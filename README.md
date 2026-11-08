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

Kinetix includes a cross-platform automated End-to-End smoke test (`scripts/e2e_test.mjs`) that automatically starts (or connects to) `services/ai-engine` (`:8001`) and `apps/api` (`:8000`) and verifies the full Phase 1 + Phase 2 Trello lifecycle:
1. **Health Checks:** Verifies `GET /health` on both `http://localhost:8001/health` and `http://localhost:8000/health` return `200 OK`.
2. **Board & Trello Defaults:** Creates a board (`POST /api/v1/boards`) and asserts default Trello `labels` (length $\ge 6$), `members` (length $\ge 1$), and 4 default `columns` (`Backlog`, `In Progress`, `Review`, `Done`) with fractional positions `"a0"`, `"a1"`, `"a2"`, `"a3"`.
3. **List (Column) Operations:** Reorders a column via `PATCH /api/v1/columns/:columnId/move` and copies a column via `POST /api/v1/columns/:columnId/copy`, verifying the duplicated column exists.
4. **Rich Trello Card Lifecycle:** Creates a card (`POST /api/v1/boards/:boardId/cards`), moves it via **O(1) Fractional Index Move** (`PATCH /api/v1/cards/:cardId/move`), and updates it via `PATCH /api/v1/cards/:cardId` with `cover`, `label_ids`, `member_ids`, multiple named `checklists` (`"Frontend Checklist"` & `"QA Checklist"`), and `is_due_complete: true`.
5. **Comments & Activity Feed:** Adds a Markdown comment via `POST /api/v1/cards/:cardId/comments` and verifies the comment and a corresponding `COMMENT_ADDED` entry in `board.activities`.
6. **AI Smart Card Enrichment & Decomposition:** Calls `POST /api/v1/cards/:cardId/ai-decompose` ($\rightarrow$ `POST /internal/v1/enrich-card` & `/internal/v1/decompose-task` with `X-Internal-Token` authentication) and verifies populated `checklists`, `subtasks`, `story_points`, and `priority`.
7. **Card Copy & Archive:** Copies the card via `POST /api/v1/cards/:cardId/copy` and archives the copy via `PATCH /api/v1/cards/:copiedCardId` (`{ is_archived: true }`).
8. **Live WebSocket Broadcast:** Verifies real-time room events on `/ws/boards/:boardId`.

Run the E2E smoke test with a single command:

```bash
node scripts/e2e_test.mjs
# or via root package.json:
npm run test:e2e
```

---

## Phase 2 Complete Trello Feature Parity & Workspace Guide

- **Rich 2-Column Trello Card Back Modal:** Click any card to open the full Trello Card Back dialog featuring a dynamic cover header, editable inline title, quick-add pills (Labels, Members, Checklist, Dates, Attachment, Cover), structured Markdown description editor with live preview, multiple named checklists with animated progress bars, Web/Link attachments, and a combined Markdown comments & activity timeline.
- **Customizable Card Covers & Expandable Color Labels:** Choose from 10 curated Trello cover colors and toggle between **Normal Header Strip** and **Full Card Tint** modes. Click any label pill on the board (or press `L`) to smoothly expand/collapse label text across all cards simultaneously.
- **Horizontal List (Column) Drag-and-Drop & List Actions:** Reorder entire lists horizontally with `@dnd-kit` and $O(1)$ fractional indexing (`PATCH /api/v1/columns/:columnId/move`), add new lists inline, rename list headers, set list accent colors & WIP limits, copy entire lists with their cards (`POST /api/v1/columns/:columnId/copy`), move/sort all cards in a list, or archive lists.
- **Multiple Named Checklists & Smart Due Dates:** Create multiple named checklists per card, toggle items with instant progress percentage bars, filter completed items, and track Start/Due dates with automatic **Complete** (green), **Due Soon** (amber), and **Overdue** (red) status badges.
- **Multi-View Switcher (Kanban Board, Calendar View & Table View):** Switch seamlessly between the **Kanban Board**, the **Monthly Calendar View** (plotting cards by due date with quick-navigation), and the **Spreadsheet Table View**.
- **Board Customization Menu, Backgrounds & Archived Items Drawer:** Star/bookmark boards, customize the board background from 12 curated gradients and solid surfaces, inspect the live board activity log, and restore or permanently manage archived cards and lists from the **Archived Items** drawer.
- **Member Assignment & Quick Filtering:** Assign workspace members (`Alex Rivera`, `Maya Lin`, `Samir Patel`, `Elena Rostova`) to cards and filter the board by member, label, due-date status, or **Blocker Radar** (`blocked_by_card_ids`).
- **✨ AI Smart Card Enrichment (`apps/web` $\rightarrow$ `apps/api` $\rightarrow$ `services/ai-engine`):** Click **✨ AI Smart Enrich** inside any card modal to synthesize a structured Markdown specification (`## Objective`, `## Technical Architecture`, `## Acceptance Criteria`), multiple categorized checklists (`Implementation Checklist` & `QA & Verification`), auto-matched Trello color labels, story points, and priority estimates.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Cmd + K` / `Ctrl + K` | Open the global **Command Palette** (search cards, switch views, trigger AI actions, change themes/backgrounds) |
| `C` or `N` | Open the **New Card** modal to create a card in the active board |
| `L` | Toggle **Expandable Label Text** across all cards on the Kanban board |
| `Q` | Toggle **"My Cards"** member filter (filters board to cards assigned to Alex Rivera) |
| `B` | Toggle the right-hand **Board Menu & Activity / Background Drawer** |
| `Esc` | Close the active Card Modal, Command Palette, or Popover |

---

## Documentation & Governance

- **[Architecture & Fractional Indexing Specification](./docs/architecture.md)**
- **[REST, WebSocket & Internal AI API Contract](./docs/api-contract.md)**
- **[OpenAPI 3.1 Specification](./packages/contracts/openapi.yaml)**
- **[Orca Worktree Agent Isolation Rules](./AGENT_RULES.md)**
