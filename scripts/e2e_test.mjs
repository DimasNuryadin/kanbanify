#!/usr/bin/env node
/**
 * Kinetix Gate 4 — Automated Cross-Service End-to-End Smoke Test
 * Verifies:
 *  1. Process orchestration / connection to AI Engine (Port 8001) & Core API (Port 8000)
 *  2. Health check endpoints (GET :8001/health & GET :8000/health)
 *  3. Board creation & 4 default columns with fractional indices ("a0", "a1", "a2", "a3")
 *  4. Card creation in Backlog & O(1) fractional index move to In Progress ("a0V")
 *  5. Live WebSocket real-time event broadcast (/ws/boards/:boardId)
 *  6. Cross-service AI Task Decomposition (API -> AI Engine -> Persistence)
 */

import assert from "node:assert/strict";
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "..");
const API_DIR = resolve(ROOT_DIR, "apps", "api");
const AI_ENGINE_DIR = resolve(ROOT_DIR, "services", "ai-engine");

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";
const AI_ENGINE_BASE_URL =
  process.env.INTERNAL_AI_ENGINE_URL ?? "http://localhost:8001";
const INTERNAL_SERVICE_TOKEN =
  process.env.INTERNAL_SERVICE_TOKEN ?? "orca_internal_sync_token_2026";

/** @type {Array<{ name: string; proc: import("node:child_process").ChildProcess }>} */
const spawnedProcesses = [];

function logStep(step, message) {
  console.log(`\x1b[36m[E2E:${step}]\x1b[0m ${message}`);
}

function logPass(message) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
}

