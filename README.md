# Kanbanify

**High-Performance Real-Time Kanban & AI Workspace**

Kanbanify is a polyglot monorepo combining an optimistic real-time Multi-Board Kanban, Calendar, Table & Sprint Analytics workspace (`apps/web`), a low-latency Fastify REST + WebSocket coordination server with lexicographical O(1) fractional indexing, a Trello Butler Runtime Automation Engine, real-time Sprint Analytics Aggregator, and Native Trello JSON Importer / CSV Exporter (`apps/api`), and a stateless FastAPI AI task-decomposition, Natural Language Butler Rule Compiler & Executive Sprint Health Analyzer microservice (`services/ai-engine`), unified by strict 1:1 physical data contracts (`packages/contracts`).

---

## System Architecture & Tech Stack

```mermaid
flowchart LR
    subgraph Client ["apps/web (Next.js 16 — Port 3000)"]
        UI["React 19 + Tailwind v4\nKanban / Calendar / Table / Analytics / Graph / Retro + Pomodoro Dock + Time Tracking"]
        Store["Zustand v5 + TanStack Query v5\nOptimistic O(1) Fractional Indexer & Auth/RBAC Store"]
    end

    subgraph CoreAPI ["apps/api (Fastify v5 — Port 8000)"]
        REST["REST API (/api/v1/*)\nZod Contract Validation & RBAC Guard"]
        Auth["Auth Service & JWT\nRegister, Login, Demo Users & Token Verification"]
        Invites["Shareable Invites Service\nCreate, Preview & Join Board Links"]
        CustomFields["Custom Fields Service\nCRUD Definitions, Dropdowns & Value Assignments"]
        DepGraph["Dependency Graph Service\nCycle-Safe Linking & DAG Engine"]
        Theme["Theme Studio Service\nPresets & Glassmorphism Persistence"]
        TimeTracking["Time Tracking & Pomodoro Service\nStopwatch, Worklogs & Pomodoro Auto-Logger"]
        Retro["Sprint Retrospective Service\n4-Column Retro, Upvotes & Card Converter"]
        Butler["Butler Automation Engine\nRuntime Trigger & Action Executor"]
        Analytics["Analytics & Data Portability\nBurndown + Trello JSON Import + CSV/JSON Export"]
        Presence["Presence & Typing Hub\nGET/POST /presence & WS sync"]
        Webhook["Webhook Dispatcher\nSlack Block Kit & Discord Embeds"]
        WS["WebSocket Hub (/ws/boards/:boardId)\nReal-Time Broadcast"]
        Repo["Drizzle ORM + In-Memory Fallback"]
    end

    subgraph AIEngine ["services/ai-engine (FastAPI — Port 8001)"]
        Decomposer["POST /internal/v1/decompose-task\nPOST /internal/v1/enrich-card"]
        RuleParser["POST /internal/v1/parse-automation\nBilingual ID/EN Butler Rule Compiler"]
        BoardAnalyzer["POST /internal/v1/analyze-board\nAI Executive Sprint Health & Bottleneck Analyzer"]
        Auditor["POST /internal/v1/audit-permissions\nAI Workspace Access & Permission Auditor"]
        Formatter["POST /internal/v1/format-notification\nAI ChatOps Digest & Notification Formatter"]
        CriticalPath["POST /internal/v1/analyze-dependencies\nAI Critical Path & Bottleneck Analyzer"]
        RetroSynthesizer["POST /internal/v1/synthesize-retro\nAI Sprint Retro Synthesizer & Estimation Analyzer"]
    end

    subgraph Infra ["Infrastructure (Docker Compose)"]
        PG[("PostgreSQL 16\n(Port 5432)")]
        RD[("Redis 7 Pub/Sub\n(Port 6379)")]
    end

    UI <--> Store
    Store -- "REST JSON + JWT/Role (HTTP :8000)" --> REST
    Store <-- "Live Events (WS :8000)" --> WS
    REST --> Auth
    REST --> Invites
    REST --> CustomFields
    REST --> DepGraph
    REST --> Theme
    REST --> TimeTracking
    REST --> Retro
    REST --> Butler
    REST --> Analytics
    REST --> Presence
    REST --> Webhook
    Auth --> Repo
    Invites --> Repo
    CustomFields --> Repo
    DepGraph --> Repo
    Theme --> Repo
    TimeTracking --> Repo
    Retro --> Repo
    Butler --> Repo
    Analytics --> Repo
    Presence --> WS
    Webhook --> Repo
    REST --> Repo
    Repo <--> PG
    WS <--> RD
    REST -- "X-Internal-Token (:8001)" --> Decomposer
    REST -- "X-Internal-Token (:8001)" --> RuleParser
    REST -- "X-Internal-Token (:8001)" --> BoardAnalyzer
    REST -- "X-Internal-Token (:8001)" --> Auditor
    DepGraph -- "X-Internal-Token (:8001)" --> CriticalPath
    Retro -- "X-Internal-Token (:8001)" --> RetroSynthesizer
    Webhook -- "X-Internal-Token (:8001)" --> Formatter
```

