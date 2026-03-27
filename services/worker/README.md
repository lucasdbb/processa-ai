# Processa AI - Worker Service

O **Worker** é um serviço assíncrono escrito em **Python 3.13** responsável pelo processamento pesado e integração com IA da plataforma Processa AI. Ele consome jobs de uma fila (Redis), executando tarefas como OCR de documentos, análise jurídica com LLMs (Large Language Models), geração de relatórios (DOCX) e ingestão de dados para RAG.

## 🚀 Tecnologias e Arquitetura

*   **Linguagem:** Python 3.13
*   **Fila/Cache:** Redis (Consumo via `BLPOP` e `redis-py`)
*   **Banco de Dados:** PostgreSQL (via Supabase / `psycopg` 3)
*   **Armazenamento:** Supabase Storage (para download e upload de documentos)
*   **IA & LLM:** Integração com modelos Gemini (análises) e Mistral OCR (fallback)
*   **Geração de Documentos:** `python-docx` para preenchimento de templates DOCX
*   **Processamento de Arquivos:** OCR e extração de texto de PDFs

O Worker opera de forma totalmente independente da API (`apps/backend`). Ele recebe a mensagem com o ID da tarefa, busca os detalhes no banco de dados, processa, salva os resultados e atualiza o status do job, liberando o backend de operações bloqueantes ou demoradas.

## 📂 Estrutura de Diretórios

```
services/worker/
├── src/
│   ├── assets/
│   │   └── templates/       # Templates .docx base para geração de relatórios
│   │       ├── calculadoras/
│   │       └── ia/
│   ├── core/                # Módulos core (Config, DB, Storage, OCR, LLM, Queue)
│   ├── handlers/            # Handlers específicos para cada tipo de Job
│   │   ├── reports/         # Geração de relatórios (CNIS, Rescisão, Brief Scanner)
│   │   ├── pipeline.py      # Pipeline principal de processamento
│   │   ├── ai_service.py    # Análise de IA
│   │   ├── rag_ingest.py    # Processamento e chunking para RAG (Vector Search)
│   │   └── ...
│   ├── prompts/             # System prompts e instruções para os LLMs
│   └── main.py              # Entry point do Worker (Event Loop / Polling do Redis)
├── Dockerfile               # Configuração do container
├── pyproject.toml           # Dependências Python
└── .env.example             # Variáveis de ambiente
```

## ⚙️ Configuração Local

### 1. Pré-requisitos
*   Python 3.13+
*   [uv](https://docs.astral.sh/uv/) (Package manager)
*   Redis Server rodando (localmente ou via Docker)
*   PostgreSQL / Supabase

### 2. Instalação

```bash
cd services/worker
uv sync
```

### 3. Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```env
ENVIRONMENT=development

# Fila
REDIS_URL=redis://localhost:6379/0
REDIS_QUEUE_NAME=processa_ai_tasks

# Banco de Dados
DATABASE_URL=postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# Provedores de IA
GEMINI_API_KEY=AI...
MISTRAL_API_KEY=xxx
```

### 4. Executando o Worker

O Worker roda como um processo contínuo em background, ouvindo a fila do Redis:

```bash
uv run python -m src.main
```

## 🧠 Fluxo de Execução (Exemplo: Análise de Documento)

1. O usuário faz upload de um documento no **Frontend**.
2. O **Backend** salva os metadados no Supabase, gera o arquivo no Storage e enfileira uma mensagem no **Redis**.
3. O **Worker** (`src.main.py`) detecta a mensagem via `BLPOP`.
4. O `pipeline.py` orquestra o processo:
    - Baixa o documento do Supabase Storage (`core/storage.py`).
    - Extrai o texto via OCR/PDF Parsing quando necessário (`core/ocr.py`) ou envia PDF direto ao Gemini.
    - Envia o conteúdo e instruções (`prompts/`) para o pipeline Gemini (`handlers/pipeline.py`).
    - Recebe o JSON/Resposta do modelo.
    - Gera um documento DOCX baseado em templates (`handlers/reports/`).
    - Faz o upload do resultado no Storage e atualiza o banco de dados.
    - Atualiza o status do Job para `completed`.
5. O usuário vê o resultado final na interface.
