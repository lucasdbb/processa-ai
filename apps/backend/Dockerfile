# FastAPI Backend with uv
FROM python:3.13-slim

WORKDIR /app

# Install uv
ADD https://astral.sh/uv/install.sh /tmp/install.sh
RUN sh /tmp/install.sh && rm /tmp/install.sh
ENV PATH="/root/.cargo/bin:$PATH"

# Copy project files
COPY pyproject.toml ./
COPY src ./src

# Install dependencies
RUN uv sync --no-dev

# Run application (Railway will set PORT env var)
CMD uv run uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}
