import type { AuditReportInput } from "@website-auditor/shared";

import { getAuditRun, listAuditLinksForRun } from "@website-auditor/db";
import { buildAuditMarkdown } from "@website-auditor/shared";
import { createError, defineEventHandler, getQuery, getRouterParam, setHeader } from "h3";

import { requireUser } from "../../../utils/auth.js";
import { getAuditComparison } from "../../../utils/comparison.js";

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

  const [comparison, links] = await Promise.all([
    getAuditComparison(auditRun),
    listAuditLinksForRun(auditRun.id),
  ]);

  const markdown = buildAuditMarkdown({
    run: {
      websiteName: auditRun.websiteName,
      baseUrl: auditRun.baseUrl,
      status: auditRun.status,
      startedAt: auditRun.startedAt,
      finishedAt: auditRun.finishedAt,
      pageCount: auditRun.pageCount,
      summary: (auditRun.summaryJson ?? {}) as AuditReportInput["run"]["summary"],
    },
    issues: comparison.currentIssues,
    brokenLinks: links.filter(link => link.isBroken),
    comparison,
  });

  setHeader(event, "content-type", "text/markdown; charset=utf-8");
  if (getQuery(event).download) {
    const host = new URL(auditRun.baseUrl).host.replace(/[^\w.-]/g, "");
    const date = (auditRun.startedAt ?? new Date()).toISOString().slice(0, 10);
    setHeader(event, "content-disposition", `attachment; filename="audit-${host}-${date}.md"`);
  }

  return markdown;
});
