# Kanbanify — REST, WebSocket & Internal AI Service Contract (Phase 5: Live Co-presence, Typing Indicators & Outbound Webhook Integrations)

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

### 3.1 Workspaces & Multi-Board Sidebar Navigation Endpoints

#### `GET /api/v1/workspaces` — List Workspaces with Board Summaries
Fetches all workspaces along with lightweight `BoardSummarySchema[]` for instant left sidebar navigation and board switching without loading heavy board payloads.
- **Response `200 OK` (`WorkspaceWithBoardsSchema[]`)**:
```json
[
  {
    "id": "22222222-2222-4222-8222-222222222222",
    "name": "Kinetix Engineering",
    "slug": "kinetix-engineering",
    "description": "Core workspace for high-velocity software engineering and releases",
    "logo_color": "#6366f1",
    "created_at": "2026-11-08T00:00:00.000Z",
    "boards": [
      {
        "id": "11111111-1111-4111-8111-111111111111",
        "workspace_id": "22222222-2222-4222-8222-222222222222",
        "title": "Kinetix Platform Launch",
        "is_starred": true,
        "background": {
          "type": "gradient",
          "value": "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)"
        },
        "card_count": 14,
        "updated_at": "2026-11-08T10:05:00.000Z",
        "created_at": "2026-11-08T10:00:00.000Z",
        "description": "High-performance real-time Trello & AI workspace"
      }
    ]
  }
]
```

#### `POST /api/v1/workspaces` — Create Workspace
- **Request Body (`CreateWorkspaceRequestSchema`)**:
```json
{
  "name": "Product Design",
  "slug": "product-design",
  "description": "Design systems, prototypes, and user experience research",
  "logo_color": "#ec4899"
}
```
- **Response `201 Created` (`WorkspaceSchema`)**:
```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "name": "Product Design",
  "slug": "product-design",
  "description": "Design systems, prototypes, and user experience research",
  "logo_color": "#ec4899",
  "created_at": "2026-11-08T11:00:00.000Z"
}
```

#### `GET /api/v1/workspaces/:workspaceId` — Get Workspace Details
- **Response `200 OK` (`WorkspaceWithBoardsSchema`)**

---

### 3.2 Board Templates Endpoints

#### `GET /api/v1/board-templates` — List Curated Board Templates
Returns curated board templates across Engineering, Marketing, Product, and Personal Kanban.
- **Response `200 OK` (`BoardTemplateSchema[]`)**:
```json
[
  {
    "id": "template-engineering-sprint",
    "name": "Engineering Sprint",
    "description": "Agile 2-week sprint board with Backlog, In Progress, Review, and Done columns with Butler automation.",
    "category": "ENGINEERING",
    "background": {
      "type": "gradient",
      "value": "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)"
    },
    "default_columns": ["Backlog", "In Progress", "Review", "Done"],
    "sample_cards_count": 5
  },
  {
    "id": "template-marketing-launch",
    "name": "Marketing Launch",
    "description": "Campaign pipeline for content creation, asset review, approvals, and scheduled deployment.",
    "category": "MARKETING",
    "background": {
      "type": "gradient",
      "value": "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #831843 100%)"
    },
    "default_columns": ["Ideas", "Drafting", "Creative Review", "Scheduled", "Published"],
    "sample_cards_count": 4
  },
  {
    "id": "template-product-roadmap",
    "name": "Product Roadmap",
    "description": "Quarterly strategic roadmap tracking feature discovery, validation, active builds, and releases.",
    "category": "PRODUCT",
    "background": {
      "type": "gradient",
      "value": "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)"
    },
    "default_columns": ["Discovery", "Planned Q1", "Planned Q2", "In Development", "Shipped"],
    "sample_cards_count": 6
  },
  {
    "id": "template-personal-kanban",
    "name": "Personal Kanban",
    "description": "Simple WIP-limited personal productivity board for daily focus, todos, and weekly review.",
    "category": "PERSONAL",
    "background": {
      "type": "gradient",
      "value": "linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)"
    },
    "default_columns": ["To Do", "Doing (Today)", "Waiting / On Hold", "Done"],
    "sample_cards_count": 3
  }
]
```

---

### 3.3 Board & Customization Endpoints

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
    "automation_rules": [],
    "created_at": "2026-11-08T10:00:00.000Z"
  }
]
```

#### `POST /api/v1/boards` — Create Board (With Optional Template & Butler Rules)
If `template_id` is provided, automatically pre-populates template columns, default labels, sample cards, and default Butler automation rules.
- **Request Body (`CreateBoardRequestSchema`)**:
```json
{
  "workspace_id": "22222222-2222-4222-8222-222222222222",
  "title": "Q1 2027 Engineering Sprint",
  "description": "Sprint board pre-configured from Engineering Sprint template",
  "is_starred": false,
  "background": {
    "type": "gradient",
    "value": "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)"
  },
  "template_id": "template-engineering-sprint"
}
```
- **Response `201 Created` (`BoardSchema`)**

#### `GET /api/v1/boards/:boardId` — Get Full Board State
Returns board with `columns` and `cards` sorted lexicographically by `position`, along with `labels`, `members`, `activities`, and `automation_rules`.
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
  "cards": [],
  "labels": [],
  "members": [],
  "activities": [],
  "automation_rules": [
    {
      "id": "66666666-6666-4666-8666-666666666661",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "name": "Auto-Complete & Tag Done Cards",
      "description": "When card is moved to Done, mark due date as complete and add Ship Ready label",
      "is_enabled": true,
      "trigger": {
        "type": "WHEN_CARD_MOVED_TO_COLUMN",
        "column_id": null,
        "column_title_match": "Done",
        "priority": null,
        "label_id": null
      },
      "actions": [
        {
          "type": "MARK_DUE_DATE_COMPLETE",
          "due_complete_value": true,
          "member_id": null,
          "label_id": null,
          "priority": null,
          "target_column_id": null,
          "checklist_title": null,
          "checklist_items": null,
          "comment_text": null
        },
        {
          "type": "ADD_LABEL",
          "label_id": "77777777-7777-4777-8777-777777777771",
          "member_id": null,
          "priority": null,
          "target_column_id": null,
          "checklist_title": null,
          "checklist_items": null,
          "comment_text": null,
          "due_complete_value": null
        }
      ],
      "execution_count": 4,
      "last_triggered_at": "2026-11-08T10:15:00.000Z",
      "created_at": "2026-11-08T00:00:00.000Z"
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
  "title": "Kinetix v3 Workspace",
  "is_starred": true,
  "background": {
    "type": "gradient",
    "value": "linear-gradient(135deg, #090d16 0%, #1e293b 100%)"
  }
}
```
- **Response `200 OK` (`BoardSchema`)**

