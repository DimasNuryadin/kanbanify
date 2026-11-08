# Kinetix

**High-Performance Real-Time Kanban & AI Workspace**

Kinetix is a polyglot monorepo combining an optimistic real-time Kanban & Table workspace (`apps/web`), a low-latency Fastify REST + WebSocket coordination server with lexicographical O(1) fractional indexing (`apps/api`), and a stateless FastAPI AI task-decomposition microservice (`services/ai-engine`), unified by strict 1:1 physical data contracts (`packages/contracts`).

---

## System Architecture & Tech Stack

```mermaid
flowchart LR
    subgraph Client ["apps/web (Next.js 16 — Port 3000)"]
        UI["React 19 + Tailwind v4\n@dnd-kit + Command Palette (Cmd+K)"]
        Store["Zustand v5 + TanStack Query v5\nOptimistic O(1) Fractional Indexer"]
    end

    subgraph CoreAPI ["apps/api (Fastify v5 — Port 8000)"]
        REST["REST API (/api/v1/*)\nZod Contract Validation"]
        WS["WebSocket Hub (/ws/boards/:boardId)\nReal-Time Broadcast"]
        Repo["Drizzle ORM + In-Memory Fallback"]
    end

    subgraph AIEngine ["services/ai-engine (FastAPI — Port 8001)"]
        Decomposer["POST /internal/v1/decompose-task\nLLM + Domain-Aware Heuristic Engine"]
    end

    subgraph Infra ["Infrastructure (Docker Compose)"]
        PG[("PostgreSQL 16\n(Port 5432)")]
        RD[("Redis 7 Pub/Sub\n(Port 6379)")]
    end

    UI <--> Store
    Store -- "REST JSON (HTTP :8000)" --> REST
    Store <-- "Live Events (WS :8000)" --> WS
    REST --> Repo
    Repo <--> PG
    WS <--> RD
    REST -- "X-Internal-Token (:8001)" --> Decomposer
```

### Tech Stack Summary

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Web Workspace (`apps/web`)** | Next.js 16 (App Router), React 19, Tailwind CSS v4, `@dnd-kit`, Zustand v5, TanStack Query v5, Lucide Icons | Optimistic Kanban & Table UI, O(1) Fractional Drag-and-Drop, `Cmd+K` Command Palette, Live WebSocket Sync |
| **Core API & WS (`apps/api`)** | Node.js 20+, Fastify v5, `@fastify/websocket`, `@fastify/cors`, Drizzle ORM, `pg`, `ioredis`, Zod v4 | REST endpoints, WebSocket real-time room fan-out, AI proxy, PostgreSQL & Redis persistence with automatic in-memory fallback |
| **AI Engine (`services/ai-engine`)** | Python 3.11/3.12, FastAPI, Uvicorn, Pydantic v2, `httpx`, OpenAI/LiteLLM | Stateless AI task decomposition (`suggested_subtasks`, `estimated_story_points`, `suggested_priority`, `potential_risks`) with deterministic zero-config fallback |
| **Shared Contracts (`packages/contracts`)** | TypeScript (`index.ts`), Python Pydantic v2 (`schemas.py`), OpenAPI 3.1 (`openapi.yaml`) | Single source of truth for all REST, WebSocket, and Internal AI schemas |
| **Infrastructure (`infrastructure/docker`)** | Docker Compose, PostgreSQL 16 Alpine, Redis 7 Alpine | Containerized 5-service production stack with healthchecks |

---

## Locked Port Registry

| Service | Path | Port | URL / Endpoint |
| :--- | :--- | :--- | :--- |
| **Web App** | `apps/web` | `3000` | `http://localhost:3000` |
| **Core API & WS** | `apps/api` | `8000` | `http://localhost:8000` (`ws://localhost:8000/ws/boards/:boardId`) |
| **AI Engine** | `services/ai-engine` | `8001` | `http://localhost:8001` |
| **PostgreSQL** | `infrastructure/docker` | `5432` | `postgresql://kinetix:kinetix_secret@localhost:5432/kinetix_db` |
| **Redis** | `infrastructure/docker` | `6379` | `redis://localhost:6379/0` |

---

## 1-Command Docker Quickstart

Launch all 5 services (`postgres`, `redis`, `ai-engine`, `api`, and `web`) with healthchecks wired automatically:

```bash
cp .env.example .env
docker compose up --build
```

Or run in detached mode using the root npm script:

```bash
npm run docker:up
```

