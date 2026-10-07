import { getAuditRun } from "@website-auditor/db";

import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";
import { getAuditComparison } from "../../../utils/comparison.js";

defineRouteMeta({
  openAPI: {
    tags: ["Audit results"],
    summary: "Compare with the previous audit",
    description: "Returns `{ previousRun, newIssueIds, fixedIssues }` against the website's previous completed audit. `previousRun` is null for a first audit.",
    security: [{ bearerAuth: ["read"] }],
  },
});

export default defineEventHandler(async (event) => {
  await requireUser(event, "read");
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Audit id is required." });
  }

  const auditRun = await getAuditRun(id);
  if (!auditRun) {
    throw createError({ statusCode: 404, statusMessage: "Audit run not found." });
  }

  const { previousRun, newIssueIds, fixedIssues } = await getAuditComparison(auditRun);
  return { previousRun, newIssueIds, fixedIssues };
});