#### `DELETE /api/v1/boards/:boardId` — Delete Board
Deletes a board and its associated columns, cards, activities, and automation rules. Broadcasts `BOARD_DELETED` via WebSocket.
- **Response `200 OK`**:
```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "deleted": true
}
```

---

### 3.4 Column (Trello List) Management Endpoints

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
- **Response `201 Created` (`ColumnSchema`)**

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
Duplicate a list along with all its non-archived cards. Broadcasts `COLUMN_CREATED` via WebSocket.
- **Request Body (`CopyColumnRequestSchema`, optional)**:
```json
{
  "title": "Backlog (Copy)",
  "position": "a0V"
}
```
- **Response `201 Created` (`CopyColumnResponseSchema`)**

---

### 3.5 Rich Card & Trello Modal Endpoints

#### `POST /api/v1/boards/:boardId/cards` — Create Card
Broadcasts `CARD_CREATED` via WebSocket and records a `CARD_CREATED` activity entry. Triggers any enabled `WHEN_CARD_CREATED` Butler automation rules.
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

#### `PATCH /api/v1/cards/:cardId` — Update Card
Full support for updating title, description, priority, story points, checklists, cover, labels, members, etc. Automatically evaluates matching Butler automation rules (`WHEN_PRIORITY_CHANGED`, `WHEN_LABEL_ADDED`, `WHEN_CHECKLIST_COMPLETED`). Broadcasts `CARD_UPDATED` via WebSocket.
- **Request Body (`UpdateCardRequestSchema`)**:
```json
{
  "title": "Implement OAuth2 PKCE & Session Rotation",
  "priority": "URGENT",
  "story_points": 8,
  "is_due_complete": true
}
```
- **Response `200 OK` (`CardSchema`)**

#### `PATCH /api/v1/cards/:cardId/move` — Move Card (O(1) Fractional Index)
Updates `column_id` and `position` in O(1). Automatically triggers enabled `WHEN_CARD_MOVED_TO_COLUMN` Butler automation rules. Appends activity records and broadcasts `CARD_MOVED` (plus `AUTOMATION_TRIGGERED` if rules fired) via WebSocket.
- **Request Body (`MoveCardRequestSchema`)**:
```json
{
  "target_column_id": "33333333-3333-4333-8333-333333333332",
  "new_position": "a0V"
}
```
- **Response `200 OK` (`CardSchema`)**

#### `POST /api/v1/cards/:cardId/copy` — Copy Card
Broadcasts `CARD_CREATED` via WebSocket.
- **Request Body (`CopyCardRequestSchema`, optional)**
- **Response `201 Created` (`CardSchema`)**

#### `DELETE /api/v1/cards/:cardId` — Permanently Delete Card
- **Response `200 OK`**: `{"id": "...", "deleted": true}`

#### `POST /api/v1/cards/:cardId/comments` — Add Card Comment
Adds a comment, appends an `ActivitySchema` entry, and broadcasts `COMMENT_ADDED` via WebSocket.
- **Request Body (`CreateCommentRequestSchema`)**
- **Response `201 Created` (`CommentSchema`)**

#### `DELETE /api/v1/cards/:cardId/comments/:commentId` — Delete Card Comment
- **Response `200 OK`**: `{"id": "...", "deleted": true}`

#### `POST /api/v1/cards/:cardId/ai-decompose` — AI Task Decomposition & Card Enrichment
- **Response `200 OK` (`CardSchema`)**

---

### 3.6 Trello Butler Automation Endpoints

#### `GET /api/v1/boards/:boardId/automations` — List Board Automation Rules
Returns all Butler automation rules configured on the board.
- **Response `200 OK` (`AutomationRuleSchema[]`)**:
```json
[
  {
    "id": "66666666-6666-4666-8666-666666666661",
    "board_id": "11111111-1111-4111-8111-111111111111",
    "name": "Auto-Complete & Tag Done Cards",
    "description": "When card is moved to Done, mark due date as complete and add Ship Ready label",
    "is_enabled": true,
    "trigger": {
      "type": "WHEN_CARD_MOVED_TO_COLUMN",
      "column_id": null,
      "column_title_match": "Done",
      "priority": null,
      "label_id": null
    },
    "actions": [
      {
        "type": "MARK_DUE_DATE_COMPLETE",
        "due_complete_value": true,
        "member_id": null,
        "label_id": null,
        "priority": null,
        "target_column_id": null,
        "checklist_title": null,
        "checklist_items": null,
        "comment_text": null
      },
      {
        "type": "ADD_LABEL",
        "label_id": "77777777-7777-4777-8777-777777777771",
        "member_id": null,
        "priority": null,
        "target_column_id": null,
        "checklist_title": null,
        "checklist_items": null,
        "comment_text": null,
        "due_complete_value": null
      }
    ],
    "execution_count": 0,
    "last_triggered_at": null,
    "created_at": "2026-11-08T00:00:00.000Z"
  }
]
```

