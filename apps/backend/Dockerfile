# FastAPI Backend with uv
FROM python:3.13-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
ENV PATH="/root/.local/bin:$PATH"

# Copy project files
COPY pyproject.toml ./
COPY src ./src

# Install dependencies
RUN uv sync --no-dev

# Run application (Railway will set PORT env var)
CMD ["uv", "run", "python", "src/main.py"]
