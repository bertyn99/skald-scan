import alchemy from "alchemy/cloudflare/nuxt";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui", "@nuxt/image"],

  image: {
    domains: ["uploads.mangadex.org"],
    provider: "none",
  },

  nitro: {
    preset: "cloudflare_module",
    cloudflare: alchemy(),
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
