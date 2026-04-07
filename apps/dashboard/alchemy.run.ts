import alchemy from "alchemy";
import { Nuxt } from "alchemy/cloudflare";
import { db, storage, sessions, syncQueue } from "../../alchemy.run";

const app = await alchemy("dashboard");

export const dashboard = await Nuxt("dashboard", {
  name: `skald-scan-${app.stage}-dashboard`,
  bindings: {
    DB: db,
    STORAGE: storage,
    SESSIONS: sessions,
    SYNC_QUEUE: syncQueue,
  },
});

await app.finalize();