#### `POST /api/v1/boards/:boardId/automations` — Create Automation Rule
Creates a new automation rule on the board and broadcasts `AUTOMATION_RULE_CREATED` via WebSocket.
- **Request Body (`CreateAutomationRuleRequestSchema`)**:
```json
{
  "name": "Assign Lead on High Priority",
  "description": "When priority changed to HIGH, assign Alex Rivera",
  "is_enabled": true,
  "trigger": {
    "type": "WHEN_PRIORITY_CHANGED",
    "priority": "HIGH"
  },
  "actions": [
    {
      "type": "ASSIGN_MEMBER",
      "member_id": "88888888-8888-4888-8888-888888888881"
    }
  ]
}
```
- **Response `201 Created` (`AutomationRuleSchema`)**

#### `PATCH /api/v1/automations/:ruleId` — Update Automation Rule
Toggle `is_enabled`, update trigger filters, or modify actions list. Broadcasts `AUTOMATION_RULE_UPDATED` via WebSocket.
- **Request Body (`UpdateAutomationRuleRequestSchema`)**:
```json
{
  "is_enabled": false
}
```
- **Response `200 OK` (`AutomationRuleSchema`)**

#### `DELETE /api/v1/automations/:ruleId` — Delete Automation Rule
Permanently deletes a Butler automation rule and broadcasts `AUTOMATION_RULE_DELETED` via WebSocket.
- **Response `200 OK`**:
```json
{
  "id": "66666666-6666-4666-8666-666666666661",
  "deleted": true
}
```

#### `POST /api/v1/boards/:boardId/automations/ai-generate` — AI Natural Language Automation Builder
Proxies a user's natural language automation command along with current board context (`columns`, `members`, `labels`) to `services/ai-engine` (`POST http://localhost:8001/internal/v1/parse-automation`), returning a structured rule ready for review or immediate persistence.
- **Request Body**:
```json
{
  "prompt": "Whenever someone moves a card into Review, set priority to HIGH and assign Samir Patel"
}
```
- **Response `200 OK` (`AIParseAutomationResponseSchema`)**:
```json
{
  "name": "Review Escalation",
  "description": "When card moved to Review, set priority to HIGH and assign Samir Patel",
  "trigger": {
    "type": "WHEN_CARD_MOVED_TO_COLUMN",
    "column_id": "33333333-3333-4333-8333-333333333333",
    "column_title_match": "Review",
    "priority": null,
    "label_id": null
  },
  "actions": [
    {
      "type": "SET_PRIORITY",
      "priority": "HIGH",
      "member_id": null,
      "label_id": null,
      "target_column_id": null,
      "checklist_title": null,
      "checklist_items": null,
      "comment_text": null,
      "due_complete_value": null
    },
    {
      "type": "ASSIGN_MEMBER",
      "member_id": "88888888-8888-4888-8888-888888888883",
      "label_id": null,
      "priority": null,
      "target_column_id": null,
      "checklist_title": null,
      "checklist_items": null,
      "comment_text": null,
      "due_complete_value": null
    }
  ]
}
```

---

### 3.7 Team Productivity & Sprint Analytics Endpoints (Phase 4)

#### `GET /api/v1/boards/:boardId/analytics` — Get Real-Time Board & Sprint Analytics
Computes and returns `BoardAnalyticsSchema` in real time from the board's columns, cards, checklists, members, Butler automation rules, and burndown history.
- **Response `200 OK` (`BoardAnalyticsSchema`)**:
```json
{
  "board_id": "11111111-1111-4111-8111-111111111111",
  "total_cards": 12,
  "completed_cards": 5,
  "archived_cards": 1,
  "completion_rate": 41.7,
  "total_story_points": 42,
  "completed_story_points": 18,
  "overdue_cards_count": 2,
  "blocked_cards_count": 1,
  "checklist_completion_rate": 68.5,
  "automation_executions_total": 9,
  "cards_by_column": [
    {
      "column_id": "33333333-3333-4333-8333-333333333331",
      "column_title": "Backlog",
      "card_count": 3,
      "total_story_points": 11,
      "wip_limit": null,
      "is_bottleneck": false
    },
    {
      "column_id": "33333333-3333-4333-8333-333333333332",
      "column_title": "In Progress",
      "card_count": 4,
      "total_story_points": 13,
      "wip_limit": 3,
      "is_bottleneck": true
    },
    {
      "column_id": "33333333-3333-4333-8333-333333333334",
      "column_title": "Done",
      "card_count": 5,
      "total_story_points": 18,
      "wip_limit": null,
      "is_bottleneck": false
    }
  ],
  "workload_by_member": [
    {
      "member_id": "88888888-8888-4888-8888-888888888881",
      "member_name": "Alex Rivera",
      "member_initials": "AR",
      "member_color": "#3b82f6",
      "assigned_cards_count": 5,
      "completed_cards_count": 2,
      "active_story_points": 13,
      "overdue_cards_count": 1
    }
  ],
  "cards_by_priority": [
    { "priority": "URGENT", "count": 2, "story_points": 13 },
    { "priority": "HIGH", "count": 4, "story_points": 16 },
    { "priority": "MEDIUM", "count": 4, "story_points": 10 },
    { "priority": "LOW", "count": 2, "story_points": 3 }
  ],
  "cards_by_label": [
    {
      "label_id": "77777777-7777-4777-8777-777777777771",
      "label_name": "Ship Ready",
      "label_color": "green",
      "count": 5
    },
    {
      "label_id": "77777777-7777-4777-8777-777777777774",
      "label_name": "Blocker",
      "label_color": "red",
      "count": 1
    }
  ],
  "burndown_series": [
    {
      "date": "Day 1",
      "ideal_remaining_points": 42,
      "actual_remaining_points": 42,
      "completed_cards_count": 0
    },
    {
      "date": "Day 7",
      "ideal_remaining_points": 0,
      "actual_remaining_points": 24,
      "completed_cards_count": 5
    }
  ]
}
```

