# syntax=docker/dockerfile:1
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY pyproject.toml ./

RUN uv sync --no-dev --no-install-project

COPY . .



EXPOSE 8000

CMD ["sh", "-lc", "uv run uvicorn main:app --host 0.0.0.0 --port 8000"]