### Tech Stack Summary

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Web Workspace (`apps/web`)** | Next.js 16 (App Router), React 19, Tailwind CSS v4, `@dnd-kit`, Zustand v5, TanStack Query v5, Lucide Icons | Real-Time Card Stopwatch (`CardLiveTimerBadge`, `CardTimeTrackingSection`), Floating Dockable Pomodoro Focus Timer (`PomodoroDock`) with circular SVG progress ring and audio chimes, 4-Column Sprint Retrospective Board (`"🔄 Retro"` View) with upvoting & 1-click Convert to Kanban Card, AI Sprint Retrospective Synthesizer Panel, 1-Click Demo Role Switcher (`ADMIN`, `EDITOR`, `VIEWER`), Read-Only Enforcement Mode for Viewers, Shareable Board Invite Modal & Member Access Management, AI Security & Permission Audit Modal, Trello Custom Fields Power-Up Modal & Card Front Badges, Visual Dependency Graph (`🕸️ Graph`) with Interactive SVG DAG Canvas, Glassmorphism Theme Customization Studio Drawer (`🎨 Theme Studio`), Collapsible Multi-Board Workspace Sidebar, Board Templates Gallery, Trello Butler Automation Center + AI Rule Builder, Sprint Analytics Dashboard & SVG Burndown Chart, Native Trello JSON Import & CSV/JSON Export Modal, Live Co-Presence Avatar Stack, Card-Level Typing Indicators ("💬 [Name] is editing..."), Outbound Webhook Modal with Live Slack/Discord Message Previewers, Optimistic Kanban/Calendar/Table/Graph/Retro UI, O(1) Fractional Drag-and-Drop, `Cmd+K` Command Palette |
| **Core API & WS (`apps/api`)** | Node.js 20+, Fastify v5, `@fastify/websocket`, `@fastify/cors`, Drizzle ORM, `pg`, `ioredis`, Zod v4 | Real-Time Time Tracking & Stopwatch Service (`/cards/:cardId/timer/start`, `stop`, manual `/time-entries`), Pomodoro Focus Complete Endpoint (`/cards/:cardId/pomodoro/complete`), Sprint Retrospective Board Service (`GET/POST /boards/:boardId/retro`, upvoting `/retro/:itemId/vote`, convert-to-card `/retro/:itemId/convert-to-card`), AI Retro Synthesizer Proxy (`POST /boards/:boardId/retro/ai-synthesize`), Enterprise JWT Authentication (HS256 tokens, register, login, `/auth/me`), Pre-Seeded Demo User Profiles, Strict RBAC Guard Middleware (`403 FORBIDDEN` enforcement matching `StandardErrorSchema`), Custom Fields CRUD & Card Value Service (`GET/POST/PATCH/DELETE /custom-fields`), Cycle-Safe Card Dependency Service (`POST/DELETE /cards/:cardId/dependencies` with Tarjan/DFS circular prevention), Interactive Dependency Graph Engine (`GET /dependency-graph`), AI Critical Path Proxy (`POST /dependency-graph/ai-analyze`), Theme Studio Persistence (`PATCH /boards/:boardId/theme`), Shareable Invite Links Service (`POST /invites`, preview, and join redemption), AI Permission Audit Proxy (`POST /api/v1/boards/:boardId/security-audit`), Multi-workspace & board endpoints, Board Templates provisioning, Runtime Butler Automation Engine, Real-Time Sprint Analytics Aggregator, Native Trello JSON Importer, CSV/JSON Exporter, Real-Time Co-Presence Service & Live Typing Coordinator, Outbound Webhook Dispatcher with HMAC-SHA256 signatures, WebSocket real-time room fan-out, PostgreSQL & Redis persistence with automatic in-memory fallback |
| **AI Engine (`services/ai-engine`)** | Python 3.11/3.12, FastAPI, Uvicorn, Pydantic v2, `httpx`, OpenAI/LiteLLM | AI Sprint Retrospective Synthesizer & Estimation Accuracy Analyzer (`POST /internal/v1/synthesize-retro`) computing sprint morale scores (`0-100`), key themes, estimation accuracy summaries, and recommended action items, AI Critical Path & Dependency Bottleneck Analyzer (`POST /internal/v1/analyze-dependencies`) computing longest DAG chain, bottleneck risk ratings, and mitigation actions, AI Workspace Access & Permission Security Auditor (`POST /internal/v1/audit-permissions`) analyzing least-privilege role distribution and invite link exposure with zero-config deterministic fallback, Stateless AI task decomposition, Trello Smart Card Enrichment, Bilingual (Indonesian & English) Natural Language to Butler Automation Rule Compiler, AI Executive Sprint Health & Bottleneck Analyzer (`POST /internal/v1/analyze-board`), and AI Smart ChatOps Notification Formatter (`POST /internal/v1/format-notification`) generating Slack Block Kit & Discord Rich Embed payloads |
| **Shared Contracts (`packages/contracts`)** | TypeScript (`index.ts`), Python Pydantic v2 (`schemas.py`), OpenAPI 3.1 (`openapi.yaml`) | Single source of truth for Phase 8 Time Tracking (`CardTimeTrackingSummary`, `ActiveCardTimer`, `CardTimeEntry`, `TimeEntrySource`), Pomodoro Sessions (`PomodoroSession`, `PomodoroMode`), Sprint Retrospectives (`RetroItem`, `RetroCategory`, `AIRetroAnalysisRequest`, `AIRetroAnalysisResponse`), Auth, JWT Sessions, RBAC Roles (`ADMIN`, `EDITOR`, `VIEWER`), Custom Fields (`CustomFieldDefinition`, `CardCustomFieldValue`), Card Dependencies & DAG Graph (`BoardDependencyGraph`, `AICriticalPathResponse`), Theme Configuration (`BoardThemeConfig`), Shareable Invite Links, AI Permission Audit, REST, WebSocket, Workspace, Template, Butler Automation, Sprint Analytics, Trello Import/Export, User Presence, Typing Indicators, Outbound Webhook, and Internal AI schemas |
| **Infrastructure (`infrastructure/docker`)** | Docker Compose, PostgreSQL 16 Alpine, Redis 7 Alpine | Containerized 5-service production stack with healthchecks |
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

Kanbanify is designed to run seamlessly on **Windows, macOS, and Linux** even without Docker/PostgreSQL/Redis running locally (`apps/api` automatically falls back to a pre-seeded in-memory store and in-process WebSocket hub, and `services/ai-engine` includes a deterministic domain-aware heuristic engine when no `LLM_API_KEY` is provided).

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

