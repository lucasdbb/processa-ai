# Plano: Sistema de Créditos - Processa AI

## Contexto

A plataforma Processa AI oferece funcionalidades de IA jurídica, calculadoras e gestão de escritório. Já existe infraestrutura parcial de créditos no backend (tabelas `user_credits`, `credit_transactions`, funções SQL `grant_credits_to_user`/`consume_credits`/`reset_monthly_credits`, integração Stripe com webhooks, endpoint `GET /api/v1/credits/balance`, e `credits-service.ts` no frontend).

**O que falta**: lógica de consumo integrada nas features, compra avulsa de créditos, UI de créditos, e feature gating por plano.

### Detalhes Arquiteturais Importantes

- **Autenticação**: O registro de usuários vai **direto pelo Supabase client** no frontend. **Não existe** `auth/router.py` no backend. Validações anti-fraude no registro precisam ser feitas no frontend ou via Supabase Edge Functions.
- **Calculadoras**: Arquitetura **híbrida**. A calculadora de rescisão trabalhista tem endpoint backend (`POST /calculators/trabalhista/rescisao-trabalhista`). A calculadora de aposentadoria é **100% client-side**.
- **Função `consume_credits()`**: Possui **race condition** (falta `SELECT ... FOR UPDATE`). Deve ser corrigida antes de usar em produção.

---

## 1. Modelo de Negócio Final

### 1.1 Custo por Funcionalidade (igual para todos os planos)

| Funcionalidade | Créditos | Inclui |
|---|---|---|
| Mensagem IA Chat | 1 | Resposta completa da IA |
| Análise CNIS | 5 | Processamento PDF + resultado + PDF gerado |
| Resumo de Processo | 5 | Processamento PDF + resultado + PDF gerado |
| Calculadora | 2 | Cálculo + PDF exportável |

> PDF de resultado **sempre incluso** no custo da feature. Sem cobrança separada.

### 1.2 Planos

| | Grátis | Estudante | Autônomo | Escritório |
|---|---|---|---|---|
| **Preço** | R$0/mês | R$29,90/mês | R$89,90/mês | *Em breve* |
| **Créditos/mês** | 0 (pré-pago) | 30 | 100 | — |
| **Boas-vindas** | 10 créditos | — | — | — |
| **IA Jurídica** | ✅ | ✅ | ✅ | — |
| **Calculadoras** | ✅ | ✅ | ✅ | — |
| **Painel de Gestão** | ❌ | ❌ | ✅ | — |
| **Compra extras** | ✅ | ✅ | ✅ | — |

**Regras de créditos:**
- Créditos de **assinatura** resetam todo mês (não acumulam)
- Créditos **comprados** avulsos nunca expiram
- Consumo prioriza créditos de assinatura primeiro, depois comprados
- Novos usuários recebem **10 créditos de boas-vindas** após adicionar CPF válido
- Plano Escritório aparece como "Em breve" na página de planos

**Entrega de créditos de boas-vindas:**
1. Criar conta → 0 créditos
2. **Adicionar CPF válido** → 10 créditos (tipo `purchased`, nunca expiram)

**Diferenciação sem multiplicador:** todos pagam o mesmo custo em créditos por feature. A diferença é que planos pagos incluem créditos mensais "grátis" (efetivamente R$0,00/crédito), enquanto o plano grátis precisa comprar avulso (R$0,70-0,99/crédito).

**Fluxos de mudança de plano:**
- **Upgrade (Grátis → Estudante, Estudante → Autônomo)**: Recebe créditos do novo plano imediatamente. Créditos comprados avulsos são mantidos.
- **Downgrade (Autônomo → Estudante, Estudante → Grátis)**: Efetivado no fim do período. Perde acesso ao painel de gestão (se sair do Autônomo). Créditos de assinatura resetam para o novo valor no próximo ciclo. Créditos comprados avulsos são mantidos.
- **Cancelamento**: Créditos de assinatura expiram no fim do período. Créditos comprados avulsos são mantidos indefinidamente.

**Notificações de saldo baixo:**
- Quando créditos de assinatura atingem < 20% → toast informativo
- Quando créditos totais = 0 → modal "Compre créditos" ao tentar usar feature
- Quando assinatura está próxima de renovar e saldo alto → nenhuma ação (evitar spam)

### 1.3 Pacotes de Créditos Avulsos

| Pacote | Preço | Preço/Crédito | Desconto |
|---|---|---|---|
| 10 créditos | R$9,90 | R$0,99 | — |
| 30 créditos | R$24,90 | R$0,83 | 16% |
| 100 créditos | R$74,90 | R$0,75 | 29% |

### 1.4 Simulação de Uso

**Estudante (30 créditos/mês inclusos):**
- 10 mensagens chat (10) + 2 análises CNIS (10) + 5 cálculos (10) = 30 créditos ✅

**Autônomo (100 créditos/mês inclusos):**
- 30 mensagens chat (30) + 5 CNIS (25) + 5 resumos (25) + 10 cálculos (20) = 100 créditos ✅

**Grátis (10 boas-vindas):**
- 1 análise CNIS (5) + 2 mensagens chat (2) + 1 cálculo (2) = 9 créditos. Sobra 1. Precisa comprar mais.

