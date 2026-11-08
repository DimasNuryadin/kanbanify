# Kinetix — REST, WebSocket & Internal AI Service Contract (Phase 2: Full Trello Parity)

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

### 3.1 Board & Customization Endpoints

#### `GET /api/v1/boards` — List Boards
- **Response `200 OK` (`BoardSchema[]`)**:
```json
[
  {
    "id": "11111111-1111-4111-8111-111111111111",
    "workspace_id": "22222222-2222-4222-8222-222222222222",
    "title": "Kinetix Platform Launch",
    "description": "High-performance real-time Trello & AI workspace",
    "is_starred": true,
    "background": {
      "type": "gradient",
      "value": "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)"
    },
    "columns": [],
    "cards": [],
    "labels": [],
    "members": [],
    "activities": [],
    "created_at": "2026-11-08T10:00:00.000Z"
  }
]
```

#### `POST /api/v1/boards` — Create Board
Auto-creates 4 default columns (`Backlog` `"a0"`, `In Progress` `"a1"`, `Review` `"a2"`, `Done` `"a3"`), 6 default Trello color labels (`DEFAULT_BOARD_LABELS`), and pre-seeded team members (`DEFAULT_BOARD_MEMBERS`).
- **Request Body (`CreateBoardRequestSchema`)**:
```json
{
  "workspace_id": "22222222-2222-4222-8222-222222222222",
  "title": "Kinetix Platform Launch",
  "description": "Core roadmap and sprint execution board",
  "is_starred": false,
  "background": {
    "type": "gradient",
    "value": "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)"
  }
}
```
- **Response `201 Created` (`BoardSchema`)**

#### `GET /api/v1/boards/:boardId` — Get Full Board State
Returns board with `columns` and `cards` sorted lexicographically by `position`, along with `labels`, `members`, and `activities`.
- **Response `200 OK` (`BoardSchema`)**:
```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "workspace_id": "22222222-2222-4222-8222-222222222222",
  "title": "Kinetix Platform Launch",
  "description": "Core roadmap and sprint execution board",
  "is_starred": true,
  "background": {
    "type": "gradient",
    "value": "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)"
  },
  "columns": [
    {
      "id": "33333333-3333-4333-8333-333333333331",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "title": "Backlog",
      "position": "a0",
      "wip_limit": null,
      "color": "#3b82f6",
      "is_archived": false
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
      "updated_at": "2026-11-08T10:05:00.000Z",
      "cover": {
        "type": "color",
        "value": "#3b82f6",
        "size": "normal"
      },
      "label_ids": ["77777777-7777-4777-8777-777777777771"],
      "member_ids": ["88888888-8888-4888-8888-888888888881"],
      "checklists": [
        {
          "id": "99999999-9999-4999-8999-999999999991",
          "title": "Implementation Steps",
          "position": "a0",
          "items": [
            {
              "id": "55555555-5555-4555-8555-555555555555",
              "title": "Configure callback routes",
              "is_completed": false,
              "position": "a0",
              "due_date": null,
              "assignee_id": "88888888-8888-4888-8888-888888888881"
            }
          ]
        }
      ],
      "comments": [],
      "attachments": [],
      "start_date": "2026-11-08T00:00:00.000Z",
      "is_due_complete": false,
      "is_archived": false,
      "is_watching": true
    }
  ],
  "labels": [
    {
      "id": "77777777-7777-4777-8777-777777777771",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "name": "Ship Ready",
      "color": "green"
    }
  ],
  "members": [
    {
      "id": "88888888-8888-4888-8888-888888888881",
      "name": "Alex Rivera",
      "email": "alex@kinetix.dev",
      "avatar_url": null,
      "initials": "AR",
      "color": "#3b82f6"
    }
  ],
  "activities": [
    {
      "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "card_id": "44444444-4444-4444-8444-444444444444",
      "actor_name": "Alex Rivera",
      "action_type": "CARD_CREATED",
      "description": "added Implement OAuth2 PKCE flow to Backlog",
      "created_at": "2026-11-08T10:05:00.000Z"
    }
  ],
  "created_at": "2026-11-08T10:00:00.000Z"
}
```

#### `PATCH /api/v1/boards/:boardId` — Update Board & Customization
Update board `title`, `description`, `is_starred`, `background`, or manage board `labels` / `members`. Broadcasts `BOARD_UPDATED` via WebSocket.
- **Request Body (`UpdateBoardRequestSchema`)**:
```json
{
  "title": "Kinetix v2 Workspace",
  "is_starred": true,
  "background": {
    "type": "gradient",
    "value": "linear-gradient(135deg, #090d16 0%, #1e293b 100%)"
  },
  "labels": [
    {
      "id": "77777777-7777-4777-8777-777777777771",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "name": "Ship Ready",
      "color": "green"
    }
  ]
}
```
- **Response `200 OK` (`BoardSchema`)**

---

### 3.2 Column (Trello List) Management Endpoints

