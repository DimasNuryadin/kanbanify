import assert from "node:assert/strict";
import { z } from "zod";
import {
  AIAnalyticsReportSchema,
  AutomationRuleSchema,
  BoardAnalyticsSchema,
  BoardExportCsvResponseSchema,
  BoardSchema,
  BoardTemplateSchema,
  CardSchema,
  ColumnSchema,
  CommentSchema,
  CopyColumnResponseSchema,
  HealthCheckResponseSchema,
  StandardErrorSchema,
  TrelloImportResultSchema,
  WorkspaceSchema,
  WorkspaceWithBoardsSchema,
  WSMessageSchema,
  type WSMessage,
} from "@kinetix/contracts";
import { buildApp } from "./app.js";

async function runSelfTest(): Promise<void> {
  console.info("=== Kinetix API Phase 3 (Multi-Board Workspace & Runtime Butler) Self-Test Suite ===");
  const { app, hub } = await buildApp({ logger: false });

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

    console.info("=== ALL KINETIX API PHASE 4 GATE 2 SELF-TESTS PASSED ===");
  } finally {
    await app.close();
  }
}

runSelfTest().catch((err) => {
  console.error("[FAIL] Self-test failed:", err);
  process.exit(1);
});