Kanbanify includes a cross-platform automated End-to-End smoke test (`scripts/e2e_test.mjs`) that automatically starts (or connects to) `services/ai-engine` (`:8001`) and `apps/api` (`:8000`) and verifies the full Phase 1 through Phase 8 lifecycle:
1. **Health Checks:** Verifies `GET /health` on both `http://localhost:8001/health` and `http://localhost:8000/health` return `200 OK`.
2. **Workspaces & Board Templates Verification (Phase 3):**
   - Calls `GET /api/v1/workspaces` and asserts at least 1 workspace and multiple seeded boards exist.
   - Calls `GET /api/v1/board-templates` and asserts board templates exist (`Engineering Sprint`, `Marketing Launch`, `Product Roadmap`, `Personal Kanban`).
   - Calls `POST /api/v1/boards` with `template_id` to provision a new board from a template with its default columns, sample cards, labels, and members.
3. **Board & Trello Defaults:** Creates a board (`POST /api/v1/boards`) and asserts default Trello `labels` (length $\ge 6$), `members` (length $\ge 1$), and 4 default `columns` (`Backlog`, `In Progress`, `Review`, `Done`) with fractional positions `"a0"`, `"a1"`, `"a2"`, `"a3"`.
4. **List (Column) Operations:** Reorders a column via `PATCH /api/v1/columns/:columnId/move` and copies a column via `POST /api/v1/columns/:columnId/copy`, verifying the duplicated column exists.
5. **Rich Trello Card Lifecycle:** Creates a card (`POST /api/v1/boards/:boardId/cards`), moves it via **O(1) Fractional Index Move** (`PATCH /api/v1/cards/:cardId/move`), and updates it via `PATCH /api/v1/cards/:cardId` with `cover`, `label_ids`, `member_ids`, multiple named `checklists` (`"Frontend Checklist"` & `"QA Checklist"`), and `is_due_complete: true`.
6. **Comments & Activity Feed:** Adds a Markdown comment via `POST /api/v1/cards/:cardId/comments` and verifies the comment and a corresponding `COMMENT_ADDED` entry in `board.activities`.
7. **AI Smart Card Enrichment & Decomposition:** Calls `POST /api/v1/cards/:cardId/ai-decompose` ($\rightarrow$ `POST /internal/v1/enrich-card` & `/internal/v1/decompose-task` with `X-Internal-Token` authentication) and verifies populated `checklists`, `subtasks`, `story_points`, and `priority`.
8. **Card Copy & Archive:** Copies the card via `POST /api/v1/cards/:cardId/copy` and archives the copy via `PATCH /api/v1/cards/:copiedCardId` (`{ is_archived: true }`).
9. **AI Natural Language to Butler Rule Generation (`API -> AI Engine`):** Calls `POST /api/v1/boards/:boardId/automations/ai-generate` ($\rightarrow$ `POST /internal/v1/parse-automation`) with `"When a card is moved to Done, mark due date complete and assign a member"` and asserts a `WHEN_CARD_MOVED_TO_COLUMN` trigger targeting `"Done"` with `MARK_DUE_DATE_COMPLETE` and `ASSIGN_MEMBER` actions.
10. **Runtime Butler Automation Execution:** Creates a card in `"Backlog"` (`is_due_complete: false`, `member_ids: []`), moves it to `"Done"` via `PATCH /api/v1/cards/:cardId/move`, and verifies that Butler automatically sets `card.is_due_complete === true`, assigns a member (`card.member_ids.length > 0`), increments the rule's `execution_count >= 1`, and appends an `"AUTOMATION_TRIGGERED"` entry to `board.activities`.
11. **Real-Time Board Analytics Verification (Phase 4):** Calls `GET /api/v1/boards/:boardId/analytics` and asserts `200 OK` with valid `total_cards`, `completion_rate`, 7-day `burndown_series`, `cards_by_column`, and `workload_by_member`.
12. **AI Executive Sprint Insights (`API -> AI Engine`, Phase 4):** Calls `POST /api/v1/boards/:boardId/analytics/ai-report` ($\rightarrow$ `POST /internal/v1/analyze-board` with `X-Internal-Token`) and asserts `200 OK` returning `health_score` (`0-100`), `health_status`, `executive_summary`, `bottlenecks`, and `actionable_recommendations`.
13. **Native Trello JSON Import & CSV/JSON Export (Phase 4):** Calls `POST /api/v1/boards/import` with a mock raw Trello JSON payload (`name`, `lists`, `cards`, `checklists`) and asserts successful board creation (`imported_lists_count > 0`) with valid O(1) fractional index positions (`"a0"`, `"a1"`, `"a2"`), then calls `GET /api/v1/boards/:boardId/export?format=csv` (and `format=json`) and asserts `200 OK` with `content_type: "text/csv"` and valid CSV data rows.
14. **Real-Time Co-Presence & Typing Indicators (Phase 5):** Updates presence state (`status: "EDITING"`, `active_card_id`, `event: "START_TYPING"`) via `POST /api/v1/boards/:boardId/presence`, verifies presence list on `GET /api/v1/boards/:boardId/presence`, and asserts proper status reset to `"ACTIVE"` upon `"STOP_TYPING"`.
15. **Slack & Discord Webhook Lifecycle & AI Notification Formatting (Phase 5):** Registers outbound Slack and Discord webhooks subscribed to `["CARD_MOVED", "AUTOMATION_TRIGGERED"]` via `POST /api/v1/boards/:boardId/webhooks`, verifies listing via `GET /api/v1/boards/:boardId/webhooks`, dispatches test pings via `POST /api/v1/webhooks/:webhookId/test` with verified `delivered: true` and formatted Slack Block Kit / Discord Rich Embed payloads, verifies AI Standup Digest formatting via `POST /internal/v1/format-notification`, and verifies cleanup via `DELETE /api/v1/webhooks/:webhookId`.
16. **Enterprise Authentication & Demo User Profiles (Phase 6):** Calls `GET /api/v1/auth/demo-users` and asserts pre-seeded `ADMIN` ("Alex Rivera"), `EDITOR` ("Maya Lin"), and `VIEWER` ("Elena Rostova") accounts with active JWT tokens; registers a new user via `POST /api/v1/auth/register` and logs in via `POST /api/v1/auth/login`; verifies `GET /api/v1/auth/me` with Bearer token and confirms graceful fallback to default `ADMIN` when headers are omitted.
17. **Strict RBAC Enforcement (`403 FORBIDDEN` vs `200/201`, Phase 6):** Asserts that card, column, and comment mutations sent with `X-Kanbanify-Role: VIEWER` are strictly rejected with HTTP `403 FORBIDDEN` matching `StandardErrorSchema`; asserts that admin-only invite creation is rejected with `403 FORBIDDEN` for `EDITOR` and `VIEWER`; asserts that `EDITOR` is permitted to create and move cards (`200/201`).
18. **Shareable Invite Links Lifecycle (Phase 6):** Creates a shareable invite link (`POST /api/v1/boards/:boardId/invites`) with role `EDITOR` and `max_uses: 5`, inspects the public preview (`GET /api/v1/invites/:token`), redeems the token (`POST /api/v1/invites/:token/join`) for a new collaborator ("Rina QA"), and verifies membership on the board with `granted_role === "EDITOR"` and incremented `uses_count: 1`.
19. **✨ AI Workspace Access & Permission Security Audit (`API -> AI Engine`, Phase 6):** Calls `POST /api/v1/boards/:boardId/security-audit` ($\rightarrow$ `POST /internal/v1/audit-permissions` with `X-Internal-Token`) and asserts `200 OK` returning a `security_score` (`0–100`), `risk_level` (`LOW`, `MEDIUM`, `HIGH`), `findings`, and `recommendations`.
20. **Trello Custom Fields Power-Up CRUD & Card Value Assignments (Phase 7):** Creates a `DROPDOWN` field (`Release Track` with colored options) and a `NUMBER` field (`Story Effort`) via `POST /api/v1/boards/:boardId/custom-fields`, assigns values to cards via `PUT /api/v1/cards/:cardId/custom-fields/:fieldId`, and verifies persistence in `card.custom_field_values`.
21. **Cycle-Safe Dependency Graph & Circular Prevention (Phase 7):** Creates Card A and Card B, links B blocked by A via `POST /api/v1/cards/:cardId/dependencies`, asserts strict rejection of circular dependency (A blocked by B) with HTTP `400 VALIDATION_ERROR`, and retrieves DAG structure via `GET /api/v1/boards/:boardId/dependency-graph`.
22. **✨ AI Critical Path & Dependency Bottleneck Analysis (`API -> AI Engine`, Phase 7):** Calls `POST /api/v1/boards/:boardId/dependency-graph/ai-analyze` ($\rightarrow$ `POST /internal/v1/analyze-dependencies` with `X-Internal-Token`) and asserts `200 OK` returning `risk_summary`, `critical_path_titles`, `top_blocker_cards`, and `unblocking_recommendations`.
23. **Glassmorphism & Theme Studio Persistence (Phase 7):** Updates board theme via `PATCH /api/v1/boards/:boardId/theme` with `{ preset: "FROSTED_GLASS", glass_blur: "lg", card_density: "compact" }` and asserts persistence across board reloads.
24. **Real-Time Card Time Tracking & Stopwatch Lifecycle (Phase 8):** Calls `POST /api/v1/cards/:cardId/timer/start` asserting `active_timer !== null`, followed by `POST /api/v1/cards/:cardId/timer/stop` asserting `active_timer === null`, `total_logged_seconds > 0`, and a `"STOPWATCH"` entry in `card.time_tracking.entries`.
25. **Manual Worklog Logging & Deletion (Phase 8):** Calls `POST /api/v1/cards/:cardId/time-entries` adding 1800s manual log, verifies recalculation of `total_logged_seconds`, and calls `DELETE /api/v1/cards/:cardId/time-entries/:entryId` asserting entry removal.
26. **Pomodoro Focus Timer Complete (Phase 8):** Calls `POST /api/v1/cards/:cardId/pomodoro/complete` with `{ mode: "FOCUS", duration_seconds: 1500 }` asserting `pomodoro_completed_count >= 1`, `total_logged_seconds >= 1500`, and a `"POMODORO"` entry in worklogs.
27. **Sprint Retrospective Board & Upvoting (Phase 8):** Creates retro note via `POST /api/v1/boards/:boardId/retro`, verifies retrieval on `GET /api/v1/boards/:boardId/retro`, toggles upvote via `POST /api/v1/retro/:itemId/vote` asserting `votes >= 1`, and converts note into real Kanban card via `POST /api/v1/retro/:itemId/convert-to-card` asserting populated `linked_card_id` and `is_resolved: true`.
28. **✨ AI Sprint Retrospective Synthesizer (`API -> AI Engine`, Phase 8):** Calls `POST /api/v1/boards/:boardId/retro/ai-synthesize` ($\rightarrow$ `POST /internal/v1/synthesize-retro` with `X-Internal-Token`) asserting `200 OK` with valid `sprint_morale_score` (`0-100`), `estimation_accuracy_summary`, `key_themes`, and `recommended_action_items`.
29. **Phase 8 Analytics & CSV Export Metrics:** Calls `GET /api/v1/boards/:boardId/analytics` asserting `total_logged_hours` and `total_pomodoros_completed`, and verifies RFC 4180 CSV export headers (`"Logged Hours"`, `"Pomodoro Count"`).
30. **Live WebSocket Broadcast (Phases 1–8):** Verifies real-time room events on `/ws/boards/:boardId` (`USER_JOINED`, `CARD_MOVED`, `AUTOMATION_TRIGGERED`, `USER_TYPING`, `PRESENCE_SYNC`, `CARD_UPDATED`, `BOARD_UPDATED`, `TIMER_UPDATED`, `RETRO_ITEM_CREATED`, `RETRO_ITEM_UPDATED`, `CARD_CREATED`).