### 1.5 Análise de Custos Reais

| Funcionalidade | Custo Real Estimado | Créditos | Valor Cobrado (1x) | Margem |
|---|---|---|---|---|
| Mensagem IA Chat | ~R$0,05-0,25 | 1 | R$0,50-0,99 | ~2-20x |
| Análise CNIS | ~R$0,50-1,50 | 5 | R$2,50-4,95 | ~2-10x |
| Resumo de Processo | ~R$0,50-1,50 | 5 | R$2,50-4,95 | ~2-10x |
| Calculadora | ~R$0,01 | 2 | R$1,00-1,98 | ~50-200x |

---

## 1.6 Medidas Anti-Fraude e Segurança

Para prevenir abuso de créditos de boas-vindas (criação de múltiplas contas):

### Estratégias Implementadas

#### 1. **Verificação de CPF (OBRIGATÓRIO)**
- CPF é **único no sistema** (1 CPF = 1 conta)
- Validação de formato e dígitos verificadores
- Créditos de boas-vindas só liberados após CPF válido
- Culturalmente aceito no Brasil (advogados já têm CPF na OAB)

```sql
-- Constraint de unicidade
ALTER TABLE profiles ADD CONSTRAINT unique_cpf UNIQUE (cpf);
```

#### 2. **Rate Limiting por IP**
- Máximo **3 contas por IP por dia**
- Máximo **10 contas por IP por mês**
- Previne criação massiva automatizada

