import { buildApp } from "./app.js";

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
