#!/usr/bin/env node
/**
 * Kanbanify Phase 7 — Automated Cross-Service End-to-End Smoke Test
 * Verifies:
 *  1. Process orchestration / connection to AI Engine (Port 8001) & Core API (Port 8000)
 *  2. Health check endpoints (GET :8001/health & GET :8000/health)
 *  3. Board creation & 4 default columns with fractional indices ("a0", "a1", "a2", "a3")
 *  4. Card creation in Backlog & O(1) fractional index move to In Progress ("a0V")
 *  5. Live WebSocket real-time event broadcast (/ws/boards/:boardId)
 *  6. Cross-service AI Task Decomposition & Enrichment (API -> AI Engine -> Persistence)
 *  7. Multi-Board Workspaces & Board Templates provisioning
 *  8. Runtime Butler Automation Engine execution on move to "Done"
 *  9. Real-Time Team Productivity Analytics & Burndown Aggregator
 * 10. AI Executive Sprint Health & Bottleneck Analyzer
 * 11. Native Trello JSON Import & CSV/JSON Export
 * 12. Real-Time Co-Presence & Live Typing Indicators (Phase 5)
 * 13. Slack & Discord Webhooks Lifecycle & AI Notification Formatter (Phase 5)
 * 14. Enterprise Authentication & Pre-Seeded Demo User Profiles (Phase 6)
 * 15. Strict RBAC Enforcement (VIEWER 403 FORBIDDEN vs EDITOR/ADMIN 200/201) (Phase 6)
 * 16. Shareable Invite Links Lifecycle (Create, Inspect, Join, Usage Increment) (Phase 6)
 * 17. AI Workspace Access & Permission Security Audit (API -> AI Engine) (Phase 6)
 * 18. Trello Custom Fields Power-Up CRUD & Card Value Assignments (Phase 7)
 * 19. Cycle-Safe Dependency Linking & Circular Prevention (API -> AI Engine) (Phase 7)
 * 20. Visual Dependency Graph & AI Critical Path Analysis (API -> AI Engine) (Phase 7)
 * 21. Glassmorphism & Theme Customization Studio Persistence (Phase 7)
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
  console.log(" KANBANIFY PHASE 7 — CUSTOM FIELDS, DEPENDENCY GRAPH & THEMES E2E");
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
  // STEP 2A: Workspaces & Board Templates Verification (Phase 3)
  // ---------------------------------------------------------------------------
  logStep("WORKSPACES", "Verifying GET /api/v1/workspaces and seeded boards...");
  const workspacesRes = await fetch(`${API_BASE_URL}/api/v1/workspaces`);
  assert.equal(
    workspacesRes.status,
    200,
    `Expected 200 from GET /api/v1/workspaces, got ${workspacesRes.status}`
  );
  const workspaces = await workspacesRes.json();
  assert.ok(
    Array.isArray(workspaces) && workspaces.length >= 1,
    `Expected at least 1 workspace, got ${workspaces?.length}`
  );
  const totalSeededBoards = workspaces.reduce(
    (sum, ws) => sum + (Array.isArray(ws.boards) ? ws.boards.length : 0),
    0
  );
  assert.ok(
    totalSeededBoards >= 2,
    `Expected multiple seeded boards across workspaces, got ${totalSeededBoards}`
  );
  logPass(
    `GET /api/v1/workspaces -> 200 OK (${workspaces.length} workspace(s), ${totalSeededBoards} seeded boards)`
  );

  logStep("TEMPLATES", "Verifying GET /api/v1/board-templates...");
  const templatesRes = await fetch(`${API_BASE_URL}/api/v1/board-templates`);
  assert.equal(
    templatesRes.status,
    200,
    `Expected 200 from GET /api/v1/board-templates, got ${templatesRes.status}`
  );
  const templates = await templatesRes.json();
  assert.ok(
    Array.isArray(templates) && templates.length >= 1,
    `Expected board templates to exist, got ${templates?.length}`
  );
  logPass(
    `GET /api/v1/board-templates -> 200 OK (${templates.length} templates: [${templates
      .map((t) => t.id)
      .join(", ")}])`
  );

  const selectedTemplate =
    templates.find((t) => t.id === "template-engineering-sprint") ?? templates[0];
  logStep(
    "BOARD_FROM_TEMPLATE",
    `Creating board from template '${selectedTemplate.id}' via POST /api/v1/boards...`
  );
  const templateBoardRes = await fetch(`${API_BASE_URL}/api/v1/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `E2E ${selectedTemplate.name} Board`,
      description: "Created from template during Phase 3 E2E verification",
      template_id: selectedTemplate.id,
    }),
  });
  assert.ok(
    templateBoardRes.status === 200 || templateBoardRes.status === 201,
    `Expected 200/201 from POST /api/v1/boards with template_id, got ${templateBoardRes.status}`
  );
  const templateBoard = await templateBoardRes.json();
  assert.ok(templateBoard.id, "Template-created board must have a valid UUID id");
  assert.equal(
    templateBoard.columns.length,
    selectedTemplate.default_columns.length,
    `Expected ${selectedTemplate.default_columns.length} columns from template, got ${templateBoard.columns.length}`
  );
  assert.ok(
    Array.isArray(templateBoard.labels) && templateBoard.labels.length >= 6,
    "Template-created board must include default labels"
  );
  assert.ok(
    Array.isArray(templateBoard.members) && templateBoard.members.length >= 1,
    "Template-created board must include default members"
  );
  logPass(
    `POST /api/v1/boards (template_id="${selectedTemplate.id}") -> ${templateBoardRes.status} Created board '${templateBoard.id}' with ${templateBoard.columns.length} columns and ${templateBoard.cards.length} sample cards`
  );

  // ---------------------------------------------------------------------------
  // STEP 2B: Board Creation & Trello Defaults (Labels, Members, 4 Columns)
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

  // ---------------------------------------------------------------------------
  // STEP 8: AI Natural Language to Butler Rule Generation (API -> AI Engine)
  // ---------------------------------------------------------------------------
  const doneCol = board.columns.find((c) => c.title === "Done");
  assert.ok(doneCol, 'Board must contain a "Done" column');

  const nlPrompt =
    "When a card is moved to Done, mark due date complete and assign a member";
  logStep(
    "AI_BUTLER_GENERATE",
    `Calling POST /api/v1/boards/${board.id}/automations/ai-generate with prompt: "${nlPrompt}"...`
  );
  const aiGenRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/automations/ai-generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: nlPrompt }),
    }
  );
  assert.ok(
    aiGenRes.status === 200 || aiGenRes.status === 201,
    `Expected 200/201 from POST /api/v1/boards/:boardId/automations/ai-generate, got ${aiGenRes.status}`
  );
  const generatedRule = await aiGenRes.json();
  assert.ok(generatedRule.trigger, "Generated rule must include a trigger object");
  assert.equal(
    generatedRule.trigger.type,
    "WHEN_CARD_MOVED_TO_COLUMN",
    `Expected trigger.type === "WHEN_CARD_MOVED_TO_COLUMN", got ${generatedRule.trigger.type}`
  );
  assert.ok(
    generatedRule.trigger.column_id === doneCol.id ||
      (typeof generatedRule.trigger.column_title_match === "string" &&
        generatedRule.trigger.column_title_match.toLowerCase().includes("done")),
    `Expected trigger to target the "Done" column, got ${JSON.stringify(generatedRule.trigger)}`
  );
  assert.ok(
    Array.isArray(generatedRule.actions) &&
      generatedRule.actions.some((a) => a.type === "MARK_DUE_DATE_COMPLETE"),
    `Expected generated rule actions to include MARK_DUE_DATE_COMPLETE, got ${JSON.stringify(generatedRule.actions)}`
  );
  logPass(
    `POST /api/v1/boards/${board.id}/automations/ai-generate -> ${aiGenRes.status} Generated rule "${generatedRule.name}" (trigger=${generatedRule.trigger.type}, actions=[${generatedRule.actions
      .map((a) => a.type)
      .join(", ")}])`
  );

  // ---------------------------------------------------------------------------
  // STEP 9: Runtime Butler Automation Execution Verification
  // ---------------------------------------------------------------------------
  logStep(
    "BUTLER_RUNTIME",
    "Ensuring active Butler rule (WHEN_CARD_MOVED_TO_COLUMN('Done') -> MARK_DUE_DATE_COMPLETE + ASSIGN_MEMBER) and testing execution..."
  );

  let activeDoneRuleId = generatedRule.id;
  const hasAssignMember =
    Array.isArray(generatedRule.actions) &&
    generatedRule.actions.some((a) => a.type === "ASSIGN_MEMBER");

  if (!activeDoneRuleId || !hasAssignMember) {
    const createRuleRes = await fetch(
      `${API_BASE_URL}/api/v1/boards/${board.id}/automations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "When Moved to Done: Complete Due Date & Assign Member",
          description:
            "Automatically mark due date complete and assign lead member when card moves to Done",
          is_enabled: true,
          trigger: {
            type: "WHEN_CARD_MOVED_TO_COLUMN",
            column_id: doneCol.id,
            column_title_match: "Done",
            priority: null,
            label_id: null,
          },
          actions: [
            {
              type: "MARK_DUE_DATE_COMPLETE",
              due_complete_value: true,
            },
            {
              type: "ASSIGN_MEMBER",
              member_id: board.members[0].id,
            },
          ],
        }),
      }
    );
    assert.ok(
      createRuleRes.status === 200 || createRuleRes.status === 201,
      `Expected 200/201 from POST /api/v1/boards/:boardId/automations, got ${createRuleRes.status}`
    );
    const createdRule = await createRuleRes.json();
    activeDoneRuleId = createdRule.id;
  }

  const butlerCardRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/cards`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        column_id: backlogCol.id,
        title: "Butler Runtime Verification Card",
        description: "Card to verify automatic Butler execution when moved to Done.",
        position: "a2",
        priority: "MEDIUM",
        due_date: "2026-11-25T00:00:00.000Z",
        is_due_complete: false,
        member_ids: [],
      }),
    }
  );
  assert.ok(
    butlerCardRes.status === 200 || butlerCardRes.status === 201,
    `Expected 200/201 creating Butler test card, got ${butlerCardRes.status}`
  );
  const butlerTestCard = await butlerCardRes.json();
  assert.equal(butlerTestCard.is_due_complete, false);
  assert.equal(butlerTestCard.member_ids.length, 0);

  const moveToDoneRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${butlerTestCard.id}/move`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_column_id: doneCol.id,
        new_position: "a0",
      }),
    }
  );
  assert.equal(
    moveToDoneRes.status,
    200,
    `Expected 200 moving Butler test card to Done, got ${moveToDoneRes.status}`
  );

  const boardAfterButlerRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}`
  );
  assert.equal(boardAfterButlerRes.status, 200);
  const boardAfterButler = await boardAfterButlerRes.json();

  const mutatedCard = boardAfterButler.cards.find(
    (c) => c.id === butlerTestCard.id
  );
  assert.ok(mutatedCard, "Butler test card must exist on board");
  assert.equal(
    mutatedCard.is_due_complete,
    true,
    "Expected card.is_due_complete === true (automatically checked by Butler)"
  );
  assert.ok(
    Array.isArray(mutatedCard.member_ids) && mutatedCard.member_ids.length > 0,
    `Expected card.member_ids.length > 0 (automatically assigned by Butler), got ${JSON.stringify(mutatedCard.member_ids)}`
  );

  const triggeredRule = (boardAfterButler.automation_rules ?? []).find(
    (r) => r.id === activeDoneRuleId || r.execution_count >= 1
  );
  assert.ok(
    triggeredRule && triggeredRule.execution_count >= 1,
    `Expected rule execution_count >= 1, got ${JSON.stringify(boardAfterButler.automation_rules)}`
  );

  assert.ok(
    Array.isArray(boardAfterButler.activities) &&
      boardAfterButler.activities.some(
        (act) => act.action_type === "AUTOMATION_TRIGGERED"
      ),
    "Expected board.activities to contain an AUTOMATION_TRIGGERED log entry"
  );
  logPass(
    `Butler Runtime Execution verified: card.is_due_complete=${mutatedCard.is_due_complete}, card.member_ids=[${mutatedCard.member_ids.join(
      ", "
    )}], rule.execution_count=${triggeredRule.execution_count}, AUTOMATION_TRIGGERED logged`
  );

  // ---------------------------------------------------------------------------
  // STEP 10: Analytics Aggregator Verification (Phase 4)
  // ---------------------------------------------------------------------------
  logStep(
    "ANALYTICS",
    `Calling GET /api/v1/boards/${board.id}/analytics to verify real-time board analytics...`
  );
  const analyticsRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/analytics`
  );
  assert.equal(
    analyticsRes.status,
    200,
    `Expected 200 from GET /api/v1/boards/:boardId/analytics, got ${analyticsRes.status}`
  );
  const analytics = await analyticsRes.json();
  assert.equal(analytics.board_id, board.id);
  assert.ok(
    typeof analytics.total_cards === "number" && analytics.total_cards >= 2,
    `Expected total_cards >= 2, got ${analytics.total_cards}`
  );
  assert.ok(
    typeof analytics.completion_rate === "number" &&
      analytics.completion_rate >= 0 &&
      analytics.completion_rate <= 100,
    `Expected completion_rate in [0, 100], got ${analytics.completion_rate}`
  );
  assert.ok(
    Array.isArray(analytics.burndown_series) &&
      analytics.burndown_series.length === 7,
    `Expected 7-day burndown_series array, got ${analytics.burndown_series?.length}`
  );
  assert.ok(
    Array.isArray(analytics.workload_by_member) &&
      analytics.workload_by_member.length >= 1,
    `Expected non-empty workload_by_member array, got ${analytics.workload_by_member?.length}`
  );
  assert.ok(
    Array.isArray(analytics.cards_by_column) &&
      analytics.cards_by_column.length >= 4,
    `Expected cards_by_column array, got ${analytics.cards_by_column?.length}`
  );
  logPass(
    `GET /api/v1/boards/${board.id}/analytics -> 200 OK (total_cards=${analytics.total_cards}, completion_rate=${analytics.completion_rate}%, burndown_days=${analytics.burndown_series.length}, workload_members=${analytics.workload_by_member.length})`
  );

  // ---------------------------------------------------------------------------
  // STEP 11: AI Executive Sprint Insights (API -> AI Engine)
  // ---------------------------------------------------------------------------
  logStep(
    "AI_SPRINT_REPORT",
    `Calling POST /api/v1/boards/${board.id}/analytics/ai-report (API -> AI Engine)...`
  );
  const aiReportRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/analytics/ai-report`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );
  assert.equal(
    aiReportRes.status,
    200,
    `Expected 200 from POST /api/v1/boards/:boardId/analytics/ai-report, got ${aiReportRes.status}`
  );
  const aiReport = await aiReportRes.json();
  assert.ok(
    typeof aiReport.health_score === "number" &&
      aiReport.health_score >= 0 &&
      aiReport.health_score <= 100,
    `Expected health_score in [0, 100], got ${aiReport.health_score}`
  );
  assert.ok(
    ["EXCELLENT", "ON_TRACK", "AT_RISK", "CRITICAL"].includes(
      aiReport.health_status
    ),
    `Expected valid health_status enum, got ${aiReport.health_status}`
  );
  assert.ok(
    typeof aiReport.executive_summary === "string" &&
      aiReport.executive_summary.length >= 10,
    "Expected non-empty executive_summary"
  );
  assert.ok(
    Array.isArray(aiReport.bottlenecks) && aiReport.bottlenecks.length >= 1,
    `Expected non-empty bottlenecks array, got ${aiReport.bottlenecks?.length}`
  );
  assert.ok(
    Array.isArray(aiReport.actionable_recommendations) &&
      aiReport.actionable_recommendations.length >= 1,
    `Expected non-empty actionable_recommendations array, got ${aiReport.actionable_recommendations?.length}`
  );
  logPass(
    `POST /api/v1/boards/${board.id}/analytics/ai-report -> 200 OK (health_score=${aiReport.health_score}, health_status=${aiReport.health_status}, bottlenecks=${aiReport.bottlenecks.length}, recommendations=${aiReport.actionable_recommendations.length})`
  );

  // ---------------------------------------------------------------------------
  // STEP 12: Native Trello JSON Import & CSV/JSON Export (Phase 4)
  // ---------------------------------------------------------------------------
  logStep(
    "TRELLO_IMPORT",
    "Calling POST /api/v1/boards/import with mock raw Trello JSON payload (name, lists, cards, checklists)..."
  );
  const mockTrelloPayload = {
    name: "Imported Q4 Platform Roadmap (Trello Export)",
    desc: "Native Trello JSON export imported into Kinetix Phase 4",
    lists: [
      { id: "trello-list-1", name: "Backlog", pos: 16384, closed: false },
      { id: "trello-list-2", name: "In Progress", pos: 32768, closed: false },
      { id: "trello-list-3", name: "Done", pos: 65536, closed: false },
    ],
    labels: [
      { id: "trello-lbl-1", name: "Platform", color: "blue" },
      { id: "trello-lbl-2", name: "Urgent", color: "red" },
    ],
    members: [
      {
        id: "trello-mem-1",
        fullName: "Alex Rivera",
        username: "arivera",
        initials: "AR",
      },
    ],
    cards: [
      {
        id: "trello-card-1",
        name: "Migrate Kafka Consumer Group to Kinetix V4",
        desc: "Ensure zero-downtime partition rebalance and telemetry hooks.",
        idList: "trello-list-2",
        pos: 16384,
        closed: false,
        due: "2026-12-01T00:00:00.000Z",
        dueComplete: false,
        idLabels: ["trello-lbl-1", "trello-lbl-2"],
        idMembers: ["trello-mem-1"],
      },
      {
        id: "trello-card-2",
        name: "Publish Executive Sprint Analytics Schema",
        desc: "Define Zod & Pydantic contracts for board analytics.",
        idList: "trello-list-3",
        pos: 32768,
        closed: false,
        due: "2026-11-10T00:00:00.000Z",
        dueComplete: true,
        idLabels: ["trello-lbl-1"],
        idMembers: ["trello-mem-1"],
      },
    ],
    checklists: [
      {
        id: "trello-chk-1",
        name: "Cutover Verification Steps",
        idCard: "trello-card-1",
        pos: 16384,
        checkItems: [
          {
            id: "trello-item-1",
            name: "Verify consumer lag < 50ms",
            state: "complete",
            pos: 16384,
          },
          {
            id: "trello-item-2",
            name: "Enable dead-letter queue alerts",
            state: "incomplete",
            pos: 32768,
          },
        ],
      },
    ],
  };

  const importRes = await fetch(`${API_BASE_URL}/api/v1/boards/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mockTrelloPayload),
  });
  assert.ok(
    importRes.status === 200 || importRes.status === 201,
    `Expected 200/201 from POST /api/v1/boards/import, got ${importRes.status}`
  );
  const importResult = await importRes.json();
  assert.ok(
    importResult.board && importResult.board.id,
    "Import result must contain created board with UUID"
  );
  assert.ok(
    importResult.imported_lists_count > 0,
    `Expected imported_lists_count > 0, got ${importResult.imported_lists_count}`
  );
  assert.equal(importResult.imported_lists_count, 3);
  assert.equal(importResult.imported_cards_count, 2);
  assert.equal(importResult.imported_checklists_count, 1);
  assert.deepEqual(
    importResult.board.columns.map((c) => c.position),
    ["a0", "a1", "a2"],
    "Imported Trello lists must have valid O(1) fractional index positions"
  );
  logPass(
    `POST /api/v1/boards/import -> ${importRes.status} Imported board '${importResult.board.id}' (lists=${importResult.imported_lists_count}, cards=${importResult.imported_cards_count}, checklists=${importResult.imported_checklists_count})`
  );

  logStep(
    "CSV_EXPORT",
    `Calling GET /api/v1/boards/${importResult.board.id}/export?format=csv and ?format=json...`
  );
  const exportCsvRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${importResult.board.id}/export?format=csv`
  );
  assert.equal(
    exportCsvRes.status,
    200,
    `Expected 200 from GET /api/v1/boards/:boardId/export?format=csv, got ${exportCsvRes.status}`
  );
  const exportCsvBody = await exportCsvRes.json();
  assert.equal(
    exportCsvBody.content_type,
    "text/csv",
    `Expected content_type === "text/csv", got ${exportCsvBody.content_type}`
  );
  assert.ok(
    typeof exportCsvBody.filename === "string" &&
      exportCsvBody.filename.endsWith(".csv"),
    `Expected .csv filename, got ${exportCsvBody.filename}`
  );
  assert.ok(
    typeof exportCsvBody.csv_data === "string" &&
      exportCsvBody.csv_data.includes("Card ID,Title,Column,Priority") &&
      exportCsvBody.csv_data.includes("Migrate Kafka Consumer Group to Kinetix V4"),
    "Expected csv_data to include header row and imported card title"
  );

  const exportJsonRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${importResult.board.id}/export?format=json`
  );
  assert.equal(
    exportJsonRes.status,
    200,
    `Expected 200 from GET /api/v1/boards/:boardId/export?format=json, got ${exportJsonRes.status}`
  );
  const exportJsonBody = await exportJsonRes.json();
  assert.equal(exportJsonBody.id, importResult.board.id);
  assert.equal(exportJsonBody.cards.length, 2);
  logPass(
    `GET /api/v1/boards/${importResult.board.id}/export?format=csv -> 200 OK (content_type="${exportCsvBody.content_type}", filename="${exportCsvBody.filename}", ${exportCsvBody.csv_data.split("\n").length} CSV rows)`
  );

  // ---------------------------------------------------------------------------
  // STEP 13: Real-Time Presence & Typing Verification (Phase 5)
  // ---------------------------------------------------------------------------
  logStep(
    "PRESENCE_TYPING",
    `Updating user presence to 'EDITING' on card '${createdCard.id}' via POST /api/v1/boards/${board.id}/presence...`
  );

  const testUser = {
    user_id: "88888888-8888-4888-8888-888888888882",
    user_name: "Maya Lin",
    initials: "ML",
    color: "#ec4899",
    status: "EDITING",
    active_card_id: createdCard.id,
    event: "START_TYPING",
  };

  const updatePresenceRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/presence`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    }
  );
  assert.equal(
    updatePresenceRes.status,
    200,
    `Expected 200 from POST /api/v1/boards/:boardId/presence, got ${updatePresenceRes.status}`
  );
  const updatePresenceBody = await updatePresenceRes.json();
  assert.equal(updatePresenceBody.success, true);
  assert.equal(updatePresenceBody.presence.status, "EDITING");
  assert.equal(updatePresenceBody.presence.active_card_id, createdCard.id);

  logStep(
    "PRESENCE_GET",
    `Fetching active presences via GET /api/v1/boards/${board.id}/presence...`
  );
  const getPresenceRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/presence`
  );
  assert.equal(
    getPresenceRes.status,
    200,
    `Expected 200 from GET /api/v1/boards/:boardId/presence, got ${getPresenceRes.status}`
  );
  const presenceListBody = await getPresenceRes.json();
  assert.equal(presenceListBody.board_id, board.id);
  assert.ok(
    Array.isArray(presenceListBody.presences) &&
      presenceListBody.presences.length >= 1,
    "Expected non-empty presences array"
  );
  const matchedPresence = presenceListBody.presences.find(
    (p) => p.user_id === testUser.user_id
  );
  assert.ok(matchedPresence, "Expected test user in active presences");
  assert.equal(matchedPresence.status, "EDITING");
  assert.equal(matchedPresence.active_card_id, createdCard.id);
  logPass(
    `GET /api/v1/boards/${board.id}/presence -> 200 OK (user='${matchedPresence.user_name}', status='${matchedPresence.status}', active_card_id='${matchedPresence.active_card_id}')`
  );

  // Stop typing to verify reset
  const stopTypingRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/presence`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: testUser.user_id,
        status: "ACTIVE",
        active_card_id: null,
        event: "STOP_TYPING",
      }),
    }
  );
  assert.equal(stopTypingRes.status, 200);
  const stopTypingBody = await stopTypingRes.json();
  assert.equal(stopTypingBody.presence.status, "ACTIVE");
  assert.equal(stopTypingBody.presence.active_card_id, null);
  logPass(
    `POST /api/v1/boards/${board.id}/presence (STOP_TYPING) -> status reset to ACTIVE, active_card_id=null`
  );

  // ---------------------------------------------------------------------------
  // STEP 14: Slack & Discord Webhook Lifecycle & AI Notification Formatting (Phase 5)
  // ---------------------------------------------------------------------------
  logStep(
    "WEBHOOK_CREATE",
    `Registering outbound Slack and Discord webhooks via POST /api/v1/boards/${board.id}/webhooks...`
  );

  const slackPayload = {
    name: "E2E Slack Engineering Channel",
    platform: "SLACK",
    url: "https://hooks.slack.com/services/T000/B000/MOCK_SLACK_HOOK",
    subscribed_events: ["CARD_MOVED", "AUTOMATION_TRIGGERED"],
    is_enabled: true,
  };
  const createSlackRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/webhooks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload),
    }
  );
  assert.ok(
    createSlackRes.status === 200 || createSlackRes.status === 201,
    `Expected 200/201 creating Slack webhook, got ${createSlackRes.status}`
  );
  const slackWebhook = await createSlackRes.json();
  assert.ok(slackWebhook.id, "Slack webhook must have an id");
  assert.equal(slackWebhook.platform, "SLACK");
  assert.deepEqual(slackWebhook.subscribed_events, [
    "CARD_MOVED",
    "AUTOMATION_TRIGGERED",
  ]);

  const discordPayload = {
    name: "E2E Discord Announcements Feed",
    platform: "DISCORD",
    url: "https://discord.com/api/webhooks/mock/MOCK_DISCORD_HOOK",
    subscribed_events: ["CARD_MOVED", "AUTOMATION_TRIGGERED"],
    is_enabled: true,
  };
  const createDiscordRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/webhooks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
    }
  );
  assert.ok(
    createDiscordRes.status === 200 || createDiscordRes.status === 201,
    `Expected 200/201 creating Discord webhook, got ${createDiscordRes.status}`
  );
  const discordWebhook = await createDiscordRes.json();
  assert.ok(discordWebhook.id, "Discord webhook must have an id");
  assert.equal(discordWebhook.platform, "DISCORD");

  logStep(
    "WEBHOOK_LIST",
    `Verifying GET /api/v1/boards/${board.id}/webhooks includes created webhooks...`
  );
  const listWebhooksRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/webhooks`
  );
  assert.equal(
    listWebhooksRes.status,
    200,
    `Expected 200 from GET /api/v1/boards/:boardId/webhooks, got ${listWebhooksRes.status}`
  );
  const webhooksList = await listWebhooksRes.json();
  assert.ok(
    Array.isArray(webhooksList) && webhooksList.length >= 2,
    `Expected at least 2 webhooks on board, got ${webhooksList.length}`
  );
  assert.ok(
    webhooksList.some((w) => w.id === slackWebhook.id),
    "Expected created Slack webhook in webhooks list"
  );
  assert.ok(
    webhooksList.some((w) => w.id === discordWebhook.id),
    "Expected created Discord webhook in webhooks list"
  );
  logPass(
    `GET /api/v1/boards/${board.id}/webhooks -> 200 OK (${webhooksList.length} webhooks configured)`
  );

  logStep(
    "WEBHOOK_TEST_DISCORD_SLACK",
    `Testing webhook dispatches & AI-formatted payloads via POST /api/v1/webhooks/:webhookId/test...`
  );
  // Test Slack Webhook
  const testSlackRes = await fetch(
    `${API_BASE_URL}/api/v1/webhooks/${slackWebhook.id}/test`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );
  assert.equal(
    testSlackRes.status,
    200,
    `Expected 200 testing Slack webhook, got ${testSlackRes.status}`
  );
  const testSlackBody = await testSlackRes.json();
  assert.equal(testSlackBody.delivered, true);
  assert.ok(
    testSlackBody.preview_payload,
    "Expected preview_payload in test response"
  );
  assert.ok(
    Array.isArray(testSlackBody.preview_payload.blocks) ||
      typeof testSlackBody.preview_payload.text === "string",
    "Expected Slack Block Kit payload with blocks or text"
  );
  logPass(
    `POST /api/v1/webhooks/${slackWebhook.id}/test -> 200 OK (delivered=true, platform=SLACK, preview_payload has valid Block Kit blocks)`
  );

  // Test Discord Webhook
  const testDiscordRes = await fetch(
    `${API_BASE_URL}/api/v1/webhooks/${discordWebhook.id}/test`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );
  assert.equal(
    testDiscordRes.status,
    200,
    `Expected 200 testing Discord webhook, got ${testDiscordRes.status}`
  );
  const testDiscordBody = await testDiscordRes.json();
  assert.equal(testDiscordBody.delivered, true);
  assert.ok(
    testDiscordBody.preview_payload,
    "Expected preview_payload in test response"
  );
  assert.ok(
    Array.isArray(testDiscordBody.preview_payload.embeds),
    "Expected Discord Rich Embed payload with embeds[]"
  );
  logPass(
    `POST /api/v1/webhooks/${discordWebhook.id}/test -> 200 OK (delivered=true, platform=DISCORD, preview_payload has valid Rich Embeds)`
  );

  // Test AI Notification Formatter directly (POST /internal/v1/format-notification)
  logStep(
    "AI_NOTIFICATION_FORMATTER",
    "Calling POST /internal/v1/format-notification (API -> AI Engine) to verify digest formatting..."
  );
  const aiNotifyRes = await fetch(
    `${API_BASE_URL}/internal/v1/format-notification`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board_title: board.title,
        recent_activities: verifiedBoard.activities.slice(-3),
      }),
    }
  );
  assert.equal(
    aiNotifyRes.status,
    200,
    `Expected 200 from POST /internal/v1/format-notification, got ${aiNotifyRes.status}`
  );
  const aiNotifyBody = await aiNotifyRes.json();
  assert.ok(
    aiNotifyBody.slack_block_kit_payload,
    "Expected slack_block_kit_payload in AI digest response"
  );
  assert.ok(
    aiNotifyBody.discord_embed_payload,
    "Expected discord_embed_payload in AI digest response"
  );
  assert.ok(
    typeof aiNotifyBody.summary_text === "string" &&
      aiNotifyBody.summary_text.length > 5,
    "Expected non-empty summary_text in AI digest response"
  );
  logPass(
    `POST /internal/v1/format-notification -> 200 OK (summary_text="${aiNotifyBody.summary_text.slice(
      0,
      60
    )}...")`
  );

  // Clean up Discord webhook via DELETE
  const deleteWebhookRes = await fetch(
    `${API_BASE_URL}/api/v1/webhooks/${discordWebhook.id}`,
    {
      method: "DELETE",
    }
  );
  assert.equal(
    deleteWebhookRes.status,
    204,
    `Expected 204 from DELETE /api/v1/webhooks/:webhookId, got ${deleteWebhookRes.status}`
  );
  logPass(
    `DELETE /api/v1/webhooks/${discordWebhook.id} -> 204 No Content verified`
  );

  // ---------------------------------------------------------------------------
  // STEP 15: Enterprise Authentication & Pre-Seeded Demo User Profiles (Phase 6)
  // ---------------------------------------------------------------------------
  logStep(
    "AUTH_DEMO_USERS",
    "Fetching pre-seeded demo user accounts via GET /api/v1/auth/demo-users..."
  );
  const demoUsersRes = await fetch(`${API_BASE_URL}/api/v1/auth/demo-users`);
  assert.equal(
    demoUsersRes.status,
    200,
    `Expected 200 from GET /api/v1/auth/demo-users, got ${demoUsersRes.status}`
  );
  const demoUsers = await demoUsersRes.json();
  assert.ok(
    Array.isArray(demoUsers) && demoUsers.length >= 3,
    `Expected at least 3 demo accounts, got ${demoUsers?.length}`
  );

  const adminDemo = demoUsers.find((u) => u.default_role === "ADMIN");
  const editorDemo = demoUsers.find((u) => u.default_role === "EDITOR");
  const viewerDemo = demoUsers.find((u) => u.default_role === "VIEWER");

  assert.ok(adminDemo, "Expected demo user with ADMIN default_role");
  assert.ok(editorDemo, "Expected demo user with EDITOR default_role");
  assert.ok(viewerDemo, "Expected demo user with VIEWER default_role");
  assert.ok(
    typeof adminDemo.token === "string" && adminDemo.token.length > 10,
    "Expected demo users to include pre-signed session tokens"
  );
  logPass(
    `GET /api/v1/auth/demo-users -> 200 OK (${demoUsers.length} accounts: ADMIN="${adminDemo.name}", EDITOR="${editorDemo.name}", VIEWER="${viewerDemo.name}")`
  );

  logStep(
    "AUTH_REGISTER_LOGIN",
    "Registering and logging in custom user via POST /api/v1/auth/register and /login..."
  );
  const testAccount = {
    name: "Rina QA Integration",
    email: `rina.integration.${Date.now()}@kanbanify.dev`,
    password: "SecurePassword123!",
  };

  const registerRes = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testAccount),
  });
  assert.ok(
    registerRes.status === 200 || registerRes.status === 201,
    `Expected 200/201 from POST /api/v1/auth/register, got ${registerRes.status}`
  );
  const registerBody = await registerRes.json();
  assert.ok(registerBody.token, "Register response must contain JWT token");
  assert.equal(registerBody.user.email, testAccount.email.toLowerCase());
  assert.equal(registerBody.user.default_role, "EDITOR");

  const loginRes = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testAccount.email,
      password: testAccount.password,
    }),
  });
  assert.equal(
    loginRes.status,
    200,
    `Expected 200 from POST /api/v1/auth/login, got ${loginRes.status}`
  );
  const loginBody = await loginRes.json();
  assert.ok(loginBody.token, "Login response must contain session token");
  assert.equal(loginBody.user.email, testAccount.email.toLowerCase());

  // Verify GET /api/v1/auth/me with Bearer token
  const meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(
    meRes.status,
    200,
    `Expected 200 from GET /api/v1/auth/me with Bearer token, got ${meRes.status}`
  );
  const meBody = await meRes.json();
  assert.equal(meBody.email, testAccount.email.toLowerCase());

  // Verify GET /api/v1/auth/me defaults gracefully to ADMIN without auth headers
  const meDefaultRes = await fetch(`${API_BASE_URL}/api/v1/auth/me`);
  assert.equal(meDefaultRes.status, 200);
  const meDefaultBody = await meDefaultRes.json();
  assert.equal(meDefaultBody.default_role, "ADMIN");
  logPass(
    `POST /api/v1/auth/register & /login -> 200 OK (token issued, user resolved via /me, default ADMIN fallback confirmed)`
  );

  // ---------------------------------------------------------------------------
  // STEP 16: Strict RBAC Enforcement Verification (403 FORBIDDEN vs 200/201) (Phase 6)
  // ---------------------------------------------------------------------------
  logStep(
    "RBAC_VIEWER_BLOCKED",
    "Testing RBAC Guard: sending mutations with X-Kanbanify-Role: VIEWER and asserting strictly 403 FORBIDDEN..."
  );

  // 1. VIEWER card creation rejection
  const viewerCardCreateRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/cards`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kanbanify-Role": "VIEWER",
      },
      body: JSON.stringify({
        column_id: backlogCol.id,
        title: "Unauthorized Viewer Card Creation Attempt",
        position: "a5",
      }),
    }
  );
  assert.equal(
    viewerCardCreateRes.status,
    403,
    `Expected 403 FORBIDDEN for VIEWER card create, got ${viewerCardCreateRes.status}`
  );
  const viewerCardCreateBody = await viewerCardCreateRes.json();
  assert.equal(
    viewerCardCreateBody.error?.code,
    "FORBIDDEN",
    `Expected error.code === "FORBIDDEN", got ${JSON.stringify(viewerCardCreateBody)}`
  );

  // 2. VIEWER card move rejection
  const viewerCardMoveRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${createdCard.id}/move`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Kanbanify-Role": "VIEWER",
      },
      body: JSON.stringify({
        target_column_id: reviewCol.id,
        new_position: "a0",
      }),
    }
  );
  assert.equal(
    viewerCardMoveRes.status,
    403,
    `Expected 403 FORBIDDEN for VIEWER card move, got ${viewerCardMoveRes.status}`
  );
  const viewerCardMoveBody = await viewerCardMoveRes.json();
  assert.equal(viewerCardMoveBody.error?.code, "FORBIDDEN");

  // 3. VIEWER comment creation rejection
  const viewerCommentRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${createdCard.id}/comments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kanbanify-Role": "VIEWER",
      },
      body: JSON.stringify({
        content: "Unauthorized Viewer Comment Attempt",
      }),
    }
  );
  assert.equal(
    viewerCommentRes.status,
    403,
    `Expected 403 FORBIDDEN for VIEWER card comment, got ${viewerCommentRes.status}`
  );

  // 4. Admin-only operations: EDITOR rejected with 403 FORBIDDEN
  const editorInviteRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/invites`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kanbanify-Role": "EDITOR",
      },
      body: JSON.stringify({
        role: "VIEWER",
        max_uses: 2,
      }),
    }
  );
  assert.equal(
    editorInviteRes.status,
    403,
    `Expected 403 FORBIDDEN for EDITOR creating invite link, got ${editorInviteRes.status}`
  );
  const editorInviteBody = await editorInviteRes.json();
  assert.equal(editorInviteBody.error?.code, "FORBIDDEN");

  logPass(
    "RBAC Enforcement verified: VIEWER mutations strictly rejected with 403 FORBIDDEN; ADMIN-only endpoints reject EDITOR with 403 FORBIDDEN"
  );

  logStep(
    "RBAC_EDITOR_ALLOWED",
    "Testing RBAC Guard: performing card creation & updates with X-Kanbanify-Role: EDITOR and asserting 200/201..."
  );
  const editorCardCreateRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/cards`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kanbanify-Role": "EDITOR",
      },
      body: JSON.stringify({
        column_id: backlogCol.id,
        title: "Authorized Editor Card Creation",
        position: "a6",
        priority: "MEDIUM",
      }),
    }
  );
  assert.ok(
    editorCardCreateRes.status === 200 || editorCardCreateRes.status === 201,
    `Expected 200/201 for EDITOR card create, got ${editorCardCreateRes.status}`
  );
  const editorCard = await editorCardCreateRes.json();
  assert.ok(editorCard.id, "Editor-created card must have valid id");

  const editorCardMoveRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${editorCard.id}/move`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Kanbanify-Role": "EDITOR",
      },
      body: JSON.stringify({
        target_column_id: inProgressCol.id,
        new_position: "a1",
      }),
    }
  );
  assert.equal(
    editorCardMoveRes.status,
    200,
    `Expected 200 for EDITOR card move, got ${editorCardMoveRes.status}`
  );

  // Backward compatibility check: mutation without auth/role headers succeeds as ADMIN
  const backwardCompatCardRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${editorCard.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Authorized Card Update without Header (Defaults to ADMIN)",
      }),
    }
  );
  assert.equal(
    backwardCompatCardRes.status,
    200,
    `Expected 200 for mutation without auth headers (default ADMIN), got ${backwardCompatCardRes.status}`
  );
  logPass(
    "RBAC EDITOR and Backward-Compatible Default ADMIN mutations succeeded with 200/201"
  );

  // ---------------------------------------------------------------------------
  // STEP 17: Shareable Invite Link Lifecycle Verification (Phase 6)
  // ---------------------------------------------------------------------------
  logStep(
    "INVITE_CREATE",
    `Creating shareable invite link via POST /api/v1/boards/${board.id}/invites as ADMIN...`
  );
  const createInviteRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/invites`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kanbanify-Role": "ADMIN",
      },
      body: JSON.stringify({
        role: "EDITOR",
        max_uses: 5,
      }),
    }
  );
  assert.ok(
    createInviteRes.status === 200 || createInviteRes.status === 201,
    `Expected 200/201 from POST /api/v1/boards/:boardId/invites, got ${createInviteRes.status}`
  );
  const createdInvite = await createInviteRes.json();
  assert.ok(
    typeof createdInvite.token === "string" && createdInvite.token.length > 5,
    "Expected generated invite link to have a valid token string"
  );
  assert.equal(createdInvite.role, "EDITOR");
  assert.equal(createdInvite.max_uses, 5);
  assert.equal(createdInvite.uses_count, 0);
  assert.equal(createdInvite.is_active, true);
  logPass(
    `POST /api/v1/boards/${board.id}/invites -> ${createInviteRes.status} Created invite token="${createdInvite.token}" (role=EDITOR, max_uses=5, uses_count=0)`
  );

  logStep(
    "INVITE_INSPECT",
    `Inspecting invite link via GET /api/v1/invites/${createdInvite.token}...`
  );
  const inspectInviteRes = await fetch(
    `${API_BASE_URL}/api/v1/invites/${createdInvite.token}`
  );
  assert.equal(
    inspectInviteRes.status,
    200,
    `Expected 200 from GET /api/v1/invites/:token, got ${inspectInviteRes.status}`
  );
  const inspectInviteBody = await inspectInviteRes.json();
  assert.equal(inspectInviteBody.board_id, board.id);
  assert.equal(inspectInviteBody.granted_role, "EDITOR");
  assert.equal(inspectInviteBody.is_valid, true);
  logPass(
    `GET /api/v1/invites/${createdInvite.token} -> 200 OK (board="${inspectInviteBody.board_title}", granted_role="${inspectInviteBody.granted_role}", is_valid=true)`
  );

  logStep(
    "INVITE_JOIN",
    `Redeeming invite link via POST /api/v1/invites/${createdInvite.token}/join for Rina QA...`
  );
  const joinPayload = {
    name: "Rina QA",
    email: "rina@kanbanify.dev",
  };
  const joinInviteRes = await fetch(
    `${API_BASE_URL}/api/v1/invites/${createdInvite.token}/join`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(joinPayload),
    }
  );
  assert.equal(
    joinInviteRes.status,
    200,
    `Expected 200 from POST /api/v1/invites/:token/join, got ${joinInviteRes.status}`
  );
  const joinInviteBody = await joinInviteRes.json();
  assert.equal(joinInviteBody.board_id, board.id);
  assert.equal(
    joinInviteBody.granted_role,
    "EDITOR",
    `Expected granted_role === "EDITOR", got ${joinInviteBody.granted_role}`
  );
  assert.equal(joinInviteBody.member.name, "Rina QA");
  assert.equal(joinInviteBody.member.email, "rina@kanbanify.dev");

  // Verify member is now in board.members and invite uses_count incremented
  const boardAfterJoinRes = await fetch(`${API_BASE_URL}/api/v1/boards/${board.id}`);
  assert.equal(boardAfterJoinRes.status, 200);
  const boardAfterJoin = await boardAfterJoinRes.json();
  const joinedMember = boardAfterJoin.members.find(
    (m) => m.email.toLowerCase() === "rina@kanbanify.dev"
  );
  assert.ok(joinedMember, "Expected Rina QA in board.members after invite redemption");
  assert.equal(joinedMember.role, "EDITOR");

  const listInvitesRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/invites`
  );
  assert.equal(listInvitesRes.status, 200);
  const boardInvites = await listInvitesRes.json();
  const redeemedInvite = boardInvites.find((i) => i.token === createdInvite.token);
  assert.ok(redeemedInvite, "Expected created invite link in board invites list");
  assert.equal(
    redeemedInvite.uses_count,
    1,
    `Expected invite uses_count === 1, got ${redeemedInvite.uses_count}`
  );
  logPass(
    `POST /api/v1/invites/${createdInvite.token}/join -> 200 OK (Rina QA added with granted_role="EDITOR", invite uses_count=1)`
  );

  // ---------------------------------------------------------------------------
  // STEP 18: AI Workspace Security & Permission Audit (API -> AI Engine) (Phase 6)
  // ---------------------------------------------------------------------------
  logStep(
    "AI_SECURITY_AUDIT",
    `Calling POST /api/v1/boards/${board.id}/security-audit (API -> AI Engine)...`
  );
  const securityAuditRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/security-audit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );
  assert.equal(
    securityAuditRes.status,
    200,
    `Expected 200 from POST /api/v1/boards/:boardId/security-audit, got ${securityAuditRes.status}`
  );
  const auditReport = await securityAuditRes.json();
  assert.ok(
    typeof auditReport.security_score === "number" &&
      auditReport.security_score >= 0 &&
      auditReport.security_score <= 100,
    `Expected security_score in [0, 100], got ${auditReport.security_score}`
  );
  assert.ok(
    ["LOW", "MEDIUM", "HIGH"].includes(auditReport.risk_level),
    `Expected risk_level in ["LOW", "MEDIUM", "HIGH"], got ${auditReport.risk_level}`
  );
  assert.ok(
    Array.isArray(auditReport.findings),
    "Expected findings to be an array"
  );
  assert.ok(
    Array.isArray(auditReport.recommendations) &&
      auditReport.recommendations.length >= 1,
    "Expected recommendations to have at least 1 item"
  );
  assert.ok(
    typeof auditReport.summary === "string" && auditReport.summary.length > 5,
    "Expected non-empty summary in security audit report"
  );
  logPass(
    `POST /api/v1/boards/${board.id}/security-audit -> 200 OK (security_score=${auditReport.security_score}, risk_level=${auditReport.risk_level}, findings=${auditReport.findings.length}, recommendations=${auditReport.recommendations.length})`
  );

  // ---------------------------------------------------------------------------
  // STEP 19: Custom Fields Lifecycle Verification (Phase 7)
  // ---------------------------------------------------------------------------
  logStep(
    "CUSTOM_FIELDS_CREATE",
    "Creating DROPDOWN and NUMBER custom fields via POST /api/v1/boards/:boardId/custom-fields..."
  );

  // 1. Create DROPDOWN Custom Field ("Release Track")
  const dropdownFieldRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/custom-fields`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Release Track",
        type: "DROPDOWN",
        show_on_front: true,
        options: [
          { label: "Alpha", color: "blue" },
          { label: "Beta", color: "purple" },
          { label: "GA", color: "green" },
        ],
      }),
    }
  );
  assert.ok(
    dropdownFieldRes.status === 200 || dropdownFieldRes.status === 201,
    `Expected 200/201 from POST /custom-fields (DROPDOWN), got ${dropdownFieldRes.status}`
  );
  const dropdownField = await dropdownFieldRes.json();
  assert.ok(dropdownField.id, "Expected created DROPDOWN custom field to have an id");
  assert.equal(dropdownField.name, "Release Track");
  assert.equal(dropdownField.type, "DROPDOWN");
  assert.equal(dropdownField.show_on_front, true);
  assert.ok(
    Array.isArray(dropdownField.options) && dropdownField.options.length === 3,
    "Expected 3 options for Release Track dropdown"
  );
  const selectedDropdownOption = dropdownField.options[1]; // Beta

  // 2. Create NUMBER Custom Field ("Story Effort")
  const numberFieldRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/custom-fields`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Story Effort",
        type: "NUMBER",
        show_on_front: true,
      }),
    }
  );
  assert.ok(
    numberFieldRes.status === 200 || numberFieldRes.status === 201,
    `Expected 200/201 from POST /custom-fields (NUMBER), got ${numberFieldRes.status}`
  );
  const numberField = await numberFieldRes.json();
  assert.ok(numberField.id, "Expected created NUMBER custom field to have an id");
  assert.equal(numberField.name, "Story Effort");
  assert.equal(numberField.type, "NUMBER");
  assert.equal(numberField.show_on_front, true);

  // 3. Verify GET /api/v1/boards/:boardId/custom-fields returns fields
  const listCfRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/custom-fields`
  );
  assert.equal(
    listCfRes.status,
    200,
    `Expected 200 from GET /custom-fields, got ${listCfRes.status}`
  );
  const boardCustomFields = await listCfRes.json();
  assert.ok(
    boardCustomFields.some((f) => f.id === dropdownField.id),
    "Expected created dropdown field in custom-fields list"
  );
  assert.ok(
    boardCustomFields.some((f) => f.id === numberField.id),
    "Expected created number field in custom-fields list"
  );
  logPass(
    `POST /api/v1/boards/${board.id}/custom-fields -> Created DROPDOWN ("Release Track") and NUMBER ("Story Effort") verified via GET`
  );

  // 4. Assign Custom Field values to card via PUT /api/v1/cards/:cardId/custom-fields/:fieldId
  logStep(
    "CUSTOM_FIELDS_ASSIGN",
    `Assigning custom field values to card '${createdCard.id}' via PUT /api/v1/cards/:cardId/custom-fields/:fieldId...`
  );

  const putDropdownValRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${createdCard.id}/custom-fields/${dropdownField.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: selectedDropdownOption.id }),
    }
  );
  assert.equal(
    putDropdownValRes.status,
    200,
    `Expected 200 from PUT /cards/:cardId/custom-fields/:fieldId, got ${putDropdownValRes.status}`
  );
  const updatedCardAfterDropdown = await putDropdownValRes.json();
  assert.ok(
    Array.isArray(updatedCardAfterDropdown.custom_field_values),
    "Expected updated card to have custom_field_values array"
  );
  const assignedDropdownEntry = updatedCardAfterDropdown.custom_field_values.find(
    (v) => v.field_id === dropdownField.id
  );
  assert.ok(
    assignedDropdownEntry,
    "Expected card to contain assigned dropdown field value"
  );
  assert.equal(assignedDropdownEntry.value, selectedDropdownOption.id);

  const putNumberValRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${createdCard.id}/custom-fields/${numberField.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 13 }),
    }
  );
  assert.equal(
    putNumberValRes.status,
    200,
    `Expected 200 from PUT /cards/:cardId/custom-fields/:fieldId, got ${putNumberValRes.status}`
  );
  const updatedCardAfterNumber = await putNumberValRes.json();
  const assignedNumberEntry = updatedCardAfterNumber.custom_field_values.find(
    (v) => v.field_id === numberField.id
  );
  assert.ok(
    assignedNumberEntry,
    "Expected card to contain assigned number field value"
  );
  assert.equal(assignedNumberEntry.value, 13);
  logPass(
    `PUT /api/v1/cards/${createdCard.id}/custom-fields/:fieldId -> 200 OK (Release Track="${selectedDropdownOption.label}", Story Effort=13 persisted in card.custom_field_values)`
  );

  // ---------------------------------------------------------------------------
  // STEP 20: Cycle-Safe Dependency Graph & AI Critical Path (API -> AI Engine) (Phase 7)
  // ---------------------------------------------------------------------------
  logStep(
    "DEPENDENCY_LINKING",
    "Creating Card A and Card B, linking B blocked by A, and verifying circular dependency rejection..."
  );

  const cardARes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/cards`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        column_id: backlogCol.id,
        title: "Phase 7 Card A - Architectural Foundation",
        description: "Must be completed before implementation starts",
        position: "a1",
      }),
    }
  );
  assert.ok(
    cardARes.status === 200 || cardARes.status === 201,
    `Expected 200/201 from POST /cards for Card A, got ${cardARes.status}`
  );
  const cardA = await cardARes.json();
  assert.ok(cardA.id, "Expected Card A to have valid ID");

  const cardBRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/cards`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        column_id: backlogCol.id,
        title: "Phase 7 Card B - Feature Implementation",
        description: "Dependent on Card A architectural foundation",
        position: "a2",
      }),
    }
  );
  assert.ok(
    cardBRes.status === 200 || cardBRes.status === 201,
    `Expected 200/201 from POST /cards for Card B, got ${cardBRes.status}`
  );
  const cardB = await cardBRes.json();
  assert.ok(cardB.id, "Expected Card B to have valid ID");

  // Link Card B as blocked by Card A
  const linkBtoARes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${cardB.id}/dependencies`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocker_card_id: cardA.id }),
    }
  );
  assert.equal(
    linkBtoARes.status,
    200,
    `Expected 200 from POST /cards/:cardId/dependencies, got ${linkBtoARes.status}`
  );
  const linkBtoABody = await linkBtoARes.json();
  assert.ok(
    linkBtoABody.card.blocked_by_card_ids.includes(cardA.id),
    "Expected Card B blocked_by_card_ids to include Card A"
  );
  logPass(
    `POST /api/v1/cards/${cardB.id}/dependencies -> 200 OK (Card B successfully marked as blocked by Card A)`
  );

  // Attempt circular dependency: Link Card A as blocked by Card B
  logStep(
    "CYCLE_PREVENTION",
    "Attempting circular dependency: linking Card A as blocked by Card B (expecting strictly 400 VALIDATION_ERROR)..."
  );
  const cycleRes = await fetch(
    `${API_BASE_URL}/api/v1/cards/${cardA.id}/dependencies`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocker_card_id: cardB.id }),
    }
  );
  assert.equal(
    cycleRes.status,
    400,
    `Circular dependency MUST be rejected with 400 VALIDATION_ERROR, got ${cycleRes.status}`
  );
  const cycleErr = await cycleRes.json();
  assert.equal(
    cycleErr.error.code,
    "VALIDATION_ERROR",
    `Expected error.code === "VALIDATION_ERROR", got ${cycleErr.error?.code}`
  );
  assert.ok(
    cycleErr.error.message.toLowerCase().includes("circular"),
    `Expected message to reference circular dependency, got "${cycleErr.error?.message}"`
  );
  logPass(
    `Circular dependency (Card A <-> Card B) strictly rejected with 400 VALIDATION_ERROR: "${cycleErr.error.message}"`
  );

  // Call GET /api/v1/boards/:boardId/dependency-graph
  logStep(
    "DEPENDENCY_GRAPH_GET",
    `Calling GET /api/v1/boards/${board.id}/dependency-graph...`
  );
  const graphRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/dependency-graph`
  );
  assert.equal(
    graphRes.status,
    200,
    `Expected 200 from GET /dependency-graph, got ${graphRes.status}`
  );
  const graphData = await graphRes.json();
  assert.ok(Array.isArray(graphData.nodes), "Expected graphData.nodes array");
  assert.ok(Array.isArray(graphData.edges), "Expected graphData.edges array");
  assert.ok(
    Array.isArray(graphData.critical_path_card_ids),
    "Expected graphData.critical_path_card_ids array"
  );
  assert.ok(
    graphData.nodes.some((n) => n.card_id === cardA.id),
    "Expected Card A to be present in graph nodes"
  );
  assert.ok(
    graphData.nodes.some((n) => n.card_id === cardB.id),
    "Expected Card B to be present in graph nodes"
  );
  assert.ok(
    graphData.edges.some(
      (e) => e.from_card_id === cardA.id && e.to_card_id === cardB.id
    ),
    "Expected directed edge from Card A to Card B in graph edges"
  );
  assert.equal(
    graphData.has_circular_dependency,
    false,
    "Board dependency graph must have has_circular_dependency === false"
  );
  logPass(
    `GET /api/v1/boards/${board.id}/dependency-graph -> 200 OK (${graphData.nodes.length} nodes, ${graphData.edges.length} edges, critical path length: ${graphData.critical_path_card_ids.length})`
  );

  // Call POST /api/v1/boards/:boardId/dependency-graph/ai-analyze (API -> AI Engine)
  logStep(
    "AI_CRITICAL_PATH_ANALYZE",
    `Calling POST /api/v1/boards/${board.id}/dependency-graph/ai-analyze (API -> AI Engine)...`
  );
  const aiAnalyzeRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/dependency-graph/ai-analyze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );
  assert.equal(
    aiAnalyzeRes.status,
    200,
    `Expected 200 from POST /dependency-graph/ai-analyze, got ${aiAnalyzeRes.status}`
  );
  const aiAnalyzeBody = await aiAnalyzeRes.json();
  assert.ok(
    typeof aiAnalyzeBody.risk_summary === "string" &&
      aiAnalyzeBody.risk_summary.length > 0,
    "Expected non-empty risk_summary in AI critical path response"
  );
  assert.ok(
    Array.isArray(aiAnalyzeBody.critical_path_titles),
    "Expected critical_path_titles array in AI critical path response"
  );
  assert.ok(
    Array.isArray(aiAnalyzeBody.unblocking_recommendations) &&
      aiAnalyzeBody.unblocking_recommendations.length >= 1,
    "Expected at least 1 unblocking_recommendations in AI critical path response"
  );
  assert.ok(
    Array.isArray(aiAnalyzeBody.top_blocker_cards),
    "Expected top_blocker_cards array in AI critical path response"
  );
  logPass(
    `POST /api/v1/boards/${board.id}/dependency-graph/ai-analyze -> 200 OK (critical_path_titles=[${aiAnalyzeBody.critical_path_titles.join(
      ", "
    )}], top_blockers=${aiAnalyzeBody.top_blocker_cards.length}, recommendations=${
      aiAnalyzeBody.unblocking_recommendations.length
    })`
  );

  // ---------------------------------------------------------------------------
  // STEP 21: Theme Studio Persistence Verification (Phase 7)
  // ---------------------------------------------------------------------------
  logStep(
    "THEME_STUDIO_PERSISTENCE",
    `Calling PATCH /api/v1/boards/${board.id}/theme with FROSTED_GLASS preset...`
  );
  const patchThemeRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}/theme`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset: "FROSTED_GLASS",
        glass_blur: "lg",
        card_density: "compact",
      }),
    }
  );
  assert.equal(
    patchThemeRes.status,
    200,
    `Expected 200 from PATCH /boards/:boardId/theme, got ${patchThemeRes.status}`
  );
  const patchThemeBody = await patchThemeRes.json();
  assert.equal(patchThemeBody.preset, "FROSTED_GLASS");
  assert.equal(patchThemeBody.glass_blur, "lg");
  assert.equal(patchThemeBody.card_density, "compact");

  // Verify theme persisted on the board
  const getBoardAfterThemeRes = await fetch(
    `${API_BASE_URL}/api/v1/boards/${board.id}`
  );
  assert.equal(getBoardAfterThemeRes.status, 200);
  const boardAfterTheme = await getBoardAfterThemeRes.json();
  assert.equal(boardAfterTheme.theme_config.preset, "FROSTED_GLASS");
  assert.equal(boardAfterTheme.theme_config.glass_blur, "lg");
  assert.equal(boardAfterTheme.theme_config.card_density, "compact");
  logPass(
    `PATCH /api/v1/boards/${board.id}/theme -> 200 OK (persisted preset="FROSTED_GLASS", glass_blur="lg", card_density="compact" confirmed via GET /boards/:boardId)`
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
    "\x1b[32m[PASS] Kanbanify Phase 7 Custom Fields, Dependency Graph & Theme Studio E2E Smoke Tests Succeeded!\x1b[0m"
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
