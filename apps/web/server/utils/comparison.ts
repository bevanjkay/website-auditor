import { countIssuesBySeverity, getPreviousCompletedAuditRun, listAuditIssuesForRun } from "@website-auditor/db";

import { compareIssueSets, issueComparisonKey } from "@website-auditor/shared";

export async function getAuditComparison(auditRun: { id: string; websiteId: string; startedAt: Date | null; finishedAt: Date | null }) {
  const [currentIssues, previousRun] = await Promise.all([
    listAuditIssuesForRun(auditRun.id),
    getPreviousCompletedAuditRun(auditRun),
  ]);

  if (!previousRun) {
    return { currentIssues, previousRun: null, newIssueIds: [] as string[], fixedIssues: [] as typeof currentIssues };
  }

  const [previousIssues, previousSeverityCounts] = await Promise.all([
    listAuditIssuesForRun(previousRun.id),
    countIssuesBySeverity([previousRun.id]),
  ]);
  const { newKeys, fixed } = compareIssueSets(currentIssues, previousIssues);

  return {
    currentIssues,
    previousRun: { ...previousRun, severityCounts: previousSeverityCounts.get(previousRun.id)! },
    newIssueIds: currentIssues.filter(issue => newKeys.has(issueComparisonKey(issue))).map(issue => issue.id),
    fixedIssues: fixed,
  };
}
