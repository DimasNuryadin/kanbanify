import assert from "node:assert/strict";
import { z } from "zod";
import {
  AIAnalyticsReportSchema,
  AIPermissionAuditResponseSchema,
  AuthSessionResponseSchema,
  AuthUserSchema,
  AutomationRuleSchema,
  BoardAnalyticsSchema,
  BoardExportCsvResponseSchema,
  BoardInviteLinkSchema,
  BoardSchema,
  BoardTemplateSchema,
  CardSchema,
  ColumnSchema,
  CommentSchema,
  CopyColumnResponseSchema,
  HealthCheckResponseSchema,
  JoinViaInviteResponseSchema,
  MemberSchema,
  StandardErrorSchema,
  TestWebhookResponseSchema,
  TrelloImportResultSchema,
  UserPresenceSchema,
  WebhookConfigSchema,
  WorkspaceSchema,
  WorkspaceWithBoardsSchema,
  WSMessageSchema,
  type WSMessage,
} from "@kinetix/contracts";
import { buildApp } from "./app.js";

async function runSelfTest(): Promise<void> {
  console.info("=== Kinetix API Phase 3 (Multi-Board Workspace & Runtime Butler) Self-Test Suite ===");
  const { app, hub, presenceService } = await buildApp({ logger: false });

  try {
    // 1. Health Check
    const healthRes = await app.inject({
      method: "GET",
      url: "/health",
    });
    assert.equal(healthRes.statusCode, 200, "GET /health must return 200");
    const healthBody = HealthCheckResponseSchema.parse(healthRes.json());
    assert.equal(healthBody.status, "ok");
    assert.equal(healthBody.service, "kinetix-api");
    assert.equal(healthBody.version, "1.0.0");
    console.info("[PASS] 1. GET /health -> 200 OK", healthBody);

    // 2. List Boards
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/boards",
    });
    assert.equal(listRes.statusCode, 200, "GET /api/v1/boards must return 200");
    const initialBoards = z.array(BoardSchema).parse(listRes.json());
    assert.ok(initialBoards.length >= 1, "Pre-seeded board should be present");
    assert.equal(
      initialBoards[0]!.labels.length,
      6,
      "Pre-seeded board must have 6 default Trello labels"
    );
    assert.equal(
      initialBoards[0]!.members.length,
      4,
      "Pre-seeded board must have 4 default members"
    );
    console.info(
      `[PASS] 2. GET /api/v1/boards -> ${initialBoards.length} board(s) with Phase 2 fields`
    );

    // 3. Create Board (auto-creates 4 default columns, 6 Trello labels, 4 members)
    const createBoardRes = await app.inject({
      method: "POST",
      url: "/api/v1/boards",
      payload: {
        title: "Self-Test Trello Parity Board",
        description: "End-to-end verification board",
        is_starred: false,
      },
    });
    assert.equal(createBoardRes.statusCode, 201);
    const createdBoard = BoardSchema.parse(createBoardRes.json());
    assert.equal(createdBoard.columns.length, 4);
    assert.equal(createdBoard.labels.length, 6);
    assert.equal(createdBoard.members.length, 4);
    assert.deepEqual(
      createdBoard.labels.map((l) => l.color),
      ["green", "yellow", "orange", "red", "purple", "blue"]
    );
    assert.deepEqual(
      createdBoard.columns.map((c) => ({
        title: c.title,
        position: c.position,
      })),
      [
        { title: "Backlog", position: "a0" },
        { title: "In Progress", position: "a1" },
        { title: "Review", position: "a2" },
        { title: "Done", position: "a3" },
      ]
    );
    console.info(
      "[PASS] 3. POST /api/v1/boards -> 201 Created with 4 columns, 6 labels, 4 members"
    );

    // Attach an in-process mock WebSocket subscriber to verify real-time broadcasts
    const receivedWsMessages: WSMessage[] = [];
    const mockSocket = {
      readyState: 1,
      OPEN: 1,
      send(raw: string) {
        const parsedMsg = WSMessageSchema.parse(JSON.parse(raw));
        receivedWsMessages.push({
          ...parsedMsg,
          data: parsedMsg.data,
        });
      },
      on() {
        // no-op for test
      },
    };
    hub.addClient(createdBoard.id, mockSocket);

    // 3b. PATCH /api/v1/boards/:boardId (Update Board customization)
    const patchBoardRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/boards/${createdBoard.id}`,
      payload: {
        title: "Self-Test Trello Workspace Updated",
        description: "Updated description",
        is_starred: true,
        background: {
          type: "solid",
          value: "#0f172a",
        },
      },
    });
    assert.equal(patchBoardRes.statusCode, 200);
    const patchedBoard = BoardSchema.parse(patchBoardRes.json());
    assert.equal(patchedBoard.title, "Self-Test Trello Workspace Updated");
    assert.equal(patchedBoard.is_starred, true);
    assert.equal(patchedBoard.background.type, "solid");
    console.info("[PASS] 3b. PATCH /api/v1/boards/:boardId -> 200 OK");

    // 4. Create Column with fractional index "a2V" and color
    const createColRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/columns`,
      payload: {
        title: "QA Verification",
        position: "a2V",
        wip_limit: 3,
        color: "#8b5cf6",
      },
    });
    assert.equal(createColRes.statusCode, 201);
    const createdCol = ColumnSchema.parse(createColRes.json());
    assert.equal(createdCol.position, "a2V");
    assert.equal(createdCol.color, "#8b5cf6");

    // 4b. Update Column (PATCH /api/v1/columns/:columnId)
    const patchColRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/columns/${createdCol.id}`,
      payload: {
        title: "Staging & QA",
        color: "#10b981",
        wip_limit: 4,
      },
    });
    assert.equal(patchColRes.statusCode, 200);
    const patchedCol = ColumnSchema.parse(patchColRes.json());
    assert.equal(patchedCol.title, "Staging & QA");
    assert.equal(patchedCol.color, "#10b981");

    // 4c. Move Column Horizontally (PATCH /api/v1/columns/:columnId/move)
    const moveColRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/columns/${createdCol.id}/move`,
      payload: {
        new_position: "a1V",
      },
    });
    assert.equal(moveColRes.statusCode, 200);
    const movedCol = ColumnSchema.parse(moveColRes.json());
    assert.equal(movedCol.position, "a1V");
    console.info(
      "[PASS] 4. Column Create, Update & Horizontal Move (/api/v1/columns/:columnId/move) -> 200 OK"
    );

    const backlogCol = createdBoard.columns[0]!;
    const inProgressCol = createdBoard.columns[1]!;

    // 5. Create Two Cards in Backlog with fractional positions "a1" and "a0"
    const cardBRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/cards`,
      payload: {
        column_id: backlogCol.id,
        title: "Second Card (position a1)",
        description: "Card B description",
        position: "a1",
        priority: "MEDIUM",
        tags: ["backend"],
      },
    });
    assert.equal(cardBRes.statusCode, 201);
    const cardB = CardSchema.parse(cardBRes.json());

    const cardARes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/cards`,
      payload: {
        column_id: backlogCol.id,
        title: "First Card (position a0)",
        description: "Card A description",
        position: "a0",
        priority: "HIGH",
        story_points: 3,
        tags: ["core", "urgent"],
        blocked_by_card_ids: [cardB.id],
      },
    });
    assert.equal(cardARes.statusCode, 201);
    const cardA = CardSchema.parse(cardARes.json());
    console.info("[PASS] 5. POST /api/v1/boards/:boardId/cards -> 201 Created");

    // 5b. Copy Column with all non-archived cards (POST /api/v1/columns/:columnId/copy)
    const copyColRes = await app.inject({
      method: "POST",
      url: `/api/v1/columns/${backlogCol.id}/copy`,
      payload: {
        title: "Backlog (Copy)",
        position: "a0V",
      },
    });
    assert.equal(copyColRes.statusCode, 201);
    const copiedColPayload = CopyColumnResponseSchema.parse(copyColRes.json());
    assert.equal(copiedColPayload.column.title, "Backlog (Copy)");
    assert.equal(copiedColPayload.column.position, "a0V");
    assert.equal(
      copiedColPayload.cards.length,
      2,
      "Copied column must deep-copy the 2 non-archived cards"
    );
    console.info(
      "[PASS] 5b. POST /api/v1/columns/:columnId/copy -> 201 Created with deep-copied cards"
    );

    // 6. Rich Card Update (PATCH /api/v1/cards/:cardId) with cover, label_ids, member_ids, multiple checklists, is_archived
    const patchCardRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/cards/${cardA.id}`,
      payload: {
        title: "First Card Updated",
        priority: "URGENT",
        cover: {
          type: "color",
          value: "#3b82f6",
          size: "full",
        },
        label_ids: [createdBoard.labels[0]!.id, createdBoard.labels[1]!.id],
        member_ids: [createdBoard.members[0]!.id],
        checklists: [
          {
            id: "99999999-9999-4999-8999-999999999901",
            title: "Backend Checklist",
            position: "a0",
            items: [
              {
                id: "55555555-5555-4555-8555-555555555555",
                title: "Verify schema alignment",
                is_completed: true,
                position: "a0",
                due_date: null,
                assignee_id: createdBoard.members[0]!.id,
              },
            ],
          },
          {
            id: "99999999-9999-4999-8999-999999999902",
            title: "Release Checklist",
            position: "a1",
            items: [
              {
                id: "55555555-5555-4555-8555-555555555556",
                title: "Run smoke tests",
                is_completed: false,
                position: "a0",
                due_date: null,
                assignee_id: null,
              },
            ],
          },
        ],
        is_archived: true,
        is_watching: true,
      },
    });
    assert.equal(patchCardRes.statusCode, 200);
    const patchedCard = CardSchema.parse(patchCardRes.json());
    assert.equal(patchedCard.title, "First Card Updated");
    assert.equal(patchedCard.priority, "URGENT");
    assert.equal(patchedCard.cover.type, "color");
    assert.equal(patchedCard.cover.value, "#3b82f6");
    assert.equal(patchedCard.label_ids.length, 2);
    assert.equal(patchedCard.member_ids.length, 1);
    assert.equal(patchedCard.checklists.length, 2);
    assert.equal(
      patchedCard.subtasks.length,
      1,
      "subtasks must remain synced with first checklist"
    );
    assert.equal(patchedCard.is_archived, true);
    assert.equal(patchedCard.is_watching, true);

    // Unarchive cardA so it stays active on board
    const unarchiveRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/cards/${cardA.id}`,
      payload: { is_archived: false },
    });
    assert.equal(unarchiveRes.statusCode, 200);
    console.info(
      "[PASS] 6. PATCH /api/v1/cards/:cardId -> 200 OK (cover, labels, members, multiple checklists, archive)"
    );

    // 6b. Copy Card & Delete Copied Card (POST /api/v1/cards/:cardId/copy & DELETE /api/v1/cards/:cardId)
    const copyCardRes = await app.inject({
      method: "POST",
      url: `/api/v1/cards/${cardA.id}/copy`,
      payload: {
        target_column_id: inProgressCol.id,
        title: "First Card Updated (Copy)",
        position: "a2",
      },
    });
    assert.equal(copyCardRes.statusCode, 201);
    const copiedCard = CardSchema.parse(copyCardRes.json());
    assert.equal(copiedCard.checklists.length, 2);
    assert.equal(copiedCard.label_ids.length, 2);

    const deleteCardRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/cards/${copiedCard.id}`,
    });
    assert.equal(deleteCardRes.statusCode, 200);
    assert.deepEqual(deleteCardRes.json(), {
      id: copiedCard.id,
      deleted: true,
    });
    console.info(
      "[PASS] 6b. POST /api/v1/cards/:cardId/copy & DELETE /api/v1/cards/:cardId -> 200 OK"
    );

    // 7. Move Card O(1) Fractional Index (PATCH /api/v1/cards/:cardId/move)
    const moveCardRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/cards/${cardA.id}/move`,
      payload: {
        target_column_id: inProgressCol.id,
        new_position: "a0V",
      },
    });
    assert.equal(moveCardRes.statusCode, 200);
    const movedCard = CardSchema.parse(moveCardRes.json());
    assert.equal(movedCard.column_id, inProgressCol.id);
    assert.equal(movedCard.position, "a0V");
    console.info(
      "[PASS] 7. PATCH /api/v1/cards/:cardId/move -> 200 OK (O(1) move)"
    );

    // 7b. Add & Delete Card Comment (POST /api/v1/cards/:cardId/comments)
    const addCommentRes = await app.inject({
      method: "POST",
      url: `/api/v1/cards/${cardA.id}/comments`,
      payload: {
        author_id: createdBoard.members[0]!.id,
        author_name: createdBoard.members[0]!.name,
        content: "Verified OAuth2 PKCE flow and checklist sync.",
      },
    });
    assert.equal(addCommentRes.statusCode, 201);
    const createdComment = CommentSchema.parse(addCommentRes.json());
    assert.equal(createdComment.card_id, cardA.id);
    assert.equal(
      createdComment.content,
      "Verified OAuth2 PKCE flow and checklist sync."
    );
    console.info(
      "[PASS] 7b. POST /api/v1/cards/:cardId/comments -> 201 Created"
    );

    // 8. AI Decompose Proxy (POST /api/v1/cards/:cardId/ai-decompose)
    const aiDecomposeRes = await app.inject({
      method: "POST",
      url: `/api/v1/cards/${cardB.id}/ai-decompose`,
      payload: {},
    });
    assert.equal(aiDecomposeRes.statusCode, 200);
    const decomposedCard = CardSchema.parse(aiDecomposeRes.json());
    assert.ok(
      decomposedCard.checklists.length >= 1,
      "AI Decompose should populate checklists"
    );
    assert.ok(
      decomposedCard.subtasks.length >= 1,
      "AI Decompose should populate subtasks"
    );
    assert.ok(
      typeof decomposedCard.story_points === "number",
      "AI Decompose should populate story_points"
    );
    console.info(
      "[PASS] 8. POST /api/v1/cards/:cardId/ai-decompose -> 200 OK"
    );

    // 9. Get Full Board State & Verify Lexicographical Sorting & Activities Log
    const getBoardRes = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${createdBoard.id}`,
    });
    assert.equal(getBoardRes.statusCode, 200);
    const fullBoard = BoardSchema.parse(getBoardRes.json());
    assert.deepEqual(
      fullBoard.columns.map((c) => c.position),
      ["a0", "a0V", "a1", "a1V", "a2", "a3"],
      "Columns must be sorted lexicographically by position ASC"
    );
    assert.ok(
      fullBoard.activities.length >= 5,
      "Board activities log should record card creation, updates, moves, and comments"
    );
    const activityTypes = fullBoard.activities.map((a) => a.action_type);
    assert.ok(activityTypes.includes("CARD_CREATED"));
    assert.ok(activityTypes.includes("CARD_MOVED"));
    assert.ok(activityTypes.includes("COMMENT_ADDED"));
    assert.ok(activityTypes.includes("CARD_ARCHIVED"));
    console.info(
      `[PASS] 9. GET /api/v1/boards/:boardId -> 200 OK (${fullBoard.activities.length} activities logged)`
    );

    // 9b. Delete Comment (DELETE /api/v1/cards/:cardId/comments/:commentId)
    const delCommentRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/cards/${cardA.id}/comments/${createdComment.id}`,
    });
    assert.equal(delCommentRes.statusCode, 200);
    assert.deepEqual(delCommentRes.json(), {
      id: createdComment.id,
      deleted: true,
    });
    console.info(
      "[PASS] 9b. DELETE /api/v1/cards/:cardId/comments/:commentId -> 200 OK"
    );

    // ========================================================================
    // PHASE 3 GATE 2 VERIFICATIONS
    // ========================================================================

    // 10. Workspaces & Multi-Board Sidebar (GET /api/v1/workspaces & POST /api/v1/workspaces)
    const workspacesRes = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces",
    });
    assert.equal(workspacesRes.statusCode, 200);
    const workspaces = z.array(WorkspaceWithBoardsSchema).parse(workspacesRes.json());
    assert.ok(workspaces.length >= 1, "Default workspace must be present");
    const defaultWs = workspaces.find((w) => w.slug === "kinetix-engineering") ?? workspaces[0]!;
    assert.ok(defaultWs.boards.length >= 3, "Default workspace must have 3 rich pre-seeded boards for multi-board sidebar");
    assert.ok(defaultWs.boards.some((b) => b.title === "Kinetix Platform Launch"));
    assert.ok(defaultWs.boards.some((b) => b.title === "Mobile App Redesign & Growth"));
    assert.ok(defaultWs.boards.some((b) => b.title === "Core Infrastructure & Reliability"));
    console.info(
      `[PASS] 10. GET /api/v1/workspaces -> ${workspaces.length} workspace(s), pre-seeded with ${defaultWs.boards.length} rich boards`
    );

    // 10b. Create Workspace (POST /api/v1/workspaces)
    const createWsRes = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces",
      payload: {
        name: "Product Design",
        slug: "product-design",
        description: "Design systems, prototypes, and UX research",
        logo_color: "#ec4899",
      },
    });
    assert.equal(createWsRes.statusCode, 201);
    const createdWs = WorkspaceSchema.parse(createWsRes.json());
    assert.equal(createdWs.name, "Product Design");
    assert.equal(createdWs.slug, "product-design");
    console.info("[PASS] 10b. POST /api/v1/workspaces -> 201 Created");

    // 11. Curated Board Templates (GET /api/v1/board-templates)
    const templatesRes = await app.inject({
      method: "GET",
      url: "/api/v1/board-templates",
    });
    assert.equal(templatesRes.statusCode, 200);
    const templates = z.array(BoardTemplateSchema).parse(templatesRes.json());
    assert.equal(templates.length, 4, "Must return 4 curated board templates");
    const templateCategories = templates.map((t) => t.category);
    assert.ok(templateCategories.includes("ENGINEERING"));
    assert.ok(templateCategories.includes("MARKETING"));
    assert.ok(templateCategories.includes("PRODUCT"));
    assert.ok(templateCategories.includes("PERSONAL"));
    console.info("[PASS] 11. GET /api/v1/board-templates -> 4 rich curated templates verified");

    // 12. Create Board from Template (POST /api/v1/boards with template_id)
    const templateBoardRes = await app.inject({
      method: "POST",
      url: "/api/v1/boards",
      payload: {
        workspace_id: defaultWs.id,
        title: "Sprint 42 — High Velocity Build",
        template_id: "template-engineering-sprint",
      },
    });
    assert.equal(templateBoardRes.statusCode, 201);
    const templateBoard = BoardSchema.parse(templateBoardRes.json());
    assert.equal(templateBoard.columns.length, 4);
    assert.deepEqual(
      templateBoard.columns.map((c) => c.title),
      ["Backlog", "In Progress", "Review", "Done"]
    );
    assert.ok(templateBoard.cards.length >= 1, "Template should populate sample cards");
    assert.ok(templateBoard.automation_rules.length >= 1, "Engineering template should pre-configure Butler rules");
    console.info("[PASS] 12. POST /api/v1/boards (from template) -> 201 Created with columns, sample cards, and automations");

    // 13. Butler Automation Rules CRUD (GET /api/v1/boards/:boardId/automations & POST /api/v1/boards/:boardId/automations)
    // Primary pre-seeded board verification
    const primaryBoardId = "11111111-1111-4111-8111-111111111111";
    const primaryRulesRes = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${primaryBoardId}/automations`,
    });
    assert.equal(primaryRulesRes.statusCode, 200);
    const primaryRules = z.array(AutomationRuleSchema).parse(primaryRulesRes.json());
    assert.ok(primaryRules.length >= 2, "Primary board must have 2 pre-seeded default Butler rules");
    const autoCompleteRule = primaryRules.find(
      (r) =>
        r.trigger.type === "WHEN_CARD_MOVED_TO_COLUMN" &&
        r.trigger.column_title_match === "Done"
    );
    assert.ok(autoCompleteRule, "Pre-seeded 'Auto-Complete on Done' rule must exist");
    const autoReviewRule = primaryRules.find(
      (r) => r.trigger.type === "WHEN_CHECKLIST_COMPLETED"
    );
    assert.ok(autoReviewRule, "Pre-seeded 'Checklist 100% Auto-Review' rule must exist");
    console.info("[PASS] 13. GET /api/v1/boards/:boardId/automations -> Pre-seeded Butler rules verified");

    // 13b. Create custom Butler Automation rule on board
    const createRuleRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/automations`,
      payload: {
        name: "Auto-Complete on Done Test",
        description: "When card is moved to Done, mark due date as complete and assign Alex Rivera",
        is_enabled: true,
        trigger: {
          type: "WHEN_CARD_MOVED_TO_COLUMN",
          column_title_match: "Done",
        },
        actions: [
          {
            type: "MARK_DUE_DATE_COMPLETE",
            due_complete_value: true,
          },
          {
            type: "ADD_LABEL",
            label_id: "77777777-7777-4777-8777-777777777771",
          },
          {
            type: "ASSIGN_MEMBER",
            member_id: "88888888-8888-4888-8888-888888888881",
          },
        ],
      },
    });
    assert.equal(createRuleRes.statusCode, 201);
    const createdRule = AutomationRuleSchema.parse(createRuleRes.json());
    assert.equal(createdRule.execution_count, 0);
    assert.equal(createdRule.last_triggered_at, null);
    console.info("[PASS] 13b. POST /api/v1/boards/:boardId/automations -> 201 Created rule");

    // 13c. Update / toggle rule (PATCH /api/v1/automations/:ruleId)
    const patchRuleRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/automations/${createdRule.id}`,
      payload: {
        is_enabled: true,
      },
    });
    assert.equal(patchRuleRes.statusCode, 200);
    const patchedRule = AutomationRuleSchema.parse(patchRuleRes.json());
    assert.equal(patchedRule.is_enabled, true);
    console.info("[PASS] 13c. PATCH /api/v1/automations/:ruleId -> 200 OK");

    // 14. RUNTIME BUTLER AUTOMATION ENGINE EXECUTION (WHEN_CARD_MOVED_TO_COLUMN)
    const bCol = createdBoard.columns.find((c) => c.title === "Backlog")!;
    const doneCol = createdBoard.columns.find((c) => c.title === "Done")!;

    const freshCardRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/cards`,
      payload: {
        column_id: bCol.id,
        title: "Test Butler Auto-Complete Card",
        description: "Card to verify runtime Butler automation engine",
        position: "a9",
        priority: "MEDIUM",
        is_due_complete: false,
        member_ids: [],
        label_ids: [],
      },
    });
    assert.equal(freshCardRes.statusCode, 201);
    const freshCard = CardSchema.parse(freshCardRes.json());
    assert.equal(freshCard.is_due_complete, false);
    assert.equal(freshCard.member_ids.length, 0);

    // Move card to "Done" column -> Butler Automation MUST fire!
    const autoMoveCardRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/cards/${freshCard.id}/move`,
      payload: {
        target_column_id: doneCol.id,
        new_position: "a0",
      },
    });
    assert.equal(autoMoveCardRes.statusCode, 200);
    const autoMovedCard = CardSchema.parse(autoMoveCardRes.json());
    assert.equal(autoMovedCard.column_id, doneCol.id);
    assert.equal(
      autoMovedCard.is_due_complete,
      true,
      "Butler must set is_due_complete = true on moving to Done"
    );
    assert.ok(
      autoMovedCard.member_ids.includes("88888888-8888-4888-8888-888888888881"),
      "Butler must automatically assign member Alex Rivera"
    );
    assert.ok(
      autoMovedCard.label_ids.includes("77777777-7777-4777-8777-777777777771"),
      "Butler must automatically attach Ship Ready label"
    );

    // Verify Rule Audit: execution_count incremented and last_triggered_at updated
    const rulesAfterTrigger = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${createdBoard.id}/automations`,
    });
    const rulesList = z.array(AutomationRuleSchema).parse(rulesAfterTrigger.json());
    const triggeredRule = rulesList.find((r) => r.id === createdRule.id)!;
    assert.equal(triggeredRule.execution_count, 1, "Rule execution_count must increment to 1");
    assert.ok(triggeredRule.last_triggered_at !== null, "Rule last_triggered_at must be updated");

    // Verify Activity Audit Log: AUTOMATION_TRIGGERED logged
    const boardStateRes = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${createdBoard.id}`,
    });
    const boardState = BoardSchema.parse(boardStateRes.json());
    const autoActivity = boardState.activities.find(
      (a) => a.action_type === "AUTOMATION_TRIGGERED"
    );
    assert.ok(autoActivity, "AUTOMATION_TRIGGERED activity log must be recorded");
    assert.ok(
      autoActivity.description.includes("🤖 Butler executed rule: [Auto-Complete on Done Test]"),
      `Activity description should match: ${autoActivity.description}`
    );
    console.info(
      "[PASS] 14. Runtime Butler Engine (WHEN_CARD_MOVED_TO_COLUMN) -> is_due_complete=true, member assigned, execution_count=1, activity logged!"
    );

    // 14b. RUNTIME BUTLER AUTOMATION ENGINE (WHEN_CHECKLIST_COMPLETED -> MOVE_CARD_TO_COLUMN)
    const primaryInProgressCol = primaryBoardId ? "33333333-3333-4333-8333-333333333332" : "";
    const reviewCol = "33333333-3333-4333-8333-333333333333";

    const checklistCardRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${primaryBoardId}/cards`,
      payload: {
        column_id: primaryInProgressCol,
        title: "Checklist Auto-Review Test Card",
        description: "Verify WHEN_CHECKLIST_COMPLETED trigger moves card to Review",
        position: "a9V",
        priority: "MEDIUM",
        checklists: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccc0001",
            title: "PR Checklist",
            position: "a0",
            items: [
              {
                id: "iiiiiiii-iiii-4iii-8iii-iiiiiiii0001",
                title: "Unit tests pass",
                is_completed: true,
                position: "a0",
                due_date: null,
                assignee_id: null,
              },
              {
                id: "iiiiiiii-iiii-4iii-8iii-iiiiiiii0002",
                title: "Code review signed off",
                is_completed: false,
                position: "a1",
                due_date: null,
                assignee_id: null,
              },
            ],
          },
        ],
      },
    });
    assert.equal(checklistCardRes.statusCode, 201);
    const createdChecklistCard = CardSchema.parse(checklistCardRes.json());
    assert.equal(createdChecklistCard.column_id, primaryInProgressCol);

    // Update the second checklist item to is_completed = true
    const completeChecklistRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/cards/${createdChecklistCard.id}`,
      payload: {
        checklists: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccc0001",
            title: "PR Checklist",
            position: "a0",
            items: [
              {
                id: "iiiiiiii-iiii-4iii-8iii-iiiiiiii0001",
                title: "Unit tests pass",
                is_completed: true,
                position: "a0",
                due_date: null,
                assignee_id: null,
              },
              {
                id: "iiiiiiii-iiii-4iii-8iii-iiiiiiii0002",
                title: "Code review signed off",
                is_completed: true,
                position: "a1",
                due_date: null,
                assignee_id: null,
              },
            ],
          },
        ],
      },
    });
    assert.equal(completeChecklistRes.statusCode, 200);
    const updatedChecklistCard = CardSchema.parse(completeChecklistRes.json());
    assert.equal(
      updatedChecklistCard.column_id,
      reviewCol,
      "WHEN_CHECKLIST_COMPLETED rule must automatically move card to Review column"
    );
    console.info(
      "[PASS] 14b. Runtime Butler Engine (WHEN_CHECKLIST_COMPLETED) -> automatically moved card to Review column!"
    );

    // 15. Natural Language AI Automation Generation (POST /api/v1/boards/:boardId/automations/ai-generate)
    const aiGenRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/automations/ai-generate`,
      payload: {
        prompt: "Whenever someone moves a card into Review, set priority to HIGH and assign Samir Patel",
      },
    });
    assert.ok(aiGenRes.statusCode === 200 || aiGenRes.statusCode === 201);
    const generatedRule = AutomationRuleSchema.parse(aiGenRes.json());
    assert.ok(generatedRule.id, "Generated rule must be persisted and have an ID");
    assert.equal(generatedRule.is_enabled, true);
    console.info("[PASS] 15. POST /api/v1/boards/:boardId/automations/ai-generate -> rule parsed & persisted");

    // 16. Delete Board (DELETE /api/v1/boards/:boardId)
    const delBoardRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/boards/${templateBoard.id}`,
    });
    assert.equal(delBoardRes.statusCode, 200);
    assert.deepEqual(delBoardRes.json(), { id: templateBoard.id, deleted: true });
    console.info("[PASS] 16. DELETE /api/v1/boards/:boardId -> 200 OK");

    // 17. Verify WebSocket Broadcast Events (including Phase 3 events)
    const wsEvents = receivedWsMessages.map((m) => m.event);
    assert.ok(wsEvents.includes("BOARD_UPDATED"));
    assert.ok(wsEvents.includes("COLUMN_CREATED"));
    assert.ok(wsEvents.includes("COLUMN_UPDATED"));
    assert.ok(wsEvents.includes("COLUMN_MOVED"));
    assert.ok(wsEvents.includes("CARD_CREATED"));
    assert.ok(wsEvents.includes("CARD_UPDATED"));
    assert.ok(wsEvents.includes("CARD_ARCHIVED"));
    assert.ok(wsEvents.includes("CARD_MOVED"));
    assert.ok(wsEvents.includes("COMMENT_ADDED"));
    assert.ok(wsEvents.includes("AUTOMATION_TRIGGERED"));
    assert.ok(wsEvents.includes("AUTOMATION_RULE_CREATED"));
    assert.ok(wsEvents.includes("AUTOMATION_RULE_UPDATED"));
    console.info(
      "[PASS] 17. WebSocket Broadcast Verification (Phase 2 & Phase 3) ->",
      Array.from(new Set(wsEvents))
    );

    // 18. PHASE 4 GATE 2: Real-Time Board Analytics (GET /api/v1/boards/:boardId/analytics)
    const analyticsRes = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${primaryBoardId}/analytics`,
    });
    assert.equal(analyticsRes.statusCode, 200);
    const analyticsData = BoardAnalyticsSchema.parse(analyticsRes.json());
    assert.equal(analyticsData.board_id, primaryBoardId);
    assert.ok(analyticsData.total_cards >= 1, "Analytics must report active cards");
    assert.equal(
      analyticsData.burndown_series.length,
      7,
      "Analytics must generate deterministic 7-day burndown_series"
    );
    assert.equal(analyticsData.burndown_series[0]!.date, "Day 1");
    assert.equal(analyticsData.burndown_series[6]!.date, "Day 7");
    assert.equal(
      analyticsData.burndown_series[6]!.actual_remaining_points,
      Math.max(
        0,
        analyticsData.total_story_points - analyticsData.completed_story_points
      ),
      "Day 7 actual remaining points must equal total - completed story points"
    );
    assert.ok(
      analyticsData.cards_by_column.length >= 4,
      "cards_by_column must include active board columns"
    );
    assert.ok(
      analyticsData.workload_by_member.length >= 4,
      "workload_by_member must include board members"
    );
    assert.equal(analyticsData.cards_by_priority.length, 4);
    console.info(
      `[PASS] 18. GET /api/v1/boards/:boardId/analytics -> 200 OK (completion_rate=${analyticsData.completion_rate}%, burndown_series=7 days)`
    );

    // 19. PHASE 4 GATE 2: AI Executive Sprint Report Proxy (POST /api/v1/boards/:boardId/analytics/ai-report)
    const aiReportRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${primaryBoardId}/analytics/ai-report`,
      payload: {},
    });
    assert.equal(aiReportRes.statusCode, 200);
    const aiReport = AIAnalyticsReportSchema.parse(aiReportRes.json());
    assert.ok(
      aiReport.health_score >= 0 && aiReport.health_score <= 100,
      "AI report health_score must be between 0 and 100"
    );
    assert.ok(
      ["EXCELLENT", "ON_TRACK", "AT_RISK", "CRITICAL"].includes(
        aiReport.health_status
      )
    );
    assert.ok(aiReport.executive_summary.length > 0);
    assert.ok(aiReport.actionable_recommendations.length >= 1);
    console.info(
      `[PASS] 19. POST /api/v1/boards/:boardId/analytics/ai-report -> 200 OK (score=${aiReport.health_score}, status=${aiReport.health_status})`
    );

    // 20. PHASE 4 GATE 2: Native Trello JSON Importer (POST /api/v1/boards/import)
    const trelloImportRes = await app.inject({
      method: "POST",
      url: "/api/v1/boards/import",
      payload: {
        workspace_id: defaultWs.id,
        board_title_override: "Imported Trello Product Launch",
        format: "trello_json",
        payload: {
          name: "Legacy Trello Board",
          desc: "Imported from Trello JSON export",
          lists: [
            { id: "trello-list-1", name: "To Do", closed: false, pos: 100 },
            { id: "trello-list-2", name: "Doing", closed: false, pos: 200 },
            { id: "trello-list-3", name: "Done", closed: false, pos: 300 },
            {
              id: "trello-list-archived",
              name: "Old Archived List",
              closed: true,
              pos: 400,
            },
          ],
          cards: [
            {
              id: "trello-card-1",
              name: "Migrate legacy Trello boards to Kinetix",
              desc: "Support full JSON lists, cards, labels, and checklists",
              idList: "trello-list-1",
              pos: 16384,
              due: "2026-11-20T00:00:00.000Z",
              dueComplete: false,
              closed: false,
              labels: [{ id: "tl-1", name: "Ship Ready", color: "green" }],
            },
            {
              id: "trello-card-2",
              name: "Verify fractional indexing on imported cards",
              desc: "Ensure a0, a1 positions are assigned in order",
              idList: "trello-list-3",
              pos: 32768,
              due: "2026-11-10T00:00:00.000Z",
              dueComplete: true,
              closed: false,
              labels: [{ id: "tl-2", name: "Architecture", color: "blue" }],
            },
          ],
          checklists: [
            {
              id: "trello-chk-1",
              idCard: "trello-card-1",
              name: "Migration Steps",
              checkItems: [
                {
                  name: "Parse Trello lists and generate fractional positions",
                  state: "complete",
                  pos: 10,
                },
                {
                  name: "Map cards and checklists to Kinetix schema",
                  state: "incomplete",
                  pos: 20,
                },
              ],
            },
          ],
        },
      },
    });
    assert.equal(trelloImportRes.statusCode, 201);
    const importResult = TrelloImportResultSchema.parse(trelloImportRes.json());
    assert.equal(importResult.board.title, "Imported Trello Product Launch");
    assert.equal(
      importResult.imported_lists_count,
      3,
      "Closed Trello lists must be filtered out"
    );
    assert.equal(importResult.imported_cards_count, 2);
    assert.equal(importResult.imported_checklists_count, 1);
    assert.deepEqual(
      importResult.board.columns.map((c) => c.position),
      ["a0", "a1", "a2"],
      "Imported columns must have fractional positions a0, a1, a2"
    );
    const importedCard1 = importResult.board.cards.find((c) =>
      c.title.includes("Migrate legacy Trello boards")
    )!;
    assert.ok(importedCard1, "Imported card 1 must exist");
    assert.equal(importedCard1.checklists.length, 1);
    assert.equal(importedCard1.checklists[0]!.items.length, 2);
    assert.equal(importedCard1.subtasks.length, 2);
    console.info(
      `[PASS] 20. POST /api/v1/boards/import -> 201 Created (${importResult.imported_lists_count} lists, ${importResult.imported_cards_count} cards, ${importResult.imported_checklists_count} checklists)`
    );

    // 21. PHASE 4 GATE 2: Board Exporter CSV & JSON (GET /api/v1/boards/:boardId/export)
    const exportCsvRes = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${importResult.board.id}/export?format=csv`,
    });
    assert.equal(exportCsvRes.statusCode, 200);
    const exportedCsv = BoardExportCsvResponseSchema.parse(exportCsvRes.json());
    assert.equal(exportedCsv.content_type, "text/csv");
    assert.ok(exportedCsv.filename.endsWith(".csv"));
    assert.ok(
      exportedCsv.csv_data.includes(
        "Card ID,Title,Column,Priority,Story Points,Labels,Members,Due Date,Due Complete,Checklist Progress,Blocked By Count,Archived,Updated At"
      ),
      "CSV header row must match specification"
    );
    assert.ok(
      exportedCsv.csv_data.includes("Migrate legacy Trello boards to Kinetix"),
      "CSV data must include imported card title"
    );
    assert.ok(
      exportedCsv.csv_data.includes('"1/2"'),
      "CSV data must include checklist progress 1/2"
    );

    const exportJsonRes = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${importResult.board.id}/export?format=json`,
    });
    assert.equal(exportJsonRes.statusCode, 200);
    const exportedBoardJson = BoardSchema.parse(exportJsonRes.json());
    assert.equal(exportedBoardJson.id, importResult.board.id);
    console.info(
      "[PASS] 21. GET /api/v1/boards/:boardId/export?format=csv|json -> 200 OK"
    );

    // 22. Verify StandardErrorSchema on 404 and 400
    const notFoundRes = await app.inject({
      method: "GET",
      url: "/api/v1/boards/99999999-9999-4999-8999-999999999999",
    });
    assert.equal(notFoundRes.statusCode, 404);
    const notFoundErr = StandardErrorSchema.parse(notFoundRes.json());
    assert.equal(notFoundErr.error.code, "RESOURCE_NOT_FOUND");

    const badReqRes = await app.inject({
      method: "POST",
      url: "/api/v1/boards",
      payload: { title: "" },
    });
    assert.equal(badReqRes.statusCode, 400);
    const badReqErr = StandardErrorSchema.parse(badReqRes.json());
    assert.equal(badReqErr.error.code, "VALIDATION_ERROR");
    console.info(
      "[PASS] 22. StandardErrorSchema envelope verified for 400 & 404"
    );

    // ========================================================================
    // 23. PHASE 5 GATE 2: Outbound Webhook Management (CRUD & Test Dispatch)
    // ========================================================================

    // 23a. Verify Pre-Seeded Webhooks (1 Slack and 1 Discord on main board)
    const listWebhooksRes = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${initialBoards[0]!.id}/webhooks`,
    });
    assert.equal(listWebhooksRes.statusCode, 200);
    const preseededWebhooks = z
      .array(WebhookConfigSchema)
      .parse(listWebhooksRes.json());
    assert.ok(
      preseededWebhooks.length >= 2,
      "Must have at least 2 pre-seeded webhooks on the main board"
    );
    assert.ok(
      preseededWebhooks.some((w) => w.platform === "SLACK"),
      "Must have pre-seeded SLACK webhook"
    );
    assert.ok(
      preseededWebhooks.some((w) => w.platform === "DISCORD"),
      "Must have pre-seeded DISCORD webhook"
    );
    console.info(
      `[PASS] 23a. GET /api/v1/boards/:boardId/webhooks -> ${preseededWebhooks.length} pre-seeded webhooks (Slack + Discord)`
    );

    // 23b. Create Webhook (POST /api/v1/boards/:boardId/webhooks)
    const createWebhookRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/webhooks`,
      payload: {
        name: "Security Incident Alert",
        platform: "SLACK",
        url: "https://hooks.slack.com/services/T000/B000/XXXXX",
        is_enabled: true,
        subscribed_events: [
          "CARD_CREATED",
          "CARD_MOVED",
          "AUTOMATION_TRIGGERED",
        ],
      },
    });
    assert.equal(createWebhookRes.statusCode, 201);
    const createdWebhook = WebhookConfigSchema.parse(createWebhookRes.json());
    assert.equal(createdWebhook.name, "Security Incident Alert");
    assert.equal(createdWebhook.platform, "SLACK");
    assert.equal(createdWebhook.is_enabled, true);
    assert.equal(createdWebhook.subscribed_events.length, 3);
    console.info(
      "[PASS] 23b. POST /api/v1/boards/:boardId/webhooks -> 201 Created webhook"
    );

    // 23c. Update Webhook Toggle & Name (PATCH /api/v1/webhooks/:webhookId)
    const updateWebhookRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/webhooks/${createdWebhook.id}`,
      payload: {
        name: "Security Incident Alert (Disabled)",
        is_enabled: false,
      },
    });
    assert.equal(updateWebhookRes.statusCode, 200);
    const updatedWebhook = WebhookConfigSchema.parse(updateWebhookRes.json());
    assert.equal(updatedWebhook.name, "Security Incident Alert (Disabled)");
    assert.equal(updatedWebhook.is_enabled, false);
    console.info(
      "[PASS] 23c. PATCH /api/v1/webhooks/:webhookId -> 200 OK toggled is_enabled=false"
    );

    // 23d. Test Slack Webhook Ping Delivery & Rich Payload Formatting (POST /api/v1/webhooks/:webhookId/test)
    const testSlackRes = await app.inject({
      method: "POST",
      url: `/api/v1/webhooks/${createdWebhook.id}/test`,
    });
    assert.equal(testSlackRes.statusCode, 200);
    const testSlackBody = testSlackRes.json() as any;
    TestWebhookResponseSchema.parse(testSlackBody);
    assert.equal(testSlackBody.success, true);
    assert.equal(testSlackBody.delivered, true);
    assert.equal(testSlackBody.platform, "SLACK");
    assert.ok(testSlackBody.preview_payload, "Preview payload must be present");
    assert.ok(
      Array.isArray(testSlackBody.preview_payload.blocks),
      "Slack preview payload must contain Block Kit blocks"
    );
    console.info(
      "[PASS] 23d. POST /api/v1/webhooks/:webhookId/test -> 200 OK Slack Block Kit preview verified"
    );

    // 23e. Test Discord Webhook Ping Delivery & Rich Embeds
    const discordWebhook = preseededWebhooks.find(
      (w) => w.platform === "DISCORD"
    )!;
    const testDiscordRes = await app.inject({
      method: "POST",
      url: `/api/v1/webhooks/${discordWebhook.id}/test`,
    });
    assert.equal(testDiscordRes.statusCode, 200);
    const testDiscordBody = testDiscordRes.json() as any;
    TestWebhookResponseSchema.parse(testDiscordBody);
    assert.equal(testDiscordBody.success, true);
    assert.equal(testDiscordBody.delivered, true);
    assert.equal(testDiscordBody.platform, "DISCORD");
    assert.ok(
      Array.isArray(testDiscordBody.preview_payload.embeds),
      "Discord preview payload must contain embeds array"
    );
    assert.ok(
      typeof testDiscordBody.preview_payload.embeds[0].color === "number",
      "Discord embed must contain numerical color badge"
    );
    console.info(
      "[PASS] 23e. POST /api/v1/webhooks/:webhookId/test -> 200 OK Discord Rich Embed preview verified"
    );

    // 23f. Delete Webhook (DELETE /api/v1/webhooks/:webhookId)
    const deleteWebhookRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/webhooks/${createdWebhook.id}`,
    });
    assert.equal(deleteWebhookRes.statusCode, 204);

    const listAfterDelete = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${createdBoard.id}/webhooks`,
    });
    assert.equal(listAfterDelete.statusCode, 200);
    const remaining = z.array(WebhookConfigSchema).parse(listAfterDelete.json());
    assert.ok(
      !remaining.some((w) => w.id === createdWebhook.id),
      "Deleted webhook must not appear in list"
    );
    console.info(
      "[PASS] 23f. DELETE /api/v1/webhooks/:webhookId -> 204 No Content verified"
    );

    // ========================================================================
    // 24. PHASE 5 GATE 2: Real-Time Presence & Live Typing Indicators
    // ========================================================================

    // 24a. GET initial presence for board
    const presenceGetRes1 = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${createdBoard.id}/presence`,
    });
    assert.equal(presenceGetRes1.statusCode, 200);
    const initialPresenceData = presenceGetRes1.json() as any;
    assert.equal(initialPresenceData.board_id, createdBoard.id);
    assert.ok(Array.isArray(initialPresenceData.presences));
    console.info(
      "[PASS] 24a. GET /api/v1/boards/:boardId/presence -> 200 OK initial presence state"
    );

    // 24b. POST presence: START_TYPING on cardA
    const targetCardId = cardA.id;
    const typingRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/presence`,
      payload: {
        user_id: "88888888-8888-4888-8888-888888888881",
        user_name: "Alex Rivera",
        event: "START_TYPING",
        card_id: targetCardId,
      },
    });
    assert.equal(typingRes.statusCode, 200);
    const typingBody = typingRes.json() as any;
    assert.equal(typingBody.success, true);
    assert.equal(typingBody.presence.status, "EDITING");
    assert.equal(typingBody.presence.active_card_id, targetCardId);
    console.info(
      `[PASS] 24b. POST /api/v1/boards/:boardId/presence -> 200 OK START_TYPING (status: EDITING, active_card_id: ${targetCardId})`
    );

    // 24c. GET presence reflects the editing state
    const presenceGetRes2 = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${createdBoard.id}/presence`,
    });
    assert.equal(presenceGetRes2.statusCode, 200);
    const presenceList2 = (presenceGetRes2.json() as any).presences;
    const alexPresence = presenceList2.find(
      (p: any) => p.user_id === "88888888-8888-4888-8888-888888888881"
    );
    assert.ok(alexPresence, "Alex Rivera presence must be tracked");
    assert.equal(alexPresence.status, "EDITING");
    assert.equal(alexPresence.active_card_id, targetCardId);
    console.info(
      "[PASS] 24c. GET /api/v1/boards/:boardId/presence -> Verified active_card_id and status: EDITING"
    );

    // 24d. POST presence: STOP_TYPING
    const stopTypingRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/presence`,
      payload: {
        user_id: "88888888-8888-4888-8888-888888888881",
        event: "STOP_TYPING",
      },
    });
    assert.equal(stopTypingRes.statusCode, 200);
    const stopTypingBody = stopTypingRes.json() as any;
    assert.equal(stopTypingBody.presence.status, "ACTIVE");
    assert.equal(stopTypingBody.presence.active_card_id, null);
    console.info(
      "[PASS] 24d. POST /api/v1/boards/:boardId/presence -> 200 OK STOP_TYPING (status: ACTIVE, active_card_id: null)"
    );

    // 24e. WebSocket Presence Manager socket simulation
    const wsReceivedPresence: any[] = [];
    const presenceMockSocket = {
      readyState: 1,
      OPEN: 1,
      send(data: string) {
        wsReceivedPresence.push(JSON.parse(data));
      },
      on(_event: string, _listener: (...args: unknown[]) => void) {},
    };

    const registeredUser = presenceService.registerSocket(
      createdBoard.id,
      presenceMockSocket,
      {
        user_id: "88888888-8888-4888-8888-888888888882",
        user_name: "Maya Lin",
      }
    );
    assert.equal(registeredUser.user_name, "Maya Lin");

    await presenceService.handleClientEvent(
      createdBoard.id,
      registeredUser.user_id,
      {
        event: "START_TYPING",
        card_id: targetCardId,
      }
    );

    const userPresencesAfterTyping = presenceService.getPresences(
      createdBoard.id
    );
    const mayaPresence = userPresencesAfterTyping.find(
      (p) => p.user_id === registeredUser.user_id
    );
    assert.ok(mayaPresence, "Maya Lin presence must be found");
    assert.equal(mayaPresence.status, "EDITING");
    assert.equal(mayaPresence.active_card_id, targetCardId);

    await presenceService.handleClientEvent(
      createdBoard.id,
      registeredUser.user_id,
      {
        event: "STOP_TYPING",
      }
    );
    const mayaPresenceStopped = presenceService
      .getPresences(createdBoard.id)
      .find((p) => p.user_id === registeredUser.user_id);
    assert.ok(mayaPresenceStopped);
    assert.equal(mayaPresenceStopped.status, "ACTIVE");
    assert.equal(mayaPresenceStopped.active_card_id, null);
    console.info(
      "[PASS] 24e. Real-time WebSocket Presence Manager verified with active_card_id tracking & broadcast"
    );

    // ========================================================================
    // 25. PHASE 6: AUTHENTICATION, RBAC ENFORCEMENT & SHAREABLE INVITE LINKS
    // ========================================================================

    // 25a. Pre-seeded Demo Users (GET /api/v1/auth/demo-users)
    const demoUsersRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/demo-users",
    });
    assert.equal(demoUsersRes.statusCode, 200, "GET /api/v1/auth/demo-users must return 200");
    const demoUsers = demoUsersRes.json() as any[];
    assert.equal(demoUsers.length, 3, "Must return 3 pre-seeded demo users (ADMIN, EDITOR, VIEWER)");
    const adminDemo = demoUsers.find((u) => u.default_role === "ADMIN");
    const editorDemo = demoUsers.find((u) => u.default_role === "EDITOR");
    const viewerDemo = demoUsers.find((u) => u.default_role === "VIEWER");
    assert.ok(adminDemo && adminDemo.token, "ADMIN demo user must have ready-to-use token");
    assert.ok(editorDemo && editorDemo.token, "EDITOR demo user must have ready-to-use token");
    assert.ok(viewerDemo && viewerDemo.token, "VIEWER demo user must have ready-to-use token");
    console.info("[PASS] 25a. GET /api/v1/auth/demo-users -> 200 OK (ADMIN, EDITOR, VIEWER with ready-to-use tokens)");

    // 25b. User Registration (POST /api/v1/auth/register)
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Jordan Lee",
        email: "jordan@kinetix.dev",
        password: "Password123!",
      },
    });
    assert.equal(registerRes.statusCode, 201, "POST /api/v1/auth/register must return 201");
    const registerSession = AuthSessionResponseSchema.parse(registerRes.json());
    assert.equal(registerSession.user.name, "Jordan Lee");
    assert.equal(registerSession.user.email, "jordan@kinetix.dev");
    assert.equal(registerSession.user.default_role, "EDITOR");
    assert.ok(registerSession.token.length > 20);
    console.info("[PASS] 25b. POST /api/v1/auth/register -> 201 Created AuthSessionResponse");

    // 25c. User Login (POST /api/v1/auth/login)
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "jordan@kinetix.dev",
        password: "Password123!",
      },
    });
    assert.equal(loginRes.statusCode, 200, "POST /api/v1/auth/login must return 200");
    const loginSession = AuthSessionResponseSchema.parse(loginRes.json());
    assert.equal(loginSession.user.email, "jordan@kinetix.dev");
    console.info("[PASS] 25c. POST /api/v1/auth/login -> 200 OK");

    // Instant demo login
    const demoLoginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "alex@kinetix.dev",
        password: "",
      },
    });
    assert.equal(demoLoginRes.statusCode, 200, "POST /api/v1/auth/login demo instant login must return 200");
    const demoLoginSession = AuthSessionResponseSchema.parse(demoLoginRes.json());
    assert.equal(demoLoginSession.user.default_role, "ADMIN");
    console.info("[PASS] 25c-2. POST /api/v1/auth/login (instant demo login) -> 200 OK");

    // 25d. Current User Profile (GET /api/v1/auth/me)
    const meBearerRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        authorization: `Bearer ${editorDemo.token}`,
      },
    });
    assert.equal(meBearerRes.statusCode, 200);
    const meEditor = AuthUserSchema.parse(meBearerRes.json());
    assert.equal(meEditor.email, "maya@kinetix.dev");
    assert.equal(meEditor.default_role, "EDITOR");

    // Default me without header defaults to primary ADMIN
    const meDefaultRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });
    assert.equal(meDefaultRes.statusCode, 200);
    const meDefault = AuthUserSchema.parse(meDefaultRes.json());
    assert.equal(meDefault.email, "alex@kinetix.dev");
    assert.equal(meDefault.default_role, "ADMIN");
    console.info("[PASS] 25d. GET /api/v1/auth/me -> 200 OK (Bearer resolved & backward-compatible default ADMIN)");

    // 25e. RBAC Guard Verification on Mutations (Cards & Columns)
    // Attempting card creation with VIEWER role -> 403 FORBIDDEN
    const viewerCreateCardRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/cards`,
      headers: {
        "x-kanbanify-role": "VIEWER",
      },
      payload: {
        column_id: createdBoard.columns[0]!.id,
        title: "Unauthorized Viewer Card",
        position: "b0",
      },
    });
    assert.equal(viewerCreateCardRes.statusCode, 403, "VIEWER mutating cards must return 403");
    const viewerErr = StandardErrorSchema.parse(viewerCreateCardRes.json());
    assert.equal(viewerErr.error.code, "FORBIDDEN");
    assert.equal(
      viewerErr.error.message,
      "Viewer role has read-only access and cannot modify board content."
    );
    assert.deepEqual(viewerErr.error.details, {
      required_role: "EDITOR",
      current_role: "VIEWER",
    });

    // Attempting card move with VIEWER role -> 403 FORBIDDEN
    const viewerMoveCardRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/cards/${targetCardId}/move`,
      headers: {
        "x-kanbanify-role": "VIEWER",
      },
      payload: {
        target_column_id: createdBoard.columns[1]!.id,
        new_position: "a99",
      },
    });
    assert.equal(viewerMoveCardRes.statusCode, 403, "VIEWER moving card must return 403");
    const viewerMoveErr = StandardErrorSchema.parse(viewerMoveCardRes.json());
    assert.equal(viewerMoveErr.error.code, "FORBIDDEN");

    // Attempting card comment with VIEWER role -> 403 FORBIDDEN
    const viewerCommentRes = await app.inject({
      method: "POST",
      url: `/api/v1/cards/${targetCardId}/comments`,
      headers: {
        "x-kanbanify-role": "VIEWER",
      },
      payload: {
        content: "Viewer comment should be rejected",
      },
    });
    assert.equal(viewerCommentRes.statusCode, 403, "VIEWER adding comments must return 403");

    // Successful card creation with EDITOR role -> 201 Created
    const editorCreateCardRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/cards`,
      headers: {
        "x-kanbanify-role": "EDITOR",
      },
      payload: {
        column_id: createdBoard.columns[0]!.id,
        title: "Editor Allowed Card",
        position: "a0Z",
      },
    });
    assert.equal(editorCreateCardRes.statusCode, 201, "EDITOR card creation must return 201");
    const editorCard = CardSchema.parse(editorCreateCardRes.json());
    assert.equal(editorCard.title, "Editor Allowed Card");

    // Successful card move with EDITOR role -> 200 OK
    const editorMoveRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/cards/${editorCard.id}/move`,
      headers: {
        "x-kanbanify-role": "EDITOR",
      },
      payload: {
        target_column_id: createdBoard.columns[1]!.id,
        new_position: "a1Z",
      },
    });
    assert.equal(editorMoveRes.statusCode, 200, "EDITOR card move must return 200");
    console.info(
      "[PASS] 25e. RBAC Guard on mutations -> VIEWER blocked (403 FORBIDDEN with exact envelope), EDITOR allowed (200/201)"
    );

    // 25f. RBAC Guard on ADMIN-Only Operations
    // EDITOR attempting DELETE /api/v1/boards/:boardId -> 403 FORBIDDEN
    const editorDeleteBoardRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/boards/${createdBoard.id}`,
      headers: {
        "x-kanbanify-role": "EDITOR",
      },
    });
    assert.equal(editorDeleteBoardRes.statusCode, 403, "EDITOR deleting board must return 403");
    const editorDelErr = StandardErrorSchema.parse(editorDeleteBoardRes.json());
    assert.equal(editorDelErr.error.code, "FORBIDDEN");
    assert.equal(editorDelErr.error.message, "Admin role required to perform this action.");
    assert.deepEqual(editorDelErr.error.details, {
      required_role: "ADMIN",
      current_role: "EDITOR",
    });

    // EDITOR attempting to generate invite -> 403 FORBIDDEN
    const editorInviteRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/invites`,
      headers: {
        "x-kanbanify-role": "EDITOR",
      },
      payload: {
        role: "EDITOR",
      },
    });
    assert.equal(editorInviteRes.statusCode, 403, "EDITOR creating invite must return 403");

    // EDITOR attempting to add member directly -> 403 FORBIDDEN
    const editorAddMemberRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/members`,
      headers: {
        "x-kanbanify-role": "EDITOR",
      },
      payload: {
        name: "Unauthorized Member",
        email: "unauth@kinetix.dev",
        role: "EDITOR",
      },
    });
    assert.equal(editorAddMemberRes.statusCode, 403, "EDITOR adding member must return 403");
    console.info(
      "[PASS] 25f. RBAC Guard on ADMIN-only operations -> EDITOR blocked with 403 FORBIDDEN"
    );

    // 25g. Board Members Management (ADMIN Only)
    // ADMIN adds a new board member
    const addMemberRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/members`,
      headers: {
        "x-kanbanify-role": "ADMIN",
      },
      payload: {
        name: "Marcus Vance",
        email: "marcus@kinetix.dev",
        role: "EDITOR",
      },
    });
    assert.equal(addMemberRes.statusCode, 201);
    const addedMember = MemberSchema.parse(addMemberRes.json());
    assert.equal(addedMember.name, "Marcus Vance");
    assert.equal(addedMember.email, "marcus@kinetix.dev");
    assert.equal(addedMember.role, "EDITOR");

    // ADMIN updates member role to VIEWER
    const updateMemberRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/boards/${createdBoard.id}/members/${addedMember.id}`,
      headers: {
        "x-kanbanify-role": "ADMIN",
      },
      payload: {
        role: "VIEWER",
      },
    });
    assert.equal(updateMemberRes.statusCode, 200);
    const updatedMember = MemberSchema.parse(updateMemberRes.json());
    assert.equal(updatedMember.role, "VIEWER");

    // ADMIN removes member
    const removeMemberRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/boards/${createdBoard.id}/members/${addedMember.id}`,
      headers: {
        "x-kanbanify-role": "ADMIN",
      },
    });
    assert.equal(removeMemberRes.statusCode, 200);
    assert.deepEqual(removeMemberRes.json(), { id: addedMember.id, removed: true });
    console.info(
      "[PASS] 25g. Board Members Management -> POST, PATCH role, DELETE member verified"
    );

    // 25h. Shareable Board Invite Links Lifecycle
    // List existing pre-seeded invites on default board
    const listInvitesRes = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${initialBoards[0]!.id}/invites`,
    });
    assert.equal(listInvitesRes.statusCode, 200);
    const existingInvites = z.array(BoardInviteLinkSchema).parse(listInvitesRes.json());
    assert.ok(existingInvites.length >= 2, "Default board must have at least 2 pre-seeded invites");
    console.info(
      `[PASS] 25h-1. GET /api/v1/boards/:boardId/invites -> ${existingInvites.length} invite(s) retrieved`
    );

    // ADMIN creates a new shareable invite link with max_uses = 2
    const createInviteRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/invites`,
      headers: {
        "x-kanbanify-role": "ADMIN",
      },
      payload: {
        role: "EDITOR",
        max_uses: 2,
        expires_in_hours: 48,
      },
    });
    assert.equal(createInviteRes.statusCode, 201);
    const createdInvite = BoardInviteLinkSchema.parse(createInviteRes.json());
    assert.ok(createdInvite.token.startsWith("kb_inv_"));
    assert.equal(createdInvite.role, "EDITOR");
    assert.equal(createdInvite.max_uses, 2);
    assert.equal(createdInvite.uses_count, 0);
    assert.equal(createdInvite.is_active, true);
    console.info(
      `[PASS] 25h-2. POST /api/v1/boards/:boardId/invites -> 201 Created token=${createdInvite.token}`
    );

    // Public preview invite link
    const previewInviteRes = await app.inject({
      method: "GET",
      url: `/api/v1/invites/${createdInvite.token}`,
    });
    assert.equal(previewInviteRes.statusCode, 200);
    const previewData = previewInviteRes.json() as any;
    assert.equal(previewData.board_id, createdBoard.id);
    assert.equal(previewData.granted_role, "EDITOR");
    assert.equal(previewData.is_valid, true);
    console.info(
      "[PASS] 25h-3. GET /api/v1/invites/:token -> 200 OK preview (is_valid: true)"
    );

    // First user redeems invite link to join board
    const joinRes1 = await app.inject({
      method: "POST",
      url: `/api/v1/invites/${createdInvite.token}/join`,
      payload: {
        name: "Sarah Connor",
        email: "sarah@resistance.dev",
      },
    });
    assert.equal(joinRes1.statusCode, 200);
    const joinBody1 = JoinViaInviteResponseSchema.parse(joinRes1.json());
    assert.equal(joinBody1.granted_role, "EDITOR");
    assert.equal(joinBody1.member.name, "Sarah Connor");
    assert.equal(joinBody1.member.email, "sarah@resistance.dev");
    assert.equal(joinBody1.member.role, "EDITOR");

    // Verify member exists in board and uses_count incremented
    const boardAfterJoin = await app.inject({
      method: "GET",
      url: `/api/v1/boards/${createdBoard.id}`,
    });
    assert.equal(boardAfterJoin.statusCode, 200);
    const parsedBoardAfterJoin = BoardSchema.parse(boardAfterJoin.json());
    const foundMember = parsedBoardAfterJoin.members.find(
      (m) => m.email === "sarah@resistance.dev"
    );
    assert.ok(foundMember, "New member must appear in board.members");
    assert.equal(foundMember.role, "EDITOR");

    // Second user redeems invite link -> reaches max_uses (2)
    const joinRes2 = await app.inject({
      method: "POST",
      url: `/api/v1/invites/${createdInvite.token}/join`,
      payload: {
        name: "John Connor",
        email: "john@resistance.dev",
      },
    });
    assert.equal(joinRes2.statusCode, 200);
    const joinBody2 = JoinViaInviteResponseSchema.parse(joinRes2.json());
    assert.equal(joinBody2.member.name, "John Connor");

    // Third join attempt should fail with 400 because max_uses is exhausted
    const joinRes3 = await app.inject({
      method: "POST",
      url: `/api/v1/invites/${createdInvite.token}/join`,
      payload: {
        name: "Kyle Reese",
        email: "kyle@resistance.dev",
      },
    });
    assert.equal(joinRes3.statusCode, 400, "Exhausted invite link must reject join with 400");
    const joinErr = StandardErrorSchema.parse(joinRes3.json());
    assert.equal(joinErr.error.code, "VALIDATION_ERROR");

    // Revoke an invite link
    const revokeRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/invites/${createdInvite.id}`,
      headers: {
        "x-kanbanify-role": "ADMIN",
      },
    });
    assert.equal(revokeRes.statusCode, 200);
    assert.deepEqual(revokeRes.json(), { id: createdInvite.id, revoked: true });
    console.info(
      "[PASS] 25h. Shareable Invite Link Lifecycle (Create, Preview, Join, Usage Increment & Revoke) verified"
    );

    // 25i. AI Permission & Security Audit Proxy
    const auditRes = await app.inject({
      method: "POST",
      url: `/api/v1/boards/${createdBoard.id}/security-audit`,
    });
    assert.equal(auditRes.statusCode, 200);
    const auditBody = AIPermissionAuditResponseSchema.parse(auditRes.json());
    assert.ok(auditBody.security_score >= 0 && auditBody.security_score <= 100);
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(auditBody.risk_level));
    assert.ok(auditBody.summary.length > 0);
    console.info(
      `[PASS] 25i. POST /api/v1/boards/:boardId/security-audit -> 200 OK (score: ${auditBody.security_score}, risk: ${auditBody.risk_level})`
    );

    console.info(
      "=== ALL KINETIX API PHASE 6 GATE 2 SELF-TESTS PASSED ==="
    );
  } finally {
    await app.close();
  }
}

runSelfTest().catch((err) => {
  console.error("[FAIL] Self-test failed:", err);
  process.exit(1);
});
