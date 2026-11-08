# Kinetix

**High-Performance Real-Time Kanban & AI Workspace**

Kinetix is a polyglot monorepo combining an optimistic real-time Kanban board (`apps/web`), a low-latency Fastify REST + WebSocket coordination server with lexicographical O(1) fractional indexing (`apps/api`), and a stateless FastAPI AI task-decomposition microservice (`services/ai-engine`), unified by strict 1:1 physical data contracts (`packages/contracts`).

---

## Monorepo Structure

```text
kinetix/
├── apps/
│   ├── web/                      # Next.js 16 Frontend (React 19, Tailwind v4, Zustand v5, TanStack Query v5, @dnd-kit)
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api/                      # Fastify v5 Core API & WebSocket Server (Drizzle ORM, PostgreSQL, Redis)
│       ├── package.json
│       └── tsconfig.json
├── services/
│   └── ai-engine/                # Python 3.12 FastAPI AI Service (Pydantic v2, LiteLLM/OpenAI)
│       └── pyproject.toml
├── packages/
│   └── contracts/                # Shared Physical Data Contracts (1:1 TypeScript Zod v4 & Python Pydantic v2)
│       ├── package.json
│       ├── index.ts
│       ├── schemas.py
│       └── openapi.yaml
├── infrastructure/
│   └── docker/                   # Docker Compose & Infrastructure Definitions
│       └── .gitkeep
├── docs/
│   ├── architecture.md           # System design, Port Registry, Env Registry, Fractional Indexing rules
│   └── api-contract.md           # Full REST, WebSocket, and Internal AI Service contract
├── AGENT_RULES.md                # Mandatory strict isolation rules for all Orca worktree agents
├── .env.example                  # Locked environment variables and ports
├── .gitignore                    # Node, Python, Docker, Env, IDE ignores
└── README.md                     # Project overview and architecture summary
```

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

## Documentation & Governance

- **[Architecture & Fractional Indexing Specification](./docs/architecture.md)**
- **[REST, WebSocket & Internal AI API Contract](./docs/api-contract.md)**
- **[OpenAPI 3.1 Specification](./packages/contracts/openapi.yaml)**
- **[Orca Worktree Agent Isolation Rules](./AGENT_RULES.md)**
