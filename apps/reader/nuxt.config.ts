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
      // Used by the proxy to reflect the request Origin for authenticated CORS.
      // Defaults to the deployed reader URL; override via NUXT_PUBLIC_READER_URL.
      readerUrl: process.env.NUXT_PUBLIC_READER_URL ?? '',
    },
  },

  routeRules: {
    '/api/**': {
      // CORS is applied per-request in server/api/proxy/[...].ts so the
      // Access-Control-Allow-Origin can reflect the request origin (not '*').
      cors: false,
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
