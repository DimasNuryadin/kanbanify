# KINETIX — MANDATORY AGENT ISOLATION & WORKTREE RULES

> **CRITICAL:** Every Orca parallel agent operating in Gate 2 and beyond MUST strictly obey these isolation boundaries, contract locks, and self-test requirements.

---

## 1. Strict Directory Jail Rules

Each worktree agent is strictly confined to its assigned directory jail. Writing, deleting, or modifying files outside your allowed directory is a hard violation:

| Workstream Agent | Allowed Write Directory (JAIL) | Strictly Forbidden Write Targets |
| :--- | :--- | :--- |
| **Frontend Agent (`apps/web`)** | `apps/web/**` | `apps/api/**`, `services/**`, `infrastructure/**`, `packages/**`, `docs/**`, root files |
| **Backend API Agent (`apps/api`)** | `apps/api/**` | `apps/web/**`, `services/**`, `infrastructure/**`, `packages/**`, `docs/**`, root files |
| **AI Engine Agent (`services/ai-engine`)** | `services/ai-engine/**` | `apps/**`, `infrastructure/**`, `packages/**`, `docs/**`, root files |
| **Infrastructure Agent (`infrastructure/docker`)** | `infrastructure/docker/**` | `apps/**`, `services/**`, `packages/**`, `docs/**`, root files |

*Zero Root Pollution Rule*: Never create source files, lockfiles, temporary scripts, or build artifacts in the repository root.

---

## 2. Contract & Port Lock (READ-ONLY in Gate 2)

During Gate 2 parallel execution, the following paths and files are **strictly READ-ONLY**:

1. `packages/contracts/**` (`index.ts`, `schemas.py`, `openapi.yaml`, `package.json`)
2. `docs/**` (`architecture.md`, `api-contract.md`)
3. `.env.example`
4. `AGENT_RULES.md`

All services MUST bind to and communicate over the locked ports defined in `.env.example`:
- `WEB_PORT=3000` (`apps/web`)
- `API_PORT=8000` (`apps/api`)
- `AI_ENGINE_PORT=8001` (`services/ai-engine`)
- `POSTGRES_PORT=5432` (PostgreSQL)
- `REDIS_PORT=6379` (Redis)

---

## 3. Database Ownership Rule

- **Exclusive Owner**: Only `apps/api` (Fastify + Drizzle ORM) owns the PostgreSQL database (`DATABASE_URL`), schema definitions, and migrations.
- **No Direct DB Access from Other Services**: `services/ai-engine` and `apps/web` MUST NEVER connect directly to PostgreSQL (`5432`) or Redis (`6379`).
- `services/ai-engine` is stateless and invoked by `apps/api` via `POST http://localhost:8001/internal/v1/decompose-task` with header `X-Internal-Token: <INTERNAL_SERVICE_TOKEN>`.

---

## 4. Mandatory Self-Test Gate (Before Completing Any Worktree Task)

Before any agent finishes its worktree task, it MUST execute and pass all checks below for its domain:

1. **Git Boundary Audit**:
   - Run `git status` and `git diff --name-only` to verify that **100% of modified/untracked files reside strictly inside your assigned directory jail** and no read-only foundation files (`packages/contracts/`, `docs/`, `.env.example`, `AGENT_RULES.md`) were modified.
2. **Type & Schema Verification**:
   - **`apps/web` & `apps/api`**: Run `tsc --noEmit` (or `npm run typecheck`) and ensure all payloads import and validate against `@kinetix/contracts` (`../../packages/contracts/index.ts`).
   - **`services/ai-engine`**: Verify syntax and Pydantic v2 validation against `packages/contracts/schemas.py`.
3. **Runtime & Endpoint Smoke Test**:
   - **`apps/api`**: Boot server on port `8000`, verify `GET http://localhost:8000/health` returns `200 OK` (`{"status": "ok", "service": "api", "version": "1.0.0"}`), and verify error responses match `StandardErrorSchema`.
   - **`services/ai-engine`**: Boot server on port `8001`, verify `GET http://localhost:8001/health` returns `200 OK` (`{"status": "ok", "service": "ai-engine", "version": "1.0.0"}`), and verify `POST /internal/v1/decompose-task` enforces `X-Internal-Token` and returns a valid `AIDecomposeResponseSchema` (including deterministic fallback when `LLM_API_KEY` is a placeholder).
   - **`apps/web`**: Verify build/typecheck passes and `NEXT_PUBLIC_USE_MOCK=true` / live API modes adhere to `BoardSchema`, `ColumnSchema`, and `CardSchema`.
