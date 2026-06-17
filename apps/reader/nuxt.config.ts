// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui"],

  nitro: {
    preset: "cloudflare_module",
  },

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  compatibilityDate: "2025-01-15",

  runtimeConfig: {
    public: {
      dashboardUrl: 'http://localhost:3000',
    },
  },

  routeRules: {
    '/api/**': {
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    },
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: "never",
        braceStyle: "1tbs",
      },
    },
  },
});
