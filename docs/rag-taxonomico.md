# RAG Taxonômico — Estratégia de Busca Vetorial para Direito Brasileiro

## Visão Geral

O Processa AI utiliza uma estratégia de **RAG (Retrieval-Augmented Generation) Taxonômico** para fundamentar as respostas do chat jurídico e dos agentes de IA em legislação brasileira real. Em vez de depender exclusivamente do conhecimento geral do modelo de linguagem — que pode alucinar artigos, números de lei ou jurisprudência inexistente — o sistema recupera trechos de legislação verificada de uma base de conhecimento própria e os injeta no contexto da conversa.

O termo "taxonômico" reflete a organização hierárquica da base: a legislação é classificada por **área do direito** (trabalhista, civil, penal, etc.) e **tópicos** dentro de cada área, permitindo buscas filtradas e mais precisas.

---

## Por que RAG em vez de Fine-Tuning?

| Aspecto | Fine-Tuning | RAG |
|---|---|---|
| **Atualização** | Requer retreinar o modelo a cada mudança legislativa | Basta inserir/atualizar documentos na base |
| **Rastreabilidade** | Impossível saber de onde veio uma citação | Cada resposta vem com as fontes exatas usadas |
| **Custo** | Alto (GPU, tempo de treino, versionamento de modelos) | Baixo (apenas armazenamento e embeddings) |
| **Alucinação** | Reduz mas não elimina | O modelo recebe o texto real, cita o que viu |
| **Escopo** | Fixo após treino | Expansível a qualquer momento (upload de novos PDFs) |

