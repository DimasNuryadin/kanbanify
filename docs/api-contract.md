# Kinetix — REST, WebSocket & Internal AI Service Contract

All payloads MUST strictly validate against `packages/contracts/index.ts` (Zod) and `packages/contracts/schemas.py` (Pydantic v2).

---

## 1. Standard Error Envelope (`StandardErrorSchema`)

All error responses across `apps/api` (`8000`) and `services/ai-engine` (`8001`) MUST return this exact JSON structure:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND | VALIDATION_ERROR | UNAUTHORIZED | INTERNAL_ERROR",
    "message": "Human-readable explanation",
    "details": {}
  }
}
```

---

## 2. Health Checks (Mandatory for All Backend/Services)

### `GET /health` on `apps/api` (`http://localhost:8000/health`)
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "service": "api",
  "version": "1.0.0"
}
```

### `GET /health` on `services/ai-engine` (`http://localhost:8001/health`)
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "service": "ai-engine",
  "version": "1.0.0"
}
```

---

## 3. Core API (`apps/api` — Fastify Port `8000`)

### 3.1 `GET /api/v1/boards` — List Boards
- **Response `200 OK`**:
```json
[
  {
    "id": "11111111-1111-4111-8111-111111111111",
    "workspace_id": "22222222-2222-4222-8222-222222222222",
    "title": "Kinetix Platform Launch",
    "columns": [],
    "cards": [],
    "created_at": "2026-11-08T10:00:00.000Z"
  }
]
```

### 3.2 `POST /api/v1/boards` — Create Board
Auto-creates 4 default columns: `Backlog` (`"a0"`), `In Progress` (`"a1"`), `Review` (`"a2"`), `Done` (`"a3"`).
- **Request Body (`CreateBoardRequestSchema`)**:
```json
{
  "workspace_id": "22222222-2222-4222-8222-222222222222",
  "title": "Kinetix Platform Launch"
}
```
- **Response `201 Created` (`BoardSchema`)**:
```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "workspace_id": "22222222-2222-4222-8222-222222222222",
  "title": "Kinetix Platform Launch",
  "columns": [
    {
      "id": "33333333-3333-4333-8333-333333333331",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "title": "Backlog",
      "position": "a0",
      "wip_limit": null
    },
    {
      "id": "33333333-3333-4333-8333-333333333332",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "title": "In Progress",
      "position": "a1",
      "wip_limit": 5
    },
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "title": "Review",
      "position": "a2",
      "wip_limit": null
    },
    {
      "id": "33333333-3333-4333-8333-333333333334",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "title": "Done",
      "position": "a3",
      "wip_limit": null
    }
  ],
  "cards": [],
  "created_at": "2026-11-08T10:00:00.000Z"
}
```

### 3.3 `GET /api/v1/boards/:boardId` — Get Full Board State
Returns board with `columns` and `cards` sorted lexicographically by `position`.
- **Response `200 OK` (`BoardSchema`)**:
```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "workspace_id": "22222222-2222-4222-8222-222222222222",
  "title": "Kinetix Platform Launch",
  "columns": [
    {
      "id": "33333333-3333-4333-8333-333333333331",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "title": "Backlog",
      "position": "a0",
      "wip_limit": null
    }
  ],
  "cards": [
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "column_id": "33333333-3333-4333-8333-333333333331",
      "title": "Implement OAuth2 PKCE flow",
      "description": "Support GitHub and Google providers",
      "position": "a0",
      "priority": "HIGH",
      "story_points": 5,
      "tags": ["auth", "security"],
      "subtasks": [
        {
          "id": "55555555-5555-4555-8555-555555555555",
          "title": "Configure callback routes",
          "is_completed": false,
          "position": "a0"
        }
      ],
      "blocked_by_card_ids": [],
      "due_date": "2026-11-15T00:00:00.000Z",
      "updated_at": "2026-11-08T10:05:00.000Z"
    }
  ],
  "created_at": "2026-11-08T10:00:00.000Z"
}
```

### 3.4 `POST /api/v1/boards/:boardId/columns` — Create Column
Broadcasts `COLUMN_CREATED` via WebSocket.
- **Request Body (`CreateColumnRequestSchema`)**:
```json
{
  "title": "QA Verification",
  "position": "a2V",
  "wip_limit": 3
}
```
- **Response `201 Created` (`ColumnSchema`)**:
```json
{
  "id": "33333333-3333-4333-8333-333333333339",
  "board_id": "11111111-1111-4111-8111-111111111111",
  "title": "QA Verification",
  "position": "a2V",
  "wip_limit": 3
}
```

### 3.5 `POST /api/v1/boards/:boardId/cards` — Create Card
Broadcasts `CARD_CREATED` via WebSocket.
- **Request Body (`CreateCardRequestSchema`)**:
```json
{
  "column_id": "33333333-3333-4333-8333-333333333331",
  "title": "Implement OAuth2 PKCE flow",
  "description": "Support GitHub and Google providers",
  "position": "a0",
  "priority": "HIGH",
  "story_points": 5,
  "tags": ["auth", "security"],
  "subtasks": [],
  "blocked_by_card_ids": [],
  "due_date": "2026-11-15T00:00:00.000Z"
}
```
- **Response `201 Created` (`CardSchema`)**

### 3.6 `PATCH /api/v1/cards/:cardId` — Update Card
Updates card details, `blocked_by_card_ids`, or `subtasks`, and broadcasts `CARD_UPDATED` via WebSocket.
- **Request Body (`UpdateCardRequestSchema`)**:
```json
{
  "title": "Implement OAuth2 PKCE & Session Rotation",
  "priority": "URGENT",
  "story_points": 8,
  "blocked_by_card_ids": ["66666666-6666-4666-8666-666666666666"],
  "subtasks": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "title": "Configure callback routes",
      "is_completed": true,
      "position": "a0"
    }
  ]
}
```
- **Response `200 OK` (`CardSchema`)**

### 3.7 `PATCH /api/v1/cards/:cardId/move` — Move Card (O(1) Fractional Index)
Updates a single row in PostgreSQL (`column_id = target_column_id`, `position = new_position`) and broadcasts `CARD_MOVED` via WebSocket.
- **Request Body (`MoveCardRequestSchema`)**:
```json
{
  "target_column_id": "33333333-3333-4333-8333-333333333332",
  "new_position": "a0V"
}
```
- **Response `200 OK` (`CardSchema`)**

### 3.8 `POST /api/v1/cards/:cardId/ai-decompose` — AI Task Decomposition
Calls `services/ai-engine` (`POST http://localhost:8001/internal/v1/decompose-task`), saves the generated `subtasks`, `story_points`, and `priority` to PostgreSQL, broadcasts `CARD_UPDATED` via WebSocket, and returns the updated `CardSchema`.
- **Request Body**: Empty `{}` (or optional `{"board_context": ["string"]}`)
- **Response `200 OK` (`CardSchema`)**

