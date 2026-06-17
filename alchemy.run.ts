import alchemy from "alchemy";
import { D1Database, R2Bucket, KVNamespace, Queue } from "alchemy/cloudflare";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));

const app = await alchemy("skald-scan-infra");

export const db = await D1Database("skald-db", {
  name: `skald-scan-${app.stage}-db`,
  migrationsDir: resolve(repoRoot, "packages/shared/drizzle"),
});

export const storage = await R2Bucket("skald-manga", {
  name: `skald-scan-${app.stage}-manga`,
});

export const sessions = await KVNamespace("skald-sessions", {
  title: `skald-scan-${app.stage}-sessions`,
});

export const syncQueue = await Queue("skald-sync-queue", {
  name: `skald-scan-${app.stage}-sync-queue`,
});

await app.finalize();