No contexto jurídico, a rastreabilidade é especialmente crítica. Um advogado precisa saber se o "Art. 477 da CLT" citado pelo assistente realmente existe e diz o que foi apresentado. O RAG resolve isso: o artigo exibido na resposta veio literalmente da base de conhecimento, e o usuário pode verificar a fonte.

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    ADMINISTRAÇÃO                        │
│  (Painel Admin → Base de Conhecimento)                  │
│                                                         │
│  Upload PDF ──→ Supabase Storage ──→ Job Redis          │
│  Texto puro ──→ direto                ↓                 │
│  URL        ──→ download           Worker               │
│                                       │                 │
│                              ┌────────┴────────┐       │
│                              │  Pipeline RAG   │       │
│                              │  1. Extrair     │       │
│                              │  2. Classificar │       │
│                              │  3. Chunking    │       │
│                              │  4. Enriquecer  │       │
│                              │  5. Embeddings  │       │
│                              │  6. INSERT      │       │
│                              │  7. Done        │       │
│                              └────────┬────────┘       │
│                                       ↓                 │
│                              ┌────────────────┐        │
│                              │   PostgreSQL    │        │
│                              │   + pgvector    │        │
│                              │                 │        │
│                              │  rag_chunks     │        │
│                              │  (texto +       │        │
│                              │   2x embedding  │        │
│                              │   768 dims)     │        │
│                              └───────┬─────────┘        │
│                                      │                  │
│                    ┌─────────────────┼──────────────┐   │
│                    ↓                 ↓              │   │
│              ┌──────────┐    ┌──────────────┐      │   │
│              │  Backend  │    │   Worker     │      │   │
│              │  (Chat)   │    │  (Agentes)   │      │   │
│              └─────┬─────┘    └──────┬───────┘      │   │
│                    ↓                 ↓              │   │
│              Chat Jurídico     Reclamação Trab.     │   │
│              via SSE stream    Scanner de Peça      │   │
│                                CNIS, etc.           │   │
└─────────────────────────────────────────────────────┘
```

### Componentes Principais

1. **Base de Conhecimento (Admin)** — Interface para gestão de documentos com progress bar em tempo real
2. **Pipeline de Ingestão (Worker)** — Processa documentos em 7 etapas: extração → classificação LLM → chunking → enriquecimento LLM → dual embedding → persistência
3. **Busca Vetorial Dual (pgvector)** — Recupera trechos por similaridade usando dois embeddings por chunk (conteúdo original + resumo em linguagem moderna)
4. **Integração no Chat** — Injeta contexto no prompt do modelo com fontes verificáveis
5. **Integração nos Agentes** — Enriquece prompts de ferramentas de IA

---

## Taxonomia Jurídica

A base de conhecimento é organizada em uma hierarquia de dois níveis:

### Áreas do Direito

Cada documento e chunk é classificado em uma **área jurídica**. As áreas pré-cadastradas são:

| Área | Slug | Exemplos de Legislação |
|---|---|---|
| Direito Trabalhista | `trabalhista` | CLT, Súmulas do TST |
| Direito Previdenciário | `previdenciario` | Lei 8.213/91, Decreto 3.048/99 |
| Direito Civil | `civil` | Código Civil, Lei do Inquilinato |
| Direito Processual Civil | `processual-civil` | CPC/2015 |
| Direito do Consumidor | `consumidor` | CDC (Lei 8.078/90) |
| Direito Constitucional | `constitucional` | CF/88 |
| Direito Penal | `penal` | Código Penal, LEP |
| Direito Administrativo | `administrativo` | Lei 8.666/93, Lei 14.133/21 |

### Tópicos

Dentro de cada área, existem **tópicos** que agrupam legislação por tema específico. Exemplo para Direito Trabalhista:

- Rescisão Contratual
- Jornada de Trabalho
- Férias e 13º Salário
- Estabilidade Provisória
- Acidente de Trabalho

Os tópicos servem como refinamento opcional — a busca pode ser feita apenas por área ou sem filtro algum (busca global).

### Por que a Taxonomia é Importante?

Sem classificação, uma pergunta sobre "prazo de contestação" poderia retornar artigos do CPC, da CLT e do CDC ao mesmo tempo. A taxonomia permite:

1. **Filtragem por contexto** — O chat pode inferir a área da pergunta e filtrar resultados
2. **Relevância aumentada** — Chunks da área correta têm prioridade
3. **Organização administrativa** — O admin visualiza documentos por área, facilitando manutenção
4. **Reutilização por agentes** — O agente de reclamação trabalhista busca apenas na área "trabalhista"

---

## Pipeline de Ingestão (7 Etapas)

Quando um documento é adicionado à base de conhecimento (via upload de PDF, texto puro ou URL), ele passa por um pipeline de 7 etapas no Worker, com **progresso em tempo real** visível no painel admin.

```
[0%]   Iniciando processamento
[5%]   Etapa 1 — Extrair texto
[15%]  Etapa 2 — Classificar documento (LLM)
[25%]  Etapa 3 — Chunking jurídico
[35%]  Etapa 4 — Enriquecer chunks (LLM)
[60%]  Etapa 5 — Gerar embeddings (dual)
[90%]  Etapa 6 — Salvar no banco
[100%] Etapa 7 — Concluído
```

### Etapa 1 — Extração de Texto (5%)

| Fonte | Processamento |
|---|---|
| **PDF** | Download do Supabase Storage → Extração nativa via PyMuPDF (gratuito). Se texto insuficiente (PDF escaneado), fallback para OCR via Mistral. |
| **Texto puro** | Conteúdo já disponível, pula extração. |
| **URL** | Download da URL → Se HTML, extração DOM-aware. Se PDF, mesmo pipeline de PDF. |

**Extração DOM-aware para HTML:** Quando a URL é uma página HTML (ex: planalto.gov.br), o sistema faz parsing DOM com BeautifulSoup e trata especialmente tags `<strike>`:

- Artigos riscados (revogados) são detectados via `<strike>` ou `<s>`
- O sistema busca nos siblings seguintes a anotação de qual lei revogou (ex: "Redação dada pela Lei nº 13.467/2017")
- Injeta marcadores no texto: `««REVOGADO|Lei nº 13.467/2017»» ... ««/REVOGADO»»`
- O chunker depois extrai esses marcadores para preencher os campos `status` e `revogado_por`

**Otimização de custo para PDFs:** A extração nativa via PyMuPDF é tentada primeiro (custo zero). O OCR via Mistral só é acionado como fallback para PDFs escaneados onde o texto nativo é insuficiente (<50 caracteres).

### Etapa 2 — Classificação por LLM (15%)

O classificador usa uma **chamada LLM** (modelo: `gemini-3.1-flash-lite-preview`) para determinar automaticamente:

- **`legislacao`** — Nome da legislação (ex: "CLT", "Código Civil", "Lei 8.213/91")
- **`area`** — Área do direito (slug da taxonomia, ex: "trabalhista")
- **`tipo`** — Tipo do documento (ex: "codigo", "lei_avulsa", "sumula", "doutrina")

A classificação recebe a lista de áreas disponíveis no banco (`legal_areas`) para manter consistência com a taxonomia cadastrada.

Se o admin já selecionou uma área no upload, ela é usada como hint (mas o LLM pode refiná-la). Se a classificação falhar, usa a área do admin ou "geral" como fallback.

### Etapa 3 — Chunking Jurídico (25%)

O chunking é a etapa mais crítica do pipeline. A qualidade dos chunks determina diretamente a qualidade das respostas do RAG.

**Princípio fundamental: artigos são unidades atômicas.**

Em legislação, um artigo (Art. 477, Art. 5º, etc.) é a unidade mínima de significado. Cortar um artigo no meio produziria um chunk incoerente. Por isso, o chunker trata artigos como blocos indivisíveis.

**Algoritmo de Chunking:**

1. **Detecção de artigos** — Regex `Art(igo)?\.?\s*\d+` identifica o início de cada artigo
2. **Agrupamento** — Parágrafos (§), incisos (I, II, III...) e alíneas (a, b, c...) são agrupados com o artigo pai
3. **Limites de tamanho** — Cada chunk tem entre 200 e 2.400 caracteres
4. **Merge de chunks pequenos** — Artigos muito curtos (<200 chars) são agrupados com o próximo
5. **Split de chunks grandes** — Artigos muito longos (>2.400 chars) são divididos em pontos naturais (parágrafos, incisos), mantendo overlap de 150 caracteres para preservar contexto
6. **Detecção de revogação** — Marcadores `««REVOGADO|...»»` são extraídos para preencher `status` e `revogado_por`
7. **Fallback** — Se nenhum artigo for detectado (texto não-legislativo), usa chunking por parágrafos

### Etapa 4 — Enriquecimento por LLM (35-55%)

Inovação central do pipeline. Cada chunk passa por uma **chamada LLM em batch** (modelo: `gemini-3.1-flash-lite-preview`) que adiciona:

| Campo | Descrição | Exemplo |
|---|---|---|
| `tema` | Tópico jurídico específico | "rescisão contratual" |
| `resumo` | Resumo em linguagem moderna e acessível | "O empregador deve pagar as verbas rescisórias em até 10 dias após o término do contrato, sob pena de multa equivalente ao salário do empregado." |
| `quality` | Qualidade do chunk (0=skip, 1=normal, 2=alta) | 1 |
| `revogado_por` | Lei que revogou/alterou (se aplicável) | "Lei nº 13.467/2017" |

**Por que o resumo é essencial:**

Legislação brasileira antiga (ex: CLT de 1943) usa linguagem arcaica que não corresponde às buscas dos usuários. O resumo em linguagem moderna garante que a busca semântica funcione:

```
Texto original (CLT 1943):
"A entrega ao empregado de documentos que comprovem a communicação
 da extincção contratual aos órgãos competentes..."