---

## 4. WebSocket Real-Time Contract (`WS /ws/boards/:boardId`)

- **Endpoint**: `ws://localhost:8000/ws/boards/:boardId`
- **Envelope Schema (`WSMessageSchema`)**:
```json
{
  "event": "CARD_MOVED",
  "board_id": "11111111-1111-4111-8111-111111111111",
  "data": {
    "card_id": "44444444-4444-4444-8444-444444444444",
    "target_column_id": "33333333-3333-4333-8333-333333333332",
    "new_position": "a0V",
    "updated_at": "2026-11-08T10:15:00.000Z"
  },
  "actor_id": "user_or_client_id",
  "timestamp": "2026-11-08T10:15:00.000Z"
}
```
- **Supported `event` Values**:
  - `"CARD_MOVED"`
  - `"CARD_UPDATED"`
  - `"CARD_CREATED"`
  - `"COLUMN_CREATED"`

---

## 5. Internal AI Engine (`services/ai-engine` — FastAPI Port `8001`)

### `POST /internal/v1/decompose-task`
- **Required Header**: `X-Internal-Token: <INTERNAL_SERVICE_TOKEN>` (returns `401 UNAUTHORIZED` with `StandardErrorSchema` if missing or invalid).
- **Request Body (`AIDecomposeRequestSchema`)**:
```json
{
  "card_title": "Implement OAuth2 PKCE flow",
  "card_description": "Support GitHub and Google providers",
  "board_context": ["Setup PostgreSQL users table", "Configure JWT middleware"]
}
```
- **Response `200 OK` (`AIDecomposeResponseSchema`)**:
```json
{
  "suggested_subtasks": [
    { "title": "Register OAuth2 client credentials and redirect URIs", "position": "a0" },
    { "title": "Implement PKCE code_verifier and code_challenge generator", "position": "a1" },
    { "title": "Create token exchange callback handler and link user session", "position": "a2" }
  ],
  "estimated_story_points": 3,
  "suggested_priority": "HIGH",
  "potential_risks": [
    "Callback URL mismatch across local and staging environments",
    "Provider rate limits during token introspection"
  ]
}
```