#### 3. **Blacklist de Emails Temporários**
- Bloquear domínios conhecidos: `guerrillamail.com`, `10minutemail.com`, `tempmail.com`, etc.
- Lista mantida e atualizada regularmente
- Referência: [disposable-email-domains](https://github.com/disposable/disposable-email-domains)

#### 4. **Captcha no Registro**
- Google reCAPTCHA v3 (invisível)
- Score-based: só mostra desafio se score < 0.5
- Previne bots automatizados

### Estratégias Futuras (Fase 2)

#### 5. **Device Fingerprinting**
- Identificar dispositivo único via `fingerprintjs`
- Limitar contas por device
- Detectar uso de múltiplos CPFs no mesmo dispositivo

#### 6. **Monitoramento e Alertas**
```python
# Flags automáticos no admin:
# - Mesmo CPF tentado em múltiplos emails → bloquear
# - Mesmo IP, 5+ contas em 1 hora → alertar admin
# - Emails muito similares (joao1@, joao2@, joao3@) → revisar
# - Créditos usados em < 5 min após registro → suspeito
# - Apenas usa boas-vindas, nunca compra → marcar para revisão
```

#### 7. **Dashboard Admin de Segurança**
- Visualizar contas criadas por IP/dia
- Lista de CPFs duplicados tentados
- Histórico de uso de créditos de boas-vindas
- Ações: bloquear IP, revogar créditos, banir conta

### Fluxo de Registro com Anti-Fraude

> **IMPORTANTE**: O registro vai direto pelo Supabase client no frontend. Não existe `auth/router.py` no backend. As validações anti-fraude no registro (reCAPTCHA, email descartável) devem ser feitas **no frontend antes de chamar `supabase.auth.signUp()`**. O rate limiting por IP pode ser feito via backend endpoint auxiliar ou Supabase Edge Function.

```
1. Usuário acessa /registro
2. Frontend: reCAPTCHA v3 valida (score > 0.5)
3. Frontend: verifica email não é temporário (lista local ou API)
4. Frontend: chama endpoint auxiliar para verificar rate limit de IP
5. Frontend: chama supabase.auth.signUp() (cria conta com 0 créditos)
6. Usuário faz login e preenche perfil com CPF
7. Frontend: chama POST /api/v1/credits/claim-welcome com CPF
8. Backend: valida CPF (formato + dígitos)
9. Backend: verifica CPF não existe no sistema
10. Backend: verifica rate limit de IP
11. Backend: salva CPF e concede 10 créditos
```

### Tabelas de Segurança

```sql
-- Rastreamento de IPs
CREATE TABLE registration_ips (
    ip_address TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_registration_ips_ip_date
ON registration_ips(ip_address, created_at);

-- Lista de emails/IPs bloqueados
CREATE TABLE blocked_entities (
    entity_type TEXT, -- 'email', 'ip', 'cpf'
    entity_value TEXT,
    reason TEXT,
    blocked_at TIMESTAMP DEFAULT NOW(),
    blocked_by UUID, -- admin user
    PRIMARY KEY (entity_type, entity_value)
);
```

---

## 2. Implementação Técnica

### O Que Já Existe (infraestrutura pronta)

- ✅ Tabela `user_credits` (subscription_credits, subscription_used, purchased_credits, purchased_used, computed columns)
- ✅ Tabela `credit_transactions` (amount, transaction_type, credit_type, reason, metadata)
- ✅ Funções SQL: `grant_credits_to_user()`, `consume_credits()`, `reset_monthly_credits()`
- ✅ `billing_plans` com campo `monthly_credits`
- ✅ Integração Stripe (checkout, portal, webhooks com idempotência)
- ✅ Webhook handlers para grant/reset de créditos na renovação
- ✅ Endpoint `GET /api/v1/credits/balance`
- ✅ Frontend `credits-service.ts` com `getCredits()`

---

### Fase 1: Migração SQL + Configuração

**Arquivo novo**: `apps/backend/migrations/versions/xxx_credit_costs_and_packages.py`

Alterações no banco:
```sql
-- ============================================
-- 1. Tabela de custos por feature
-- ============================================
CREATE TABLE credit_costs (
    feature_key TEXT PRIMARY KEY,       -- 'ai_chat', 'cnis_analysis', 'process_summary', 'calculator_rescisao', 'calculator_aposentadoria'
    display_name TEXT NOT NULL,
    base_cost INTEGER NOT NULL,          -- custo em créditos
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO credit_costs VALUES
    ('ai_chat', 'Mensagem IA Chat', 1, 'Uma mensagem no chat jurídico', true),
    ('cnis_analysis', 'Análise CNIS', 5, 'Análise completa de CNIS com PDF', true),
    ('process_summary', 'Resumo de Processo', 5, 'Resumo de processo com PDF', true),
    ('calculator_rescisao', 'Calculadora Rescisão', 2, 'Cálculo rescisão trabalhista com PDF', true),
    ('calculator_aposentadoria', 'Calculadora Aposentadoria', 2, 'Simulação de aposentadoria com PDF', true);

ALTER TABLE credit_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read credit_costs" ON credit_costs FOR SELECT USING (true);

-- ============================================
-- 2. Tabela de pacotes de créditos
-- ============================================
CREATE TABLE credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,        -- preço em centavos (990 = R$9,90)
    stripe_price_id TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0
);

INSERT INTO credit_packages (name, credits, price_cents, sort_order) VALUES
    ('10 Créditos', 10, 990, 1),
    ('30 Créditos', 30, 2490, 2),
    ('100 Créditos', 100, 7490, 3);

ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read credit_packages" ON credit_packages FOR SELECT USING (true);

-- ============================================
-- 3. Adicionar CPF à tabela profiles (anti-fraude)
-- ============================================
ALTER TABLE profiles ADD COLUMN cpf TEXT;
ALTER TABLE profiles ADD COLUMN welcome_credits_claimed BOOLEAN DEFAULT false;

-- Partial unique index: permite múltiplos NULLs mas impede CPFs duplicados
CREATE UNIQUE INDEX idx_profiles_cpf ON profiles(cpf) WHERE cpf IS NOT NULL;

-- ============================================
-- 4. Tabelas de segurança e anti-fraude
-- ============================================
CREATE TABLE registration_ips (
    ip_address TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_registration_ips_ip_date ON registration_ips(ip_address, created_at);

CREATE TABLE blocked_entities (
    entity_type TEXT NOT NULL,    -- 'email_domain', 'ip', 'cpf'
    entity_value TEXT NOT NULL,
    reason TEXT,
    blocked_at TIMESTAMP DEFAULT NOW(),
    blocked_by UUID,             -- admin user
    PRIMARY KEY (entity_type, entity_value)
);

-- ============================================
-- 5. CORREÇÃO CRÍTICA: race condition em consume_credits
-- ============================================
-- A função existente faz SELECT + UPDATE sem lock.
-- Adicionar FOR UPDATE para prevenir consumo duplo.

CREATE OR REPLACE FUNCTION public.consume_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_reason TEXT DEFAULT 'usage'
) RETURNS boolean AS $$
DECLARE
    v_subscription_available INTEGER;
    v_purchased_available INTEGER;
    v_from_subscription INTEGER;
    v_from_purchased INTEGER;
BEGIN
    -- FOR UPDATE: trava a row até o fim da transação
    SELECT subscription_available, purchased_available
    INTO v_subscription_available, v_purchased_available
    FROM public.user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Verifica saldo total
    IF COALESCE(v_subscription_available, 0) +
       COALESCE(v_purchased_available, 0) < p_amount THEN
        RETURN false;
    END IF;

    -- Prioriza créditos de assinatura
    v_from_subscription := LEAST(COALESCE(v_subscription_available, 0), p_amount);
    v_from_purchased := p_amount - v_from_subscription;

    -- Debita créditos
    UPDATE public.user_credits
    SET subscription_used = subscription_used + v_from_subscription,
        purchased_used = purchased_used + v_from_purchased,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Log de transações
    IF v_from_subscription > 0 THEN
        INSERT INTO public.credit_transactions
            (user_id, amount, transaction_type, credit_type, reason)
        VALUES
            (p_user_id, -v_from_subscription, 'consume', 'subscription', p_reason);
    END IF;

    IF v_from_purchased > 0 THEN
        INSERT INTO public.credit_transactions
            (user_id, amount, transaction_type, credit_type, reason)
        VALUES
            (p_user_id, -v_from_purchased, 'consume', 'purchased', p_reason);
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### Fase 2: Backend — Serviço de Consumo de Créditos

**Arquivo**: `apps/backend/src/features/billing/credits/schemas.py`

Adicionar:
```python
class CreditCheckResponse(BaseModel):
    has_credits: bool
    cost: int
    available: int

class ConsumeCreditsResponse(BaseModel):
    success: bool
    credits_consumed: int
    remaining: int

class FeatureCostItem(BaseModel):
    feature_key: str
    display_name: str
    cost: int
    description: str

class CreditPackage(BaseModel):
    id: str
    name: str
    credits: int
    price_cents: int

class PurchaseCheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str

class CreditTransaction(BaseModel):
    id: str
    amount: int
    transaction_type: str   # grant, consume, refund, reset
    credit_type: str        # subscription, purchased
    reason: str
    created_at: str

class CreditHistoryResponse(BaseModel):
    transactions: list[CreditTransaction]
    total: int
    page: int
    page_size: int
```

**Arquivo**: `apps/backend/src/features/billing/credits/service.py`

Adicionar métodos ao `CreditsService`:
```python
async def get_feature_cost(feature_key: str) -> int:
    """Busca custo base de credit_costs pelo feature_key."""

async def check_credits(user_id: str, feature_key: str) -> CreditCheckResponse:
    """Verifica se user tem créditos suficientes. Retorna has_credits, cost, available."""

async def consume_credits(user_id: str, feature_key: str) -> ConsumeCreditsResponse:
    """1. Busca base_cost da feature
       2. Chama SQL consume_credits(user_id, cost, reason=feature_key)
       3. Retorna success + remaining"""

async def refund_credits(user_id: str, amount: int, reason: str):
    """Devolve créditos em caso de falha no processamento.
       Chama grant_credits_to_user com tipo 'purchased'."""

async def get_all_feature_costs() -> list[FeatureCostItem]:
    """Lista todas as features e seus custos."""

async def get_packages() -> list[CreditPackage]:
    """Lista pacotes de créditos ativos."""

async def create_purchase_checkout(user_id: str, package_id: str, redirect_urls) -> PurchaseCheckoutResponse:
    """Cria Stripe checkout session modo 'payment' para compra de créditos.
       Metadata: {user_id, package_id, credits}."""

async def grant_welcome_credits(user_id: str, cpf: str):
    """Concede 10 créditos de boas-vindas após validar CPF.
       1. Valida formato do CPF
       2. Verifica se CPF já não foi usado
       3. Salva CPF no perfil
       4. Concede 10 créditos (tipo 'purchased')
       5. Registra IP do usuário"""

async def validate_cpf(cpf: str) -> bool:
    """Valida formato e dígitos verificadores do CPF."""

async def check_ip_rate_limit(ip: str) -> bool:
    """Verifica se IP não excedeu limite de criação de contas."""
```

**Arquivo**: `apps/backend/src/features/billing/credits/router.py`

Adicionar endpoints:
```python
GET  /api/v1/credits/balance             # (já existe) Saldo atual
GET  /api/v1/credits/check/{feature_key} # Verificar créditos suficientes
GET  /api/v1/credits/costs               # Listar custos das features
GET  /api/v1/credits/packages            # Listar pacotes de créditos
GET  /api/v1/credits/history             # Histórico de transações (paginado)
POST /api/v1/credits/purchase            # Criar checkout Stripe para compra avulsa
POST /api/v1/credits/claim-welcome       # Reivindicar boas-vindas (body: {cpf})
```

> **IMPORTANTE**: NÃO expor endpoint público `POST /credits/consume`. O consumo de créditos deve acontecer **internamente nos services** das features (IA, calculadoras). Expor um endpoint de consumo permite que qualquer chamada API debite créditos arbitrariamente.

---

### Fase 3: Backend — Integração com Features

#### 3a. Integração com IA

**Arquivo**: `apps/backend/src/features/ai/service.py`

Em cada método de análise (CNIS, Process Summary, Chat):
```python
# ANTES de criar o job:
result = await credits_service.consume_credits(user_id, 'cnis_analysis')
if not result.success:
    raise HTTPException(402, "Créditos insuficientes")

# Se job falhar:
try:
    # ... processar job
except Exception:
    await credits_service.refund_credits(user_id, cost, f"refund_{feature_key}")
    raise
```

**Arquivo**: `apps/backend/src/features/ai/router.py`
- Injetar `CreditsService` como dependência

#### 3b. Integração com Calculadoras (ATENÇÃO: arquitetura híbrida)

> A calculadora de **rescisão trabalhista** tem endpoint backend (`POST /calculators/trabalhista/rescisao-trabalhista`).
> A calculadora de **aposentadoria** é **100% client-side** (sem backend).

**Calculadora de Rescisão** (já tem backend):

**Arquivo**: `apps/backend/src/features/calculators/service.py`
```python
# Adicionar consumo ANTES de calcular:
result = await credits_service.consume_credits(user_id, 'calculator_rescisao')
if not result.success:
    raise HTTPException(402, "Créditos insuficientes")
# ... continuar com cálculo + PDF
```

**Arquivo**: `apps/backend/src/features/calculators/router.py`
- Injetar `CreditsService` como dependência

**Calculadora de Aposentadoria** (precisa de novo endpoint):

Como o cálculo é 100% client-side, há duas abordagens:

**Opção A (RECOMENDADA): Criar endpoint backend para aposentadoria**
```python
# apps/backend/src/features/calculators/router.py
@router.post("/previdencia/aposentadoria")
async def calcular_aposentadoria(data: AposentadoriaRequest, user_id: str):
    # 1. Consumir créditos
    result = await credits_service.consume_credits(user_id, 'calculator_aposentadoria')
    if not result.success:
        raise HTTPException(402, "Créditos insuficientes")
    # 2. Calcular (mover lógica do frontend para cá)
    # 3. Gerar PDF
    # 4. Retornar resultado
```

Benefícios: lógica centralizada, consumo atômico, PDF server-side, audit trail completo.

**Opção B: Manter client-side com endpoint de consumo dedicado**
```python
# Endpoint que APENAS debita créditos (sem cálculo)
@router.post("/previdencia/consume-and-validate")
async def consume_calculator_credits(user_id: str):
    result = await credits_service.consume_credits(user_id, 'calculator_aposentadoria')
    if not result.success:
        raise HTTPException(402, "Créditos insuficientes")
    return {"success": True, "token": generate_usage_token()}
    # Frontend só mostra resultado se receber token válido
```

Desvantagem: usuário pode manipular o frontend para pular a validação. Menos seguro.

---

### Fase 4: Backend — Compra Avulsa + Boas-Vindas

**Arquivo**: `apps/backend/src/features/billing/webhooks/service.py`

Adicionar handler para compra de créditos:
```python
# No handler de checkout.session.completed:
if session.mode == 'payment':
    # Compra avulsa de créditos
    metadata = session.metadata  # {user_id, package_id, credits}
    await grant_credits_to_user(user_id, credits, 'credit_purchase', 'purchased')
```

**Boas-vindas com validação de CPF**:

Implementar endpoint `POST /api/v1/credits/claim-welcome`:
```python
async def claim_welcome_credits(user_id: str, cpf: str, ip: str):
    # 1. Verificar se usuário já reivindicou boas-vindas
    if already_claimed(user_id):
        raise HTTPException(400, "Créditos já reivindicados")

    # 2. Validar CPF (formato + dígitos)
    if not validate_cpf(cpf):
        raise HTTPException(400, "CPF inválido")

    # 3. Verificar se CPF já existe no sistema
    if cpf_exists(cpf):
        raise HTTPException(409, "CPF já cadastrado")

    # 4. Verificar rate limit de IP (3 contas/dia)
    if not check_ip_rate_limit(ip):
        raise HTTPException(429, "Limite de contas atingido para este IP")

    # 5. Salvar CPF no perfil
    update_profile(user_id, cpf=cpf)

    # 6. Registrar IP
    log_registration_ip(ip, user_id)

    # 7. Conceder 10 créditos
    grant_credits_to_user(user_id, 10, 'welcome_bonus', 'purchased')

    return {"success": True, "credits_granted": 10}
```

---

### Fase 5: Backend — Segurança e Anti-Fraude

**Arquivo**: `apps/backend/src/core/security.py` (novo)

Implementar utilitários de segurança:
```python
import re
from datetime import datetime

def validate_cpf(cpf: str) -> bool:
    """Valida CPF brasileiro (formato + dígitos verificadores)."""
    cpf = re.sub(r'[^0-9]', '', cpf)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False

    for i in range(9, 11):
        value = sum((int(cpf[num]) * ((i+1) - num) for num in range(0, i)))
        digit = ((value * 10) % 11) % 10
        if digit != int(cpf[i]):
            return False
    return True

async def check_ip_rate_limit(supabase, ip: str, max_per_day: int = 3) -> bool:
    """Verifica limite de contas por IP por dia."""
    result = supabase.table('registration_ips') \
        .select('id', count='exact') \
        .eq('ip_address', ip) \
        .gte('created_at', datetime.now().date().isoformat()) \
        .execute()
    return result.count < max_per_day

def is_disposable_email(email: str) -> bool:
    """Verifica se email é temporário/descartável."""
    domain = email.split('@')[1].lower()
    return domain in DISPOSABLE_DOMAINS

async def verify_recaptcha(token: str, secret_key: str) -> bool:
    """Verifica token reCAPTCHA v3 com Google API."""
    import httpx
    response = await httpx.AsyncClient().post(
        'https://www.google.com/recaptcha/api/siteverify',
        data={'secret': secret_key, 'response': token}
    )
    data = response.json()
    return data.get('success', False) and data.get('score', 0) >= 0.5

# Carregar de arquivo: disposable_domains.txt (um domínio por linha)
DISPOSABLE_DOMAINS = {
    'guerrillamail.com', '10minutemail.com', 'tempmail.com',
    'mailinator.com', 'throwaway.email', 'sharklasers.com',
    'yopmail.com', 'trashmail.com', 'fakeinbox.com',
    # ... expandir com lista completa de ~2000 domínios
    # Referência: https://github.com/disposable/disposable-email-domains
}
```

> **NOTA**: Não existe `auth/router.py` no backend. O registro vai direto pelo Supabase client no frontend. Validações anti-fraude no registro devem ser feitas:
> - **Email descartável e reCAPTCHA**: no **frontend** antes de `supabase.auth.signUp()`
> - **Rate limiting por IP**: endpoint auxiliar `GET /api/v1/security/check-registration` (opcional) ou validação no `claim-welcome`
> - **Validação de CPF e IP**: no endpoint `POST /api/v1/credits/claim-welcome` (já implementado na Fase 4)

**Endpoint auxiliar** (opcional): `apps/backend/src/features/billing/credits/router.py`
```python
@router.get("/security/check-registration")
async def check_registration(request: Request):
    """Frontend chama antes do registro para validar IP e email."""
    ip = request.client.host
    can_register = await check_ip_rate_limit(supabase, ip)
    return {"allowed": can_register}
```

**Variáveis de ambiente** (`.env`):
```
RECAPTCHA_SECRET_KEY=your_secret_key
RECAPTCHA_SITE_KEY=your_site_key
```

---

### Fase 6: Frontend — Store e Serviço

**Novo arquivo**: `apps/frontend/src/stores/credits-store.ts`
```typescript
// Zustand store
interface CreditsState {
  credits: UserCredits | null
  costs: FeatureCost[]
  packages: CreditPackage[]
  isLoading: boolean
  fetchCredits: () => Promise<void>
  fetchCosts: () => Promise<void>
  fetchPackages: () => Promise<void>
}
```

**Arquivo**: `apps/frontend/src/services/credits-service.ts`

Adicionar métodos:
```typescript
checkCredits(featureKey: string): Promise<CreditCheckResponse>
consumeCredits(featureKey: string): Promise<ConsumeCreditsResponse>
getFeatureCosts(): Promise<FeatureCostItem[]>
getPackages(): Promise<CreditPackage[]>
purchaseCredits(packageId: string): Promise<{checkout_url: string}>
claimWelcomeCredits(cpf: string): Promise<{success: boolean, credits_granted: number}>
```

---

### Fase 7: Frontend — Onboarding e Reivindicação de Boas-Vindas

**Novo arquivo**: `apps/frontend/src/components/onboarding/WelcomeCreditsModal.tsx`
```tsx
// Modal exibido para novos usuários sem CPF cadastrado
// Aparece automaticamente após login se welcome_credits_claimed === false

interface Props {
  onComplete: () => void
}

export function WelcomeCreditsModal({ onComplete }: Props) {
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await creditsService.claimWelcomeCredits(cpf)
      toast.success('10 créditos adicionados! Experimente a plataforma.')
      onComplete()
    } catch (error) {
      if (error.status === 409) {
        toast.error('CPF já cadastrado em outra conta')
      } else if (error.status === 429) {
        toast.error('Limite de contas atingido. Tente novamente amanhã.')
      } else {
        toast.error('CPF inválido')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open>
      <DialogContent>
        <h2>Ganhe 10 créditos grátis!</h2>
        <p>Para começar a usar a plataforma, adicione seu CPF.</p>
        <Input
          placeholder="000.000.000-00"
          mask="999.999.999-99"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
        />
        <Button onClick={handleSubmit} loading={loading}>
          Resgatar créditos
        </Button>
      </DialogContent>
    </Dialog>
  )
}
```

**Arquivo**: `apps/frontend/src/pages/app/dashboard.tsx` ou layout

Adicionar lógica para exibir modal:
```tsx
const { user } = useUser()
const { credits } = useCredits()
const [showWelcomeModal, setShowWelcomeModal] = useState(false)

useEffect(() => {
  // Mostrar modal se: usuário nunca reivindicou boas-vindas
  // Usa flag dedicada (não depende do saldo, que pode ser 0 após uso legítimo)
  if (user && !user.welcome_credits_claimed) {
    setShowWelcomeModal(true)
  }
}, [user])

return (
  <>
    {showWelcomeModal && (
      <WelcomeCreditsModal onComplete={() => {
        setShowWelcomeModal(false)
        // Refresh credits
      }} />
    )}
    {/* resto do dashboard */}
  </>
)
```

**Arquivo**: `apps/frontend/src/pages/register.tsx` (opcional)

Adicionar reCAPTCHA v3:
```tsx
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'

const { executeRecaptcha } = useGoogleReCaptcha()

const handleRegister = async (data) => {
  const token = await executeRecaptcha('register')
  await authService.register({ ...data, recaptcha_token: token })
}
```

---

### Fase 8: Frontend — UI de Créditos

**Novo arquivo**: `apps/frontend/src/components/layout/CreditBalance.tsx`
- Widget no sidebar/header do AppLayout
- Ícone de moeda + número de créditos disponíveis
- Tooltip: breakdown assinatura vs comprados
- Botão "Comprar créditos" → abre modal/página

**Arquivo afetado**: Layout do app (sidebar) — incluir CreditBalance

**Novo arquivo**: `apps/frontend/src/pages/app/creditos/index.tsx` (ou modal)
- Lista de pacotes de créditos com preço e desconto
- Botão "Comprar" → Stripe checkout (mode=payment)
- Saldo atual exibido no topo

---

### Fase 9: Frontend — Indicadores nas Features

**Arquivo**: `apps/frontend/src/pages/app/ia/index.tsx`
- Badge "X créditos" no botão de enviar/analisar
- Antes de submeter: verificar créditos (check endpoint)
- Se insuficiente: modal "Créditos insuficientes" com link para comprar
- Após uso: atualizar saldo no store

**Arquivo**: `apps/frontend/src/pages/app/calculadoras/` (arquivos de calculadora)
- Badge "2 créditos" no botão calcular
- Mesma lógica de check/consume

---

### Fase 10: Frontend — Atualizar Planos

**Arquivo**: `apps/frontend/src/pages/planos.tsx`
- Atualizar cards dos 3 planos + Escritório (em breve)
- Exibir créditos mensais em cada plano
- Tabela comparativa: features + créditos
- Highlight Autônomo como popular
- Incluir seção "Compre créditos avulsos" abaixo dos planos

---

### Fase 11: Feature Gating (Controle de Acesso)

**Backend**: `apps/backend/src/core/middleware.py` ou dependência nova
```python
# Verificar plano do usuário para rotas do office (gestão)
# Grátis e Estudante → HTTP 403 nas rotas /api/v1/office/*
# Autônomo → acesso total
```

**Frontend**: `apps/frontend/src/router.tsx`
- Rotas /app/clientes, /app/processos, /app/servicos, etc.
- Verificar plano do usuário via subscription store
- Se não autorizado → tela de upgrade com link para planos

---

### Fase 12: Configurações

**Arquivo**: `apps/frontend/src/pages/app/configuracoes/index.tsx`
- Seção "Créditos": saldo atual, breakdown
- Link para comprar créditos
- Link para histórico de uso (futuramente)

---

## 3. Arquivos Críticos

### Backend — Modificar
| Arquivo | Alteração |
|---|---|
| `apps/backend/src/features/billing/credits/service.py` | Consumo interno, check, refund, compra, boas-vindas, CPF |
| `apps/backend/src/features/billing/credits/router.py` | 6 novos endpoints (sem consume público) |
| `apps/backend/src/features/billing/credits/schemas.py` | Novos schemas |
| `apps/backend/src/features/billing/webhooks/service.py` | Handler compra avulsa |
| `apps/backend/src/features/ai/service.py` | Consumo de créditos internamente |
| `apps/backend/src/features/ai/router.py` | Injetar CreditsService |
| `apps/backend/src/features/calculators/service.py` | Consumo de créditos (rescisão) |
| `apps/backend/src/features/calculators/router.py` | Injetar CreditsService + novo endpoint aposentadoria |
| `apps/backend/src/core/middleware.py` | Feature gating por plano |

### Backend — Criar
| Arquivo | Descrição |
|---|---|
| `apps/backend/migrations/versions/xxx_credit_costs_and_packages.py` | Migração SQL (créditos + CPF + segurança + fix consume_credits) |
| `apps/backend/src/core/security.py` | Utilitários de segurança (CPF, rate limit, reCAPTCHA, email) |

### Frontend — Modificar
| Arquivo | Alteração |
|---|---|
| `apps/frontend/src/services/credits-service.ts` | Novos métodos API |
| `apps/frontend/src/features/auth/hooks/use-auth.ts` | Validações anti-fraude antes de signUp |
| `apps/frontend/src/features/auth/types/index.ts` | Adicionar `cpf` e `welcome_credits_claimed` ao User |
| `apps/frontend/src/pages/planos.tsx` | Atualizar planos + créditos |
| `apps/frontend/src/pages/app/ia/index.tsx` | Indicadores de crédito |
| `apps/frontend/src/pages/app/calculadoras/` | Migrar aposentadoria para backend + indicadores |
| `apps/frontend/src/pages/app/configuracoes/index.tsx` | Seção créditos + histórico |
| `apps/frontend/src/router.tsx` | Feature gating por plano |
| Layout do app (sidebar/header) | Incluir CreditBalance |

### Frontend — Criar
| Arquivo | Descrição |
|---|---|
| `apps/frontend/src/stores/credits-store.ts` | Zustand store de créditos |
| `apps/frontend/src/components/layout/CreditBalance.tsx` | Widget de saldo |
| `apps/frontend/src/components/onboarding/WelcomeCreditsModal.tsx` | Modal de boas-vindas com CPF |
| `apps/frontend/src/pages/app/creditos/index.tsx` | Página de compra |

---

## 4. Ordem de Implementação

### Fase 1: Banco de Dados
1. Migração SQL: tabelas `credit_costs`, `credit_packages`, campo `cpf` e `welcome_credits_claimed` em profiles
2. Migração SQL: tabelas de segurança `registration_ips`, `blocked_entities`
3. Migração SQL: **FIX `consume_credits()`** com `FOR UPDATE` (correção de race condition)
4. Migração SQL: RLS policies para novas tabelas

### Fase 2: Backend — Segurança
5. Criar `apps/backend/src/core/security.py` (validate_cpf, check_ip_rate_limit, is_disposable_email, verify_recaptcha)

### Fase 3: Backend — Créditos Core
6. Schemas de créditos (CreditCheckResponse, ConsumeCreditsResponse, FeatureCost, CreditPackage, etc.)
7. Service: `get_feature_cost`, `check_credits`, `consume_credits`, `refund_credits`
8. Service: `get_all_feature_costs`, `get_packages`, `get_transaction_history`
9. Service: `create_purchase_checkout`, `grant_welcome_credits` (com validação CPF)
10. Router: endpoints GET balance, check, costs, packages, history + POST purchase, claim-welcome

### Fase 4: Backend — Integração Features
11. Integrar consumo na feature de IA (chat, CNIS, process summary)
12. Integrar consumo na calculadora de rescisão trabalhista (já tem backend)
13. Criar endpoint backend para calculadora de aposentadoria (migrar lógica client-side)
14. Handler de compra avulsa no webhook Stripe (checkout.session.completed mode=payment)

### Fase 5: Backend — Controle de Acesso
15. Feature gating por plano (middleware para rotas /api/v1/office/*)

### Fase 6: Frontend — Core
16. Adicionar `cpf` e `welcome_credits_claimed` ao tipo User
17. Novos métodos em credits-service.ts (check, costs, packages, history, purchase, claimWelcome)
18. Credits store (Zustand): saldo, custos, pacotes
19. WelcomeCreditsModal (onboarding com CPF)

### Fase 7: Frontend — UI de Créditos
20. CreditBalance widget (sidebar/header)
21. Indicadores de crédito na IA ("1 crédito" no botão, modal insuficiente)
22. Indicadores de crédito nas calculadoras
23. Página/modal de compra de créditos (pacotes + Stripe checkout)

### Fase 8: Frontend — Planos e Acesso
24. Atualizar página de planos (3 planos + Escritório em breve + seção créditos avulsos)
25. Feature gating no router (rotas office → upgrade page)
26. Seção créditos nas configurações (saldo + histórico)

### Fase 9: Frontend — Anti-Fraude (opcional)
27. Validação de email descartável no registro (lista local)
28. reCAPTCHA v3 no formulário de registro
29. Endpoint auxiliar de verificação de IP antes do registro

---

## 5. Verificação e Testes

### Testes Unitários
- `cd apps/backend && uv run pytest` — testes de serviços, validações, regras de negócio

### Fluxos de Créditos
1. **Boas-vindas com CPF**:
   - Novo usuário → 0 créditos, `welcome_credits_claimed = false`
   - Adicionar CPF válido via claim-welcome → 10 créditos, `welcome_credits_claimed = true`
   - Tentar claim-welcome novamente → erro "já reivindicado" (flag `welcome_credits_claimed`)
   - Tentar CPF duplicado → erro 409 "CPF já cadastrado"
   - Gastar todos os créditos → modal NÃO reaparece (usa flag, não saldo)

2. **Consumo de créditos (interno, sem endpoint público)**:
   - Usar IA Chat → service consome 1 crédito internamente
   - Análise CNIS → service consome 5 créditos internamente
   - Calculadora Rescisão → service consome 2 créditos internamente
   - Calculadora Aposentadoria → novo endpoint backend consome 2 créditos
   - Usar sem créditos → HTTP 402 + mensagem clara + link para comprar
   - Falha no processamento → refund automático dos créditos consumidos

3. **Compra e assinatura**:
   - Comprar pacote → Stripe checkout (mode=payment) → webhook → créditos purchased adicionados
   - Assinar Estudante → 30 créditos subscription concedidos
   - Renovação mensal (invoice.paid) → reset subscription + 30 novos créditos
   - Créditos purchased NÃO resetam na renovação

4. **Upgrade/Downgrade**:
   - Upgrade Grátis → Estudante → créditos do novo plano imediatos
   - Downgrade Autônomo → Estudante → efetivado no fim do período
   - Cancelamento → créditos subscription expiram, purchased mantidos

5. **Feature gating**:
   - Acessar painel gestão sem Autônomo → HTTP 403 + redirect upgrade
   - Widget de saldo atualiza em tempo real após uso
   - Saldo baixo (< 20%) → toast informativo

6. **Histórico de transações**:
   - GET /credits/history retorna transações paginadas
   - Cada consumo/compra/grant aparece no histórico
   - Filtro por tipo (consume, grant, refund, reset)

### Testes de Segurança (Anti-Fraude)

7. **Validação de CPF**:
   - CPF inválido (formato errado) → erro
   - CPF inválido (dígitos verificadores) → erro
   - CPF com todos dígitos iguais (111.111.111-11) → erro
   - CPF válido → aceito

8. **Rate limiting**:
   - Claim-welcome de 3 IPs diferentes no mesmo dia → OK
   - Tentar 4º claim-welcome do mesmo IP → HTTP 429 "Limite atingido"
   - No dia seguinte → permitir novamente

9. **Email descartável** (frontend):
   - Registrar com `test@guerrillamail.com` → bloqueado antes de signUp
   - Registrar com `test@gmail.com` → permitido

10. **reCAPTCHA** (se implementado):
    - Score < 0.5 → mostrar desafio
    - Score > 0.5 → registro direto

### Teste de Concorrência (CRÍTICO)
11. **Stress test com `FOR UPDATE` fix**:
    - 100 requisições simultâneas consumindo créditos do mesmo usuário
    - Verificar que `FOR UPDATE` previne consumo duplo
    - Validar integridade: soma(transações) == saldo final
    - Sem o fix, créditos ficam negativos (bug de race condition)
