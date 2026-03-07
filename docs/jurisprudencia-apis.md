# Acesso a Jurisprudência Brasileira — APIs e Scraping

## O Problema em Duas Camadas

A jurisprudência brasileira se divide em dois tipos de dados distintos:

| Camada | O que é | Solução |
|---|---|---|
| **Metadados do processo** | Número, classe, assunto, tribunal, datas, movimentações | DataJud (API unificada) |
| **Texto da decisão / ementa** | Inteiro teor, ementa, súmulas | Cada tribunal individualmente |

---

## 1. DataJud (CNJ) — Melhor Ponto de Partida

**O que é:** API pública unificada do CNJ que cobre **todos os tribunais brasileiros** — STJ, STF, TST, 24 TRTs, 27 TJs estaduais, TRFs, TREs.

**O que tem:** Metadados do processo — número CNJ, classe, assunto, tribunal, datas, movimentações.
**O que NÃO tem:** Texto das decisões ou ementa.

**Autenticação:** Chave pública, sem registro necessário.

```
Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
```

**Base URL:** `https://api-publica.datajud.cnj.jus.br/`

### Endpoints por Tribunal

```
# Tribunais Superiores
api_publica_stj/_search
api_publica_stf/_search
api_publica_tst/_search
api_publica_tse/_search

# Tribunais Regionais Federais
api_publica_trf1/_search  → api_publica_trf6/_search

# Tribunais Regionais do Trabalho
api_publica_trt1/_search  → api_publica_trt24/_search

# Tribunais de Justiça Estaduais
api_publica_tjsp/_search
api_publica_tjrj/_search
api_publica_tjmg/_search
api_publica_tjrs/_search
# ... todos os 27 estados (tjac, tjal, tjam, tjap, tjba, tjce, tjdft, tjes, tjgo,
#     tjma, tjms, tjmt, tjpa, tjpb, tjpe, tjpi, tjpr, tjrn, tjro, tjrr, tjsc, tjse, tjto)
```

### Exemplo de Busca

```bash
POST https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search
Content-Type: application/json
Authorization: APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==

{
  "query": {
    "bool": {
      "must": [
        { "match": { "classe.nome": "Recurso Especial" } }
      ],
      "filter": [
        { "range": { "dataAjuizamento": { "gte": "2023-01-01" } } }
      ]
    }
  },
  "size": 10,
  "from": 0
}
```

### Campos Disponíveis

| Campo | Descrição |
|---|---|
| `numeroProcesso` | Número CNJ unificado |
| `classe` | Classe processual (código + nome) |
| `tribunal` | Sigla do tribunal |
| `grau` | Instância (G1, G2, JE, etc.) |
| `dataAjuizamento` | Data de ajuizamento |
| `orgaoJulgador` | Órgão julgador (código, nome, município IBGE) |
| `assuntos` | Array de assuntos (código + descrição) |
| `movimentos` | Array de movimentações com datas e códigos |
| `nivelSigilo` | Nível de sigilo |
| `dataHoraUltimaAtualizacao` | Última atualização |

**Paginação:** usa `search_after` do Elasticsearch.

**Docs oficiais:** https://datajud-wiki.cnj.jus.br/api-publica/

---

## 2. Texto Completo das Decisões (por tribunal)

### STJ

| Item | Detalhe |
|---|---|
| **Fonte** | SCON — https://processo.stj.jus.br/SCON/ |
| **Método** | Scraping (HTML + PDF) |
| **Dificuldade** | Média |
| **API oficial** | Não existe |
| **O que tem** | Ementa, inteiro teor, ministro relator, órgão julgador, data, publicação DJe |

Libs da comunidade (Python/R):
- https://github.com/lucianlorens/stj (Python)
- https://github.com/jjesusfilho/stj (R)
- https://github.com/courtsbr/stj (R)

---

### STF

| Item | Detalhe |
|---|---|
| **Fonte** | https://jurisprudencia.stf.jus.br/ |
| **Método** | Scraping (React SPA) ou chamadas à API interna do frontend |
| **Dificuldade** | Média-Alta |
| **API oficial** | Não documentada publicamente |
| **O que tem** | Acórdãos desde 1950, súmulas, decisões monocráticas, informativos |