Resumo gerado pelo LLM:
"O empregador deve entregar ao empregado os documentos de rescisão
 e pagar todas as verbas em até 10 dias após o fim do contrato."

Busca do usuário: "prazo para pagar rescisão"
→ Match com o resumo: ALTO (linguagem compatível)
→ Match com o original: BAIXO (linguagem arcaica)
```

**Processamento em batch:** Os chunks são enviados ao LLM em lotes de até 50, com representação compacta (~200 chars por chunk) para minimizar tokens.

**Quality scoring:**
- `0` — Chunk inútil (ex: "Art. X - Revogado.", texto de ementa sem conteúdo). Não recebe embedding.
- `1` — Chunk normal. Recebe embedding.
- `2` — Chunk de alta relevância (artigos frequentemente citados). Recebe embedding.

### Etapa 5 — Geração de Embeddings Dual (60-75%)

Cada chunk de qualidade > 0 recebe **dois embeddings** de 768 dimensões:

1. **`embedding`** — Embedding do conteúdo original (`content`)
2. **`embedding_resumo`** — Embedding do resumo em linguagem moderna (`resumo`)

O modelo de embedding é **Google `gemini-embedding-001`** (768 dimensões), configurável via variável de ambiente `GEMINI_EMBEDDING_MODEL`.

**Processamento em batch:** Até 100 textos por requisição à API do Google. Para documentos grandes, o pipeline faz múltiplas requisições em sequência.

**Otimização:** Chunks com `quality = 0` são salvos sem embeddings (economia de custo e espaço).

### Etapa 6 — Persistência (90%)

Os chunks com embeddings são inseridos na tabela `rag_chunks` do PostgreSQL com a extensão **pgvector**. O índice IVFFlat permite buscas de similaridade eficientes.

### Etapa 7 — Conclusão (100%)

O documento na tabela `rag_documents` é atualizado com `status = 'ready'`, `total_chunks = N`, e os campos `area` e `legislacao` da classificação LLM. Se qualquer etapa falhar, o status é marcado como `'error'` com a mensagem de erro.

**Progresso em tempo real:** A cada etapa, o worker atualiza as colunas `progress` (0-100) e `progress_message` na tabela `rag_documents`. O frontend faz polling a cada 3 segundos e exibe uma barra de progresso com percentual e descrição da etapa atual.

### Metadados completos de cada chunk

| Campo | Descrição | Exemplo |
|---|---|---|
| `content` | Texto integral do trecho | "Art. 477. Na extinção do contrato..." |
| `section_title` | Título da seção/capítulo | "Do Término do Contrato" |
| `area` | Área jurídica classificada | "trabalhista" |
| `tema` | Tópico específico (LLM) | "rescisão contratual" |
| `legislacao` | Nome da legislação de origem | "CLT" |
| `artigo` | Identificador do artigo | "Art. 477" |
| `chunk_index` | Ordem sequencial no documento | 42 |
| `status` | Status do artigo | "vigente", "revogado", "alterado" |
| `revogado_por` | Lei que revogou/alterou | "Lei nº 13.467/2017" |
| `resumo` | Resumo em linguagem moderna (LLM) | "O prazo para pagamento..." |
| `quality` | Qualidade (0=skip, 1=normal, 2=alta) | 1 |
| `tipo_documento` | Tipo do documento de origem | "codigo" |
| `embedding` | Vetor 768d do conteúdo original | `[0.023, -0.041, ...]` |
| `embedding_resumo` | Vetor 768d do resumo moderno | `[0.018, -0.055, ...]` |

---

## Busca Vetorial Dual (Retrieval)

Quando o usuário faz uma pergunta no chat ou um agente de IA precisa de contexto jurídico, a busca acontece em quatro passos:

### 1. Embedding da Query

A pergunta do usuário é convertida no mesmo espaço vetorial (768 dims) usando o mesmo modelo `gemini-embedding-001`. Isso garante que a comparação de similaridade seja válida.

### 2. Busca Dual por Similaridade Coseno

O pgvector calcula a **distância coseno** entre o vetor da query e **ambos os vetores** de cada chunk (conteúdo + resumo), usando `GREATEST()` para pegar o melhor score:

```sql
WITH scored AS (
    SELECT
        id, content, section_title, area, tema, legislacao, artigo,
        status, revogado_por, resumo,
        GREATEST(
            CASE WHEN embedding IS NOT NULL
                 THEN 1 - (embedding <=> query::vector)
                 ELSE 0 END,
            CASE WHEN embedding_resumo IS NOT NULL
                 THEN 1 - (embedding_resumo <=> query::vector)
                 ELSE 0 END
        ) AS raw_score
    FROM public.rag_chunks
    WHERE quality > 0
)
SELECT *, ...
FROM scored
WHERE raw_score >= 0.30
ORDER BY boosted_score DESC
LIMIT 8
```

Isso resolve o problema de linguagem arcaica: quando o texto original da CLT de 1943 não faz match com a pergunta moderna do usuário, o resumo em linguagem atual faz.

### 3. Boosting por Status

Chunks com status `vigente` recebem score integral. Chunks `alterado` perdem 10%, e `revogado` perdem 30%. Isso garante que legislação vigente tenha prioridade, sem excluir completamente a revogada (que pode ser relevante para contexto histórico):

```sql
CASE status
    WHEN 'vigente'  THEN raw_score
    WHEN 'alterado' THEN raw_score * 0.9
    ELSE                 raw_score * 0.7
