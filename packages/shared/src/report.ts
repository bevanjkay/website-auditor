export interface ReportIssue {
  id: string;
  code: string;
  severity: string;
  category: string;
  title: string;
  message: string;
  pageUrl?: string | null;
  evidenceJson?: unknown;
}

export interface ReportSeverityCounts {
  error: number;
  warning: number;
  info: number;
}

export interface ReportLighthouseResult {
  url: string;
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  largestContentfulPaintMs?: number | null;
  totalBlockingTimeMs?: number | null;
  cumulativeLayoutShift?: number | null;
  findings?: Array<{ title: string; category: string; score?: number | null; displayValue?: string | null }>;
}

export interface AuditReportInput {
  run: {
    websiteName: string;
    baseUrl: string;
    status: string;
    startedAt: string | Date | null;
    finishedAt: string | Date | null;
    pageCount: number;
    summary: {
      maxPagesReached?: boolean;
      maxDepthReached?: boolean;
      lighthouse?: { results: ReportLighthouseResult[] };
    };
  };
  issues: ReportIssue[];
  brokenLinks: Array<{ targetUrl: string; targetType: string; httpStatus: number | null; sourceUrl: string | null; anchorText: string | null }>;
  comparison: {
    previousRun: { startedAt: string | Date | null; finishedAt: string | Date | null; severityCounts: ReportSeverityCounts } | null;
    newIssueIds: string[];
    fixedIssues: ReportIssue[];
  };
}

export interface IssueGroup<T extends ReportIssue> {
  key: string;
  code: string;
  title: string;
  severity: string;
  category: string;
  items: T[];
}

const severityRank: Record<string, number> = { error: 0, warning: 1, info: 2 };

const runStatusLabels: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  completed_with_limits: "Completed, crawl limit reached",
  cancelled: "Cancelled",
  failed: "Failed",
};

const categoryLabels: Record<string, string> = {
  crawl: "Crawl",
  broken_link: "Broken links",
  typo: "Typos",
  seo: "SEO",
  security: "Security",
  health: "Site health",
};

const maxOccurrencesPerGroup = 100;

function evidenceOf(issue: ReportIssue): Record<string, unknown> {
  return issue.evidenceJson && typeof issue.evidenceJson === "object" ? issue.evidenceJson as Record<string, unknown> : {};
}

// Broken links split into internal and external targets with different severities, so each gets its own named group.
export function groupIssues<T extends ReportIssue>(issues: T[]): IssueGroup<T>[] {
  const groups = new Map<string, IssueGroup<T>>();
  for (const issue of issues) {
    const targetType = issue.code === "broken_link" && typeof evidenceOf(issue).targetType === "string" ? evidenceOf(issue).targetType as string : "";
    const key = `${issue.code}|${issue.severity}|${targetType}`;
    const group = groups.get(key) ?? {
      key,
      code: issue.code,
      title: targetType ? `Broken ${targetType} link` : issue.title,
      severity: issue.severity,
      category: issue.category,
      items: [],
    };
    group.items.push(issue);
    groups.set(key, group);
  }

  return [...groups.values()].sort((left, right) =>
    (severityRank[left.severity] ?? 9) - (severityRank[right.severity] ?? 9)
    || right.items.length - left.items.length
    || left.title.localeCompare(right.title));
}

