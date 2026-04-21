export default defineNuxtConfig({
  srcDir: "app",
  serverDir: "server",
  ssr: false,
  compatibilityDate: "2026-04-06",
  devtools: {
    enabled: false,
  },
  app: {
    head: {
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      ],
    },
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