END AS boosted_score
```

### 4. Ranking e Seleção

Os chunks são ordenados por `boosted_score` (maior primeiro) e os **top 8** são selecionados. A quantidade foi calibrada para fornecer contexto suficiente sem exceder o limite de tokens do modelo.

**Filtro taxonômico:** Quando o contexto indica uma área específica (ex: agente de reclamação trabalhista), a busca é restrita a chunks daquela área via `WHERE area = 'trabalhista'`.

**Filtro de qualidade:** Chunks com `quality = 0` são automaticamente excluídos (não têm embeddings).

---

## Integração no Chat Jurídico

O chat é o principal consumidor do RAG. A integração acontece durante o fluxo de streaming SSE (Server-Sent Events):

### Fluxo Completo

```
1. Usuário envia mensagem
2. Backend salva mensagem no banco
3. ──→ EMBEDDING: gera vetor da mensagem (gemini-embedding-001)
4. ──→ BUSCA RAG DUAL: pgvector busca em embedding + embedding_resumo
5. Monta system prompt dinâmico (prompt base + chunks + instrução de citação)
6. Carrega histórico da sessão (últimas 20 mensagens)
7. ──→ STREAM: envia para Gemini com system prompt + histórico
8. Cada token é enviado via SSE para o frontend em tempo real
9. Ao finalizar: salva resposta + envia evento "done" com fontes
```

### System Prompt Dinâmico

O prompt enviado ao modelo é composto de duas partes:

**Parte fixa (sempre presente):**
```
Você é um assistente jurídico especializado em direito brasileiro.