function formatTimestamp(value: string | Date | null) {
  if (!value) {
    return "not recorded";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "not recorded" : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatDelta(current: number, previous: number | undefined) {
  if (previous === undefined) {
    return "";
  }
  const delta = current - previous;
  return delta === 0 ? "0" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function typoWords(issue: ReportIssue) {
  const words = Array.isArray(evidenceOf(issue).words) ? evidenceOf(issue).words as unknown[] : [];
  return words.flatMap((entry) => {
    if (typeof entry === "string") {
      return [entry];
    }
    if (entry && typeof entry === "object" && typeof (entry as { word?: unknown }).word === "string") {
      const { word, suggestions } = entry as { word: string; suggestions?: unknown };
      const options = Array.isArray(suggestions) ? suggestions.filter(item => typeof item === "string").slice(0, 3) : [];
      return [options.length ? `${word} → ${options.join(" / ")}` : word];
    }
    return [];
  });
}

function occurrenceLine(issue: ReportIssue, isNew: boolean, repeatedMessage: boolean) {
  const location = issue.pageUrl ?? "Site-wide";
  const detail = issue.code === "possible_typos"
    ? typoWords(issue).join(", ")
    : repeatedMessage ? "" : issue.message;
  return `- ${location}${isNew ? " (new)" : ""}${detail ? ` — ${detail}` : ""}`;
}

export function buildAuditMarkdown(input: AuditReportInput): string {
  const { run, issues, brokenLinks, comparison } = input;
  const newIds = new Set(comparison.newIssueIds);
  const counts: ReportSeverityCounts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    if (issue.severity === "error" || issue.severity === "warning" || issue.severity === "info") {
      counts[issue.severity] += 1;
    }
  }
  const previous = comparison.previousRun?.severityCounts;
  const lines: string[] = [];

  lines.push(`# Website audit: ${run.websiteName}`, "");
  lines.push(
    `- Site: ${run.baseUrl}`,
    `- Status: ${runStatusLabels[run.status] ?? run.status}`,
    `- Started: ${formatTimestamp(run.startedAt)}`,
    `- Finished: ${formatTimestamp(run.finishedAt)}`,
    `- Pages crawled: ${run.pageCount}`,
  );
  if (run.status === "completed_with_limits") {
    const limit = run.summary.maxPagesReached ? "page limit" : run.summary.maxDepthReached ? "depth limit" : "limit";
    lines.push(`- Note: the crawl reached its ${limit}, so some pages were not audited.`);
  }
  lines.push(comparison.previousRun
    ? `- Compared with: the audit started ${formatTimestamp(comparison.previousRun.startedAt)}`
    : "- Compared with: nothing yet. First completed audit for this site.");
  lines.push("", "Generated by Website Auditor. Issues are grouped by check, most severe first; each bullet is one affected page.", "");

  lines.push("## Summary", "");
  lines.push(previous ? "| Severity | Count | Change |" : "| Severity | Count |");
  lines.push(previous ? "| --- | ---: | ---: |" : "| --- | ---: |");
  for (const [key, label] of [["error", "Errors"], ["warning", "Warnings"], ["info", "Info"]] as const) {
    lines.push(previous ? `| ${label} | ${counts[key]} | ${formatDelta(counts[key], previous[key])} |` : `| ${label} | ${counts[key]} |`);
  }
  if (comparison.previousRun) {
    lines.push("", `${plural(newIds.size, "issue")} new since the previous audit, ${comparison.fixedIssues.length} fixed.`);
  }
  lines.push("");

  lines.push("## Issues to fix", "");
  const groups = groupIssues(issues);
  if (!groups.length) {
    lines.push("No issues found.", "");
  }
  for (const group of groups) {
    const pages = new Set(group.items.map(item => item.pageUrl ?? "")).size;
    const severityLabel = group.severity.charAt(0).toUpperCase() + group.severity.slice(1);
    lines.push(`### ${severityLabel}: ${group.title} (${pages > 1 ? plural(pages, "page") : plural(group.items.length, "occurrence")}, ${categoryLabels[group.category] ?? group.category})`, "");
    const messages = new Set(group.items.map(item => item.message));
    const repeatedMessage = messages.size === 1 && group.items.length > 1;
    if (repeatedMessage) {
      lines.push(group.items[0]!.message, "");
    }
    for (const item of group.items.slice(0, maxOccurrencesPerGroup)) {
      lines.push(occurrenceLine(item, newIds.has(item.id), repeatedMessage));
    }
    if (group.items.length > maxOccurrencesPerGroup) {
      lines.push(`- …and ${group.items.length - maxOccurrencesPerGroup} more`);
    }
    lines.push("");
  }

  const linkGroups = new Map<string, { targetType: string; httpStatus: number | null; sources: Map<string, string | null> }>();
  for (const link of brokenLinks) {
    const group = linkGroups.get(link.targetUrl) ?? { targetType: link.targetType, httpStatus: link.httpStatus, sources: new Map() };
    if (link.sourceUrl && !group.sources.has(link.sourceUrl)) {
      group.sources.set(link.sourceUrl, link.anchorText);
    }
    linkGroups.set(link.targetUrl, group);
  }
  if (linkGroups.size) {
    lines.push("## Broken links", "");
    const ordered = [...linkGroups.entries()].sort((left, right) =>
      Number(right[1].targetType === "internal") - Number(left[1].targetType === "internal") || right[1].sources.size - left[1].sources.size);
    for (const [targetUrl, group] of ordered) {
      lines.push(`### ${targetUrl} (${group.httpStatus ?? "no response"}, ${group.targetType}, ${plural(group.sources.size, "page")})`, "");
      for (const [sourceUrl, anchorText] of [...group.sources.entries()].slice(0, maxOccurrencesPerGroup)) {
        lines.push(`- ${sourceUrl}${anchorText ? ` — link text “${anchorText}”` : ""}`);
      }
      lines.push("");
    }
  }

  if (comparison.fixedIssues.length) {
    lines.push("## Fixed since the previous audit", "");
    for (const group of groupIssues(comparison.fixedIssues)) {
      const locations = group.items.slice(0, 10).map(item => item.pageUrl ?? "site-wide").join(", ");
      const more = group.items.length > 10 ? `, and ${group.items.length - 10} more` : "";
      lines.push(`- ${group.title} (${plural(group.items.length, "occurrence")}): ${locations}${more}`);
    }
    lines.push("");
  }

  const lighthouse = run.summary.lighthouse?.results ?? [];
  if (lighthouse.length) {
    lines.push("## Lighthouse", "");
    for (const result of lighthouse) {
      const score = (value: number | null) => value ?? "n/a";
      lines.push(`### ${result.url}`, "");
      lines.push(`Performance ${score(result.performanceScore)} · Accessibility ${score(result.accessibilityScore)} · Best practices ${score(result.bestPracticesScore)} · SEO ${score(result.seoScore)}`);
      const vitals = [
        typeof result.largestContentfulPaintMs === "number" ? `LCP ${(result.largestContentfulPaintMs / 1000).toFixed(1)} s` : null,
        typeof result.totalBlockingTimeMs === "number" ? `TBT ${Math.round(result.totalBlockingTimeMs)} ms` : null,
        typeof result.cumulativeLayoutShift === "number" ? `CLS ${Math.round(result.cumulativeLayoutShift * 1000) / 1000}` : null,
      ].filter(Boolean);
      if (vitals.length) {
        lines.push(vitals.join(" · "));
      }
      if (result.findings?.length) {
        lines.push("");
        for (const finding of result.findings) {
          lines.push(`- ${finding.title} (${finding.category}${typeof finding.score === "number" ? `, score ${finding.score}` : ""}${finding.displayValue ? `, ${finding.displayValue}` : ""})`);
        }
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