Run the E2E smoke test with a single command:

```bash
node scripts/e2e_test.mjs
# or via root package.json:
npm run test:e2e
```

---

## Phase 8 Real-Time Time Tracking, Pomodoro Focus Timer & AI Sprint Retrospectives

- **Real-Time Card Time Tracking & Stopwatch Lifecycle (`apps/web` <-> `apps/api`):**
  - **1-Click Card Front & Modal Stopwatch:** Click the stopwatch icon on any card front or inside the 2-Column Card Back Modal (`CardTimeTrackingSection`) to start/stop live time tracking via `POST /api/v1/cards/:cardId/timer/start` and `POST /api/v1/cards/:cardId/timer/stop`.
  - **Live Pulsing Ticker Badge (`CardLiveTimerBadge`):** Running timers pulse in high-visibility emerald with live elapsed second tickers, displaying the active user's initials/name. Hovering over a running badge provides an instant **⏹️ Stop** button.
  - **Collaborative Concurrency Protection:** Starting a timer on any card automatically detects and stops any existing active stopwatch for that user on other cards, preventing phantom dual-tracking.
  - **Manual Worklog & Estimation Calibration:** Add manual time log entries with custom notes via `POST /api/v1/cards/:cardId/time-entries` and delete incorrect entries via `DELETE /api/v1/cards/:cardId/time-entries/:entryId` with automatic recalculation of `total_logged_seconds`. Set `estimated_seconds` to visualize completion ratio and track estimation accuracy.
  - **Instant WebSocket Synchronization:** Real-time `TIMER_UPDATED` and `CARD_UPDATED` events are broadcast to all peers on `/ws/boards/:boardId`.
