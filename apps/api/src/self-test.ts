import assert from "node:assert/strict";
import { z } from "zod";
import {
  BoardSchema,
  CardSchema,
  ColumnSchema,
  CommentSchema,
  CopyColumnResponseSchema,
  HealthCheckResponseSchema,
  StandardErrorSchema,
  WSMessageSchema,
  type WSMessage,
} from "@kinetix/contracts";
import { buildApp } from "./app.js";

async function runSelfTest(): Promise<void> {
  console.info("=== Kinetix API Phase 2 (Full Trello Parity) Self-Test Suite ===");
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
        receivedWsMessages.push(WSMessageSchema.parse(JSON.parse(raw)));
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

    // 10. Verify WebSocket Broadcast Events
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
    console.info(
      "[PASS] 10. WebSocket Broadcast Verification ->",
      Array.from(new Set(wsEvents))
    );

    // 11. Verify StandardErrorSchema on 404 and 400
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
      "[PASS] 11. StandardErrorSchema envelope verified for 400 & 404"
    );

    console.info("=== ALL KINETIX API PHASE 2 SELF-TESTS PASSED ===");
  } finally {
    await app.close();
  }
}

runSelfTest().catch((err) => {
  console.error("[FAIL] Self-test failed:", err);
  process.exit(1);
});
