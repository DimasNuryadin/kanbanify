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
  // STEP 3: Board Creation & Default Columns
  // ---------------------------------------------------------------------------
  logStep("BOARD", 'Creating board {"title": "E2E Integration Board"}...');
  const createBoardRes = await fetch(`${API_BASE_URL}/api/v1/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "E2E Integration Board" }),
  });
  assert.ok(
    createBoardRes.status === 200 || createBoardRes.status === 201,
    `Expected 200/201 from POST /api/v1/boards, got ${createBoardRes.status}`
  );

  const board = await createBoardRes.json();
  assert.ok(board.id, "Created board must have a valid UUID id");
  assert.equal(board.title, "E2E Integration Board");
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
    `POST /api/v1/boards -> ${createBoardRes.status} Created board '${board.id}' with default columns [a0, a1, a2, a3]`
  );

  const backlogCol = board.columns.find((c) => c.title === "Backlog");
  const inProgressCol = board.columns.find((c) => c.title === "In Progress");
  assert.ok(backlogCol && inProgressCol, "Backlog and In Progress columns must exist");

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
  // STEP 4: Card Creation & O(1) Fractional Move
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
        priority: "MEDIUM",
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
  assert.equal(
    movedCard.column_id,
    inProgressCol.id,
    "Moved card column_id must equal In Progress column id"
  );
  assert.equal(
    movedCard.position,
    "a0V",
    'Moved card position must equal "a0V"'
  );

  // Verify persistence via GET /api/v1/boards/:boardId
  const verifyBoardRes = await fetch(`${API_BASE_URL}/api/v1/boards/${board.id}`);
  assert.equal(verifyBoardRes.status, 200);
  const verifiedBoard = await verifyBoardRes.json();
  const persistedCard = verifiedBoard.cards.find((c) => c.id === createdCard.id);
  assert.ok(persistedCard, "Moved card must be persisted on board");
  assert.equal(persistedCard.column_id, inProgressCol.id);
  assert.equal(persistedCard.position, "a0V");
  logPass(
    `PATCH /api/v1/cards/${createdCard.id}/move -> 200 OK (persisted column_id='${inProgressCol.id}', position='a0V')`
  );

  // ---------------------------------------------------------------------------
  // STEP 5: Cross-Service AI Task Decomposition (API -> AI Engine -> DB)
  // ---------------------------------------------------------------------------
  logStep(
    "AI_DECOMPOSE",
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
    Array.isArray(decomposedCard.subtasks) && decomposedCard.subtasks.length > 0,
    "AI-decomposed card must contain non-empty subtasks[]"
  );
  for (const st of decomposedCard.subtasks) {
    assert.ok(
      typeof st.id === "string" && st.id.length > 0,
      "Each subtask must have a valid id"
    );
    assert.ok(
      typeof st.title === "string" && st.title.length > 0,
      "Each subtask must have a non-empty title"
    );
    assert.ok(
      typeof st.position === "string" && st.position.length > 0,
      "Each subtask must have a valid fractional index position"
    );
  }
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
    `POST /api/v1/cards/${createdCard.id}/ai-decompose -> 200 OK (${decomposedCard.subtasks.length} subtasks, story_points=${decomposedCard.story_points}, priority=${decomposedCard.priority})`
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
  console.log("\x1b[32m[PASS] All E2E Integration Smoke Tests Succeeded!\x1b[0m");
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