Libs da comunidade:
- https://github.com/courtsbr/stf (R)
- https://github.com/diego-feijo/rulingbr (dataset STF 2011–2018, pré-coletado)

---

### TST + TRTs (Sistema Falcão)

| Item | Detalhe |
|---|---|
| **Fonte** | Sistema Falcão — https://jurisprudencia.jt.jus.br/ |
| **Método** | Scraping (React SPA) |
| **Dificuldade** | Média |
| **Cobertura** | Todos os 24 TRTs + TST, decisões desde 2016 |
| **O que tem** | Acórdãos, sentenças, decisões de admissibilidade, IRDRs, IACs, súmulas, OJs, teses jurídicas |

Contato para acesso programático: nugepsp@tst.jus.br

---

### TJs Estaduais

| Item | Detalhe |
|---|---|
| **Fonte** | Portal individual de cada TJ |
| **Método** | Scraping por estado |
| **Dificuldade** | Alta (cada TJ tem estrutura diferente) |
| **Exceção** | TJDFT tem API pública de jurisprudência documentada |

Para metadados: DataJud cobre todos os 27 TJs.

---

## 3. APIs Comerciais

### Escavador API

- **Docs:** https://api.escavador.com/v2/docs/
- **Auth:** Bearer Token (gerado em https://api.escavador.com/tokens)
- **Rate limit:** 500 req/min (documentado)
- **Foco:** Monitoramento de processos por CPF/CNPJ — **não** texto de jurisprudência
- **Precificação:** Créditos por uso (público em https://api.escavador.com/servicos)
- **Paginação:** Cursor-based

Endpoints principais:
```
GET /processos/numero_cnj/{numero}
GET /processos/numero_cnj/{numero}/movimentacoes
GET /envolvido/processos
```

---

### JusBrasil B2B

- **Cobertura:** 90M+ decisões indexadas — melhor cobertura disponível
- **API:** Existe, mas é **comercial — acesso por contato** (sem preço público)
- **Docs:** https://api.jusbrasil.com.br/docs/index.html
- **Scraping do site público:** Viola ToS, arriscado juridicamente

---

## 4. Resumo de Viabilidade

| Fonte | Acesso | Dados | Custo | Risco |
|---|---|---|---|---|
| DataJud (CNJ) | API pública com chave aberta | Metadados (sem texto) | Gratuito | Nenhum |
| STJ SCON | Scraping HTML/PDF | Ementa + inteiro teor | Gratuito | Baixo |
| STF | Scraping React SPA | Ementa + inteiro teor | Gratuito | Baixo |
| Sistema Falcão | Scraping React SPA | Trabalhista completo | Gratuito | Baixo |
| TJs | Scraping individual | Variável | Gratuito | Baixo |
| Escavador API | API documentada | Monitoramento de processos | Pago (créditos) | Nenhum |
| JusBrasil B2B | API comercial (contato) | Tudo | Pago (alto) | Nenhum |

> **Nota legal:** Tribunais brasileiros publicam decisões como informação pública. Scraping de portais oficiais é geralmente permitido. Deve-se observar a LGPD ao tratar dados pessoais presentes nas decisões.

---

## 5. Estratégia de Implementação para o Processa AI

### Fase 1 — Rápido e gratuito

1. **DataJud** para descoberta e filtros de processos (todos os tribunais, gratuito, JSON, Elasticsearch)
2. **Scraping STJ SCON** para ementas de direito civil e previdenciário
3. **Sistema Falcão** para decisões trabalhistas (TST + todos os TRTs)

### Fase 2 — Produção

4. **STF** via chamadas à API interna do SPA para casos constitucionais
5. **Escavador** para monitoramento de processos por cliente (CPF/CNPJ)

### Fase 3 — Escala

6. **JusBrasil B2B** se a base de usuários justificar o investimento

---

## 6. Banco Pessoal de Jurisprudência (feature interna)

Para a funcionalidade de "segundo cérebro jurídico" (acórdãos do próprio advogado):

```
Fluxo:
  Advogado faz upload do acórdão (PDF)
  → LLM extrai ementa, teses, dispositivos legais
  → Gera embedding do texto
  → Armazena no pgvector do Supabase (já disponível no projeto)
  → Busca semântica por linguagem natural
```

**Vantagem:** Sem dependência de API externa. Funciona 100% na infraestrutura já existente no Processa AI.
