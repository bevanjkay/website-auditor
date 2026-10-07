import { getAuditRun } from "@website-auditor/db";

import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";

defineRouteMeta({
  openAPI: {
    tags: ["Audits"],
    summary: "Get an audit",
    description: "Returns `{ auditRun }`. While it runs, `summaryJson.progress` reports the current stage.",
    security: [{ bearerAuth: ["read"] }],
  },
});

export default defineEventHandler(async (event) => {
  await requireUser(event, "read");
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Audit id is required.",
    });
  }

  const auditRun = await getAuditRun(id);
  if (!auditRun) {
    throw createError({
      statusCode: 404,
      statusMessage: "Audit run not found.",
    });
  }

  return { auditRun };
});
