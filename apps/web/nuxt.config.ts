export default defineNuxtConfig({
  srcDir: "app",
  serverDir: "server",
  ssr: false,
  compatibilityDate: "2026-04-06",
  devtools: {
    enabled: false,
  },
  css: ["~/assets/css/main.css"],
  modules: [],
  imports: {
    dirs: ["composables"],
  },
  runtimeConfig: {
    sessionSecret: process.env.SESSION_SECRET,
    public: {
      appName: "Website Auditor",
    },
  },
  nitro: {
    externals: {
      inline: ["@website-auditor/db", "@website-auditor/shared"],
    },
  },
  build: {
    transpile: ["@website-auditor/db", "@website-auditor/shared"],
  },
});