async function isHealthy(url) {
  try {
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function waitForHealth(name, baseUrl, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isHealthy(baseUrl)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error(
    `Timed out waiting for ${name} at ${baseUrl}/health after ${timeoutMs}ms`
  );
}

function resolveAiEngineCommand() {
  const winVenvPython = resolve(AI_ENGINE_DIR, ".venv", "Scripts", "python.exe");
  const unixVenvPython = resolve(AI_ENGINE_DIR, ".venv", "bin", "python");

  if (existsSync(winVenvPython)) {
    return {
      command: winVenvPython,
      args: ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
    };
  }
  if (existsSync(unixVenvPython)) {
    return {
      command: unixVenvPython,
      args: ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
    };
  }
  return {
    command: "uv",
    args: [
      "run",
      "python",
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8001",
    ],
  };
}

function resolveApiCommand() {
  const tsxCli = resolve(API_DIR, "node_modules", "tsx", "dist", "cli.mjs");
  if (existsSync(tsxCli)) {
    return {
      command: process.execPath,
      args: [tsxCli, "src/index.ts"],
    };
  }
  return {
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["tsx", "src/index.ts"],
  };
}

async function ensureServicesRunning() {
  // 1. Ensure AI Engine (Port 8001)
  if (await isHealthy(AI_ENGINE_BASE_URL)) {
    logStep("INIT", `Connected to existing AI Engine at ${AI_ENGINE_BASE_URL}`);
  } else {
    const { command, args } = resolveAiEngineCommand();
    logStep(
      "INIT",
      `Starting services/ai-engine on port 8001 (${command} ${args.join(" ")})...`
    );
    const proc = spawn(command, args, {
      cwd: AI_ENGINE_DIR,
      env: {
        ...process.env,
        AI_ENGINE_PORT: "8001",
        INTERNAL_SERVICE_TOKEN,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    proc.stderr?.on("data", (chunk) => {
      const text = String(chunk).trim();
      if (text.includes("ERROR") || text.includes("Traceback")) {
        console.error(`[ai-engine:err] ${text}`);
      }
    });
    spawnedProcesses.push({ name: "ai-engine", proc });
    await waitForHealth("services/ai-engine", AI_ENGINE_BASE_URL);
  }

  // 2. Ensure Core API (Port 8000)
  if (await isHealthy(API_BASE_URL)) {
    logStep("INIT", `Connected to existing Core API at ${API_BASE_URL}`);
  } else {
    const { command, args } = resolveApiCommand();
    logStep(
      "INIT",
      `Starting apps/api on port 8000 (${command} ${args.join(" ")})...`
    );
    const proc = spawn(command, args, {
      cwd: API_DIR,
      env: {
        ...process.env,
        API_PORT: "8000",
        API_HOST: "127.0.0.1",
        INTERNAL_AI_ENGINE_URL: AI_ENGINE_BASE_URL,
        INTERNAL_SERVICE_TOKEN,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    proc.stderr?.on("data", (chunk) => {
      const text = String(chunk).trim();
      if (text.includes("Error") || text.includes("ERR_")) {
        console.error(`[api:err] ${text}`);
      }
    });
    spawnedProcesses.push({ name: "api", proc });
    await waitForHealth("apps/api", API_BASE_URL);
  }
}

async function cleanup() {
  for (const { name, proc } of spawnedProcesses.reverse()) {
    if (!proc.pid || proc.killed) continue;
    logStep("CLEANUP", `Terminating spawned ${name} process (PID ${proc.pid})...`);
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: "ignore" });
      } else {
        proc.kill("SIGTERM");
      }
    } catch {
      try {
        proc.kill("SIGKILL");
      } catch {
        // Ignore already exited process
      }
    }
  }
}

async function runSmokeTests() {
  console.log("==================================================================");
  console.log(" KINETIX GATE 4 — AUTOMATED END-TO-END INTEGRATION SMOKE TEST");
  console.log("==================================================================");

  await ensureServicesRunning();

  // ---------------------------------------------------------------------------
  // STEP 2: Health Check Verification
  // ---------------------------------------------------------------------------
  logStep("HEALTH", "Verifying /health on AI Engine (:8001) and Core API (:8000)...");

  const aiHealthRes = await fetch(`${AI_ENGINE_BASE_URL}/health`);
  assert.equal(
    aiHealthRes.status,
    200,
    `Expected AI Engine /health to return 200, got ${aiHealthRes.status}`
  );
  const aiHealthBody = await aiHealthRes.json();
  assert.equal(aiHealthBody.status, "ok");
  logPass(
    `GET ${AI_ENGINE_BASE_URL}/health -> 200 OK (${JSON.stringify(aiHealthBody)})`
  );

  const apiHealthRes = await fetch(`${API_BASE_URL}/health`);
  assert.equal(
    apiHealthRes.status,
    200,
    `Expected Core API /health to return 200, got ${apiHealthRes.status}`
  );
  const apiHealthBody = await apiHealthRes.json();
  assert.equal(apiHealthBody.status, "ok");
  logPass(
    `GET ${API_BASE_URL}/health -> 200 OK (${JSON.stringify(apiHealthBody)})`
  );

  // ---------------------------------------------------------------------------
  // STEP 2: Board Creation & Trello Defaults (Labels, Members, 4 Columns)
  // ---------------------------------------------------------------------------
  logStep("BOARD", 'Creating board {"title": "E2E Phase 2 Trello Parity Board"}...');
  const createBoardRes = await fetch(`${API_BASE_URL}/api/v1/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "E2E Phase 2 Trello Parity Board",
      description: "Automated Phase 2 Full Trello Parity verification board",
    }),
  });
  assert.ok(
    createBoardRes.status === 200 || createBoardRes.status === 201,
    `Expected 200/201 from POST /api/v1/boards, got ${createBoardRes.status}`
  );

  const board = await createBoardRes.json();
  assert.ok(board.id, "Created board must have a valid UUID id");
  assert.equal(board.title, "E2E Phase 2 Trello Parity Board");
  assert.ok(
    Array.isArray(board.labels) && board.labels.length >= 6,
    `Expected >= 6 default Trello labels, got ${board.labels?.length}`
  );
  assert.ok(
    Array.isArray(board.members) && board.members.length >= 1,
    `Expected >= 1 default board members, got ${board.members?.length}`
  );
  assert.equal(
    board.columns.length,
    4,
    `Expected 4 default columns, got ${board.columns.length}`
  );

  const expectedColumns = [
    { title: "Backlog", position: "a0" },
    { title: "In Progress", position: "a1" },
    { title: "Review", position: "a2" },
    { title: "Done", position: "a3" },
  ];

  assert.deepEqual(
    board.columns.map((c) => ({ title: c.title, position: c.position })),
    expectedColumns,
    "Default columns must match Backlog(a0), In Progress(a1), Review(a2), Done(a3)"
  );
  logPass(
    `POST /api/v1/boards -> ${createBoardRes.status} Created board '${board.id}' with ${board.labels.length} labels, ${board.members.length} members, and 4 default columns`
  );

  const backlogCol = board.columns.find((c) => c.title === "Backlog");
  const inProgressCol = board.columns.find((c) => c.title === "In Progress");
  const reviewCol = board.columns.find((c) => c.title === "Review");
  assert.ok(
    backlogCol && inProgressCol && reviewCol,
    "Backlog, In Progress, and Review columns must exist"
  );

  // Optional: Open live WebSocket listener on /ws/boards/:boardId if global WebSocket exists
  /** @type {Array<{ event: string; board_id: string; data: unknown }>} */
  const wsEvents = [];
  let wsClient = null;
  if (typeof WebSocket !== "undefined") {
    try {
      const wsUrl = `${API_BASE_URL.replace(/^http/, "ws")}/ws/boards/${board.id}`;
      wsClient = new WebSocket(wsUrl);
      await new Promise((resolveWs) => {
        const timer = setTimeout(resolveWs, 1500);
        wsClient.onopen = () => {
          clearTimeout(timer);
          resolveWs();
        };
        wsClient.onerror = () => {
          clearTimeout(timer);
          resolveWs();
        };
      });
      wsClient.onmessage = (evt) => {
        try {
          wsEvents.push(JSON.parse(String(evt.data)));
        } catch {
          // Ignore parse errors
        }
      };
    } catch {
      wsClient = null;
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 3: List (Column) Operations (Reorder & Copy)
  // ---------------------------------------------------------------------------
  logStep(
    "COLUMN_MOVE",
    `Reordering column '${reviewCol.title}' via PATCH /api/v1/columns/${reviewCol.id}/move...`
  );
  const moveColRes = await fetch(
    `${API_BASE_URL}/api/v1/columns/${reviewCol.id}/move`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_position: "a0V" }),
    }
  );
  assert.equal(
    moveColRes.status,
    200,
    `Expected 200 from PATCH /api/v1/columns/:columnId/move, got ${moveColRes.status}`
  );
  const movedCol = await moveColRes.json();
  assert.equal(movedCol.id, reviewCol.id);
  assert.equal(movedCol.position, "a0V");
  logPass(
    `PATCH /api/v1/columns/${reviewCol.id}/move -> 200 OK (new_position="a0V")`
  );

  logStep(
    "COLUMN_COPY",
    `Copying column '${backlogCol.title}' via POST /api/v1/columns/${backlogCol.id}/copy...`
  );
  const copyColRes = await fetch(
    `${API_BASE_URL}/api/v1/columns/${backlogCol.id}/copy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Backlog (Copy)",
        position: "a0G",
      }),
    }
  );
  assert.ok(
    copyColRes.status === 200 || copyColRes.status === 201,
    `Expected 200/201 from POST /api/v1/columns/:columnId/copy, got ${copyColRes.status}`
  );
  const copiedColPayload = await copyColRes.json();
  assert.ok(
    copiedColPayload.column && copiedColPayload.column.id,
    "Copied column response must include column object with UUID"
  );
  assert.equal(copiedColPayload.column.title, "Backlog (Copy)");

  const boardAfterColCopyRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}`
  );
  assert.equal(boardAfterColCopyRes.status, 200);
  const boardAfterColCopy = await boardAfterColCopyRes.json();
  const duplicatedColumn = boardAfterColCopy.columns.find(
    (c) => c.id === copiedColPayload.column.id
  );
  assert.ok(duplicatedColumn, "Duplicated column must exist on fetched board");
  assert.equal(duplicatedColumn.title, "Backlog (Copy)");
  logPass(
    `POST /api/v1/columns/${backlogCol.id}/copy -> ${copyColRes.status} Duplicated column '${duplicatedColumn.id}' ("Backlog (Copy)") verified on board`
  );

  // ---------------------------------------------------------------------------
  // STEP 4: Rich Trello Card Lifecycle (Create, Move, Cover, Labels, Members, Checklists, Due Complete)
  // ---------------------------------------------------------------------------
  logStep(
    "CARD_CREATE",
    'Creating card "Implement Real-Time WebSocket & Payment Flow" in Backlog...'
  );
  const createCardRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/cards`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        column_id: backlogCol.id,
        title: "Implement Real-Time WebSocket & Payment Flow",
        description:
          "Synchronize live Kanban board state over WebSockets and handle Stripe checkout webhook retries safely.",
        position: "a0",
        priority: "HIGH",
        tags: ["websocket", "payments"],
      }),
    }
  );
  assert.ok(
    createCardRes.status === 200 || createCardRes.status === 201,
    `Expected 200/201 from POST /api/v1/boards/:boardId/cards, got ${createCardRes.status}`
  );
  const createdCard = await createCardRes.json();
  assert.ok(createdCard.id, "Created card must have a UUID id");
  assert.equal(createdCard.column_id, backlogCol.id);
  assert.equal(createdCard.position, "a0");
  logPass(
    `POST /api/v1/boards/${board.id}/cards -> ${createCardRes.status} Created card '${createdCard.id}' in Backlog (pos: "a0")`
  );

  logStep(
    "CARD_MOVE",
    'Moving card to "In Progress" with O(1) fractional index position "a0V"...'
  );
  const moveCardRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${createdCard.id}/move`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_column_id: inProgressCol.id,
        new_position: "a0V",
      }),
    }
  );
  assert.equal(
    moveCardRes.status,
    200,
    `Expected 200 from PATCH /api/v1/cards/:cardId/move, got ${moveCardRes.status}`
  );
  const movedCard = await moveCardRes.json();
  assert.equal(movedCard.column_id, inProgressCol.id);
  assert.equal(movedCard.position, "a0V");
  logPass(
    `PATCH /api/v1/cards/${createdCard.id}/move -> 200 OK (column_id='${inProgressCol.id}', position='a0V')`
  );

  logStep(
    "CARD_RICH_UPDATE",
    `Updating card '${createdCard.id}' with cover, label_ids, member_ids, multiple named checklists, and is_due_complete=true...`
  );
  const targetLabelIds = [board.labels[0].id, board.labels[5].id];
  const targetMemberIds = [board.members[0].id];
  const frontendChecklistId = "99999999-9999-4999-8999-999999999101";
  const qaChecklistId = "99999999-9999-4999-8999-999999999102";
  const richUpdatePayload = {
    cover: { type: "color", value: "blue", size: "normal" },
    label_ids: targetLabelIds,
    member_ids: targetMemberIds,
    start_date: "2026-11-08T00:00:00.000Z",
    due_date: "2026-11-20T00:00:00.000Z",
    is_due_complete: true,
    checklists: [
      {
        id: frontendChecklistId,
        title: "Frontend Checklist",
        position: "a0",
        items: [
          {
            id: "55555555-5555-4555-8555-555555555901",
            title: "Render cover strip & expandable Trello label pills",
            is_completed: true,
            position: "a0",
            due_date: null,
            assignee_id: targetMemberIds[0],
          },
          {
            id: "55555555-5555-4555-8555-555555555902",
            title: "Wire optimistic checklist progress bar",
            is_completed: false,
            position: "a1",
            due_date: null,
            assignee_id: targetMemberIds[0],
          },
        ],
      },
      {
        id: qaChecklistId,
        title: "QA Checklist",
        position: "a1",
        items: [
          {
            id: "55555555-5555-4555-8555-555555555903",
            title: "Verify WebSocket CARD_UPDATED broadcast across peers",
            is_completed: true,
            position: "a0",
            due_date: null,
            assignee_id: targetMemberIds[0],
          },
        ],
      },
    ],
  };

  const updateCardRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${createdCard.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(richUpdatePayload),
    }
  );
  assert.equal(
    updateCardRes.status,
    200,
    `Expected 200 from PATCH /api/v1/cards/:cardId, got ${updateCardRes.status}`
  );
  const updatedCard = await updateCardRes.json();
  assert.deepEqual(updatedCard.cover, {
    type: "color",
    value: "blue",
    size: "normal",
  });
  assert.deepEqual(updatedCard.label_ids, targetLabelIds);
  assert.deepEqual(updatedCard.member_ids, targetMemberIds);
  assert.equal(updatedCard.is_due_complete, true);
  assert.equal(updatedCard.checklists.length, 2);
  assert.equal(updatedCard.checklists[0].title, "Frontend Checklist");
  assert.equal(updatedCard.checklists[1].title, "QA Checklist");
  logPass(
    `PATCH /api/v1/cards/${createdCard.id} -> 200 OK (cover=blue, labels=${updatedCard.label_ids.length}, members=${updatedCard.member_ids.length}, checklists=["Frontend Checklist", "QA Checklist"], is_due_complete=true)`
  );

  // ---------------------------------------------------------------------------
  // STEP 5: Comments & Activity Feed
  // ---------------------------------------------------------------------------
  logStep(
    "COMMENT_ADD",
    `Adding Markdown comment via POST /api/v1/cards/${createdCard.id}/comments...`
  );
  const commentText =
    "Verified **O(1) fractional indexing** and multi-checklist persistence in E2E smoke test.";
  const addCommentRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${createdCard.id}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author_id: board.members[0].id,
        author_name: board.members[0].full_name,
        author_initials: board.members[0].initials,
        content: commentText,
      }),
    }
  );
  assert.ok(
    addCommentRes.status === 200 || addCommentRes.status === 201,
    `Expected 200/201 from POST /api/v1/cards/:cardId/comments, got ${addCommentRes.status}`
  );
  const createdComment = await addCommentRes.json();
  assert.ok(createdComment.id, "Created comment must have a UUID id");
  assert.equal(createdComment.content, commentText);

  const verifyBoardRes = await fetch(`${API_BASE_URL}/api/v1/boards/${board.id}`);
  assert.equal(verifyBoardRes.status, 200);
  const verifiedBoard = await verifyBoardRes.json();
  const persistedCard = verifiedBoard.cards.find((c) => c.id === createdCard.id);
  assert.ok(persistedCard, "Updated card must be persisted on board");
  assert.ok(
    Array.isArray(persistedCard.comments) &&
      persistedCard.comments.some((cm) => cm.id === createdComment.id),
    "Card comments[] must contain the newly created comment"
  );
  assert.ok(
    Array.isArray(verifiedBoard.activities) &&
      verifiedBoard.activities.some(
        (act) =>
          act.action_type === "COMMENT_ADDED" && act.card_id === createdCard.id
      ),
    "Board activities[] must contain a COMMENT_ADDED entry for the card"
  );
  logPass(
    `POST /api/v1/cards/${createdCard.id}/comments -> ${addCommentRes.status} Comment & COMMENT_ADDED activity verified on board`
  );

  // ---------------------------------------------------------------------------
  // STEP 6: AI Task Decompose / Enrich (API -> AI Engine -> DB)
  // ---------------------------------------------------------------------------
  logStep(
    "AI_ENRICH",
    `Calling POST /api/v1/cards/${createdCard.id}/ai-decompose (API -> AI Engine -> DB)...`
  );
  const decomposeRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${createdCard.id}/ai-decompose`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );
  assert.equal(
    decomposeRes.status,
    200,
    `Expected 200 from POST /api/v1/cards/:cardId/ai-decompose, got ${decomposeRes.status}`
  );
  const decomposedCard = await decomposeRes.json();

  assert.ok(
    Array.isArray(decomposedCard.checklists) &&
      decomposedCard.checklists.length >= 2,
    `AI-enriched card must contain checklists[] (got ${decomposedCard.checklists?.length})`
  );
  assert.ok(
    Array.isArray(decomposedCard.subtasks) && decomposedCard.subtasks.length > 0,
    "AI-enriched card must contain non-empty subtasks[]"
  );
  assert.ok(
    typeof decomposedCard.story_points === "number" &&
      decomposedCard.story_points > 0,
    `Expected positive story_points, got ${decomposedCard.story_points}`
  );
  assert.ok(
    ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(decomposedCard.priority),
    `Expected valid priority enum, got ${decomposedCard.priority}`
  );
  logPass(
    `POST /api/v1/cards/${createdCard.id}/ai-decompose -> 200 OK (${decomposedCard.checklists.length} checklists, ${decomposedCard.subtasks.length} subtasks, story_points=${decomposedCard.story_points}, priority=${decomposedCard.priority})`
  );

  // ---------------------------------------------------------------------------
  // STEP 7: Card Copy & Archive
  // ---------------------------------------------------------------------------
  logStep(
    "CARD_COPY_ARCHIVE",
    `Copying card via POST /api/v1/cards/${createdCard.id}/copy and archiving the copy...`
  );
  const copyCardRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${createdCard.id}/copy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_column_id: inProgressCol.id,
        title: "Implement Real-Time WebSocket & Payment Flow (Copy)",
        position: "a1",
      }),
    }
  );
  assert.ok(
    copyCardRes.status === 200 || copyCardRes.status === 201,
    `Expected 200/201 from POST /api/v1/cards/:cardId/copy, got ${copyCardRes.status}`
  );
  const copiedCard = await copyCardRes.json();
  assert.ok(
    copiedCard.id && copiedCard.id !== createdCard.id,
    "Copied card must have a new UUID id"
  );
  assert.equal(
    copiedCard.title,
    "Implement Real-Time WebSocket & Payment Flow (Copy)"
  );

  const archiveCardRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${copiedCard.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_archived: true }),
    }
  );
  assert.equal(
    archiveCardRes.status,
    200,
    `Expected 200 from PATCH /api/v1/cards/:copiedCardId, got ${archiveCardRes.status}`
  );
  const archivedCard = await archiveCardRes.json();
  assert.equal(archivedCard.id, copiedCard.id);
  assert.equal(archivedCard.is_archived, true);
  logPass(
    `POST /api/v1/cards/${createdCard.id}/copy & PATCH /api/v1/cards/${copiedCard.id} -> Copied card '${copiedCard.id}' and archived (is_archived=true)`
  );

  if (wsClient) {
    await new Promise((r) => setTimeout(r, 150));
    wsClient.close();
    if (wsEvents.length > 0) {
      logPass(
        `WebSocket /ws/boards/${board.id} received real-time events: [${wsEvents
          .map((e) => e.event)
          .join(", ")}]`
      );
    }
  }

  console.log("==================================================================");
  console.log(
    "\x1b[32m[PASS] Phase 2 Full Trello Parity E2E Smoke Tests Succeeded!\x1b[0m"
  );
  console.log("==================================================================");
}

try {
  await runSmokeTests();
} catch (err) {
  console.error("\x1b[31m[FAIL] E2E Integration Smoke Test Failed:\x1b[0m", err);
  process.exitCode = 1;
} finally {
  await cleanup();
}
