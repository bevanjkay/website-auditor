import { brokenLinkTarget, countIssuesBySeverity, getPreviousCompletedAuditRun, listAuditIssuesForRun } from "@website-auditor/db";

import { compareIssueSets, isLinkIgnored, issueComparisonKey, linkIgnoresSchema } from "@website-auditor/shared";

export async function getAuditComparison(auditRun: { id: string; websiteId: string; startedAt: Date | null; finishedAt: Date | null; linkIgnoresJson: unknown }) {
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
  // Links ignored since the previous audit were not fixed, so leave them out of the comparison.
  const linkIgnores = linkIgnoresSchema.parse(auditRun.linkIgnoresJson ?? []);
  const comparablePrevious = previousIssues.filter(issue => issue.code !== "broken_link" || !isLinkIgnored(brokenLinkTarget(issue), linkIgnores));
  const { newKeys, fixed } = compareIssueSets(currentIssues, comparablePrevious);

  return {
    currentIssues,
    previousRun: { ...previousRun, severityCounts: previousSeverityCounts.get(previousRun.id)! },
    newIssueIds: currentIssues.filter(issue => newKeys.has(issueComparisonKey(issue))).map(issue => issue.id),
    fixedIssues: fixed,
  };
}