REGRAS:
- Responda APENAS sobre direito brasileiro
- Cite artigos de lei, súmulas e jurisprudência
- Esclareça que são orientações, NÃO parecer jurídico
- Use o formato: (Art. X, Lei Y)
...
```

**Parte dinâmica (quando RAG retorna chunks):**
```
=== BASE DE CONHECIMENTO (FONTES VERIFICADAS) ===
[1] Art. 477, CLT (vigente): "Na extinção do contrato de trabalho, o empregador
    deverá proceder à anotação na CTPS, comunicar a dispensa aos
    órgãos competentes e realizar o pagamento das verbas rescisórias
    no prazo estipulado no § 6º deste artigo."
[2] Art. 477 §6º, CLT (vigente): "A entrega ao empregado de documentos que
    comprovem a comunicação da extinção contratual aos órgãos
    competentes bem como o pagamento dos valores constantes do
    instrumento de rescisão ou recibo de quitação deverão ser
    efetuados até dez dias contados a partir do término do contrato."
=== INSTRUÇÃO ===
Fundamente sua resposta nos artigos acima quando relevantes.
Cite SEMPRE a fonte entre parênteses: (Art. X, Lei Y).
Se a legislação fornecida não cobrir a pergunta, responda com seu
conhecimento geral e diga claramente que não há fonte específica.
```

Esse design tem três propriedades importantes:

1. **Non-invasive** — Se o RAG não retornar nada (base vazia, erro, query genérica), o chat funciona normalmente sem fontes
2. **Transparente** — O modelo sabe que são "fontes verificadas" e é instruído a citá-las
3. **Honesto** — A instrução final diz explicitamente para avisar quando a base não cobre o assunto

### Fontes no Frontend

Quando o stream termina, o backend envia um evento SSE final contendo as fontes usadas com dados enriquecidos:

```json
{
  "done": true,
  "message_id": "uuid-da-mensagem",
  "sources": [
    {
      "legislacao": "CLT",
      "artigo": "Art. 477",
      "area": "trabalhista",
      "tema": "rescisão contratual",
      "score": 0.892,
      "content": "Na extinção do contrato de trabalho, o empregador...",
      "resumo": "O empregador deve pagar as verbas rescisórias em até 10 dias após o término do contrato, sob pena de multa equivalente ao salário do empregado.",
      "status": "vigente",
      "revogado_por": null,
      "section_title": "Da Rescisão"
    }
  ]
}
```

O frontend renderiza essas fontes como um painel colapsável abaixo da mensagem do assistente, com design enriquecido:

- **Identificação** — Artigo e legislação (ex: "Art. 477, CLT")
- **Área** — Badge com a área jurídica
- **Tema** — Badge com o tópico específico
- **Status** — Badge colorido: verde (vigente), amarelo (alterado), vermelho (revogado)
- **Revogado por** — Se aplicável, mostra qual lei revogou/alterou em itálico
- **Relevância** — Percentual de similaridade (ex: "89%")
- **Resumo** — Texto principal da fonte: o resumo em linguagem moderna (completo, nunca cortado)
- **"Ver texto original"** — Toggle para expandir o conteúdo original do chunk com borda lateral

O **resumo como texto principal** resolve o problema de chunks com texto cortado: o resumo é sempre uma frase completa gerada pelo LLM, enquanto o content pode ser truncado pelo chunking. O advogado vê a explicação moderna e pode expandir o texto original se quiser verificar a literalidade.

---

## Integração nos Agentes de IA

Além do chat, o RAG é utilizado pelos agentes de IA que processam documentos no Worker. O padrão é o mesmo, mas adaptado para o contexto de cada ferramenta:

### Reclamação Trabalhista

Quando o usuário solicita a geração de uma reclamação trabalhista:

1. O Worker recebe o job com o texto do usuário (fatos do caso) e os documentos anexados
2. **Antes de enviar ao LLM**, o Worker gera um embedding do texto do caso
3. Busca chunks na área `trabalhista` com top 8 resultados (busca dual)
4. Injeta a legislação encontrada no prompt junto com os fatos do caso
5. O LLM gera a reclamação já fundamentada nos artigos reais da base

**Resultado:** A reclamação trabalhista cita artigos da CLT que realmente existem e são relevantes para o caso, em vez de depender do conhecimento (potencialmente desatualizado) do modelo.

### Extensibilidade para Outros Agentes

O mesmo padrão pode ser aplicado a qualquer agente de IA:

| Agente | Área RAG | Uso |
|---|---|---|
| Reclamação Trabalhista | `trabalhista` | Fundamentação legal da petição |
| Scanner de Peça | *todas* | Verificar legislação citada na petição |
| Resumo de Processo | *inferida* | Contextualizar com artigos relevantes |
| Análise CNIS | `previdenciario` | Legislação previdenciária aplicável |

O módulo `core/rag.py` no Worker é genérico e reutilizável — recebe um embedding de query e uma área opcional, retorna chunks formatados prontos para injeção no prompt.

---

## Gestão da Base de Conhecimento

O painel administrativo (`/admin?tab=knowledge-base`) permite gerenciar toda a base de documentos:

### Fontes de Documentos

| Tipo | Descrição | Exemplo |
|---|---|---|
| **Upload PDF** | Arquivo PDF enviado pelo admin | CLT completa, Código Civil, súmulas |
| **Texto puro** | Conteúdo colado diretamente | Artigo específico, ementa de jurisprudência |
| **URL** | Documento importado de uma URL | Página de legislação (ex: planalto.gov.br) |

### Ciclo de Vida do Documento

```
Upload/Criação → [pending] → Job enfileirado no Redis
                      ↓
               Worker processa → [processing] (barra de progresso 0-100%)
                      ↓
               Sucesso → [ready] (chunks + embeddings criados)
               Falha   → [error] (mensagem de erro visível no admin)