#### `POST /api/v1/boards/:boardId/columns` — Create Column
Broadcasts `COLUMN_CREATED` via WebSocket.
- **Request Body (`CreateColumnRequestSchema`)**:
```json
{
  "title": "QA Verification",
  "position": "a2V",
  "wip_limit": 3,
  "color": "#8b5cf6"
}
```
- **Response `201 Created` (`ColumnSchema`)**:
```json
{
  "id": "33333333-3333-4333-8333-333333333339",
  "board_id": "11111111-1111-4111-8111-111111111111",
  "title": "QA Verification",
  "position": "a2V",
  "wip_limit": 3,
  "color": "#8b5cf6",
  "is_archived": false
}
```

#### `PATCH /api/v1/columns/:columnId` — Update Column
Rename list `title`, set list `color`, update `wip_limit`, or archive list (`is_archived`). Broadcasts `COLUMN_UPDATED` via WebSocket.
- **Request Body (`UpdateColumnRequestSchema`)**:
```json
{
  "title": "Staging & QA",
  "color": "#10b981",
  "wip_limit": 4,
  "is_archived": false
}
```
- **Response `200 OK` (`ColumnSchema`)**

#### `PATCH /api/v1/columns/:columnId/move` — Move Column Horizontally
Reorder list horizontally using fractional index `new_position`. Broadcasts `COLUMN_MOVED` via WebSocket.
- **Request Body (`MoveColumnRequestSchema`)**:
```json
{
  "new_position": "a0V"
}
```
- **Response `200 OK` (`ColumnSchema`)**

#### `POST /api/v1/columns/:columnId/copy` — Copy Column with All Cards
Duplicate a list along with all its non-archived cards (classic Trello action). Broadcasts `COLUMN_CREATED` via WebSocket.
- **Request Body (`CopyColumnRequestSchema`, optional)**:
```json
{
  "title": "Backlog (Copy)",
  "position": "a0V"
}
```
- **Response `201 Created` (`CopyColumnResponseSchema`)**:
```json
{
  "column": {
    "id": "33333333-3333-4333-8333-333333333399",
    "board_id": "11111111-1111-4111-8111-111111111111",
    "title": "Backlog (Copy)",
    "position": "a0V",
    "wip_limit": null,
    "color": "#3b82f6",
    "is_archived": false
  },
  "cards": []
}
```

---

### 3.3 Rich Card & Trello Modal Endpoints