#### `POST /api/v1/boards/:boardId/analytics/ai-report` — Generate AI Executive Sprint Health & Bottleneck Report
Computes `BoardAnalyticsSchema` for the board, forwards `AIAnalyticsRequestSchema` (`{ board_title, analytics }`) to `services/ai-engine` (`POST http://localhost:8001/internal/v1/analyze-board`), and returns `AIAnalyticsReportSchema`.
- **Response `200 OK` (`AIAnalyticsReportSchema`)**:
```json
{
  "health_score": 74,
  "health_status": "ON_TRACK",
  "executive_summary": "Sprint velocity is steady at **41.7% completion** (18/42 story points delivered), though a WIP limit breach in **In Progress** (4/3 cards) and 2 overdue cards require attention.",
  "bottlenecks": [
    "Column 'In Progress' exceeds its WIP limit (4 active cards vs limit of 3).",
    "2 cards are currently past their due date and 1 card is flagged as blocked.",
    "Alex Rivera is carrying 13 active story points across 3 open cards."
  ],
  "actionable_recommendations": [
    "Swarm on the 1 blocked card in 'In Progress' to bring the column back within its WIP limit of 3.",
    "Rebalance 1 High-priority card from Alex Rivera to Samir Patel or Elena Rostova.",
    "Review and update due dates for the 2 overdue cards during tomorrow's standup."
  ],
  "generated_at": "2026-11-09T09:00:00.000Z"
}
```

---

### 3.8 Native Trello JSON Import & Board Export Endpoints (Phase 4)

#### `POST /api/v1/boards/import` — Import Board from Trello JSON or Kanbanify JSON
Accepts `TrelloImportRequestSchema` containing either a raw Trello board JSON export (`lists`, `cards`, `checklists`, `labels`) or a complete Kanbanify `BoardSchema` JSON. Maps Trello `lists` -> `columns` (generating lexicographical fractional index `position`), `cards` -> `cards` (mapping `idList`, `labels`, `due`, `dueComplete`, `idMembers`, and matching `checklists`), persists the new board into the target workspace, broadcasts `BOARD_IMPORTED` via WebSocket, and returns `TrelloImportResultSchema`.
- **Request Body (`TrelloImportRequestSchema`)**:
```json
{
  "workspace_id": "22222222-2222-4222-8222-222222222222",
  "board_title_override": "Imported Trello Roadmap",
  "format": "trello_json",
  "payload": {
    "name": "Trello Product Launch",
    "desc": "Imported from Trello JSON export",
    "lists": [
      { "id": "trello-list-1", "name": "To Do", "closed": false },
      { "id": "trello-list-2", "name": "Doing", "closed": false },
      { "id": "trello-list-3", "name": "Done", "closed": false }
    ],
    "cards": [
      {
        "id": "trello-card-1",
        "name": "Migrate legacy Trello boards to Kinetix",
        "desc": "Support full JSON lists, cards, labels, and checklists",
        "idList": "trello-list-1",
        "due": "2026-11-20T00:00:00.000Z",
        "dueComplete": false,
        "closed": false,
        "labels": [{ "id": "tl-1", "name": "Ship Ready", "color": "green" }]
      }
    ],
    "checklists": [
      {
        "id": "trello-chk-1",
        "idCard": "trello-card-1",
        "name": "Migration Steps",
        "checkItems": [
          { "name": "Parse Trello lists and generate fractional positions", "state": "complete" },
          { "name": "Map cards and checklists to Kinetix schema", "state": "incomplete" }
        ]
      }
    ]
  }
}
```
- **Response `201 Created` (`TrelloImportResultSchema`)**:
```json
{
  "board": {
    "id": "99999999-9999-4999-8999-999999999999",
    "workspace_id": "22222222-2222-4222-8222-222222222222",
    "title": "Imported Trello Roadmap",
    "description": "Imported from Trello JSON export",
    "is_starred": false,
    "background": {
      "type": "gradient",
      "value": "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)"
    },
    "columns": [],
    "cards": [],
    "labels": [],
    "members": [],
    "activities": [],
    "automation_rules": [],
    "created_at": "2026-11-09T09:00:00.000Z"
  },
  "imported_lists_count": 3,
  "imported_cards_count": 1,
  "imported_checklists_count": 1
}
```

#### `GET /api/v1/boards/:boardId/export?format=csv|json` — Export Board as CSV or JSON
Exports full board data either as downloadable CSV (`Card ID, Title, Column, Priority, Story Points, Labels, Members, Due Date, Due Complete, Checklist Progress, Blocked By, Created/Updated At`) or complete Kinetix/Trello-compatible JSON.
- **Query Parameter**: `format` (`"csv"` | `"json"`, default `"json"`).
- **Response `200 OK` (`format=json` -> `BoardSchema`)**: Returns full `BoardSchema` JSON.
- **Response `200 OK` (`format=csv` -> `BoardExportCsvResponseSchema`)**:
```json
{
  "filename": "kinetix-platform-launch-export.csv",
  "content_type": "text/csv",
  "csv_data": "Card ID,Title,Column,Priority,Story Points,Labels,Members,Due Date,Due Complete,Checklist Progress,Blocked By,Updated At\n\"44444444-4444-4444-8444-444444444441\",\"Implement OAuth2 PKCE flow\",\"In Progress\",\"HIGH\",5,\"Ship Ready\",\"Alex Rivera\",\"2026-11-15T00:00:00.000Z\",false,\"2/3\",\"\",\"2026-11-09T09:00:00.000Z\""
}
```

### 3.10 Phase 5 Outbound Webhook Integration Endpoints

