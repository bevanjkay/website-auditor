import { version } from "./package.json";

export default defineNuxtConfig({
  srcDir: "app",
  serverDir: "server",
  ssr: false,
  compatibilityDate: "2026-04-06",
  devtools: {
    enabled: false,
  },
  app: {
    viewTransition: true,
    head: {
      htmlAttrs: { lang: "en" },
      titleTemplate: title => title ? `${title} · Website Auditor` : "Website Auditor",
      meta: [
        { name: "color-scheme", content: "light dark" },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
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
    experimental: {
      openAPI: true,
    },
    openAPI: {
      production: "runtime",
      meta: {
        title: "Website Auditor API",
        description: "Authenticate with an API token from the API tokens page: `Authorization: Bearer wa_…`. The API is unstable before 1.0.",
        version,
      },
      // The bundled Scalar and Swagger pages load scripts from a CDN onto this origin, where they would run with
      // the signed-in user's session. Point an external client at /_openapi.json instead.
      ui: {
        scalar: false,
        swagger: false,
      },
    },
    externals: {
      inline: ["@website-auditor/db", "@website-auditor/shared"],
    },
  },
  build: {
    transpile: ["@website-auditor/db", "@website-auditor/shared"],
  },
});
