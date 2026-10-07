import { listWebsites } from "@website-auditor/db";

import { defineEventHandler } from "h3";

import { requireUser } from "../../utils/auth.js";

defineRouteMeta({
  openAPI: {
    tags: ["Websites"],
    summary: "List websites",
    description: "Returns `{ websites }` with each website's latest audit status and issue counts. Archived websites have `isActive: false`.",
    security: [{ bearerAuth: ["read"] }],
    $global: {
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            description: "An API token from the API tokens page. Each operation lists the scope it needs.",
          },
        },
        schemas: {
          CrawlRule: {
            type: "object",
            required: ["matcher", "pattern"],
            properties: {
              matcher: { type: "string", enum: ["glob", "exact", "prefix"] },
              pattern: { type: "string" },
            },
          },
          LinkIgnore: {
            type: "object",
            required: ["kind", "value"],
            properties: {
              kind: { type: "string", enum: ["url", "domain"], description: "`domain` also covers its subdomains." },
              value: { type: "string" },
            },
          },
        },
      },
    },
  },
});

export default defineEventHandler(async (event) => {
  await requireUser(event, "read");
  return {
    websites: await listWebsites(),
  };
});