- **Built-in Pomodoro Focus Timer (`PomodoroDock`):**
  - **Dockable Focus Widget:** Floating, persistent bottom dock accessible from any view via the timer pill in the workspace header or card action menu.
  - **Pomodoro Modes & Interval Presets:** Seamlessly cycle through **Focus (25m)**, **Short Break (5m)**, and **Long Break (15m)** with animated circular SVG countdown gauges and audible Web Audio API chimes upon completion.
  - **Direct Card Binding:** Bind focus sessions to any card on the active board with a dedicated card selector dropdown.
  - **Automatic Focus Worklog Logging (`POST /api/v1/cards/:cardId/pomodoro/complete`):** Completing a 25m Focus session automatically logs 1,500 seconds with source `"POMODORO"`, increments `card.time_tracking.pomodoro_completed_count`, updates board analytics (`total_pomodoros_completed`), and notifies team members over WebSocket.
- **Interactive 4-Column Sprint Retrospective Board (`"🔄 Retro"` View):**
  - **4 Agile Feedback Columns:**
    - 🌟 **What Went Well:** Celebrate sprint successes, deployed features, and team milestones.
    - 💡 **To Improve:** Flag process bottlenecks, tech debt, and delivery friction.
    - 👏 **Kudos:** Peer-to-peer recognition highlighting exceptional collaboration and craftsmanship.
    - 🚀 **Action Items:** Concrete agile commitments to carry forward into the next sprint.
  - **Collaborative Upvoting Engine:** Upvote or un-vote notes via `POST /api/v1/retro/:itemId/vote`. Notes automatically sort by highest vote count in real time.
  - **1-Click Convert to Kanban Card (`POST /api/v1/retro/:itemId/convert-to-card`):** Instantly convert any retro note or action item into a real Kanban task card in the Backlog with configurable priority (`HIGH`, `MEDIUM`, `LOW`), populating `retro_item.linked_card_id` and marking the item resolved with a direct navigation link.
  - **Real-Time Board Sync:** Retro item mutations trigger `RETRO_ITEM_CREATED`, `RETRO_ITEM_UPDATED`, and `RETRO_ITEM_DELETED` room broadcasts.
- **✨ AI Sprint Retrospective Synthesizer (`apps/web` -> `apps/api` -> `services/ai-engine`):**
  - **1-Click Agile Facilitator:** Click **"✨ Synthesize Sprint Retro with AI"** to forward the board's retro items, card completion metrics, and estimated vs. logged hours to `services/ai-engine` (`POST /internal/v1/synthesize-retro` with `X-Internal-Token`).
  - **Sprint Morale Score (`0–100`):** Synthesizes team sentiment into an objective sprint morale score with an ergonomic color-coded radial gauge (Green $\ge 70$, Amber $40-69$, Rose $< 40$) and qualitative assessment.
  - **Estimation Accuracy Summary:** Cross-references `total_estimated_hours` against `total_logged_hours` and overdue cards to assess estimation calibration and predictability.
  - **Key Sprint Themes & Recommended Action Items:** Identifies high-friction clusters and outputs structured agile action items with suggested assignees, priorities, and 1-click **Add to Board** card creation.
- **Sprint Analytics & CSV Export Integration (`GET /api/v1/boards/:boardId/analytics` & `export`):**
  - Sprint Analytics Dashboard includes a dedicated **Time Tracking & Focus** calibration card showing total logged hours (`total_logged_hours`), completed pomodoro count (`total_pomodoros_completed`), and percent of estimated sprint hours logged.
  - Board CSV Export (`GET /api/v1/boards/:boardId/export?format=csv`) automatically appends RFC 4180 escaped `"Logged Hours"` and `"Pomodoro Count"` columns for payroll, client billing, and agile retrospection in spreadsheets.

---

---

## Phase 7 Custom Fields Power-Up, Visual Dependency Graph & Glassmorphism Theme Studio

