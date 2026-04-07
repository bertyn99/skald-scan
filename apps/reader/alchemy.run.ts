import alchemy from "alchemy";
import { Nuxt } from "alchemy/cloudflare";
import { db, storage } from "../../alchemy.run";

const app = await alchemy("reader");

export const reader = await Nuxt("reader", {
  name: `skald-scan-${app.stage}-reader`,
  bindings: {
    DB: db,
    STORAGE: storage,
  },
});

await app.finalize();
