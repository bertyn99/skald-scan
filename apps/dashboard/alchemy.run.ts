import alchemy from "alchemy";
import { Nuxt } from "alchemy/cloudflare";
import { db, storage, sessions, syncQueue } from "../../alchemy.run.ts";

const app = await alchemy("dashboard", {
  password: process.env.ALCHEMY_PASSWORD ?? "dev-only-alchemy-password",
});

export const dashboard = await Nuxt("dashboard", {
  name: `skald-scan-${app.stage}-dashboard`,
  bindings: {
    DB: db,
    STORAGE: storage,
    SESSIONS: sessions,
    SYNC_QUEUE: syncQueue,
    BETTER_AUTH_SECRET: alchemy.secret(
      process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me"
    ),
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    READER_URL: process.env.READER_URL ?? "http://localhost:3001",
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL ?? "admin@skald-scan.test",
    SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD ?? "SkaldAdmin123!",
    SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME ?? "Skald Admin",
  },
  eventSources: [{
    queue: syncQueue,
    settings: {
      batchSize: 5,
      maxConcurrency: 5,
      maxRetries: 3,
    },
  }],
  dev: {
    command: "pnpm exec nuxt dev --port 3000",
  },
});

await app.finalize();
