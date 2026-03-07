# RAG Taxonômico Jurídico — Arquitetura Técnica

> Documentação técnica do sistema de RAG (Retrieval-Augmented Generation) com taxonomia de conhecimento jurídico. Exemplo prático com Vade Mecum.
>
> Inspirado na arquitetura do AllyForce, adaptado para o contexto jurídico brasileiro.
>
> Gerado em fevereiro de 2026.

---

## Índice

1. [O Problema do RAG Simples](#1-o-problema-do-rag-simples)
2. [Taxonomia de Conhecimento Jurídico](#2-taxonomia-de-conhecimento-jurídico)
3. [Etapa 1 — Upload e Classificação](#3-etapa-1--upload-e-classificação)
4. [Etapa 2 — Chunking Semântico Jurídico](#4-etapa-2--chunking-semântico-jurídico)
5. [Etapa 3 — Geração de Embeddings](#5-etapa-3--geração-de-embeddings)
6. [Etapa 4 — Busca em 4 Estágios](#6-etapa-4--busca-em-4-estágios)
7. [Fluxo Visual Completo](#7-fluxo-visual-completo)
8. [Schema do Banco de Dados](#8-schema-do-banco-de-dados)
9. [Comparativo: RAG Simples vs. Taxonômico](#9-comparativo-rag-simples-vs-taxonômico)
10. [Viabilidade Técnica com Infra Atual](#10-viabilidade-técnica-com-infra-atual)

---

## 1. O Problema do RAG Simples

Num RAG comum, o PDF inteiro é jogado num vetor store sem estrutura. O Vade Mecum tem **~2.000 páginas** com CLT, CPC, CC, CF, CDC, CP, CPP, ECA, etc.

Se o advogado perguntar "qual o prazo para contestação trabalhista?", o RAG simples busca por similaridade em **todos os chunks** — e pode trazer o Art. 335 do CPC (cível, 15 dias) em vez do Art. 847 da CLT (trabalhista, na audiência).

```
RAG SIMPLES:
  Query → Busca vetorial em 10.000+ chunks → Resultado impreciso
                                              (mistura CLT com CPC)

RAG TAXONÔMICO:
  Query → Keywords → Área: Trabalhista → Busca em ~200 chunks → Resultado preciso
                                                                (apenas CLT + súmulas TST)
```

O RAG taxonômico **resolve isso com pré-filtro por taxonomia**.

---

## 2. Taxonomia de Conhecimento Jurídico

O conhecimento é organizado em 4 níveis hierárquicos:

```
Área do Direito  (nível 1)
    └── Tema  (nível 2)
            └── Legislação / Fonte  (nível 3)
                    └── Chunks com embeddings  (nível 4)
```

### Exemplo completo com Vade Mecum

```
Direito Trabalhista
    ├── Contrato de Trabalho
    │       └── CLT Arts. 442-510
    │               └── [chunks]
    ├── Rescisão Contratual
    │       └── CLT Arts. 477-486
    │               └── [chunks]
    ├── Jornada de Trabalho
    │       └── CLT Arts. 57-75
    │               └── [chunks]
    ├── Férias
    │       └── CLT Arts. 129-153
    │               └── [chunks]
    ├── Remuneração
    │       └── CLT Arts. 457-467
    │               └── [chunks]
    └── Processo do Trabalho
            └── CLT Arts. 763-910
                    └── [chunks]

Direito Previdenciário
    ├── Aposentadoria
    │       └── EC 103/2019 + Lei 8.213/91
    │               └── [chunks]
    ├── Auxílio-Doença / Incapacidade Temporária
    │       └── Lei 8.213/91 Arts. 59-63
    │               └── [chunks]
    ├── BPC / LOAS
    │       └── Lei 8.742/93 Art. 20
    │               └── [chunks]
    └── Pensão por Morte
            └── Lei 8.213/91 Arts. 74-79
                    └── [chunks]

Direito Civil
    ├── Contratos
    │       └── CC Arts. 421-480
    │               └── [chunks]
    ├── Responsabilidade Civil
    │       └── CC Arts. 927-954
    │               └── [chunks]
    ├── Família
    │       └── CC Arts. 1.511-1.783
    │               └── [chunks]
    └── Obrigações
            └── CC Arts. 233-420
                    └── [chunks]

Direito Processual Civil
    ├── Procedimento Comum
    │       └── CPC Arts. 318-512
    │               └── [chunks]
    ├── Recursos
    │       └── CPC Arts. 994-1.044
    │               └── [chunks]
    └── Execução
            └── CPC Arts. 513-538
                    └── [chunks]

Direito do Consumidor
    └── CDC
            └── Lei 8.078/90
                    └── [chunks]

Direito Constitucional
    ├── Direitos Fundamentais
    │       └── CF Arts. 1-17
    │               └── [chunks]
    ├── Direitos Sociais
    │       └── CF Arts. 6-11
    │               └── [chunks]
    └── Ordem Social — Seguridade
            └── CF Arts. 194-204
                    └── [chunks]
```

Cada ferramenta de IA (Ally Jurídico, chat, gerador de petição) está **vinculada a áreas específicas** da taxonomia. Isso define o **escopo de busca antes da query chegar**.

---

## 3. Etapa 1 — Upload e Classificação

### Fluxo de upload

```
Advogado faz upload do Vade Mecum (PDF)
       │
       ▼
Extração de texto (pdf → texto)
       │
       ▼
Detecção de estrutura do documento
(é composto? quais leis contém?)
       │
       ▼
Classificação automática por seções
(cada lei → área + tema da taxonomia)
       │
       ▼
Enfileirado no Redis para processamento async
       │
       ▼
Worker processa: chunking → embedding → pgvector
```

### Detecção de documento composto

O Vade Mecum é um **documento composto** — contém múltiplas leis independentes. O sistema detecta isso por padrões:

```python
PADROES_NOVA_LEI = [
    r"^LEI\s+N[ºo°]\s+[\d.]+",           # "LEI Nº 13.467"
    r"^DECRETO[- ]LEI\s+N[ºo°]\s+[\d.]+", # "DECRETO-LEI Nº 5.452"
    r"^EMENDA\s+CONSTITUCIONAL",           # "EMENDA CONSTITUCIONAL Nº 103"
    r"^CONSTITUIÇÃO",                       # "CONSTITUIÇÃO DA REPÚBLICA"
    r"^CÓDIGO\s+(CIVIL|PENAL|PROCESSO)",   # "CÓDIGO CIVIL"
    r"^CONSOLIDAÇÃO\s+DAS\s+LEIS",         # "CONSOLIDAÇÃO DAS LEIS DO TRABALHO"
]
```

Cada lei detectada é classificada na taxonomia com um mapa pré-definido:

```python
CLASSIFICACAO_LEIS = {
    "CLT":          {"area": "Direito Trabalhista"},
    "Lei 8.213":    {"area": "Direito Previdenciário"},
    "Lei 8.742":    {"area": "Direito Previdenciário", "tema": "BPC/LOAS"},
    "EC 103":       {"area": "Direito Previdenciário", "tema": "Aposentadoria"},
    "Código Civil": {"area": "Direito Civil"},
    "CPC":          {"area": "Direito Processual Civil"},
    "CDC":          {"area": "Direito do Consumidor"},
    "CF":           {"area": "Direito Constitucional"},
}
```

A classificação por **tema** (nível 2) é feita automaticamente baseada nos artigos/títulos/capítulos dentro de cada lei.

---

## 4. Etapa 2 — Chunking Semântico Jurídico

### Princípio fundamental

**Um artigo NUNCA é partido no meio.** Parágrafos, incisos e alíneas são mantidos junto com seu artigo-pai. Um parágrafo solto sem contexto do artigo é inútil juridicamente.

### Hierarquia de quebras para documentos jurídicos

```
Prioridade de detecção (da mais alta para a mais baixa):

1. Títulos de lei           → "CONSOLIDAÇÃO DAS LEIS DO TRABALHO"
2. Títulos / Livros         → "TÍTULO II - DAS NORMAS GERAIS DE TUTELA DO TRABALHO"
3. Capítulos                → "CAPÍTULO I - DA IDENTIFICAÇÃO PROFISSIONAL"
4. Seções                   → "Seção I - Da Carteira de Trabalho e Previdência Social"
5. Artigos                  → "Art. 477." (sempre começa novo chunk)
6. Parágrafos               → "§ 1º", "§ 2º" (agrupados com o artigo-pai)
7. Incisos e alíneas        → I, II, III / a), b), c) (agrupados com o inciso-pai)
```

### Regras de chunking

```python
CONFIG = {
    "MAX_CHUNK_CHARS": 2400,   # Limite padrão
    "MIN_CHUNK_CHARS": 200,    # Chunks menores são mesclados com o anterior
    "OVERLAP_CHARS": 150,      # Contexto do chunk anterior como prefixo
}
```

**Regras especiais para legislação:**

1. **Artigo como unidade atômica:** Art. + todos os §§ + incisos + alíneas = 1 chunk (mesmo se > 2.400 chars)
2. **Artigos curtos são agrupados:** Arts. consecutivos < 200 chars cada → mesclados num chunk (ex: Arts. 478, 479, 480 da CLT)
3. **Overlap preserva contexto:** O chunk do Art. 478 começa com os últimos 150 chars do Art. 477, garantindo que referências como "conforme o artigo anterior" não se perdem
4. **Título da seção extraído:** Cada chunk carrega o título hierárquico como metadado

### Exemplo de chunk gerado

```json
{
  "id": "chunk_vademecum_clt_477",
  "content": "Art. 477. Na extinção do contrato de trabalho, o empregador deverá proceder à anotação na CTPS, comunicar a dispensa aos órgãos competentes e realizar o pagamento das verbas rescisórias no prazo estabelecido no § 6º deste artigo. § 1º (Revogado). § 2º O instrumento de rescisão ou recibo de quitação, qualquer que seja a causa ou forma de dissolução do contrato, deve ter especificada a natureza de cada parcela paga ao empregado e discriminado o seu valor, sendo válida a quitação, apenas, relativamente às mesmas parcelas. [...] § 6º A entrega ao empregado de documentos que comprovem a comunicação da extinção contratual aos órgãos competentes bem como o pagamento dos valores constantes do instrumento de rescisão ou recibo de quitação deverão ser efetuados até dez dias contados a partir do término do contrato. [...] § 8º A inobservância do disposto no § 6º deste artigo sujeitará o infrator à multa de 160 BTN, por trabalhador, bem assim ao pagamento da multa a favor do empregado, em valor equivalente ao seu salário...",
  "metadata": {
    "area": "Direito Trabalhista",
    "tema": "Rescisão Contratual",
    "legislacao": "CLT",
    "artigo": "477",
    "section_title": "Da Rescisão - Art. 477 CLT",
    "source_file": "vade_mecum_2026.pdf",
    "page_start": 234,
    "page_end": 235
  },
  "embedding": [0.023, -0.041, 0.087, ...]
}
```

### Detecção de padrões (regex)

```python
PADROES_JURIDICOS = {
    "artigo":     r"^Art\.\s*\d+[ºo°]?[\.-]?\s",
    "paragrafo":  r"^§\s*\d+[ºo°]?\s",
    "par_unico":  r"^Parágrafo\s+único[\.\s]",
    "inciso":     r"^[IVXLCDM]+\s*[-–—]\s",
    "alinea":     r"^[a-z]\)\s",
    "titulo":     r"^TÍTULO\s+[IVXLCDM]+",
    "capitulo":   r"^CAPÍTULO\s+[IVXLCDM]+",
    "secao":      r"^Seção\s+[IVXLCDM]+",
    "caixa_alta": r"^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{15,}$",  # Cabeçalhos de PDF
}
```

---

## 5. Etapa 3 — Geração de Embeddings

### Modelo recomendado

| Opção | Dimensões | Custo | Qualidade |
|-------|-----------|-------|-----------|
| Google `text-embedding-004` | 768 | Grátis (Gemini API) | Boa |
| OpenAI `text-embedding-3-small` | 1536 | ~$0.02/1M tokens | Muito boa |
| OpenAI `text-embedding-3-large` | 3072 | ~$0.13/1M tokens | Excelente |

**Recomendação:** Começar com Google `text-embedding-004` (grátis, boa qualidade), migrar para OpenAI se necessário.

### O que é armazenado

Para cada chunk, são armazenados **separadamente**:

1. **Embedding vetorial** → coluna `vector` no pgvector (busca semântica)
2. **Metadados estruturados** → colunas indexadas (filtro pré-busca)
3. **Conteúdo textual** → coluna `content` (match textual + exibição)

Os metadados são **indexados independentemente** dos vetores. Isso permite que o Estágio 1 (keywords) funcione sem tocar nos vetores — puro SQL com índices B-tree.

### Estimativa de volume para Vade Mecum

```
Vade Mecum (~2.000 páginas)
  → ~4.000 artigos de lei
  → ~6.000 chunks (artigos + agrupamentos)
  → ~6.000 embeddings de 768 dimensões
  → ~18 MB no pgvector (trivial para o Supabase)
```

---

## 6. Etapa 4 — Busca em 4 Estágios

Quando o advogado pergunta: **"Qual o prazo para pagamento das verbas rescisórias?"**

### Estágio 1 — Roteamento por Keywords (sem IA, sem custo, <5ms)

Matching determinístico de keywords contra um dicionário pré-definido.

```python
# Dicionário de keywords por área/tema
KEYWORDS = {
    "Rescisão Contratual": [
        "rescisão", "rescisórias", "verbas rescisórias", "demissão",
        "dispensa", "justa causa", "aviso prévio", "TRCT", "homologação",
        "Art. 477", "Art. 478", "Art. 479", "Art. 480", "Art. 484-A",
        "multa rescisória", "FGTS 40%", "saldo de salário"
    ],
    "Jornada de Trabalho": [
        "jornada", "hora extra", "horas extras", "banco de horas",
        "intervalo", "interjornada", "intrajornada", "turno",
        "Art. 58", "Art. 59", "Art. 71", "Art. 73"
    ],
    "Aposentadoria": [
        "aposentadoria", "aposentar", "tempo de contribuição",
        "idade mínima", "regra de transição", "pedágio", "pontos",
        "EC 103", "Lei 8.213", "INSS", "benefício previdenciário"
    ],
    # ... 40+ áreas com keywords específicas
}

# Scoring
PESOS = {
    "nome_direto": 10,    # "Rescisão Contratual" na query → +10
    "keyword_exata": 3,   # "rescisórias" → +3
    "keyword_parcial": 2, # "rescis" como substring → +2
}
```

**Aplicado à query:**

```
Query: "qual o prazo para pagamento das verbas rescisórias"

Scores:
  Rescisão Contratual:     10  ("verbas rescisórias" +3, "rescisórias" +3, implícito +4)
  Jornada de Trabalho:      0
  Contrato de Trabalho:     2  ("prazo" é genérico)
  Processo do Trabalho:     2
  Aposentadoria:            0

Resultado: filtrar apenas "Rescisão Contratual"
           → ignora ~95% dos chunks do Vade Mecum
```

**Regra:** Retorna top-4 áreas com score > 40% do score máximo. Se nenhuma área atingir o threshold, faz busca vetorial sem filtro (fallback).

### Estágio 2 — Profundidade por Plano do Usuário

Inspirado no sistema de certificações do AllyForce. A quantidade de chunks retornados (e portanto a profundidade da resposta) é proporcional ao plano.

| Plano | Chunks retornados | Tokens máx. contexto | Comportamento |
|-------|-------------------|---------------------|---------------|
| Básico | Top 3 | 2.500 | Art. 477 §6º + resposta direta |
| Intermediário | Top 6 | 4.000 | Art. 477 completo + súmulas relacionadas |
| Avançado | Top 10 | 6.000 | Art. 477 + jurisprudência + teses do banco pessoal |

### Estágio 3 — Busca Vetorial com Escopo Reduzido

Agora sim, busca por similaridade — mas **apenas nos chunks da área filtrada** pelo Estágio 1.

**Query SQL (pgvector no Supabase):**

```sql
SELECT
  id,
  content,
  metadata,
  1 - (embedding <=> query_embedding) AS cosine_similarity
FROM chunks
WHERE metadata->>'area' = 'Direito Trabalhista'
  AND metadata->>'tema' = 'Rescisão Contratual'
ORDER BY embedding <=> query_embedding
LIMIT 6;
```

**Score final (híbrido):**

```
Score = (similaridade_cosseno × 0.4)
      + (match_textual × 0.4)
      + (boost_metadado × 0.2)
```

| Componente | Peso | O que mede |
|-----------|------|-----------|
| Similaridade cosseno | 40% | Proximidade semântica do embedding |
| Match textual | 40% | Palavras exatas da query presentes no chunk ("verbas rescisórias", "prazo", "dez dias") |
| Boost de metadado | 20% | Título da seção contém termos da query |

**Regras adicionais de ranking:**

- **Diversity ranking:** Máximo 50% dos chunks do mesmo artigo (evita redundância)
- **Number pattern matching:** Identifica referências numéricas específicas ("Art. 477", "§ 6º")
- **Section title boost:** Se o `section_title` do chunk contém termos da query, score +0.2
- **Recency boost:** Para jurisprudência, decisões mais recentes ganham +0.1

### Estágio 4 — Montagem do Prompt Final

Os chunks recuperados são injetados no prompt com instruções claras:

```
=== BASE DE CONHECIMENTO (PRIORIDADE MÁXIMA) ===

[Chunk 1 — Relevância: 0.94]
Art. 477 CLT — Da Rescisão
"§ 6º A entrega ao empregado de documentos que comprovem a
comunicação da extinção contratual aos órgãos competentes bem
como o pagamento dos valores constantes do instrumento de
rescisão ou recibo de quitação deverão ser efetuados até dez
dias contados a partir do término do contrato."
📎 Fonte: CLT Art. 477 §6º | Área: Rescisão Contratual | Página: 234

[Chunk 2 — Relevância: 0.87]
Súmula 462 TST
"É desnecessária a homologação da rescisão contratual perante
o sindicato ou o Ministério do Trabalho para que sejam devidas
as verbas rescisórias."
📎 Fonte: Súmula 462 TST | Área: Rescisão Contratual

[Chunk 3 — Relevância: 0.82]
Art. 477 §8º CLT — Multa por atraso
"A inobservância do disposto no § 6º deste artigo sujeitará o
infrator à multa de 160 BTN, por trabalhador, bem assim ao
pagamento da multa a favor do empregado, em valor equivalente
ao seu salário..."
📎 Fonte: CLT Art. 477 §8º | Área: Rescisão Contratual | Página: 235

=== INSTRUÇÃO DE RESPOSTA ===
- Responda com base EXCLUSIVA nos chunks acima
- SEMPRE cite artigo, parágrafo e fonte (lei, súmula, OJ)
- Se a resposta não estiver nos chunks, diga "Não encontrei
  essa informação na base de conhecimento atual"
- NÃO invente informações que não estejam nos chunks
```

### Resposta gerada pela IA

```
O prazo para pagamento das verbas rescisórias é de **10 dias**
contados a partir do término do contrato, independentemente
do tipo de demissão (Art. 477, §6º da CLT).

Se o empregador não cumprir esse prazo, incorre em multa
equivalente ao salário do empregado (Art. 477, §8º da CLT).

**Nota:** Desde a Reforma Trabalhista (Lei 13.467/2017),
não é mais necessária a homologação sindical da rescisão
(Súmula 462 do TST).
```

---

## 7. Fluxo Visual Completo

### Upload (processamento único)

```
PDF do Vade Mecum
       │
       ▼
Extração de texto (PDF → texto puro)
       │
       ▼
Detecção de estrutura
├── É documento composto? (Vade Mecum = SIM)
├── Quais leis contém? (CLT, CC, CPC, CF...)
└── Classificação de cada lei na taxonomia
       │
       ▼
Chunking semântico por lei
├── Detectar artigos (Art. XXX)
├── Agrupar §§, incisos, alíneas com artigo-pai
├── Mesclar artigos curtos consecutivos
├── Adicionar overlap de 150 chars entre chunks
└── Extrair section_title como metadado
       │
       ▼
Geração de embeddings
├── Modelo: text-embedding-004 (768d)
├── Um embedding por chunk
└── Batch processing via job queue (Redis)
       │
       ▼
Armazenamento no pgvector (Supabase)
├── Embedding vetorial → coluna vector
├── Metadados → colunas indexadas (area, tema, legislacao, artigo)
└── Conteúdo → coluna content
```

### Busca (cada pergunta)

```
"Qual o prazo para pagamento das verbas rescisórias?"
       │
       ▼
Estágio 1: Roteamento por Keywords (<5ms, sem IA)
├── "rescisórias" → Rescisão Contratual (+3)
├── "verbas rescisórias" → Rescisão Contratual (+3)
├── Score: 10 pontos
└── Resultado: filtrar área "Rescisão Contratual"
       │
       ▼
Estágio 2: Profundidade por Plano
├── Plano intermediário → top 6 chunks
└── Max tokens: 4.000
       │
       ▼
Estágio 3: Busca Vetorial (apenas ~200 chunks, não 10.000+)
├── Similaridade cosseno (40%)
├── Match textual exato (40%)
├── Boost de metadado (20%)
├── Diversity: max 50% do mesmo artigo
└── Retorna top 6 chunks rankeados
       │
       ▼
Estágio 4: Montagem do Prompt
├── Chunks com fonte e relevância
├── Instrução: responder APENAS com base nos chunks
├── Instrução: citar artigo e fonte
└── Se fora do escopo: declarar limite
       │
       ▼
Resposta com citação de fonte
"10 dias (Art. 477, §6º CLT) + multa (Art. 477, §8º CLT)
+ Súmula 462 TST (homologação desnecessária)"
```

---

## 8. Schema do Banco de Dados

### Tabelas principais

```sql
-- Taxonomia de conhecimento
CREATE TABLE legal_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                    -- "Direito Trabalhista"
    slug TEXT NOT NULL UNIQUE,             -- "direito-trabalhista"
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE legal_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID REFERENCES legal_areas(id),
    name TEXT NOT NULL,                    -- "Rescisão Contratual"
    slug TEXT NOT NULL,                    -- "rescisao-contratual"
    keywords TEXT[] NOT NULL DEFAULT '{}', -- {"rescisão","rescisórias","demissão",...}
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(area_id, slug)
);

CREATE TABLE legal_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES legal_topics(id),
    name TEXT NOT NULL,                    -- "CLT Arts. 477-486"
    legislation TEXT NOT NULL,             -- "CLT"
    article_range TEXT,                    -- "477-486"
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Documentos uploadados
CREATE TABLE rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,               -- Path no Supabase Storage
    document_type TEXT NOT NULL,           -- "vade_mecum", "acordao", "doutrina", "lei"
    is_compound BOOLEAN DEFAULT false,     -- Vade Mecum = true
    total_chunks INTEGER DEFAULT 0,
    status TEXT DEFAULT 'processing',      -- "processing", "ready", "error"
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Chunks com embeddings
CREATE TABLE rag_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES rag_documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),

    -- Conteúdo
    content TEXT NOT NULL,
    section_title TEXT,                    -- "Da Rescisão - Art. 477 CLT"

    -- Taxonomia (filtros pré-busca)
    area TEXT NOT NULL,                    -- "Direito Trabalhista"
    tema TEXT,                             -- "Rescisão Contratual"
    legislacao TEXT,                       -- "CLT"
    artigo TEXT,                           -- "477"

    -- Metadados
    page_start INTEGER,
    page_end INTEGER,
    chunk_index INTEGER NOT NULL,          -- Ordem no documento

    -- Embedding
    embedding vector(768),                 -- pgvector (768d para text-embedding-004)

    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_chunks_area ON rag_chunks(area);
CREATE INDEX idx_chunks_tema ON rag_chunks(tema);
CREATE INDEX idx_chunks_legislacao ON rag_chunks(legislacao);
CREATE INDEX idx_chunks_artigo ON rag_chunks(artigo);
CREATE INDEX idx_chunks_user ON rag_chunks(user_id);
CREATE INDEX idx_chunks_document ON rag_chunks(document_id);

-- Índice vetorial (IVFFlat para performance com muitos chunks)
CREATE INDEX idx_chunks_embedding ON rag_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Keywords para roteamento (Estágio 1)
CREATE TABLE rag_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area TEXT NOT NULL,
    tema TEXT NOT NULL,
    keywords TEXT[] NOT NULL,              -- {"rescisão","rescisórias","demissão",...}
    keyword_weights JSONB DEFAULT '{}',    -- {"rescisão": 3, "Art. 477": 3}
    UNIQUE(area, tema)
);
```

### Query de busca completa (Estágios 1-3 combinados)

```sql
-- Estágio 1: Roteamento (identificar áreas relevantes)
-- Feito em Python com o dicionário de keywords (sem SQL)

-- Estágio 3: Busca vetorial filtrada por área
WITH scored_chunks AS (
    SELECT
        c.id,
        c.content,
        c.section_title,
        c.area,
        c.tema,
        c.legislacao,
        c.artigo,
        c.page_start,
        -- Score cosseno (40%)
        (1 - (c.embedding <=> $1)) * 0.4 AS cosine_score,
        -- Match textual (40%) — calculado em Python
        -- Boost metadado (20%) — calculado em Python
        (1 - (c.embedding <=> $1)) AS raw_similarity
    FROM rag_chunks c
    WHERE c.area = $2              -- Filtro do Estágio 1
      AND ($3 IS NULL OR c.tema = $3)  -- Filtro opcional de tema
      AND (c.user_id = $4 OR c.user_id IS NULL)  -- Docs do usuário + base pública
    ORDER BY c.embedding <=> $1
    LIMIT $5                       -- Estágio 2: limite por plano
)
SELECT * FROM scored_chunks;

-- $1 = query_embedding (vector)
-- $2 = área filtrada ("Direito Trabalhista")
-- $3 = tema filtrado ("Rescisão Contratual") ou NULL
-- $4 = user_id
-- $5 = limite de chunks (3, 6 ou 10 conforme plano)
```

---

## 9. Comparativo: RAG Simples vs. Taxonômico

| Aspecto | RAG Simples | RAG Taxonômico Jurídico |
|---------|------------|------------------------|
| Organização do conteúdo | Vetores planos numa tabela | Taxonomia de 4 níveis (área → tema → legislação → chunk) |
| Escopo da busca | Todos os chunks do banco | Filtrado por área/tema antes da busca vetorial |
| Roteamento da query | Busca vetorial em tudo | Keyword matching determinístico → áreas específicas |
| Chunking | Token fixo (500 tokens) | Semântico (artigo como unidade atômica) |
| Artigos de lei | Podem ser partidos no meio | NUNCA partidos — §§ e incisos ficam junto |
| Profundidade da resposta | Fixa para todos | Escalonada por plano do usuário |
| Custo por busca | Alto (compara contra tudo) | Baixo (pré-filtro reduz ~95% dos vetores) |
| Latência | ~200-500ms (10K chunks) | ~20-50ms (200 chunks filtrados) |
| Precisão em legislação | Pode misturar CPC com CLT | Impossível — o filtro por área impede |
| Documentos pessoais | Misturados com base geral | Separados por `user_id`, pesquisáveis individualmente |
| Fontes na resposta | Genéricas ou ausentes | Artigo + §§ + lei + página do PDF |
| Fallback | Nenhum | Match textual (70%) se cosseno falhar |

---

## 10. Viabilidade Técnica com Infra Atual

### O que já existe no Processa AI

| Componente necessário | Status | Observação |
|----------------------|--------|-----------|
| PostgreSQL (Supabase) | ✅ Existe | Banco principal do projeto |
| pgvector | ✅ Disponível | Extensão nativa do Supabase (só ativar) |
| Redis + Job Queue | ✅ Existe | `core/queue.py` já implementado |
| Worker assíncrono | ✅ Existe | Processa jobs de IA já |
| Extração de PDF | ✅ Existe | Usado no CNIS e brief-scanner |
| Geração de PDF | ✅ Existe | `markdown_pdf` já implementado |
| Sistema de créditos | ✅ Existe | Cobra por operação |
| Supabase Storage | ✅ Existe | Armazena uploads |
| Scheduler background | ✅ Existe | `core/scheduler.py` |

### O que precisa ser construído

| Componente | Esforço | Dependências |
|-----------|---------|-------------|
| Tabelas de taxonomia + chunks | Baixo | Migrations SQL |
| Ativar pgvector no Supabase | Trivial | Um comando SQL |
| Chunking semântico jurídico | Médio | Regex de padrões jurídicos |
| Classificador de documentos | Médio | Dicionário de leis → áreas |
| Dicionário de keywords por área | Médio | 40+ áreas com keywords manuais |
| Pipeline de embedding | Baixo | API call para text-embedding-004 |
| Endpoint de upload + indexação | Baixo | Novo endpoint na API |
| Endpoint de busca | Médio | SQL pgvector + scoring híbrido |
| Worker de processamento | Médio | Novo job type no Redis queue |

### Estimativa de custo

```
Upload do Vade Mecum (2.000 páginas):
  → ~6.000 chunks × embedding text-embedding-004
  → Google: GRÁTIS (até 1.500 req/min no Gemini API)
  → OpenAI: ~$0.02 (negligível)
  → Armazenamento pgvector: ~18 MB (trivial)

Busca por pergunta:
  → 1 embedding da query: grátis/negligível
  → 1 query SQL com pgvector: <50ms
  → 1 chamada LLM para resposta: custo normal do chat
  → Total adicional: ~$0.001 por busca
```

### Ativar pgvector no Supabase

```sql
-- Executar uma única vez no Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Apêndice: Tipos de Documento Suportados

| Tipo | Exemplo | Classificação |
|------|---------|--------------|
| `vade_mecum` | Vade Mecum Saraiva 2026 | Composto (múltiplas leis → múltiplas áreas) |
| `lei_avulsa` | Lei 13.467/2017 (Reforma Trabalhista) | Única área + múltiplos temas |
| `acordao` | Acórdão TST-RR-1234 | Área + tema extraídos da ementa |
| `sumula` | Súmula 462 TST | Área + tema extraídos do enunciado |
| `doutrina` | Manual de Direito do Trabalho | Composto (múltiplos temas) |
| `peca_propria` | Petição inicial redigida pelo advogado | Área + tema do caso |
| `contrato` | Contrato de prestação de serviços | Área: Civil → Contratos |