Once started:
- **Web Workspace:** [http://localhost:3000](http://localhost:3000)
- **Core API Health:** [http://localhost:8000/health](http://localhost:8000/health)
- **AI Engine Health:** [http://localhost:8001/health](http://localhost:8001/health)

---

## Local Development Quickstart (Without Docker)

Kinetix is designed to run seamlessly on **Windows, macOS, and Linux** even without Docker/PostgreSQL/Redis running locally (`apps/api` automatically falls back to a pre-seeded in-memory store and in-process WebSocket hub, and `services/ai-engine` includes a deterministic domain-aware heuristic engine when no `LLM_API_KEY` is provided).

### 1. Environment Setup

```bash
cp .env.example .env
```

### 2. Install Dependencies

```bash
# Install Core API dependencies
cd apps/api && npm install && cd ../..

# Install Web Frontend dependencies
cd apps/web && npm install && cd ../..

# Sync Python AI Engine environment (using uv or pip)
cd services/ai-engine && uv sync && cd ../..
```

### 3. Start the Services

Open 3 terminals from the repository root:

```bash
# Terminal 1 — Start AI Engine (Port 8001)
npm run dev:engine

# Terminal 2 — Start Core API & WebSocket Server (Port 8000)
npm run dev:api

# Terminal 3 — Start Next.js Web Workspace (Port 3000)
npm run dev:web
```

Then open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Automated E2E Smoke Test

Kinetix includes a cross-platform automated End-to-End smoke test (`scripts/e2e_test.mjs`) that automatically starts (or connects to) `services/ai-engine` (`:8001`) and `apps/api` (`:8000`) and verifies the full lifecycle:
1. Health checks on both `http://localhost:8001/health` and `http://localhost:8000/health`.
2. Board creation (`POST /api/v1/boards`) and verification of the 4 default columns (`Backlog`, `In Progress`, `Review`, `Done`) with fractional positions `"a0"`, `"a1"`, `"a2"`, `"a3"`.
3. Card creation (`POST /api/v1/boards/:boardId/cards`) and **O(1) Fractional Index Move** (`PATCH /api/v1/cards/:cardId/move`) to `In Progress` at position `"a0V"`.
4. Live WebSocket broadcast verification on `/ws/boards/:boardId`.
5. Cross-service **AI Task Decomposition** (`POST /api/v1/cards/:cardId/ai-decompose` -> `POST /internal/v1/decompose-task` with `X-Internal-Token` authentication) verifying populated `subtasks`, `story_points`, and `priority`.

Run the E2E smoke test with a single command:

```bash
node scripts/e2e_test.mjs
# or via root package.json:
npm run test:e2e
```

---

## UI Features Guide

- **Live API / Mock Mode Toggle:** Starts in **Live API Mode** (`NEXT_PUBLIC_USE_MOCK=false`) connected to `http://localhost:8000` and `ws://localhost:8000/ws/boards/:boardId`. Includes a header toggle to switch between **Live API** and standalone **Mock Mode** at any time, plus automatic graceful fallback if the backend is offline.
- **Light / Dark / System Mode Toggle:** Instant zero-flash theme switching in the top header and Command Palette, styled with a Linear/Vercel-inspired Zinc & Indigo design system.
- **`Cmd+K` / `Ctrl+K` Command Palette:** Keyboard-first modal to create issues, switch between Kanban and Table views, filter by priority, toggle Blocker Radar, switch themes, or jump directly to any card.
- **Multi-View Switcher (Kanban Board & Table View):** Switch seamlessly between the multi-column drag-and-drop **Kanban Board** (with WIP limit indicators) and the high-density **Spreadsheet Table View** with inline column status & priority selectors.
- **O(1) Fractional Drag-and-Drop:** Reordering or moving cards computes a lexicographical midpoint string (`prevPos` + `nextPos` $\rightarrow$ `"a0V"`) in $O(1)$ time, displayed live in the header telemetry pill and persisted via `PATCH /api/v1/cards/:cardId/move`.
- **Blocker Radar:** Cards with upstream dependencies (`blocked_by_card_ids`) display a red **Blocked** radar badge and can be filtered with one click via the **Blocker Radar** header pill or managed inside the Card Detail Drawer.
- **✨ AI Task Decomposer:** Open any card to launch the slide-over **Card Detail Drawer** and click **✨ AI Decompose Task**. Requests flow from `apps/web` $\rightarrow$ `apps/api` $\rightarrow$ `services/ai-engine` to synthesize actionable engineering subtasks (with fractional index positions), story points, and priority estimates.

---

## Documentation & Governance

- **[Architecture & Fractional Indexing Specification](./docs/architecture.md)**
- **[REST, WebSocket & Internal AI API Contract](./docs/api-contract.md)**
- **[OpenAPI 3.1 Specification](./packages/contracts/openapi.yaml)**
- **[Orca Worktree Agent Isolation Rules](./AGENT_RULES.md)**