Manages outbound webhook configurations for Slack, Discord, and Custom HTTP endpoints per board. Webhooks trigger automated outbound notification dispatches when key Kanban lifecycle events occur.

#### `GET /api/v1/boards/:boardId/webhooks` — List Board Webhooks
Fetches all configured outbound webhooks for a specific board.
- **Path Parameter**: `boardId` (UUID)
- **Response `200 OK` (`WebhookConfigSchema[]`)**:
```json
[
  {
    "id": "wh-55555555-5555-4555-8555-555555555551",
    "board_id": "11111111-1111-4111-8111-111111111111",
    "name": "Engineering Slack Alerts",
    "platform": "SLACK",
    "url": "https://example.com/webhooks/slack-incoming",
    "is_enabled": true,
    "subscribed_events": [
      "CARD_CREATED",
      "CARD_MOVED",
      "CARD_ARCHIVED",
      "AUTOMATION_TRIGGERED"
    ],
    "created_at": "2026-11-09T10:00:00.000Z"
  },
  {
    "id": "wh-55555555-5555-4555-8555-555555555552",
    "board_id": "11111111-1111-4111-8111-111111111111",
    "name": "Dev Discord Feed",
    "platform": "DISCORD",
    "url": "https://example.com/webhooks/discord-incoming",
    "is_enabled": true,
    "subscribed_events": [
      "CARD_CREATED",
      "COMMENT_ADDED"
    ],
    "created_at": "2026-11-09T10:05:00.000Z"
  }
]
```

#### `POST /api/v1/boards/:boardId/webhooks` — Create Outbound Webhook
Registers a new outbound webhook integration for Slack, Discord, or Custom endpoints.
- **Path Parameter**: `boardId` (UUID)
- **Request Body (`CreateWebhookRequestSchema`)**:
```json
{
  "name": "Incident Slack Channel",
  "platform": "SLACK",
  "url": "https://example.com/webhooks/slack-incoming",
  "is_enabled": true,
  "subscribed_events": [
    "CARD_CREATED",
    "CARD_MOVED",
    "AUTOMATION_TRIGGERED"
  ]
}
```
- **Response `201 Created` (`WebhookConfigSchema`)**:
```json
{
  "id": "wh-55555555-5555-4555-8555-555555555553",
  "board_id": "11111111-1111-4111-8111-111111111111",
  "name": "Incident Slack Channel",
  "platform": "SLACK",
  "url": "https://example.com/webhooks/slack-incoming",
  "is_enabled": true,
  "subscribed_events": [
    "CARD_CREATED",
    "CARD_MOVED",
    "AUTOMATION_TRIGGERED"
  ],
  "created_at": "2026-11-09T10:10:00.000Z"
}
```

#### `PATCH /api/v1/webhooks/:webhookId` — Update Webhook Configuration
Updates an existing webhook's name, target URL, platform adapter, enabled status, or event subscriptions.
- **Path Parameter**: `webhookId` (string)
- **Request Body (`UpdateWebhookRequestSchema`)**:
```json
{
  "name": "Incident Slack Channel (Renamed)",
  "is_enabled": false
}
```
- **Response `200 OK` (`WebhookConfigSchema`)**:
```json
{
  "id": "wh-55555555-5555-4555-8555-555555555553",
  "board_id": "11111111-1111-4111-8111-111111111111",
  "name": "Incident Slack Channel (Renamed)",
  "platform": "SLACK",
  "url": "https://example.com/webhooks/slack-incoming",
  "is_enabled": false,
  "subscribed_events": [
    "CARD_CREATED",
    "CARD_MOVED",
    "AUTOMATION_TRIGGERED"
  ],
  "created_at": "2026-11-09T10:10:00.000Z"
}
```

#### `DELETE /api/v1/webhooks/:webhookId` — Delete Webhook
Removes a registered webhook integration permanently.
- **Path Parameter**: `webhookId` (string)
- **Response `204 No Content`**

#### `POST /api/v1/webhooks/:webhookId/test` — Send Test Webhook Ping
Dispatches a sample test notification payload to the configured webhook endpoint (Slack, Discord, or Custom) to verify network connectivity and payload delivery.
- **Path Parameter**: `webhookId` (string)
- **Response `200 OK` (`TestWebhookResponseSchema`)**:
```json
{
  "success": true,
  "status_code": 200,
  "message": "Test ping successfully delivered to SLACK endpoint",
  "delivered_at": "2026-11-09T10:15:00.000Z"
}
```

---

## 4. Runtime Automation Execution Contract

Whenever a card mutation endpoint is executed on `apps/api` (`PATCH /api/v1/cards/:cardId/move`, `POST /api/v1/boards/:boardId/cards`, or `PATCH /api/v1/cards/:cardId`), the backend executes the **Butler Automation Pipeline**:

1. **Trigger Evaluation**:
   - Query all `automation_rules` for the board where `is_enabled = true`.
   - Match rules against the event trigger:
     - `WHEN_CARD_MOVED_TO_COLUMN`: matches target `column_id` or case-insensitive `column_title_match` (e.g., target column title contains `"Done"`).
     - `WHEN_CARD_CREATED`: matches on card creation.
     - `WHEN_CHECKLIST_COMPLETED`: matches when all items in a checklist become completed.
     - `WHEN_PRIORITY_CHANGED`: matches when card priority equals trigger filter priority.
     - `WHEN_LABEL_ADDED`: matches when trigger filter `label_id` is attached.

