# Portal do Cliente com Tradução Jurídica

> Toda movimentação processual é traduzida automaticamente para português simples no portal do cliente.
>
> **Frase de venda:** "Seu cliente nunca mais vai ligar perguntando 'e o meu processo?'"

---

## Índice

1. [Problema](#problema)
2. [Solução](#solução)
3. [Arquitetura — Tradução Assíncrona](#arquitetura--tradução-assíncrona)
4. [Modelo de Dados](#modelo-de-dados)
5. [Backend](#backend)
6. [Worker — Pipeline de Tradução](#worker--pipeline-de-tradução)
7. [Frontend — Portal do Cliente](#frontend--portal-do-cliente)
8. [Prompt de Tradução](#prompt-de-tradução)
9. [Fases de Evolução](#fases-de-evolução)
10. [Gamificação (Octalysis)](#gamificação-octalysis)

---

## Problema

**80% das ligações** de clientes para advogados são: "o que está acontecendo no meu processo?"

O portal do cliente já existe e exibe os andamentos, mas em linguagem jurídica bruta — incompreensível para leigos:

| O que o cliente vê hoje | O que o cliente entende |
|---|---|
| "Publicada conclusão para sentença" | ❓ Nada |
| "Juntada de petição — Contestação" | ❓ Nada |
| "Expedição de mandado de citação" | ❓ Nada |

O advogado perde horas por semana explicando movimentações por telefone.

---

## Solução

Toda movimentação cadastrada na timeline do processo é **automaticamente traduzida por IA** para português simples. A tradução é assíncrona — acontece no momento do cadastro, via worker. O portal do cliente sempre exibe a versão traduzida.

### Exemplos de tradução

| Movimentação jurídica | Tradução para o cliente |
|---|---|
| "Publicada conclusão para sentença" | "Seu processo já está com o juiz, que deve dar a decisão final em 30-90 dias. Nenhuma ação necessária agora." |
| "Juntada de petição — Contestação" | "A empresa apresentou a defesa dela. Seu advogado vai analisar e preparar a resposta." |
| "Designada audiência de instrução" | "Foi marcada uma audiência para ouvir testemunhas. Você precisará comparecer." |
| "Trânsito em julgado" | "A decisão do seu processo é definitiva. Não cabe mais recurso. Agora vamos para a fase de receber o que foi decidido." |
| "Expedição de mandado de citação" | "O juiz mandou notificar oficialmente a outra parte. Ela terá prazo para apresentar defesa." |
| "Deferida tutela de urgência" | "O juiz aceitou o pedido de urgência! A outra parte deve cumprir a decisão imediatamente, mesmo com o processo ainda em andamento." |

### Anatomia de uma tradução

Cada tradução gera 4 campos estruturados:

```
┌────────────────────────────────────────────────────────┐
│ 📋 Nova movimentação no seu processo                    │
│                                                        │
│ O que aconteceu:                                       │
│ "A empresa apresentou a defesa dela no processo."      │
│                                                        │
│ O que isso significa para você:                        │
│ "Seu advogado vai analisar os argumentos e preparar    │
│  uma resposta. É uma etapa normal do processo."        │
│                                                        │
│ Você precisa fazer algo?                               │
│ "Não. Seu advogado cuidará dos próximos passos."       │
│                                                        │
│ Próximo passo provável:                                │
│ "Réplica do advogado (prazo de 15 dias)"               │
└────────────────────────────────────────────────────────┘
```

---

## Arquitetura — Tradução Assíncrona

A tradução acontece **no momento do cadastro** do andamento, via fila Redis → Worker. O portal sempre lê do cache (nunca traduz on-the-fly).

```
                    ┌──────────────┐
                    │   Advogado   │
                    │ cadastra     │
                    │ andamento    │
                    └──────┬───────┘
                           │
                    POST /api/office/timeline
                           │
                    ┌──────▼───────┐
                    │   Backend    │
                    │              │
                    │ 1. Salva     │
                    │    evento    │
                    │ 2. Verifica  │
                    │    se o      │
                    │    processo  │──── Processo não tem ────→ FIM
                    │    tem       │     cliente vinculado     (sem tradução)
                    │    cliente   │
                    │ 3. Enfileira │
                    │    job       │
                    └──────┬───────┘
                           │
                     Redis LPUSH
                    "translation_queue"
                           │
                    ┌──────▼───────┐
                    │   Worker     │
                    │              │
                    │ 1. BLPOP     │
                    │ 2. LLM      │
                    │    traduz    │
                    │ 3. Salva em  │
                    │    timeline_ │
                    │    translations│
                    └──────────────┘
                           │
              ┌────────────▼────────────┐
              │    Cliente acessa       │
              │    portal — tradução    │
              │    já está pronta       │
              └─────────────────────────┘
```

### Por que assíncrona?

1. **Não bloqueia o advogado** — o POST retorna imediato, a tradução acontece em background
2. **Quando o andamento for automatizado** (monitoramento DataJud), o fluxo é idêntico: evento criado → tradução enfileirada → portal atualizado
3. **Retry fácil** — se o LLM falhar, o job volta pra fila
4. **Escala horizontal** — múltiplos workers processam traduções em paralelo
5. **Custo baixo** — textos curtos (~50-100 tokens de input, ~100-200 tokens de output)

---

## Modelo de Dados

### Nova tabela: `office_api.timeline_translations`

```sql
CREATE TABLE office_api.timeline_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timeline_event_id UUID NOT NULL UNIQUE REFERENCES office_api.timeline_events(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,             -- "A empresa apresentou a defesa dela."
    explanation TEXT NOT NULL,          -- "Seu advogado vai analisar..."
    action_required TEXT NOT NULL,      -- "Não. Seu advogado cuidará..."
    next_step TEXT,                     -- "Réplica do advogado (15 dias)"
    sentiment TEXT NOT NULL DEFAULT 'neutral',  -- 'positive', 'neutral', 'negative', 'urgent'
    process_phase TEXT,                -- Fase do processo: 'inicio', 'defesa', 'instrucao', 'sentenca', 'recurso', 'execucao', 'encerrado'
    process_phase_progress SMALLINT,   -- 0-100, progresso estimado da jornada processual
    model TEXT NOT NULL,               -- Modelo LLM utilizado (ex: 'gpt-4.1-mini')
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeline_translations_event ON office_api.timeline_translations(timeline_event_id);

-- RLS: acessível pelo dono do timeline_event OU pelo portal_client do processo
ALTER TABLE office_api.timeline_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_access" ON office_api.timeline_translations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM office_api.timeline_events te
            WHERE te.id = timeline_event_id AND te.user_id = auth.uid()
        )
    );
```

### Por que tabela separada (não coluna na `timeline_events`)?

1. **Separação de concerns** — dados jurídicos vs. dados de UX
2. **Nem todo evento precisa de tradução** — só eventos de processos com cliente vinculado
3. **Versionamento** — se o prompt mudar, é fácil re-traduzir sem tocar na timeline
4. **Não polui o módulo de timeline** existente — zero breaking changes

### Campo `sentiment` — classificação emocional

O LLM classifica o tom emocional do evento:

| Sentiment | Significado | Uso no frontend |
|---|---|---|
| `positive` | Boa notícia (sentença favorável, alvará) | Badge verde, animação de celebração |
| `neutral` | Evento processual normal | Badge neutro |
| `negative` | Notícia desfavorável (sentença improcedente) | Badge discreto, tom empático |
| `urgent` | Ação necessária do cliente (comparecer audiência) | Badge vermelho, destaque visual |

### Campo `process_phase` — mapeamento de fases

```
inicio → defesa → instrucao → sentenca → recurso → execucao → encerrado
  10%      25%       40%         55%        70%       85%        100%
```

O LLM classifica em qual fase o processo se encontra com base no tipo e conteúdo do andamento. O `process_phase_progress` é o percentual estimado de conclusão.

---

## Backend

### Módulo: `features/portal/translation/`

```
features/portal/translation/
├── __init__.py
├── service.py          # TranslationService — enfileirar, buscar
└── schemas.py          # Schemas da tradução
```

### `schemas.py`

```python
from pydantic import BaseModel

class TimelineTranslation(BaseModel):
    id: str
    timeline_event_id: str
    summary: str
    explanation: str
    action_required: str
    next_step: str | None
    sentiment: str   # positive, neutral, negative, urgent
    process_phase: str | None
    process_phase_progress: int | None

class TranslationJobPayload(BaseModel):
    timeline_event_id: str
    event_type: str
    title: str
    description: str | None
    process_type: str | None  # tipo do processo (trabalhista, previdenciário, etc.)
    process_number: str | None
```

### `service.py` — `TranslationService`

```python
import json
from src.core.config import settings

class TranslationService:

    async def enqueue_translation(self, conn, redis, timeline_event_id: str) -> bool:
        """
        Verifica se o processo do evento tem cliente vinculado.
        Se sim, enfileira job de tradução no Redis.
        """
        row = await conn.fetchone("""
            SELECT te.id, te.event_type, te.title, te.description,
                   p.type as process_type, p.process_number, p.client_id
            FROM office_api.timeline_events te
            JOIN office_api.processes p ON p.id = te.process_id
            WHERE te.id = %s
        """, (timeline_event_id,))

        if not row or not row["client_id"]:
            return False  # sem cliente vinculado, sem tradução

        payload = {
            "job_type": "translate_timeline_event",
            "timeline_event_id": str(row["id"]),
            "event_type": row["event_type"],
            "title": row["title"],
            "description": row["description"],
            "process_type": row["process_type"],
            "process_number": row["process_number"],
        }

        await redis.lpush("translation_queue", json.dumps(payload))
        return True

    async def get_translations_for_events(self, conn, event_ids: list[str]) -> dict[str, TimelineTranslation]:
        """
        Busca traduções para uma lista de timeline_event_ids.
        Retorna dict: {event_id: translation}
        """
        rows = await conn.fetchall("""
            SELECT * FROM office_api.timeline_translations
            WHERE timeline_event_id = ANY(%s)
        """, (event_ids,))

        return {str(r["timeline_event_id"]): TimelineTranslation(**r) for r in rows}
```

### Integração com `TimelineService.create_event()`

Após criar o evento, chamar `enqueue_translation`:

```python
# Em features/office/timeline/service.py → create_event()

# ... após INSERT e commit ...

# Enfileirar tradução para o portal do cliente
await translation_service.enqueue_translation(conn, redis, event_id)

return event
```

### Integração com `PortalService.get_processes()`

Enriquecer os `recent_events` com traduções:

```python
# Em features/portal/service.py → get_processes()

# Depois de buscar os timeline_events, buscar traduções
event_ids = [e["id"] for proc in processes for e in proc["recent_events"]]
translations = await translation_service.get_translations_for_events(conn, event_ids)

# Adicionar tradução em cada evento
for proc in processes:
    for event in proc["recent_events"]:
        event["translation"] = translations.get(str(event["id"]))
```

---

## Worker — Pipeline de Tradução

### Handler: `handlers/translate_timeline.py`

```python
import json

async def handle_translate_timeline_event(job: dict, llm_client, db_pool):
    """Traduz um andamento processual para português simples."""

    prompt = build_translation_prompt(
        event_type=job["event_type"],
        title=job["title"],
        description=job.get("description", ""),
        process_type=job.get("process_type", ""),
    )

    response = await llm_client.chat(
        model="gpt-4.1-mini",  # rápido e barato para textos curtos
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,  # baixa criatividade, alta consistência
    )

    translation = json.loads(response.content)

    async with db_pool.connection() as conn:
        await conn.execute("""
            INSERT INTO office_api.timeline_translations
                (timeline_event_id, summary, explanation, action_required,
                 next_step, sentiment, process_phase, process_phase_progress, model)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (timeline_event_id)
            DO UPDATE SET
                summary = EXCLUDED.summary,
                explanation = EXCLUDED.explanation,
                action_required = EXCLUDED.action_required,
                next_step = EXCLUDED.next_step,
                sentiment = EXCLUDED.sentiment,
                process_phase = EXCLUDED.process_phase,
                process_phase_progress = EXCLUDED.process_phase_progress,
                model = EXCLUDED.model
        """, (
            job["timeline_event_id"],
            translation["summary"],
            translation["explanation"],
            translation["action_required"],
            translation.get("next_step"),
            translation["sentiment"],
            translation.get("process_phase"),
            translation.get("process_phase_progress"),
            "gpt-4.1-mini",
        ))
        await conn.commit()
```

### Fila separada

Usar uma fila Redis dedicada (`translation_queue`) em vez da fila principal de IA (`ai_jobs`), para:
- Não competir com jobs pesados (CNIS, petições que demoram minutos)
- Prioridade alta — traduções devem ser processadas em segundos
- O worker pode ter um loop separado com `BLPOP` na `translation_queue` com timeout menor

---

## Frontend — Portal do Cliente

### Schema atualizado: `PortalTimelineEvent`

```typescript
interface TimelineTranslation {
  summary: string           // "A empresa apresentou a defesa dela."
  explanation: string       // "Seu advogado vai analisar..."
  action_required: string   // "Não. Seu advogado cuidará..."
  next_step: string | null  // "Réplica do advogado (15 dias)"
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent'
  process_phase: string | null
  process_phase_progress: number | null
}

interface PortalTimelineEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  event_type: string
  documents: PortalEventDocument[]
  translation: TimelineTranslation | null  // novo campo
}
```

### Componente: `TranslatedEvent`

```tsx
function TranslatedEvent({ event }: { event: PortalTimelineEvent }) {
  const { translation } = event

  // Fallback: se não tem tradução ainda, mostra o título original
  if (!translation) {
    return <EventFallback event={event} />
  }

  return (
    <div className={cn("rounded-lg border p-4", sentimentStyles[translation.sentiment])}>
      {/* Texto jurídico original — sempre visível */}
      <p className="text-xs text-muted-foreground font-mono">
        {event.title}{event.description ? ` — ${event.description}` : ''}
      </p>

      <div className="mt-3 pt-3 border-t border-border/50">
        {/* Tradução */}
        <p className="font-medium text-base">{translation.summary}</p>
        <p className="text-sm text-muted-foreground mt-2">{translation.explanation}</p>

        {translation.sentiment === 'urgent' && (
          <div className="mt-3 flex items-center gap-2 text-red-600 font-medium">
            <AlertCircle className="h-4 w-4" />
            {translation.action_required}
          </div>
        )}

        {translation.next_step && (
          <p className="text-xs text-muted-foreground mt-2">
            Próximo passo: {translation.next_step}
          </p>
        )}

        {/* Selo de marca */}
        <p className="text-xs text-muted-foreground/60 mt-3 text-right">
          Simplificado pelo Processa AI
        </p>
      </div>
    </div>
  )
}
```

### Componente: `ProcessJourney` — Barra de Progresso

```tsx
const PHASES = [
  { key: 'inicio', label: 'Início' },
  { key: 'defesa', label: 'Defesa' },
  { key: 'instrucao', label: 'Instrução' },
  { key: 'sentenca', label: 'Sentença' },
  { key: 'recurso', label: 'Recurso' },
  { key: 'execucao', label: 'Execução' },
  { key: 'encerrado', label: 'Encerrado' },
]

function ProcessJourney({ currentPhase, progress }: Props) {
  const currentIndex = PHASES.findIndex(p => p.key === currentPhase)

  return (
    <div className="flex items-center gap-1 w-full">
      {PHASES.map((phase, i) => (
        <div key={phase.key} className="flex items-center gap-1">
          <div className={cn(
            "h-3 w-3 rounded-full",
            i < currentIndex ? "bg-green-500" :
            i === currentIndex ? "bg-blue-500 animate-pulse" :
            "bg-muted"
          )} />
          {i < PHASES.length - 1 && (
            <div className={cn(
              "h-0.5 w-6",
              i < currentIndex ? "bg-green-500" : "bg-muted"
            )} />
          )}
        </div>
      ))}
    </div>
  )
}
```

---

## Prompt de Tradução

### System Prompt

```
Você é um tradutor jurídico especializado em transformar movimentações
processuais em português simples para clientes leigos.

REGRAS:
- Use linguagem clara, sem termos jurídicos
- Seja empático e tranquilizador quando possível
- Nunca dê conselho jurídico — apenas explique o que aconteceu
- "Seu advogado" (nunca cite o nome)
- Frases curtas, no máximo 2 linhas cada campo
- Se a movimentação indicar algo que o cliente precisa fazer
  (comparecer a audiência, levar documento), destaque claramente

RESPONDA em JSON com exatamente estes campos:
{
  "summary": "O que aconteceu, em uma frase simples",
  "explanation": "O que isso significa para o cliente",
  "action_required": "O que o cliente precisa fazer (ou 'Nenhuma ação necessária')",
  "next_step": "Qual o próximo passo provável do processo (ou null)",
  "sentiment": "positive | neutral | negative | urgent",
  "process_phase": "inicio | defesa | instrucao | sentenca | recurso | execucao | encerrado",
  "process_phase_progress": 0-100
}
```

### User Prompt

```
Tipo do processo: {process_type}
Tipo do evento: {event_type}
Título: {title}
Descrição: {description}

Traduza para o cliente.
```

---

## Fases de Evolução

### Fase 1 — MVP: Tradução Assíncrona (este documento)

- Tabela `timeline_translations`
- Worker traduz via fila Redis dedicada
- Portal exibe tradução + fallback para texto original
- Toggle "ver texto original"
- **Custo:** 0 créditos (incluído no plano)
- **Esforço:** Baixo

### Fase 2 — Jornada Visual do Processo

- Barra de progresso com fases (`ProcessJourney`)
- Cálculo de `process_phase` e `process_phase_progress` pelo LLM
- Estimativa de tempo restante por tipo de processo
- **Esforço:** Baixo (dados já vêm da tradução)

### Fase 3 — Notificações Empáticas

- Notificar o portal client quando novo andamento é traduzido
- Tom emocional adaptado ao `sentiment` (celebração, empatia, urgência)
- Notificação proativa de silêncio processual ("processo parado há 30 dias, isso é normal")
- E-mail com a tradução em linguagem simples
- **Esforço:** Médio

### Fase 4 — "Pergunte à IA" para Clientes

- Chat simplificado no portal onde o cliente pergunta sobre o processo
- IA responde APENAS com base nos `timeline_events` e `translations` do processo
- Nunca dá conselho jurídico — redireciona para o advogado
- **Esforço:** Médio

### Fase 5 — Integração com Monitoramento Automatizado

> Esta fase se conecta com a funcionalidade de **Monitoramento Autônomo de Processos** (item 8 do roadmap).

Quando o monitoramento DataJud detectar nova movimentação:

```
DataJud detecta movimentação
        │
        ▼
Cria timeline_event automaticamente
        │
        ▼
Enfileira tradução (mesmo fluxo deste documento)
        │
        ▼
Portal do cliente atualizado automaticamente
        │
        ▼
Cliente notificado com tradução em linguagem simples
```

O fluxo é **idêntico** ao manual — a tradução assíncrona via fila é agnóstica à origem do evento. Isso significa que a arquitetura implementada na Fase 1 já suporta o monitoramento automatizado sem alterações.

### Fase 6 — Link Público de Acompanhamento

- Advogado gera link público (ex: `processa.ai/acompanhar/{token}`)
- Página minimalista com jornada visual + última tradução
- Sem dados sensíveis — apenas fase, status e tradução
- Cliente compartilha com familiares
- Marketing viral orgânico para o Processa AI

---

## Gamificação (Octalysis)

A tradução jurídica no portal é uma base para aplicar vários **Core Drives** do Octalysis Framework de forma invisível:

### Core Drive 1 — Epic Meaning & Calling

> "Meu advogado usa tecnologia de ponta no meu caso."

- O portal traduzido posiciona o advogado como profissional diferenciado
- O cliente sente que seu caso está sendo tratado com seriedade e modernidade
- Frase no portal: *"Acompanhamento inteligente do seu processo"*

### Core Drive 2 — Development & Accomplishment

> "Meu processo está avançando!"

- **Jornada visual** com barra de progresso e fases
- Cada nova movimentação avança o progresso visualmente
- Micro-comemorações em marcos:
  - Ação distribuída → "Seu processo começou oficialmente!"
  - Audiência realizada → "Mais uma etapa concluída!"
  - Sentença favorável → "Decisão a seu favor!"
  - Trânsito em julgado → "Processo finalizado!"

### Core Drive 3 — Empowerment of Creativity & Feedback

> "Posso buscar informações quando quiser."

- "Pergunte à IA" (Fase 4) — o cliente se sente empoderado
- Toggle "ver texto original" — transparência que gera confiança
- O cliente não depende do advogado para entender o básico

### Core Drive 5 — Social Influence & Relatedness

> "Meu advogado está cuidando do meu caso."

- Termômetro de engajamento: "12 ações realizadas este mês"
- "Última ação do advogado: há 2 dias"
- Link compartilhável (Fase 6) — o cliente mostra para a família

### Core Drive 7 — Unpredictability & Curiosity

> "O que vai acontecer agora?"

- Campo `next_step` gera curiosidade sobre a próxima etapa
- Fases futuras com `?` na barra de progresso
- Estimativa de tempo restante mantém o cliente engajado

### Core Drive 8 — Loss & Avoidance

> "Não posso perder esse prazo."

- Eventos com `sentiment: urgent` destacados em vermelho
- "Você precisará comparecer" em negrito
- Notificação proativa de silêncio processual reduz ansiedade:
  *"Seu processo está em análise pelo juiz. Isso é normal — processos trabalhistas levam em média 60-90 dias nesta fase."*

### Anti-pattern: o que NÃO fazer

- Não usar linguagem de jogo (pontos, estrelas, leaderboard) no portal do **cliente**
- O cliente não é o usuário gamificado — o advogado é
- A gamificação no portal é **invisível** — o cliente só percebe clareza e profissionalismo
- Nunca banalizá o processo judicial — é a vida real do cliente

---

## Custo

| Item | Custo |
|---|---|
| Créditos para o advogado | **0** (incluído no plano como diferencial de retenção) |
| Custo de LLM por tradução | ~$0.0003 (input ~100 tokens + output ~200 tokens no GPT-4.1-mini) |
| Custo mensal estimado (100 traduções/advogado) | ~$0.03 por advogado |

O custo de LLM é negligível — textos curtos, modelo barato, sem chamadas recorrentes (cache permanente).
