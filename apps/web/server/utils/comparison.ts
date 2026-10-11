import { brokenLinkTarget, countIssuesBySeverity, getPreviousCompletedAuditRun, listAuditIssuesForRun } from "@website-auditor/db";

import { compareIssueSets, failedResourcesFromEvidence, isLinkIgnored, issueComparisonKey, linkIgnoresSchema } from "@website-auditor/shared";

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
  // Links and resources ignored since the previous audit were not fixed, so leave them out of the comparison.
  const linkIgnores = linkIgnoresSchema.parse(auditRun.linkIgnoresJson ?? []);
  const comparablePrevious = previousIssues.filter((issue) => {
    if (issue.code === "broken_link") {
      return !isLinkIgnored(brokenLinkTarget(issue), linkIgnores);
    }
    if (issue.code === "broken_resource") {
      const resources = failedResourcesFromEvidence(issue.evidenceJson);
      return !resources.length || !resources.every(resource => isLinkIgnored(resource.url, linkIgnores));
    }
    return true;
  });
  const { newKeys, fixed } = compareIssueSets(currentIssues, comparablePrevious);

  return {
    currentIssues,
    previousRun: { ...previousRun, severityCounts: previousSeverityCounts.get(previousRun.id)! },
    newIssueIds: currentIssues.filter(issue => newKeys.has(issueComparisonKey(issue))).map(issue => issue.id),
    fixedIssues: fixed,
  };
}
