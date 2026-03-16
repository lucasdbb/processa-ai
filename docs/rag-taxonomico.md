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
│                              │  1. OCR (PDF)   │       │
│                              │  2. Classificar │       │
│                              │  3. Chunking    │       │
│                              │  4. Embedding   │       │
│                              │  5. INSERT      │       │
│                              └────────┬────────┘       │
│                                       ↓                 │
│                              ┌────────────────┐        │
│                              │   PostgreSQL    │        │
│                              │   + pgvector    │        │
│                              │                 │        │
│                              │  rag_chunks     │        │
│                              │  (texto +       │        │
│                              │   embedding     │        │
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

1. **Base de Conhecimento (Admin)** — Interface para gestão de documentos
2. **Pipeline de Ingestão (Worker)** — Processa documentos em chunks com embeddings
3. **Busca Vetorial (pgvector)** — Recupera trechos relevantes por similaridade
4. **Integração no Chat** — Injeta contexto no prompt do modelo
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

## Pipeline de Ingestão

Quando um documento é adicionado à base de conhecimento (via upload de PDF, texto puro ou URL), ele passa por um pipeline de processamento no Worker:

### Etapa 1 — Aquisição do Conteúdo

| Fonte | Processamento |
|---|---|
| **PDF** | Download do Supabase Storage → OCR via Mistral para extrair texto |
| **Texto puro** | Conteúdo já disponível, pula OCR |
| **URL** | Download da URL → tratamento como PDF |

O OCR é feito pelo Mistral, que lê o PDF nativamente e extrai texto com alta fidelidade, preservando a estrutura de artigos, parágrafos e incisos.

### Etapa 2 — Classificação Taxonômica

O classificador determina automaticamente a área jurídica do documento usando dois mecanismos:

**Dicionário de Legislação** — Mapeamento direto entre nomes de lei e áreas:

```
"CLT" → trabalhista
"Código Civil" → civil
"CPC" → processual-civil
"CDC" → consumidor
"Código Penal" → penal
"CF" / "Constituição" → constitucional
```

O dicionário é aplicado tanto ao nome do arquivo quanto ao conteúdo extraído, usando regex para detectar referências como "Consolidação das Leis do Trabalho", "Lei nº 8.078", etc.

**Detecção de Documentos Compostos** — Detecta compilações (Vade Mecum, coletâneas) que contêm múltiplas leis. Nestes casos, o documento é marcado como `is_compound = true` e cada seção pode receber classificação individual durante o chunking.

Se a classificação automática falhar (nenhum padrão reconhecido), o documento recebe a área selecionada pelo administrador no momento do upload, ou fica sem classificação.

### Etapa 3 — Chunking Jurídico

O chunking é a etapa mais crítica do pipeline. A qualidade dos chunks determina diretamente a qualidade das respostas do RAG.

**Princípio fundamental: artigos são unidades atômicas.**

Em legislação, um artigo (Art. 477, Art. 5º, etc.) é a unidade mínima de significado. Cortar um artigo no meio produziria um chunk incoerente. Por isso, o chunker trata artigos como blocos indivisíveis.

**Algoritmo de Chunking:**

1. **Detecção de artigos** — Regex `Art(igo)?\.?\s*\d+` identifica o início de cada artigo
2. **Agrupamento** — Parágrafos (§), incisos (I, II, III...) e alíneas (a, b, c...) são agrupados com o artigo pai
3. **Limites de tamanho** — Cada chunk tem entre 200 e 2.400 caracteres
4. **Merge de chunks pequenos** — Artigos muito curtos (<200 chars) são agrupados com o próximo
5. **Split de chunks grandes** — Artigos muito longos (>2.400 chars) são divididos em pontos naturais (parágrafos, incisos), mantendo overlap de 150 caracteres para preservar contexto
6. **Fallback** — Se nenhum artigo for detectado (texto não-legislativo), usa chunking por parágrafos

**Metadados de cada chunk:**

| Campo | Descrição | Exemplo |
|---|---|---|
| `content` | Texto integral do trecho | "Art. 477. Na extinção do contrato..." |
| `section_title` | Título da seção/capítulo, se detectado | "Do Término do Contrato" |
| `area` | Área jurídica classificada | "trabalhista" |
| `tema` | Tópico específico, se identificado | "rescisão" |
| `legislacao` | Nome da legislação de origem | "CLT" |
| `artigo` | Identificador do artigo | "Art. 477" |
| `chunk_index` | Ordem sequencial no documento | 42 |

### Etapa 4 — Geração de Embeddings

Cada chunk de texto é convertido em um vetor numérico de **768 dimensões** usando o modelo **Google text-embedding-004**.

O embedding captura o significado semântico do texto — dois chunks sobre "rescisão de contrato de trabalho" terão vetores próximos no espaço vetorial, mesmo que usem palavras diferentes.

**Processamento em batch:**
- Até 100 textos por requisição à API do Google
- Para documentos grandes (centenas de artigos), o pipeline faz múltiplas requisições em sequência
- O modelo é o mesmo usado na busca (query embedding), garantindo compatibilidade

### Etapa 5 — Persistência

Os chunks com embeddings são inseridos na tabela `rag_chunks` do PostgreSQL com a extensão **pgvector**. O índice IVFFlat (Inverted File Flat) permite buscas de similaridade eficientes mesmo com milhares de chunks.

Ao final, o documento na tabela `rag_documents` é atualizado com `status = 'ready'` e `total_chunks = N`. Se qualquer etapa falhar, o status é marcado como `'error'` com a mensagem de erro.

---

## Busca Vetorial (Retrieval)

Quando o usuário faz uma pergunta no chat ou um agente de IA precisa de contexto jurídico, a busca acontece em três passos:

### 1. Embedding da Query

A pergunta do usuário é convertida no mesmo espaço vetorial (768 dims) usando o mesmo modelo `text-embedding-004`. Isso garante que a comparação de similaridade seja válida.

Exemplo: a pergunta "qual o prazo para pagar as verbas rescisórias?" é transformada em um vetor que estará semanticamente próximo dos chunks sobre Art. 477 da CLT.

### 2. Busca por Similaridade Coseno

O pgvector calcula a **distância coseno** entre o vetor da query e todos os vetores da base:

```
similaridade = 1 - distância_coseno(query, chunk)
```

- Similaridade = 1.0 → textos idênticos
- Similaridade = 0.0 → textos completamente diferentes
- **Threshold mínimo: 0.35** — Chunks com similaridade abaixo disso são descartados (evita retornar conteúdo irrelevante)

**Filtro taxonômico:** Quando o contexto indica uma área específica (ex: agente de reclamação trabalhista), a busca é restrita a chunks daquela área, aumentando precisão e reduzindo ruído.

### 3. Ranking e Seleção

Os chunks são ordenados por similaridade (maior primeiro) e os **top 8** são selecionados. A quantidade foi calibrada para:

- Fornecer contexto suficiente para respostas fundamentadas
- Não exceder o limite de tokens do modelo
- Manter baixa latência (a busca deve ser mais rápida que a geração)

---

## Integração no Chat Jurídico

O chat é o principal consumidor do RAG. A integração acontece durante o fluxo de streaming SSE (Server-Sent Events):

### Fluxo Completo

```
1. Usuário envia mensagem
2. Backend salva mensagem no banco
3. ──→ EMBEDDING: gera vetor da mensagem (text-embedding-004)
4. ──→ BUSCA RAG: pgvector retorna top 8 chunks relevantes
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
[1] Art. 477, CLT: "Na extinção do contrato de trabalho, o empregador
    deverá proceder à anotação na CTPS, comunicar a dispensa aos
    órgãos competentes e realizar o pagamento das verbas rescisórias
    no prazo estipulado no § 6º deste artigo."
[2] Art. 477 §6º, CLT: "A entrega ao empregado de documentos que
    comprovem a comunicação da extinção contratual aos órgãos
    competentes bem como o pagamento dos valores constantes do
    instrumento de rescisão ou recibo de quitação deverão ser
    efetuados até dez dias contados a partir do término do contrato."
[3] Súmula 462, TST: "O prazo de dez dias previsto no art. 477, §6º,
    da CLT começa a fluir a partir do último dia trabalhado."
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

Quando o stream termina, o backend envia um evento SSE final contendo as fontes usadas:

```json
{
  "done": true,
  "message_id": "uuid-da-mensagem",
  "sources": [
    {
      "legislacao": "CLT",
      "artigo": "Art. 477",
      "area": "trabalhista",
      "score": 0.892,
      "content": "Na extinção do contrato de trabalho..."
    }
  ]
}
```

O frontend renderiza essas fontes como um painel colapsável abaixo da mensagem do assistente. Cada fonte mostra:

- **Identificação** — Artigo e legislação (ex: "Art. 477, CLT")
- **Área** — Badge com a área jurídica
- **Relevância** — Percentual de similaridade (ex: "89%")
- **Preview** — Trecho do texto original (visível ao expandir)

Isso permite que o advogado verifique se a citação é precisa sem sair do chat.

---

## Integração nos Agentes de IA

Além do chat, o RAG é utilizado pelos agentes de IA que processam documentos no Worker. O padrão é o mesmo, mas adaptado para o contexto de cada ferramenta:

### Reclamação Trabalhista

Quando o usuário solicita a geração de uma reclamação trabalhista:

1. O Worker recebe o job com o texto do usuário (fatos do caso) e os documentos anexados
2. **Antes de enviar ao LLM**, o Worker gera um embedding do texto do caso
3. Busca chunks na área `trabalhista` com top 8 resultados
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

O método `_fetch_rag_context()` no Worker é genérico e reutilizável — recebe uma query e uma área opcional, retorna texto formatado pronto para injeção no prompt.

---

## Gestão da Base de Conhecimento

O painel administrativo (`/admin?tab=knowledge-base`) permite gerenciar toda a base de documentos:

### Fontes de Documentos

| Tipo | Descrição | Exemplo |
|---|---|---|
| **Upload PDF** | Arquivo PDF enviado pelo admin | CLT completa, Código Civil, súmulas |
| **Texto puro** | Conteúdo colado diretamente | Artigo específico, ementa de jurisprudência |
| **URL** | Documento importado de uma URL | PDF de legislação disponível online |

### Ciclo de Vida do Documento

```
Upload/Criação → [pending] → Job enfileirado no Redis
                      ↓
               Worker processa → [processing]
                      ↓
               Sucesso → [ready] (chunks + embeddings criados)
               Falha   → [error] (mensagem de erro visível no admin)
```

O admin acompanha o status em tempo real (polling automático a cada 5 segundos para documentos pendentes).

### Operações Administrativas

- **Listar** — Tabela com filtros por área, status e busca por nome
- **Visualizar chunks** — Modal mostrando os chunks gerados com metadados
- **Deletar** — Remove documento + chunks (CASCADE) + arquivo do Storage
- **Taxonomia** — Criar/remover áreas e tópicos jurídicos

---

## Considerações Técnicas

### Performance

- **Embedding de query:** ~100ms (uma chamada à API do Google)
- **Busca pgvector:** ~10-50ms (índice IVFFlat com 50 listas)
- **Overhead total do RAG:** ~150-200ms por mensagem (imperceptível para o usuário, pois o streaming do LLM demora mais)

### Dimensionamento

- Cada chunk ocupa ~3KB no banco (768 floats × 4 bytes + texto + metadados)
- Um documento de 100 artigos gera ~80-120 chunks
- A CLT inteira (922 artigos) geraria ~800-1.000 chunks (~3MB no banco)
- O índice IVFFlat escala bem até ~100.000 chunks sem necessidade de reconfiguração

### Resiliência

- Se a API de embeddings falhar → chat funciona sem RAG (fallback para conhecimento do modelo)
- Se a busca pgvector falhar → idem, erro é logado mas não bloqueia o usuário
- Se o documento falhar no pipeline → status fica como `error`, admin pode retentar ou deletar
- Se a base estiver vazia → chat funciona normalmente, sem seção de fontes

### Modelo de Embedding

O modelo `text-embedding-004` do Google foi escolhido por:

1. **768 dimensões** — Bom equilíbrio entre qualidade e tamanho de armazenamento
2. **Suporte a português** — Performance comprovada em textos em português
3. **Batch API** — Até 100 textos por requisição (eficiente para ingestão em massa)
4. **Mesma família do Gemini** — Compatibilidade semântica com o modelo de chat

---

## Fluxo Completo: Da Legislação à Resposta

Para consolidar, este é o caminho completo que um artigo de lei percorre desde o upload até ser citado em uma resposta do chat:

```
1. Admin faz upload de "CLT.pdf" no painel
2. Arquivo vai para o Supabase Storage
3. Registro criado em rag_documents (status: pending)
4. Job "rag_ingest" enfileirado no Redis

5. Worker consome o job
6. Download do PDF do Storage
7. OCR via Mistral extrai texto completo
8. Classificador detecta "CLT" → área "trabalhista"
9. Chunker identifica 922 artigos como unidades atômicas
10. ~900 chunks gerados respeitando limites de tamanho
11. Embeddings gerados em batches de 100 (9 chamadas à API)
12. INSERT de todos os chunks com embeddings no PostgreSQL
13. Documento atualizado para status: ready

14. Usuário pergunta no chat: "qual o prazo das verbas rescisórias?"
15. Backend gera embedding da pergunta
16. pgvector retorna Art. 477 e §6º com score > 0.85
17. System prompt montado com os artigos como "fontes verificadas"
18. Gemini lê os artigos reais e responde citando "(Art. 477, §6º, CLT)"
19. Frontend mostra a resposta + painel de fontes com "Art. 477, CLT — 89%"

20. Advogado verifica que a citação é precisa ✓
```

---

## Evolução Futura

A arquitetura foi desenhada para suportar expansões sem refatoração:

- **Busca híbrida (vetorial + textual)** — Combinar pgvector com `tsvector` do PostgreSQL para queries que mencionam artigos específicos (ex: "Art. 5º CF") — a busca textual encontra a referência exata, a vetorial encontra artigos semanticamente relacionados
- **Classificação por LLM** — Para documentos que o classificador por dicionário não reconhece, usar uma chamada rápida ao LLM para inferir a área
- **Chunks hierárquicos** — Manter relação pai-filho entre artigos e seus parágrafos/incisos para recuperação mais granular
- **Feedback loop** — Registrar quais fontes o usuário expandiu/verificou para melhorar o ranking futuro
- **Embeddings incrementais** — Ao adicionar novos documentos, gerar embeddings apenas dos novos chunks (já funciona assim, mas pode ser otimizado para atualizações parciais)
