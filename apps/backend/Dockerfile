# FastAPI Backend with uv
FROM python:3.13-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
ENV PATH="/root/.local/bin:$PATH"

# Copy project files
COPY pyproject.toml ./
COPY src ./src

# Install dependencies and activate venv
RUN uv sync --no-dev

# Add venv to PATH so Python can find installed packages
ENV PATH="/app/.venv/bin:$PATH"

# Run application directly using venv Python
CMD ["python", "src/main.py"]
