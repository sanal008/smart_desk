FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml backend/uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev

COPY backend/ ./
COPY ml/ /ml/

RUN uv run python /ml/generate_corpus.py \
    && ML_ARTIFACTS_DIR=/app/ai/artifacts uv run python manage.py collectstatic --noinput || true

EXPOSE 8000

CMD ["uv", "run", "python", "manage.py", "runserver", "0.0.0.0:8000"]