2. **Sequential Action Execution**:
   - Execute each action defined on matching rules against the card:
     - `MARK_DUE_DATE_COMPLETE`: Mutates `is_due_complete = true` (or action's `due_complete_value`).
     - `ASSIGN_MEMBER`: Adds `member_id` to `member_ids` (if not already present).
     - `ADD_LABEL`: Adds `label_id` to `label_ids` (if not already present).
     - `SET_PRIORITY`: Updates `priority` to action's priority value.
     - `MOVE_CARD_TO_COLUMN`: Moves card to `target_column_id` with new fractional position.
     - `ADD_CHECKLIST`: Appends new checklist titled `checklist_title` with items `checklist_items`.
     - `POST_COMMENT`: Appends a new Butler automated comment with `comment_text`.

3. **Audit & Activity Trail**:
   - Increments rule's `execution_count` by 1 and updates `last_triggered_at = now()`.
   - Appends an `ActivitySchema` entry to the board with:
     - `actor_name`: `"Kinetix Butler"`
     - `action_type`: `"AUTOMATION_TRIGGERED"`
     - `is_automated`: `true`
     - `description`: `"🤖 Butler executed rule '{rule.name}' on '{card.title}'"`

4. **Real-Time WebSocket Broadcast**:
   - Broadcasts `AUTOMATION_TRIGGERED` event with `AutomationTriggeredEventDataSchema`:
     ```json
     {
       "event": "AUTOMATION_TRIGGERED",
       "board_id": "11111111-1111-4111-8111-111111111111",
       "data": {
         "rule_id": "66666666-6666-4666-8666-666666666661",
         "rule_name": "Auto-Complete & Tag Done Cards",
         "card_id": "44444444-4444-4444-8444-444444444444",
         "trigger_type": "WHEN_CARD_MOVED_TO_COLUMN",
         "action_types": ["MARK_DUE_DATE_COMPLETE", "ADD_LABEL"],
         "execution_count": 5,
         "triggered_at": "2026-11-08T10:15:00.000Z"
       },
       "actor_id": "system_butler",
       "timestamp": "2026-11-08T10:15:00.000Z"
     }
     ```
   - Also broadcasts `CARD_UPDATED` with the mutated card so all connected clients reflect the automation immediately.

---

## 5. WebSocket Real-Time Contract (`WS /ws/boards/:boardId`)

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
  - `"BOARD_DELETED"`
  - `"BOARD_IMPORTED"`
  - `"AUTOMATION_TRIGGERED"`
  - `"AUTOMATION_RULE_CREATED"`
  - `"AUTOMATION_RULE_UPDATED"`
  - `"AUTOMATION_RULE_DELETED"`
  - `"PRESENCE_SYNC"`
  - `"USER_JOINED"`
  - `"USER_LEFT"`
  - `"USER_TYPING"`

### 5.1 Real-Time Co-presence & Live Typing Indicators Protocol

Enables live collaborator presence avatars, editing activity indicators, and real-time typing status over the persistent WebSocket connection (`ws://localhost:8000/ws/boards/:boardId`).

#### Inbound Client Messages (`ClientPresenceMessageSchema`):
Clients periodically transmit heartbeats and editing state transitions:
```json
{
  "event": "HEARTBEAT | START_TYPING | STOP_TYPING",
  "card_id": "44444444-4444-4444-8444-444444444444"
}
```
- `event`:
  - `"HEARTBEAT"`: Sent every 15-30 seconds to refresh active presence and report currently viewed or focused `card_id` (or `null`).
  - `"START_TYPING"`: Broadcast when the user focuses a comment input or title editor on `card_id`. Sets user status to `"EDITING"`.
  - `"STOP_TYPING"`: Broadcast when the user unfocuses, saves, or stops typing for 3 seconds. Reverts status to `"ACTIVE"`.
- `card_id`: Target card currently being viewed or edited (or `null` if navigating board).

#### Outbound Server Presence Broadcast (`PresenceMessageSchema`):
Upon client connection, disconnection, heartbeat, or typing transition, the server broadcasts an updated presence message to all connected clients on the board:
```json
{
  "event": "PRESENCE_SYNC",
  "board_id": "11111111-1111-4111-8111-111111111111",
  "presences": [
    {
      "user_id": "88888888-8888-4888-8888-888888888881",
      "user_name": "Alex Rivera",
      "avatar_url": null,
      "initials": "AR",
      "color": "#3b82f6",
      "status": "EDITING",
      "active_card_id": "44444444-4444-4444-8444-444444444444",
      "last_seen": "2026-11-09T10:15:30.000Z"
    },
    {
      "user_id": "88888888-8888-4888-8888-888888888882",
      "user_name": "Samir Patel",
      "avatar_url": null,
      "initials": "SP",
      "color": "#10b981",
      "status": "ACTIVE",
      "active_card_id": null,
      "last_seen": "2026-11-09T10:15:28.000Z"
    }
  ],
  "actor": {
    "user_id": "88888888-8888-4888-8888-888888888881",
    "user_name": "Alex Rivera",
    "avatar_url": null,
    "initials": "AR",
    "color": "#3b82f6",
    "status": "EDITING",
    "active_card_id": "44444444-4444-4444-8444-444444444444",
    "last_seen": "2026-11-09T10:15:30.000Z"
  }
}
```
- Supported presence broadcast events (`PresenceEventTypeEnum`):
  - `"PRESENCE_SYNC"`: Initial full presence sync sent upon client connection.
  - `"USER_JOINED"`: Sent when a new collaborator connects to the board.
  - `"USER_LEFT"`: Sent when a collaborator disconnects or their heartbeat times out (60s TTL in Redis/in-memory presence store).
  - `"USER_TYPING"`: Sent when a user begins or stops typing on a card.

---

## 6. Internal AI Engine (`services/ai-engine` — FastAPI Port `8001`)

### 6.1 `POST /internal/v1/decompose-task`
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

### 6.2 `POST /internal/v1/enrich-card`
Allows the AI Engine to generate multiple named checklists, suggest Trello color labels, and write a structured Markdown description template from a brief card title.
- **Required Header**: `X-Internal-Token: <INTERNAL_SERVICE_TOKEN>`
- **Request Body (`AISuggestCardEnrichmentRequestSchema`)**:
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
- **Response `200 OK` (`AISuggestCardEnrichmentResponseSchema`)**:
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

### 6.3 `POST /internal/v1/parse-automation` (Phase 3 Natural Language Butler Parser)
Translates freeform plain text instructions into structured trigger conditions and executable actions matching the board's existing columns, labels, and members.
- **Required Header**: `X-Internal-Token: <INTERNAL_SERVICE_TOKEN>`
- **Request Body (`AIParseAutomationRequestSchema`)**:
```json
{
  "prompt": "When any card moves to Done, mark due date complete and add green label Ship Ready",
  "board_columns": [
    { "id": "33333333-3333-4333-8333-333333333331", "title": "Backlog" },
    { "id": "33333333-3333-4333-8333-333333333334", "title": "Done" }
  ],
  "board_members": [
    { "id": "88888888-8888-4888-8888-888888888881", "name": "Alex Rivera" }
  ],
  "board_labels": [
    { "id": "77777777-7777-4777-8777-777777777771", "name": "Ship Ready", "color": "green" }
  ]
}
```
- **Response `200 OK` (`AIParseAutomationResponseSchema`)**:
```json
{
  "name": "Auto-Complete & Tag Done Cards",
  "description": "When card is moved to Done, mark due date complete and attach Ship Ready label",
  "trigger": {
    "type": "WHEN_CARD_MOVED_TO_COLUMN",
    "column_id": "33333333-3333-4333-8333-333333333334",
    "column_title_match": "Done",
    "priority": null,
    "label_id": null
  },
  "actions": [
    {
      "type": "MARK_DUE_DATE_COMPLETE",
      "due_complete_value": true,
      "member_id": null,
      "label_id": null,
      "priority": null,
      "target_column_id": null,
      "checklist_title": null,
      "checklist_items": null,
      "comment_text": null
    },
    {
      "type": "ADD_LABEL",
      "label_id": "77777777-7777-4777-8777-777777777771",
      "member_id": null,
      "priority": null,
      "target_column_id": null,
      "checklist_title": null,
      "checklist_items": null,
      "comment_text": null,
      "due_complete_value": null
    }
  ]
}
```

### 6.4 `POST /internal/v1/analyze-board` (Phase 4 AI Executive Sprint Health & Bottleneck Analyzer)
Analyzes real-time board metrics (`BoardAnalyticsSchema`) and generates an executive sprint health score (`0` to `100`), status classification (`EXCELLENT | ON_TRACK | AT_RISK | CRITICAL`), markdown executive summary, detected workflow bottlenecks, and 3 to 5 concrete actionable recommendations.
- **Required Header**: `X-Internal-Token: <INTERNAL_SERVICE_TOKEN>` (returns `401 UNAUTHORIZED` with `StandardErrorSchema` if missing or invalid).
- **Request Body (`AIAnalyticsRequestSchema`)**:
```json
{
  "board_title": "Kinetix Platform Launch",
  "analytics": {
    "board_id": "11111111-1111-4111-8111-111111111111",
    "total_cards": 12,
    "completed_cards": 5,
    "archived_cards": 1,
    "completion_rate": 41.7,
    "total_story_points": 42,
    "completed_story_points": 18,
    "overdue_cards_count": 2,
    "blocked_cards_count": 1,
    "checklist_completion_rate": 68.5,
    "automation_executions_total": 9,
    "cards_by_column": [
      {
        "column_id": "33333333-3333-4333-8333-333333333332",
        "column_title": "In Progress",
        "card_count": 4,
        "total_story_points": 13,
        "wip_limit": 3,
        "is_bottleneck": true
      }
    ],
    "workload_by_member": [
      {
        "member_id": "88888888-8888-4888-8888-888888888881",
        "member_name": "Alex Rivera",
        "member_initials": "AR",
        "member_color": "#3b82f6",
        "assigned_cards_count": 5,
        "completed_cards_count": 2,
        "active_story_points": 13,
        "overdue_cards_count": 1
      }
    ],
    "cards_by_priority": [
      { "priority": "URGENT", "count": 2, "story_points": 13 }
    ],
    "cards_by_label": [
      {
        "label_id": "77777777-7777-4777-8777-777777777774",
        "label_name": "Blocker",
        "label_color": "red",
        "count": 1
      }
    ],
    "burndown_series": [
      {
        "date": "Day 1",
        "ideal_remaining_points": 42,
        "actual_remaining_points": 42,
        "completed_cards_count": 0
      }
    ]
  }
}
```
- **Response `200 OK` (`AIAnalyticsReportSchema`)**:
```json
{
  "health_score": 74,
  "health_status": "ON_TRACK",
  "executive_summary": "Sprint velocity is steady at **41.7% completion** (18/42 story points delivered), though a WIP limit breach in **In Progress** (4/3 cards) and 2 overdue cards require attention.",
  "bottlenecks": [
    "Column 'In Progress' exceeds its WIP limit (4 active cards vs limit of 3).",
    "2 cards are currently past their due date and 1 card is flagged as blocked.",
    "Alex Rivera is carrying 13 active story points across 3 open cards."
  ],
  "actionable_recommendations": [
    "Swarm on the 1 blocked card in 'In Progress' to bring the column back within its WIP limit of 3.",
    "Rebalance 1 High-priority card from Alex Rivera to Samir Patel or Elena Rostova.",
    "Review and update due dates for the 2 overdue cards during tomorrow's standup."
  ],
  "generated_at": "2026-11-09T09:00:00.000Z"
}
```

### 6.5 `POST /internal/v1/format-notification` (Phase 5 Outbound Webhook Formatter)
Invoked by `apps/api` to generate rich, visually compelling notification payloads tailored for Slack Block Kit and Discord Embeds, plus plain markdown summary text based on recent board activities.
- **Required Header**: `X-Internal-Token: <INTERNAL_SERVICE_TOKEN>` (returns `401 UNAUTHORIZED` with `StandardErrorSchema` if missing or invalid).
- **Request Body (`AISummaryNotificationRequestSchema`)**:
```json
{
  "board_title": "Kinetix Platform Launch",
  "recent_activities": [
    {
      "id": "act-01",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "card_id": "44444444-4444-4444-8444-444444444441",
      "actor_id": "88888888-8888-4888-8888-888888888881",
      "actor_name": "Alex Rivera",
      "action_type": "CARD_MOVED",
      "details": {
        "card_title": "Implement OAuth2 PKCE flow",
        "target_column": "Review"
      },
      "created_at": "2026-11-09T10:14:00.000Z"
    },
    {
      "id": "act-02",
      "board_id": "11111111-1111-4111-8111-111111111111",
      "card_id": "44444444-4444-4444-8444-444444444442",
      "actor_id": "88888888-8888-4888-8888-888888888882",
      "actor_name": "Samir Patel",
      "action_type": "AUTOMATION_TRIGGERED",
      "details": {
        "rule_name": "Auto-Assign Reviewer on Done",
        "card_title": "Implement Webhook Dispatcher"
      },
      "created_at": "2026-11-09T10:15:00.000Z"
    }
  ]
}
```
- **Response `200 OK` (`AISummaryNotificationResponseSchema`)**:
```json
{
  "slack_block_kit_payload": {
    "blocks": [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": "📋 Kinetix Board Activity: Kinetix Platform Launch",
          "emoji": true
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Alex Rivera* moved *Implement OAuth2 PKCE flow* to *Review*.\n*Butler Automation* triggered *Auto-Assign Reviewer on Done*."
        }
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": "⚡ Dispatched via Kinetix Webhook Dispatcher | 2026-11-09T10:15:00.000Z"
          }
        ]
      }
    ]
  },
  "discord_embed_payload": {
    "username": "Kinetix Bot",
    "avatar_url": "https://kinetix.internal/icons/bot-avatar.png",
    "embeds": [
      {
        "title": "📋 Board Update: Kinetix Platform Launch",
        "color": 65280,
        "description": "Recent activity summary on board **Kinetix Platform Launch**:",
        "fields": [
          {
            "name": "Card Moved",
            "value": "**Implement OAuth2 PKCE flow** moved to **Review** by Alex Rivera",
            "inline": false
          },
          {
            "name": "Automation Triggered",
            "value": "**Auto-Assign Reviewer on Done** executed on card",
            "inline": false
          }
        ],
        "footer": {
          "text": "Kinetix Webhook Dispatcher"
        },
        "timestamp": "2026-11-09T10:15:00.000Z"
      }
    ]
  },
  "summary_text": "Alex Rivera moved 'Implement OAuth2 PKCE flow' to Review. Butler automation 'Auto-Assign Reviewer on Done' executed."
}
```

---

## 7. Outbound Webhook Dispatcher Contract

`apps/api` contains an asynchronous, non-blocking **Outbound Webhook Dispatcher** that monitors board lifecycle events and dispatches HTTP POST requests to configured webhook endpoints.

### 7.1 Webhook Trigger Lifecycle
1. **Event Capture**: When any of the subscribed lifecycle events occur:
   - `CARD_CREATED`
   - `CARD_MOVED`
   - `CARD_ARCHIVED`
   - `COMMENT_ADDED`
   - `AUTOMATION_TRIGGERED`
2. **Subscription Query**: `apps/api` loads all webhooks registered on `board_id` where `is_enabled = true` and `subscribed_events` includes the current event.
3. **Payload Formatting**:
   - For `platform = "SLACK"`: The payload is formatted with Slack Block Kit JSON blocks (`{ "blocks": [...] }`).
   - For `platform = "DISCORD"`: The payload is formatted with Discord Webhook Embed JSON (`{ "embeds": [...] }`).
   - For `platform = "CUSTOM"`: The standard `OutboundWebhookPayloadSchema` JSON payload is delivered.
4. **HMAC Signature Generation**:
   - `apps/api` computes an HMAC-SHA256 signature of the serialized JSON payload using the webhook's secret key (or workspace signing key).
   - The hex digest is attached in the `X-Kanbanify-Signature` / `X-Kinetix-Signature` HTTP header (`sha256=<hex_digest>`).
5. **HTTP Dispatch**:
   - Dispatched asynchronously with a 5-second connection/read timeout.
   - Headers included:
     - `Content-Type: application/json`
     - `X-Kanbanify-Event: <EVENT_TYPE>` (along with backward-compatible `X-Kinetix-Event`)
     - `X-Kinetix-Delivery-Id: <UUID>`
     - `X-Kinetix-Signature: sha256=<HMAC_SHA256_HEX>`
     - `User-Agent: Kanbanify-Webhook-Dispatcher/1.0`
6. **Error Handling**: Non-blocking; failures or non-2xx status codes are logged with error metrics without rolling back the board transaction.

### 7.2 Outbound Webhook Payload Envelope (`OutboundWebhookPayloadSchema`)
```json
{
  "event": "CARD_MOVED",
  "board_id": "11111111-1111-4111-8111-111111111111",
  "timestamp": "2026-11-09T10:15:00.000Z",
  "actor": {
    "id": "88888888-8888-4888-8888-888888888881",
    "name": "Alex Rivera"
  },
  "data": {
    "card_id": "44444444-4444-4444-8444-444444444441",
    "card_title": "Implement OAuth2 PKCE flow",
    "source_column_id": "33333333-3333-4333-8333-333333333331",
    "target_column_id": "33333333-3333-4333-8333-333333333332",
    "target_column_title": "In Progress",
    "new_position": "a0V"
  }
}
```
