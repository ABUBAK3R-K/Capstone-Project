# Recommendation service image (used by render.yaml at the repo root, but
# runs anywhere that sets $PORT: Render, Fly.io, Railway, plain `docker run`).
#
#   docker build -t cityguide-recs recommendation-service
#   docker run --env-file recommendation-service/.env -p 8000:8000 cityguide-recs

FROM python:3.11-slim

# implicit ships manylinux wheels for 3.11; libgomp is its OpenMP runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # implicit warns (and slows down) when BLAS spawns its own thread pool.
    OPENBLAS_NUM_THREADS=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
# One worker: the similarity cache is per-process memory, so N workers would
# hold N copies of an N x N matrix.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
