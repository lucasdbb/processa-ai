FROM python:3.13-slim

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml .python-version ./

RUN uv sync

COPY src ./src

ENV PATH="/app/.venv/bin:$PATH"

CMD ["python", "-m", "src.main"]
