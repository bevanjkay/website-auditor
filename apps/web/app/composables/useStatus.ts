export type Tone = "error" | "warning" | "success" | "accent" | "neutral";

export interface SeverityCounts {
  error: number;
  warning: number;
  info: number;
}

const runStatusLabels: Record<string, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "accent" },
  completed: { label: "Completed", tone: "success" },
  completed_with_limits: { label: "Completed, limit reached", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  failed: { label: "Failed", tone: "error" },
};

export function runStatusMeta(status: string | null | undefined): { label: string; tone: Tone } {
  if (!status) {
    return { label: "Not audited", tone: "neutral" };
  }
  return runStatusLabels[status] ?? { label: status.replaceAll("_", " "), tone: "neutral" };
}

export function isActiveRunStatus(status: string | null | undefined) {
  return status === "queued" || status === "running";
}

export function isCompletedRunStatus(status: string | null | undefined) {
  return status === "completed" || status === "completed_with_limits";
}

export type SiteHealth = "archived" | "running" | "queued" | "failed" | "cancelled" | "errors" | "warnings" | "clean" | "not_audited";

export const siteHealthMeta: Record<SiteHealth, { label: string; tone: Tone }> = {
  archived: { label: "Archived", tone: "neutral" },
  running: { label: "Running", tone: "accent" },
  queued: { label: "Queued", tone: "neutral" },
  failed: { label: "Last run failed", tone: "error" },
  cancelled: { label: "Last run cancelled", tone: "neutral" },
  errors: { label: "Errors", tone: "error" },
  warnings: { label: "Warnings", tone: "warning" },
  clean: { label: "Clean", tone: "success" },
  not_audited: { label: "Not audited", tone: "neutral" },
};

export function deriveSiteHealth(site: {
  isActive: boolean;
  lastAuditStatus: string | null;
  lastCompletedRun: { severityCounts: SeverityCounts } | null;
}): SiteHealth {
  if (!site.isActive) {
    return "archived";
  }
  if (site.lastAuditStatus === "running" || site.lastAuditStatus === "queued" || site.lastAuditStatus === "failed" || site.lastAuditStatus === "cancelled") {
    return site.lastAuditStatus;
  }
  if (!site.lastCompletedRun) {
    return "not_audited";
  }
  const counts = site.lastCompletedRun.severityCounts;
  if (counts.error > 0) {
    return "errors";
  }
  return counts.warning > 0 ? "warnings" : "clean";
}

export const severityOrder = ["error", "warning", "info"] as const;

export const severityMeta: Record<string, { label: string; plural: string; tone: Tone; rank: number }> = {
  error: { label: "Error", plural: "Errors", tone: "error", rank: 0 },
  warning: { label: "Warning", plural: "Warnings", tone: "warning", rank: 1 },
  info: { label: "Info", plural: "Info", tone: "neutral", rank: 2 },
};

export const categoryLabels: Record<string, string> = {
  crawl: "Crawl",
  broken_link: "Broken links",
  typo: "Typos",
  seo: "SEO",
  security: "Security",
  health: "Site health",
};

export function categoryLabel(category: string) {
  return categoryLabels[category] ?? category.replaceAll("_", " ");
}

const httpStatusText: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorised",
  403: "Forbidden",
  404: "Not found",
  405: "Method not allowed",
  408: "Timed out",
  410: "Gone",
  429: "Too many requests",
  500: "Server error",
  502: "Bad gateway",
  503: "Unavailable",
  504: "Gateway timeout",
};

export function formatHttpStatus(status: number | null | undefined) {
  if (status === null || status === undefined) {
    return "No response";
  }
  const text = httpStatusText[status];
  return text ? `${status} ${text}` : String(status);
}
