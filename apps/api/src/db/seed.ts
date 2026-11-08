import { StorageRepository } from "./repository.js";

async function main() {
  const repo = new StorageRepository();
  await repo.init();
  if (repo.isUsingPostgres()) {
    await repo.seedPostgresIfEmpty();
    console.info("[db:seed] PostgreSQL schema initialized and seeded.");
  } else {
    console.warn(
      "[db:seed] PostgreSQL not running; In-Memory store is pre-seeded by default."
    );
  }
  await repo.close();
}

main().catch((err) => {
  console.error("[db:seed] Failed:", err);
  process.exit(1);
});
