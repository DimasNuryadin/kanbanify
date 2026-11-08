# ==============================================================================
# Kinetix Internal AI Engine Dockerfile (Python 3.11 FastAPI — Port 8001)
# Build Context: Monorepo Root (.)
# ==============================================================================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    AI_ENGINE_PORT=8001

WORKDIR /workspace

# Copy shared Pydantic v2 physical contracts (packages/contracts/schemas.py)
COPY packages/contracts ./packages/contracts

# Copy AI Engine service files
COPY services/ai-engine ./services/ai-engine

WORKDIR /workspace/services/ai-engine
RUN pip install --upgrade pip && pip install .

EXPOSE 8001

HEALTHCHECK --interval=5s --timeout=3s --retries=5 --start-period=5s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=2)" || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
