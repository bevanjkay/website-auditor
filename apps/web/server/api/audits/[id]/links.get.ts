import { listAuditLinksForRun } from "@website-auditor/db";

import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";

defineRouteMeta({
  openAPI: {
    tags: ["Audit results"],
    summary: "List checked links",
    description: "Returns `{ links }`. Broken links have `isBroken: true`.",
    security: [{ bearerAuth: ["read"] }],
  },
});

export default defineEventHandler(async (event) => {
  await requireUser(event, "read");
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Audit id is required." });
  }
  return { links: await listAuditLinksForRun(id) };
});
