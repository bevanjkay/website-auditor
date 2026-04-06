import { listAuditRunsForWebsite } from "@website-auditor/db";

import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";

export default defineEventHandler(async (event) => {
  await requireUser(event);
  const websiteId = getRouterParam(event, "id");

  if (!websiteId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Website id is required.",
    });
  }

  return {
    auditRuns: await listAuditRunsForWebsite(websiteId),
  };
});
