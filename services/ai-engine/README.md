# Kinetix Internal AI Engine (`services/ai-engine`)

Stateless FastAPI microservice bound to port `8001` (`AI_ENGINE_PORT=8001`) providing:
- `GET /health`
- `POST /internal/v1/decompose-task` (protected by `X-Internal-Token`)
- `POST /internal/v1/enrich-card` (protected by `X-Internal-Token`)
- `POST /internal/v1/parse-automation` (protected by `X-Internal-Token`)
- `POST /internal/v1/analyze-board` (protected by `X-Internal-Token`)
