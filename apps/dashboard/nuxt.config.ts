import alchemy from "alchemy/cloudflare/nuxt";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui", "@nuxt/image", "evlog/nuxt"],

  image: {
    domains: ["uploads.mangadex.org"],
    provider: "none",
  },

  evlog: {
    env: { service: "skald-scan-dashboard" },
    include: ["/api/**"],
  },

  nitro: {
    preset: "cloudflare_module",
    experimental: {
      tasks: true
    },
    cloudflare: alchemy(),
    scheduledTasks: {
      "*/30 * * * *": ["sync-chapters"],
    },
  },

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  compatibilityDate: "2026-04-24",

  eslint: {
    config: {
      stylistic: {
        commaDangle: "never",
        braceStyle: "1tbs",
      },
    },
  },
});
