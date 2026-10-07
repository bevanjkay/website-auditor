import { listAuditEventsForRun } from "@website-auditor/db";

import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";

defineRouteMeta({
  openAPI: {
    tags: ["Audit results"],
    summary: "List audit events",
    description: "Returns `{ events }`, the audit's progress log.",
    security: [{ bearerAuth: ["read"] }],
  },
});

export default defineEventHandler(async (event) => {
  await requireUser(event, "read");
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Audit id is required." });
  }
  return { events: await listAuditEventsForRun(id) };
});