- **Trello Custom Fields Power-Up (`apps/web` <-> `apps/api`):**
  - **Multi-Type Field Support:** Full support for `TEXT`, `NUMBER`, `CHECKBOX`, `DATE`, and `DROPDOWN` custom fields with custom colored option badges (`blue`, `green`, `yellow`, `orange`, `red`, `purple`).
  - **Comprehensive Field CRUD:** Endpoints `GET /api/v1/boards/:boardId/custom-fields`, `POST /api/v1/boards/:boardId/custom-fields`, `PATCH /api/v1/custom-fields/:fieldId`, and `DELETE /api/v1/custom-fields/:fieldId` (with automatic cascade-strip of deleted field values from all cards on the board).
  - **Card Value Assignments:** Set or clear card custom field values via `PUT /api/v1/cards/:cardId/custom-fields/:fieldId` with instant real-time `CARD_UPDATED` WebSocket room broadcast.
  - **Front Badge Display:** Custom fields with `show_on_front: true` automatically render sleek metadata badges directly on the card front in Kanban Board view.
  - **Spreadsheet Table View & CSV Export Integration:** Custom fields dynamically appear as dedicated columns in Table View (`apps/web`) and are exported into spreadsheet-ready RFC 4180 CSV files via `GET /api/v1/boards/:boardId/export?format=csv`.
- **Visual Dependency Graph & AI Critical Path Analyzer (`apps/web` -> `apps/api` -> `services/ai-engine`):**
  - **Interactive SVG DAG Canvas (`"🕸️ Graph"` View):** Visualizes card dependencies as an interactive Directed Acyclic Graph (DAG) with topological layer positioning, smooth Bezier curves, and highlight styling on critical path cards and blocker badges.
  - **Cycle-Safe Card Dependency Linking:** Link and unlink dependencies via `POST /api/v1/cards/:cardId/dependencies` (`{ blocker_card_id }`) and `DELETE /api/v1/cards/:cardId/dependencies/:blockerCardId`.
  - **Tarjan/DFS Circular Dependency Prevention:** Prevents dependency deadlocks by rejecting any circular dependency loop or self-dependency with HTTP `400 VALIDATION_ERROR` (`"Circular dependency detected: adding this blocker would create a dependency loop."`).
  - **Graph Computation Engine (`GET /api/v1/boards/:boardId/dependency-graph`):** Asynchronously calculates DAG nodes, directed edges, root nodes, terminal nodes, cycle flags, and the exact longest sequence of interdependent cards (`critical_path_card_ids`).
  - **✨ AI Critical Path & Dependency Bottleneck Analysis (`POST /api/v1/boards/:boardId/dependency-graph/ai-analyze` $\rightarrow$ `POST /internal/v1/analyze-dependencies`):**
    - Click **"Analyze"** inside the Graph view to proxy DAG graph topology to `services/ai-engine` with `X-Internal-Token` authentication.
    - Evaluates path length, WIP status, and bottleneck clusters to generate an executive **Risk Summary**, ordered **Critical Path Chain**, **Top Blocker Cards** ranked by downstream blast radius, and **Actionable Unblocking Recommendations**.
- **Glassmorphism & Theme Customization Studio (`apps/web` <-> `apps/api`):**
  - **Aesthetic Preset Studio (`🎨 Theme Studio` Drawer):** Choose from 5 curated aesthetic themes:
    - 🧼 `DEFAULT_CLEAN`: Crisp, high-contrast modern minimalist workspace.
    - ❄️ `FROSTED_GLASS`: Deep glassmorphism with dynamic multi-layer backdrop blurs.
    - 🌆 `CYBERPUNK_NEON`: Dark futuristic theme with vivid neon cyan and magenta accents.
    - 🏔️ `MINIMAL_NORD`: Cool arctic slate with subtle muted highlights.
    - ☕ `WARM_ESPRESSO`: Cozy earth tones and deep amber accents.
  - **Granular Ergonomic Controls:** Customize glass blur intensity (`none`, `sm`, `md`, `lg`), card density (`compact`, `comfortable`, `spacious`), card corner radius (`none`, `sm`, `md`, `lg`, `full`), accent colors, and front badge visibility toggles.
  - **Server-Side Persistence (`PATCH /api/v1/boards/:boardId/theme`):** Board theme configurations are persisted in PostgreSQL / In-Memory repository, automatically synchronizing across all connected collaborators via WebSocket (`BOARD_UPDATED`) and surviving browser reloads.

---

## Phase 6 Enterprise Auth, Role-Based Access Control (RBAC) & Shareable Invite Links

- **Enterprise JWT Authentication & Pre-Seeded Demo Profiles (`apps/api` & `apps/web`):**
  - **Pre-Seeded Demo Accounts (`GET /api/v1/auth/demo-users`):**
    - 👑 **Alex Rivera** (`ADMIN`): Full board and workspace mutation privileges, member management, and invite creation.
    - ✏️ **Maya Lin** (`EDITOR`): Standard contributor permissions (create/move/update cards, checklists, and comments).
    - 👁️ **Elena Rostova** (`VIEWER`): Strict read-only viewer permissions across boards, cards, and activity feeds.
  - **Full Registration & Login Flows:** Supports `POST /api/v1/auth/register` and `POST /api/v1/auth/login` issuing HMAC-SHA256 JWT tokens with 7-day expiration and password hashing using secure Node.js `scrypt` derivation.
  - **Current Session Endpoint (`GET /api/v1/auth/me`):** Resolves the active user profile from incoming `Authorization: Bearer <token>` or defaults gracefully to `ADMIN` for backward-compatibility.
- **1-Click Demo Role Switcher & Read-Only UI Enforcement (`apps/web`):**
  - **Top Navigation Switcher:** Instant role switcher dropdown located in `WorkspaceHeader` allowing testers and stakeholders to toggle between `ADMIN`, `EDITOR`, and `VIEWER` roles in a single click.
  - **Immediate Header Propagation:** Switching roles immediately updates `Authorization: Bearer <token>` and `X-Kanbanify-Role` on all outgoing API requests.
  - **Viewer Read-Only Enforcement Mode:** When `VIEWER` is active, board drag-and-drop handles are locked (`disabled: isViewer`), card and column creation/editing controls are disabled, and a prominent **👁️ Viewer Mode (Read-Only)** pill and warning banners are displayed.
