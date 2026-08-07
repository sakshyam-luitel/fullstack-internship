# syntax=docker/dockerfile:1
FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY pyproject.toml ./

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
        "fastapi[standard]" \
        "uvicorn[standard]" \
        "alembic>=1.13.0" \
        "sqlalchemy>=2.0.0" \
        "psycopg2-binary>=2.9.0" \
        "python-dotenv>=1.2.2"

COPY . .



EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
