import { countIssuesBySeverity, getAuditRun, getPreviousCompletedAuditRun, listAuditIssuesForRun } from "@website-auditor/db";

import { compareIssueSets, issueComparisonKey } from "@website-auditor/shared";
import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";

export default defineEventHandler(async (event) => {
  await requireUser(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Audit id is required." });
  }

  const auditRun = await getAuditRun(id);
  if (!auditRun) {
    throw createError({ statusCode: 404, statusMessage: "Audit run not found." });
  }

  const previousRun = await getPreviousCompletedAuditRun(auditRun);
  if (!previousRun) {
    return { previousRun: null, newIssueIds: [], fixedIssues: [] };
  }

  const [currentIssues, previousIssues, previousSeverityCounts] = await Promise.all([
    listAuditIssuesForRun(auditRun.id),
    listAuditIssuesForRun(previousRun.id),
    countIssuesBySeverity([previousRun.id]),
  ]);
  const { newKeys, fixed } = compareIssueSets(currentIssues, previousIssues);

  return {
    previousRun: { ...previousRun, severityCounts: previousSeverityCounts.get(previousRun.id)! },
    newIssueIds: currentIssues.filter(issue => newKeys.has(issueComparisonKey(issue))).map(issue => issue.id),
    fixedIssues: fixed,
  };
});
