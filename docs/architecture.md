# Kanbanify — System Architecture, Port Registry & Fractional Indexing Specification

## 1. Tech Stack & System Topology

**Kanbanify** is a high-performance, real-time collaborative Kanban & AI workspace architected as a strictly isolated polyglot monorepo:

- **`apps/web`**: Next.js + TypeScript + Tailwind + Zustand + TanStack Query + `@dnd-kit`.
- **`apps/api`**: Node.js + Fastify + TypeScript + Drizzle ORM + `@fastify/websocket` + PostgreSQL + Redis.
- **`services/ai-engine`**: Python + FastAPI + Pydantic v2.
- **`packages/contracts`**: Shared Zod schemas (`index.ts`), Pydantic v2 models (`schemas.py`), and OpenAPI 3.1 specification (`openapi.yaml`).

```mermaid
flowchart LR
    Web["apps/web (Next.js :3000)"] <-->|REST + WS /ws/boards/:boardId| API["apps/api (Fastify :8000)"]
    API <-->|Drizzle ORM / SQL| PG[("PostgreSQL :5432")]
    API <-->|Pub/Sub & Cache| Redis[("Redis :6379")]
    API <-->|POST /internal/v1/decompose-task| AI["services/ai-engine (FastAPI :8001)"]
    Web -.->|Zod & TS Types| Contracts["packages/contracts"]
    API -.->|Zod & TS Types| Contracts
    AI -.->|Pydantic v2| Contracts
```

---

## 2. Locked Port & Environment Registry

All services and Gate 2 agents MUST use the exact ports and environment variables defined in `.env.example`:

```ini
# --- PORT REGISTRY (LOCKED) ---
WEB_PORT=3000
API_PORT=8000
AI_ENGINE_PORT=8001
POSTGRES_PORT=5432
REDIS_PORT=6379

# --- SERVICE URLS ---
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_USE_MOCK=true
INTERNAL_AI_ENGINE_URL=http://localhost:8001

# --- DATABASE & CACHE (OWNED EXCLUSIVELY BY apps/api) ---
DATABASE_URL=postgresql://kinetix:kinetix_secret@localhost:5432/kinetix_db
REDIS_URL=redis://localhost:6379/0

# --- SECURITY & AI ---
JWT_SECRET=super_secret_dev_key_change_in_prod
INTERNAL_SERVICE_TOKEN=orca_internal_sync_token_2026
LLM_API_KEY=your_llm_api_key_here
LLM_MODEL=gpt-4o-mini
```

| Service | Directory | Locked Port | Health Check Endpoint |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | `apps/web` | `3000` | `http://localhost:3000` |
| **Core API & WebSocket** | `apps/api` | `8000` | `GET http://localhost:8000/health` |
| **Internal AI Engine** | `services/ai-engine` | `8001` | `GET http://localhost:8001/health` |
| **PostgreSQL** | `infrastructure/docker` | `5432` | `pg_isready -p 5432` |
| **Redis** | `infrastructure/docker` | `6379` | `redis-cli -p 6379 ping` |

---

## 3. Single Database Owner Rule

- **Only `apps/api` connects to PostgreSQL (`DATABASE_URL`) and manages the Drizzle ORM schema and migrations.**
- `services/ai-engine` is strictly stateless and NEVER connects to PostgreSQL or Redis directly; it receives context from `apps/api` over internal HTTP (`POST /internal/v1/decompose-task` with header `X-Internal-Token: <INTERNAL_SERVICE_TOKEN>`) and returns structured JSON.
- `apps/web` communicates exclusively with `apps/api` via REST (`NEXT_PUBLIC_API_URL`) and WebSocket (`NEXT_PUBLIC_WS_URL`).

---

## 4. Fractional Indexing (`position` Field)

- **Lexicographical String Keys**: Cards (`CardSchema.position`), Columns (`ColumnSchema.position`), and Subtasks (`SubtaskSchema.position`) use lexicographical strings (e.g., `"a0"`, `"a1"`, `"a0V"`) instead of integer indices.
- **O(1) Reordering**: Moving a card between two existing cards (`"a0"` and `"a1"`) computes the lexicographical midpoint string (`"a0V"`) and updates **only that single card record in O(1) time** via `PATCH /api/v1/cards/:cardId/move`.
- **Default Columns on Board Creation**: Creating a board (`POST /api/v1/boards`) automatically creates 4 default columns with initial fractional positions:
  1. `Backlog` (`"a0"`)
  2. `In Progress` (`"a1"`)
  3. `Review` (`"a2"`)
  4. `Done` (`"a3"`)
- **Sorting**: All columns and cards returned by `GET /api/v1/boards/:boardId` MUST be sorted lexicographically (`ASC`) by `position`.

---

## 5. Optimistic UI & Real-Time Sync

- **Optimistic Drag-and-Drop**: `apps/web` computes the new lexicographical `position` and updates the local Zustand / TanStack Query cache immediately on drag-and-drop so the UI responds with zero perceived latency.
- **Background Persistence & Broadcast**: `apps/web` dispatches `PATCH /api/v1/cards/:cardId/move` to `apps/api`. `apps/api` persists the single-row update in PostgreSQL and broadcasts a `WSMessageSchema` (`event: "CARD_MOVED"`) over Fastify WebSocket (`/ws/boards/:boardId`, backed by Redis Pub/Sub) to synchronize all connected board peers in real time.