```

O admin acompanha o progresso em **tempo real** com barra de progresso, percentual e descrição da etapa atual (polling automático a cada 3 segundos).

### Operações Administrativas

- **Listar** — Tabela com filtros por área, status e busca por nome
- **Visualizar chunks** — Modal mostrando os chunks gerados com metadados
- **Deletar** — Remove documento + chunks (CASCADE) + arquivo do Storage
- **Taxonomia** — Criar/remover áreas e tópicos jurídicos
- **Estatísticas** — Total de documentos, chunks, distribuição por área e status

---

## Considerações Técnicas

### Modelos de IA utilizados

| Modelo | Uso | Configurável via |
|---|---|---|
| `gemini-embedding-001` | Embeddings 768d (ingestão + busca) | `GEMINI_EMBEDDING_MODEL` |
| `gemini-3.1-flash-lite-preview` | Classificação e enriquecimento de chunks | `GEMINI_ENRICHMENT_MODEL` |
| `gemini-3.1-flash` | Chat jurídico (streaming SSE) | `GEMINI_CHAT_MODEL` |

### Performance

- **Embedding de query:** ~100ms (uma chamada à API do Google)
- **Busca pgvector dual:** ~10-50ms (índice IVFFlat com 50 listas)
- **Overhead total do RAG:** ~150-200ms por mensagem (imperceptível para o usuário, pois o streaming do LLM demora mais)

### Custo de Ingestão

| Etapa | Custo |
|---|---|
| Extração de texto (PyMuPDF nativo) | Gratuito |
| Extração de texto (Mistral OCR fallback) | ~$0.01/página |
| Classificação LLM (1 chamada por documento) | ~$0.001 |
| Enriquecimento LLM (1 chamada por batch de 50 chunks) | ~$0.005/batch |
| Embeddings (gemini-embedding-001) | Gratuito (API do Google) |
| Total para CLT (~900 chunks) | ~$0.10 |

### Dimensionamento

- Cada chunk ocupa ~6KB no banco (2 × 768 floats × 4 bytes + texto + metadados)
- Um documento de 100 artigos gera ~80-120 chunks
- A CLT inteira (~900 artigos) gera ~800-1.000 chunks (~6MB no banco)
- O índice IVFFlat escala bem até ~100.000 chunks sem necessidade de reconfiguração

### Resiliência

- Se a API de embeddings falhar → chat funciona sem RAG (fallback para conhecimento do modelo)
- Se a busca pgvector falhar → idem, erro é logado mas não bloqueia o usuário
- Se o documento falhar no pipeline → status fica como `error`, admin pode retentar ou deletar
- Se a base estiver vazia → chat funciona normalmente, sem seção de fontes
- Se o enriquecimento LLM falhar → chunks são salvos sem resumo/tema (funciona, apenas sem dual embedding)

### Segurança (RLS)

Todas as tabelas RAG e chat possuem Row Level Security:

- `legal_areas` / `legal_topics` / `rag_keywords` — SELECT público (taxonomia é pública)
- `rag_documents` / `rag_chunks` — Sem acesso anônimo (apenas via backend/worker)
- `chat_sessions` — Cada usuário vê apenas suas sessões
- `chat_messages` — Cada usuário vê apenas mensagens das suas sessões

---

## Fluxo Completo: Da Legislação à Resposta

Para consolidar, este é o caminho completo que um artigo de lei percorre desde o upload até ser citado em uma resposta do chat:

```
1.  Admin faz upload da URL da CLT (planalto.gov.br) no painel
2.  Registro criado em rag_documents (status: pending)
3.  Job "rag_ingest" enfileirado no Redis
4.  Frontend mostra barra de progresso: 0%

