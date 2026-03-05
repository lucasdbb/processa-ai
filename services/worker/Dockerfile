FROM python:3.13-slim

WORKDIR /app

# LibreOffice headless for DOCX -> PDF conversion
RUN apt-get update && \
    apt-get install -y --no-install-recommends libreoffice-writer && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml .python-version ./

RUN uv sync

COPY src ./src

ENV PATH="/app/.venv/bin:$PATH"

CMD ["python", "-m", "src.main"]