#### `POST /api/v1/boards/:boardId/cards` — Create Card
Broadcasts `CARD_CREATED` via WebSocket and records a `CARD_CREATED` activity entry.
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
  "due_date": "2026-11-15T00:00:00.000Z",
  "cover": { "type": "none", "value": null, "size": "normal" },
  "label_ids": ["77777777-7777-4777-8777-777777777771"],
  "member_ids": ["88888888-8888-4888-8888-888888888881"],
  "checklists": [],
  "attachments": [],
  "start_date": null,
  "is_due_complete": false,
  "is_archived": false,
  "is_watching": false
}
```
- **Response `201 Created` (`CardSchema`)**

#### `PATCH /api/v1/cards/:cardId` — Update Card (Full Trello Modal Support)
Full support for updating `title`, `description`, `priority`, `story_points`, `tags`, `subtasks`, `blocked_by_card_ids`, `cover`, `label_ids`, `member_ids`, `checklists`, `attachments`, `start_date`, `due_date`, `is_due_complete`, `is_archived`, `is_watching`. Keeps `subtasks` synced with `checklists` items for backward compatibility. Broadcasts `CARD_UPDATED` (or `CARD_ARCHIVED` when `is_archived` becomes `true`) via WebSocket.
- **Request Body (`UpdateCardRequestSchema`)**:
```json
{
  "title": "Implement OAuth2 PKCE & Session Rotation",
  "priority": "URGENT",
  "story_points": 8,
  "cover": {
    "type": "color",
    "value": "#8b5cf6",
    "size": "normal"
  },
  "label_ids": ["77777777-7777-4777-8777-777777777771"],
  "member_ids": ["88888888-8888-4888-8888-888888888881"],
  "checklists": [
    {
      "id": "99999999-9999-4999-8999-999999999991",
      "title": "Security Audit Checklist",
      "position": "a0",
      "items": [
        {
          "id": "55555555-5555-4555-8555-555555555555",
          "title": "Configure callback routes",
          "is_completed": true,
          "position": "a0",
          "due_date": null,
          "assignee_id": "88888888-8888-4888-8888-888888888881"
        }
      ]
    }
  ],
  "is_due_complete": true,
  "is_archived": false,
  "is_watching": true
}
```
- **Response `200 OK` (`CardSchema`)**

#### `PATCH /api/v1/cards/:cardId/move` — Move Card (O(1) Fractional Index)
Updates a single row in PostgreSQL (`column_id = target_column_id`, `position = new_position`), appends a `CARD_MOVED` activity record, and broadcasts `CARD_MOVED` via WebSocket.
- **Request Body (`MoveCardRequestSchema`)**:
```json
{
  "target_column_id": "33333333-3333-4333-8333-333333333332",
  "new_position": "a0V"
}
```
- **Response `200 OK` (`CardSchema`)**

#### `POST /api/v1/cards/:cardId/copy` — Copy Card
Copy card to the same or another list with its checklists, labels, members, and attachments. Broadcasts `CARD_CREATED` via WebSocket.
- **Request Body (`CopyCardRequestSchema`, optional)**:
```json
{
  "target_column_id": "33333333-3333-4333-8333-333333333332",
  "title": "Implement OAuth2 PKCE flow (Copy)",
  "position": "a1",
  "keep_checklists": true,
  "keep_labels": true,
  "keep_members": true,
  "keep_attachments": true
}
```
- **Response `201 Created` (`CardSchema`)**

#### `DELETE /api/v1/cards/:cardId` — Permanently Delete Card
Permanently deletes an archived card and broadcasts `CARD_ARCHIVED` via WebSocket.
- **Response `200 OK`**:
```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "deleted": true
}
```

#### `POST /api/v1/cards/:cardId/comments` — Add Card Comment
Adds a Markdown comment (`CommentSchema`) to a card, appends a `COMMENT_ADDED` `ActivitySchema` record to the board, and broadcasts `COMMENT_ADDED` via WebSocket.
- **Request Body (`CreateCommentRequestSchema`)**:
```json
{
  "author_id": "88888888-8888-4888-8888-888888888881",
  "author_name": "Alex Rivera",
  "author_initials": "AR",
  "content": "Verified PKCE challenge generation with SHA-256."
}
```
- **Response `201 Created` (`CommentSchema`)**:
```json
{
  "id": "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
  "card_id": "44444444-4444-4444-8444-444444444444",
  "author_id": "88888888-8888-4888-8888-888888888881",
  "author_name": "Alex Rivera",
  "author_initials": "AR",
  "content": "Verified PKCE challenge generation with SHA-256.",
  "created_at": "2026-11-08T10:20:00.000Z",
  "updated_at": "2026-11-08T10:20:00.000Z"
}
```

#### `DELETE /api/v1/cards/:cardId/comments/:commentId` — Delete Card Comment
Deletes a comment from a card and broadcasts `CARD_UPDATED` via WebSocket.
- **Response `200 OK`**:
```json
{
  "id": "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
  "deleted": true
}
```

#### `POST /api/v1/cards/:cardId/ai-decompose` — AI Task Decomposition & Trello Card Enrichment
Calls `services/ai-engine` (`POST http://localhost:8001/internal/v1/decompose-task` or `/internal/v1/enrich-card`), persists the generated `subtasks`, `checklists`, `story_points`, and `priority` to PostgreSQL, broadcasts `CARD_UPDATED` via WebSocket, and returns the updated `CardSchema`.
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
- **Supported `event` Values (`WSEventTypeEnum`)**:
  - `"CARD_MOVED"`
  - `"CARD_UPDATED"`
  - `"CARD_CREATED"`
  - `"CARD_ARCHIVED"`
  - `"COLUMN_CREATED"`
  - `"COLUMN_MOVED"`
  - `"COLUMN_UPDATED"`
  - `"COMMENT_ADDED"`
  - `"BOARD_UPDATED"`

---

## 5. Internal AI Engine (`services/ai-engine` — FastAPI Port `8001`)

### 5.1 `POST /internal/v1/decompose-task`
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

### 5.2 `POST /internal/v1/enrich-card`
Allows the AI Engine to generate multiple named checklists, suggest Trello color labels, and write a structured Markdown description template from a brief card title.
- **Required Header**: `X-Internal-Token: <INTERNAL_SERVICE_TOKEN>`
- **Request Body (`AISuggestCardEnrichmentRequest` / `AISuggestCardEnrichmentRequestSchema`)**:
```json
{
  "card_title": "Implement OAuth2 PKCE flow",
  "card_description": "Support GitHub and Google providers",
  "board_context": ["Setup PostgreSQL users table", "Configure JWT middleware"],
  "available_labels": [
    {
      "id": "77777777-7777-4777-8777-777777777771",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "name": "Ship Ready",
      "color": "green"
    }
  ]
}
```
- **Response `200 OK` (`AISuggestCardEnrichmentResponse` / `AISuggestCardEnrichmentResponseSchema`)**:
```json
{
  "structured_description": "## Objective\nImplement OAuth2 PKCE authentication flow for GitHub and Google.\n\n## Acceptance Criteria\n- S256 code challenge verification\n- Secure HTTP-only session rotation",
  "suggested_checklists": [
    {
      "title": "Implementation Steps",
      "position": "a0",
      "items": [
        { "title": "Register OAuth2 client credentials and redirect URIs", "position": "a0" },
        { "title": "Implement PKCE code_verifier and code_challenge generator", "position": "a1" }
      ]
    },
    {
      "title": "QA & Security Verification",
      "position": "a1",
      "items": [
        { "title": "Verify state parameter CSRF protection", "position": "a0" }
      ]
    }
  ],
  "suggested_labels": [
    { "name": "Architecture", "color": "blue" },
    { "name": "AI Assisted", "color": "purple" }
  ],
  "estimated_story_points": 5,
  "suggested_priority": "HIGH",
  "potential_risks": [
    "Callback URL mismatch across local and staging environments"
  ]
}
```