5.  Worker consome o job
6.  [5%] Download da URL → extração DOM-aware do HTML
7.  [5%] Tags <strike> detectadas → marcadores ««REVOGADO|Lei nº X»» injetados
8.  [15%] LLM classifica: legislacao="CLT", area="trabalhista", tipo="codigo"
9.  [25%] Chunker identifica ~900 artigos como unidades atômicas
10. [25%] Marcadores de revogação extraídos → status/revogado_por preenchidos
11. [35%] LLM enriquece em batches de 50: gera tema, resumo, quality para cada chunk
12. [60%] Embedding do conteúdo original: 9 batches de 100 textos
13. [75%] Embedding dos resumos: mais 9 batches
14. [90%] INSERT de todos os chunks com dual embeddings no PostgreSQL
15. [100%] Documento atualizado para status: ready

16. Usuário pergunta no chat: "qual o prazo das verbas rescisórias?"
17. Backend gera embedding da pergunta
18. pgvector compara com AMBOS os embeddings (original + resumo) via GREATEST()
19. Art. 477 e §6º retornados com score > 0.85 (match via resumo moderno)
20. System prompt montado com os artigos como "fontes verificadas"
21. Gemini lê os artigos reais e responde citando "(Art. 477, §6º, CLT)"
22. Frontend mostra a resposta + painel de fontes:
    - Resumo completo em linguagem moderna como texto principal
    - Badge "vigente" em verde, tema "rescisão contratual", 89% relevância
    - Toggle "Ver texto original" para o advogado verificar a literalidade

23. Advogado verifica que a citação é precisa ✓
```

---

## Evolução Futura

A arquitetura foi desenhada para suportar expansões sem refatoração:

- **Busca híbrida (vetorial + textual)** — Combinar pgvector com `tsvector` do PostgreSQL para queries que mencionam artigos específicos (ex: "Art. 5º CF") — a busca textual encontra a referência exata, a vetorial encontra artigos semanticamente relacionados
- **Chunks hierárquicos** — Manter relação pai-filho entre artigos e seus parágrafos/incisos para recuperação mais granular
- **Feedback loop** — Registrar quais fontes o usuário expandiu/verificou para melhorar o ranking futuro
- **Embeddings incrementais** — Ao adicionar novos documentos, gerar embeddings apenas dos novos chunks (já funciona assim, mas pode ser otimizado para atualizações parciais)
- **Profundidade por plano** — Variar a quantidade de chunks retornados (top_k) conforme o plano do usuário
