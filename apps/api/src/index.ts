import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "./app.js";

function loadEnvIfNeeded(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ];
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    try {
      const content = readFileSync(envPath, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx <= 0) continue;
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
        if (key && process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    } catch {
      // Ignore env read errors
    }
  }
}

loadEnvIfNeeded();

const API_PORT = Number(process.env.API_PORT ?? 8000);
const API_HOST = process.env.API_HOST ?? "0.0.0.0";

async function startServer(): Promise<void> {
  const { app } = await buildApp({ logger: true });

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}; shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    const address = await app.listen({ port: API_PORT, host: API_HOST });
    console.info(`[kinetix-api] Server listening at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

startServer();