- **Strict Backend RBAC Guard Middleware (`apps/api`):**
  - **Granular Role Matrix:**
    | Operation | ADMIN | EDITOR | VIEWER |
    | :--- | :---: | :---: | :---: |
    | View Boards, Cards, Activity, Analytics | ✅ | ✅ | ✅ |
    | Create / Move / Update / Archive Cards | ✅ | ✅ | ❌ (`403 FORBIDDEN`) |
    | Add Checklists & Post Comments | ✅ | ✅ | ❌ (`403 FORBIDDEN`) |
    | Create Shareable Board Invites | ✅ | ❌ (`403 FORBIDDEN`) | ❌ (`403 FORBIDDEN`) |
    | Modify Board Members & Roles | ✅ | ❌ (`403 FORBIDDEN`) | ❌ (`403 FORBIDDEN`) |
    | Delete Board | ✅ | ❌ (`403 FORBIDDEN`) | ❌ (`403 FORBIDDEN`) |
  - **Standardized Error Envelope:** All unauthorized mutations return HTTP `403 FORBIDDEN` strictly compliant with `StandardErrorSchema` (`error.code: "FORBIDDEN"`).
  - **100% Backward Compatibility:** Requests omitting auth headers default to `ADMIN`, preserving unhindered functionality across all Phase 1–5 workflows.
- **Shareable Board Invite Links (`ShareBoardModal`):**
  - **Invite Link Creation (`POST /api/v1/boards/:boardId/invites`):** Administrators can generate cryptographic invite tokens (`kb_inv_*`) with customizable target roles (`EDITOR` or `VIEWER`), expiration hours (e.g., 24h, 7 days, or never), and maximum usage caps.
  - **Public Preview & Verification (`GET /api/v1/invites/:token`):** Inspects link validity, target board title, inviter name, and granted role without requiring prior authentication.
  - **Invite Redemption Flow (`POST /api/v1/invites/:token/join`):** New users join the board with the granted role, automatically adding them to `board.members`, incrementing `uses_count`, and broadcasting `BOARD_UPDATED` over WebSocket.
- **✨ AI Workspace Access & Permission Security Auditor (`POST /api/v1/boards/:boardId/security-audit` $\rightarrow$ `services/ai-engine`):**
  - Accessible via the **Share Board** modal by clicking **"Run AI Security & Permission Audit"**.
  - Forwards the board's membership roster and active invite links to `services/ai-engine` (`POST /internal/v1/audit-permissions` with `X-Internal-Token`).
  - Evaluates role distribution under the **Principle of Least Privilege (PoLP)** and flags security risks (e.g., excessive admins, public editor invite links without expiration or usage limits).
  - Returns a numeric **Security Score (`0–100`)**, **Risk Level Badge (`LOW`, `MEDIUM`, `HIGH`)**, bulleted **Findings**, and **Actionable Hardening Recommendations**.

---

## Phase 5 Real-Time Co-Presence, Typing Indicators & Outbound Webhook Integrations

- **Live Multi-User Co-Presence Avatar Stack (`WorkspaceHeader` & `/ws/boards/:boardId`):**
  - Displays real-time online collaborator avatars in the board header with active status rings (`ACTIVE`, `IDLE`, `EDITING`).
  - Automatically joins room on board switch and syncs initial presence state via `GET /api/v1/boards/:boardId/presence` or WebSocket `PRESENCE_SYNC`.
  - Offline cleanup and `USER_LEFT` broadcast when browser tab is closed or socket disconnects.
- **Card-Level Live Typing Indicators ("💬 [Name] is editing..."):**
  - **Board Card Front Indicator:** Whenever a collaborator begins typing on a card, `apps/web` emits `START_TYPING` with `active_card_id`. Connected peers immediately see an animated `💬 [Name] is editing...` banner on the card front.
  - **2-Column Card Back Modal Banner:** Opening a card being edited by a teammate displays a prominent warning banner (`⚡ [Name] is currently typing on this card`) with their avatar color and initials to prevent overwrite conflicts.
  - Automatically resets status to `ACTIVE` and broadcasts `PRESENCE_SYNC` on `STOP_TYPING` or modal close.
- **Outbound Webhook Integrations (`apps/api` Webhook Dispatcher):**
  - Configure outbound webhooks per board (`GET/POST /api/v1/boards/:boardId/webhooks`, `PATCH/DELETE /api/v1/webhooks/:webhookId`) targeting **Slack**, **Discord**, or **Custom HTTP endpoints**.
  - Event subscriptions: `CARD_CREATED`, `CARD_MOVED`, `CARD_ARCHIVED`, `COMMENT_ADDED`, and `AUTOMATION_TRIGGERED`.
  - **Cryptographic Security:** Each outgoing webhook request includes an `X-Kanbanify-Signature` (and `X-Kinetix-Signature`) HMAC-SHA256 signature, `X-Kanbanify-Event`, and unique `X-Kinetix-Delivery-Id`.
- **✨ AI Smart Notification Formatter (`POST /internal/v1/format-notification` $\rightarrow$ `services/ai-engine`):**
  - Compiles raw board activities and events into native **Slack Block Kit** (`slack_block_kit_payload`) and **Discord Rich Embed** (`discord_embed_payload`) structures, complete with header blocks, field summaries, actor attributions, and color coding (green for Done, red for Urgent/Archived, blurple for In Progress).
  - Includes a one-click **AI Daily Digest** generator summarizing recent board changes into executive ChatOps updates.
- **Interactive Webhooks Modal & Live Message Previewer (`WebhooksModal`):**
  - Access via `Cmd+K` -> `"Manage Board Webhooks"` or board menu.
  - Visual 2-column layout: Left column manages active webhooks and creates new endpoints; right column features a live interactive previewer switching between **Slack**, **Discord**, and **Raw JSON** payload views.
  - 1-Click **Test Ping** button dispatches a simulated test payload and displays live delivery status with status code and formatted payload preview.

---

## Phase 4 Team Productivity Analytics, AI Sprint Health Insights & Trello Data Portability

