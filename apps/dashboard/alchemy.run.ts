import alchemy from "alchemy";
import { Nuxt } from "alchemy/cloudflare";
import { db, storage, sessions, syncQueue } from "../../alchemy.run.ts";

const app = await alchemy("dashboard");

export const dashboard = await Nuxt("dashboard", {
  name: `skald-scan-${app.stage}-dashboard`,
  bindings: {
    DB: db,
    STORAGE: storage,
    SESSIONS: sessions,
    SYNC_QUEUE: syncQueue,
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
