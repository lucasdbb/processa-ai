FROM python:3.13-slim

WORKDIR /app

# Instalar uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copiar arquivos de configuração e código
COPY pyproject.toml .python-version ./
COPY src ./src

# Instalar dependências
RUN uv sync

# Adicionar venv ao PATH
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