- **Real-Time Team Productivity Analytics Dashboard (`Analytics` View & `GET /api/v1/boards/:boardId/analytics`):**
  - **KPI Summary Cards:** Track **Completion Rate (%)**, **Story Points Velocity** (`completed_story_points / total_story_points`), **Overdue & Blocked Risk Radar** (`overdue_cards_count` & `blocked_cards_count`), and **Butler Automation Velocity** (`automation_executions_count` across active rules).
  - **7-Day Sprint Burndown & Story Points Velocity SVG Chart:** Interactive SVG area & line chart plotting `ideal_remaining_points` vs. `actual_remaining_points` and `completed_cards_cumulative` across the 7-day sprint window (`burndown_series`).
  - **Column Distribution & WIP Bottleneck Alerts:** Visualizes card & story-point distribution across columns (`cards_by_column`), highlighting any column where `card_count > wip_limit` with a pulsing `WIP EXCEEDED` alert badge.
  - **Team Member Workload & Priority Breakdown:** Stacked completion vs. open workload bars per member (`workload_by_member`), overdue task badges, and priority distribution (`URGENT`, `HIGH`, `MEDIUM`, `LOW`).
- **✨ AI Executive Sprint Health Report (`POST /api/v1/boards/:boardId/analytics/ai-report` $\rightarrow$ `POST /internal/v1/analyze-board`):**
  - Click **✨ Generate AI Sprint Insights** inside the Analytics view (or via `Cmd+K`) to proxy live board analytics to `services/ai-engine` (`X-Internal-Token` authenticated).
  - Synthesizes a **Sprint Health Score (`0–100`)** with radial gauge and status badge (`EXCELLENT`, `ON_TRACK`, `AT_RISK`, `CRITICAL`), an **Executive Summary**, **Detected Bottlenecks** (WIP breaches, blocked/overdue cards, member overload), and **Actionable Recommendations**.
- **Native Trello JSON Import & 1-Click CSV/JSON Export (`Import / Export` Modal):**
  - **Native Trello JSON & Kanbanify Backup Importer (`POST /api/v1/boards/import`):** Drag-and-drop any raw Trello JSON export (`lists`, `cards`, `checklists`, `labels`, `members`) or Kanbanify JSON backup, or load the built-in **Sample Trello Export** in 1 click. Automatically converts open Trello lists into Kanbanify columns with valid O(1) lexicographical fractional indices (`"a0"`, `"a1"`, `"a2"`, ...), maps cards, labels, members, due dates, and multi-item checklists, and broadcasts `BOARD_IMPORTED` over WebSocket.
  - **1-Click CSV & JSON Board Exporter (`GET /api/v1/boards/:boardId/export?format=csv|json`):** Export the active board as a spreadsheet-ready `.csv` file (with RFC 4180 escaping across card IDs, columns, priorities, story points, labels, assignees, checklist progress, and due dates) or a full `.json` backup snapshot.

---

## Phase 3 Multi-Board Workspace, Templates & Trello Butler Automation

- **Collapsible Multi-Board Workspace Sidebar (`[` shortcut):** Switch between workspaces (`GET /api/v1/workspaces`), create new workspaces (`POST /api/v1/workspaces`), browse **Starred Boards** and **Workspace Boards** with live card counts and mini background swatches, and switch active boards with automatic WebSocket room reconnection (`/ws/boards/:boardId`).
- **1-Click Board Templates Gallery (`GET /api/v1/board-templates`):** Launch pre-configured boards (`POST /api/v1/boards` with `template_id`) across **Engineering Sprint**, **Marketing Launch**, **Product Roadmap**, and **Personal Kanban** categories complete with custom column pipelines, sample cards, backgrounds, and pre-wired Butler rules.
- **Trello Butler Automation Center (`⚡ Automation`):**
  - **Active Rules Manager:** Inspect active rules on the board with human-readable `WHEN ... -> THEN ...` badge chains, live `⚡ Triggered N times` counters, enable/disable toggle switches, and 1-click preset rules (*Auto-Complete on Done*, *Checklist 100% Pipeline*, *Urgent Card Triage*).
  - **✨ AI Natural Language Rule Builder (`POST /api/v1/boards/:boardId/automations/ai-generate` $\rightarrow$ `POST /internal/v1/parse-automation`):** Write rules in plain **Indonesian or English** (e.g., *"Saat kartu pindah ke Done, otomatis centang due date dan assign member"* or *"When a card is moved to Done, mark due date complete and assign a member"*). The AI Engine maps the prompt to the board's live `columns`, `members`, and `labels` and compiles a structured `AutomationRule`.
  - **Visual Trigger + Action Builder:** Build custom multi-action rules combining triggers (`WHEN_CARD_MOVED_TO_COLUMN`, `WHEN_CARD_CREATED`, `WHEN_CHECKLIST_COMPLETED`, `WHEN_PRIORITY_CHANGED`, `WHEN_LABEL_ADDED`) with chained actions (`MARK_DUE_DATE_COMPLETE`, `ASSIGN_MEMBER`, `ADD_LABEL`, `SET_PRIORITY`, `MOVE_CARD_TO_COLUMN`, `ADD_CHECKLIST`, `POST_COMMENT`).
  - **Runtime Butler Execution & Real-Time Toast Feedback:** Moving, creating, or updating a card automatically evaluates active board rules on `apps/api` (with single-hop recursion guard), mutates card fields (`is_due_complete`, `member_ids`, `label_ids`, `column_id`, `checklists`, `comments`), increments `execution_count`, logs `"AUTOMATION_TRIGGERED"` to `board.activities`, and broadcasts `"AUTOMATION_TRIGGERED"` over WebSocket to display the live `"⚡ Butler Automation"` toast notification.

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
| `Cmd + K` / `Ctrl + K` | Open the global **Command Palette** (search cards, switch boards/views, open Templates or Butler Automation, trigger AI actions, change themes/backgrounds) |
| `[` | Toggle the left **Multi-Board Workspace Sidebar** |
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
