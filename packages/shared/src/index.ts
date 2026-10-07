import { z } from "zod";

export * from "./report.js";

export const userRoles = ["admin", "user"] as const;
export type UserRole = (typeof userRoles)[number];

export const auditRunStatuses = ["queued", "running", "cancelled", "completed", "completed_with_limits", "failed"] as const;
export type AuditRunStatus = (typeof auditRunStatuses)[number];
export const auditQueueName = "audit-site";

export const issueSeverities = ["info", "warning", "error"] as const;
export type IssueSeverity = (typeof issueSeverities)[number];

export const issueCategories = ["crawl", "broken_link", "typo", "seo", "security", "health"] as const;
export type IssueCategory = (typeof issueCategories)[number];

export const crawlRuleMatchers = ["glob", "exact", "prefix"] as const;
export type CrawlRuleMatcher = (typeof crawlRuleMatchers)[number];

export const typoLanguages = ["en", "en-au", "en-gb", "en-us"] as const;
export type TypoLanguage = (typeof typoLanguages)[number];

export const crawlRuleSchema = z.object({
  matcher: z.enum(crawlRuleMatchers),
  pattern: z.string().trim().min(1).max(2048),
});

export const crawlRulesSchema = z.object({
  allow: z.array(crawlRuleSchema).max(50).default([]),
  deny: z.array(crawlRuleSchema).max(50).default([]),
});

export type CrawlRule = z.infer<typeof crawlRuleSchema>;
export type CrawlRules = z.infer<typeof crawlRulesSchema>;

export const lighthouseTargetsSchema = z.array(z.string().trim().url().max(2048)).max(10).default([]);
export type LighthouseTargets = z.infer<typeof lighthouseTargetsSchema>;
export const typoLanguageSchema = z.enum(typoLanguages).default("en");
export const typoAllowlistWordSchema = z.string().trim().min(2).max(100).transform(value => value.toLowerCase());
export const typoAllowlistSchema = z.array(typoAllowlistWordSchema).max(500).default([]);

export const linkIgnoreKinds = ["url", "domain"] as const;
export const linkIgnoreSchema = z.object({
  kind: z.enum(linkIgnoreKinds),
  value: z.string().trim().min(1).max(2048),
});
export const linkIgnoresSchema = z.array(linkIgnoreSchema).max(200).default([]);
export type LinkIgnore = z.infer<typeof linkIgnoreSchema>;

const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

// A bare host ignores the whole domain; anything with a path ignores that one URL.
export function parseLinkIgnore(input: string): LinkIgnore | null {
  const value = input.trim();
  const domain = value.toLowerCase().replace(/^\*\./, "").replace(/\/$/, "");
  if (domainPattern.test(domain)) {
    return { kind: "domain", value: domain };
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) {
    return null;
  }

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!domainPattern.test(url.hostname)) {
      return null;
    }
    url.hash = "";
    return { kind: "url", value: url.toString() };
  }
  catch {
    return null;
  }
}

function comparableUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  }
  catch {
    return value.replace(/\/$/, "");
  }
}

export function isLinkIgnored(targetUrl: string, ignores: LinkIgnore[]): boolean {
  if (!ignores.length) {
    return false;
  }

  let host = "";
  try {
    host = new URL(targetUrl).hostname.toLowerCase();
  }
  catch {
    return false;
  }

  const target = comparableUrl(targetUrl);
  return ignores.some(rule => rule.kind === "domain"
    ? host === rule.value || host.endsWith(`.${rule.value}`)
    : comparableUrl(rule.value) === target);
}

export const websiteInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().min(1).max(2048),
  typoLanguage: typoLanguageSchema.optional(),
});

export const websiteUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  crawlRules: crawlRulesSchema.optional(),
  lighthouseTargets: lighthouseTargetsSchema.optional(),
  typoLanguage: typoLanguageSchema.optional(),
  typoAllowlist: typoAllowlistSchema.optional(),
  linkIgnores: linkIgnoresSchema.optional(),
});

export const addTypoAllowlistWordSchema = z.object({
  word: typoAllowlistWordSchema,
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
});

export const createUserSchema = z.object({
  username: z.string().trim().min(3).max(100).regex(/^[\w.-]+$/),
  password: z.string().min(8).max(200),
  role: z.enum(userRoles),
});

export const updateUserSchema = z.object({
  role: z.enum(userRoles).optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(200),
});

export const apiTokenScopes = ["read", "audit:run", "websites:write"] as const;
export type ApiTokenScope = (typeof apiTokenScopes)[number];
export const apiTokenScopesSchema = z.array(z.enum(apiTokenScopes));
export const apiTokenExpiryDays = [30, 90, 365] as const;

// The worker fetches whatever URL a website points at, so only admins can hand that reach to a token.
export function apiTokenScopesForRole(role: UserRole): readonly ApiTokenScope[] {
  return role === "admin" ? apiTokenScopes : ["read", "audit:run"];
}

export const createApiTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: apiTokenScopesSchema.min(1).transform(scopes => [...new Set(scopes)]),
  expiresInDays: z.literal(apiTokenExpiryDays).nullable(),
});

export const summarySchema = z.object({
  completedWithLimits: z.boolean(),
  maxPagesReached: z.boolean(),
  maxDepthReached: z.boolean(),
  crawledFromSitemap: z.number().int().nonnegative(),
  uniqueInternalPages: z.number().int().nonnegative(),
  checkedLinks: z.number().int().nonnegative(),
  duplicateTitles: z.number().int().nonnegative(),
  duplicateDescriptions: z.number().int().nonnegative(),
  auditSummary: z.string().optional(),
  lighthouse: z.object({
    pagesAudited: z.number().int().nonnegative(),
    results: z.array(z.object({
      url: z.string().url(),
      performanceScore: z.number().nullable(),
      accessibilityScore: z.number().nullable(),
      bestPracticesScore: z.number().nullable(),
      seoScore: z.number().nullable(),
      firstContentfulPaintMs: z.number().nullable().optional(),
      largestContentfulPaintMs: z.number().nullable().optional(),
      totalBlockingTimeMs: z.number().nullable().optional(),
      cumulativeLayoutShift: z.number().nullable().optional(),
      speedIndexMs: z.number().nullable().optional(),
      findings: z.array(z.object({
        id: z.string().min(1),
        category: z.enum(["performance", "accessibility", "best-practices", "seo"]),
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        score: z.number().nullable().optional(),
        displayValue: z.string().nullable().optional(),
        targets: z.array(z.object({
          kind: z.enum(["node", "source-location", "url"]),
          selector: z.string().nullable().optional(),
          snippet: z.string().nullable().optional(),
          nodeLabel: z.string().nullable().optional(),
          path: z.string().nullable().optional(),
          explanation: z.string().nullable().optional(),
          url: z.string().nullable().optional(),
          line: z.number().int().nonnegative().nullable().optional(),
          column: z.number().int().nonnegative().nullable().optional(),
          originalFile: z.string().nullable().optional(),
          originalLine: z.number().int().nonnegative().nullable().optional(),
          originalColumn: z.number().int().nonnegative().nullable().optional(),
        })).max(8).optional(),
      })).optional(),
    })),
  }).optional(),
});

export type AuditSummary = z.infer<typeof summarySchema>;

export type DiscoveryEntryStatus = "included" | "excluded";
export type DiscoverySource = "sitemap" | "fallback";
export type DiscoverySourceMode = "sitemap" | "fallback" | "mixed";

export type CrawlRuleMatch = CrawlRule & {
  mode: "allow" | "deny";
};

export interface DiscoveryEntry {
  url: string;
  source: DiscoverySource;
  status: DiscoveryEntryStatus;
  matchedRule: CrawlRuleMatch | null;
}

export interface DiscoveryPreview {
  generatedAt: string;
  hasSitemap: boolean;
  source: DiscoverySourceMode;
  total: number;
  included: number;
  excluded: number;
  sitemapUrls: string[];
  entries: DiscoveryEntry[];
}

export interface DenySuggestion {
  matcher: CrawlRuleMatcher;
  pattern: string;
  reason: string;
  matchedCount: number;
  exampleUrls: string[];
}

export type AllowSuggestion = DenySuggestion;

export const denySuggestionSchema = z.object({
  matcher: z.enum(crawlRuleMatchers),
  pattern: z.string().trim().min(1).max(2048),
  reason: z.string().trim().min(1).max(240),
  matchedCount: z.number().int().nonnegative(),
  exampleUrls: z.array(z.string().url()).max(5),
});

export const discoveryEntrySchema = z.object({
  url: z.string().url(),
  source: z.enum(["sitemap", "fallback"]),
  status: z.enum(["included", "excluded"]),
  matchedRule: z.object({
    mode: z.enum(["allow", "deny"]),
    matcher: z.enum(crawlRuleMatchers),
    pattern: z.string().trim().min(1).max(2048),
  }).nullable(),
});

export const discoveryPreviewSchema = z.object({
  generatedAt: z.string(),
  hasSitemap: z.boolean(),
  source: z.enum(["sitemap", "fallback", "mixed"]),
  total: z.number().int().nonnegative(),
  included: z.number().int().nonnegative(),
  excluded: z.number().int().nonnegative(),
  sitemapUrls: z.array(z.string().url()),
  entries: z.array(discoveryEntrySchema),
});

export interface AuditIssueRecord {
  pageUrl?: string;
  category: IssueCategory;
  code: string;
  severity: IssueSeverity;
  title: string;
  message: string;
  evidence?: Record<string, unknown>;
}

export interface AuditLinkRecord {
  sourceUrl: string;
  targetUrl: string;
  targetType: "internal" | "external" | "canonical";
  httpStatus: number | null;
  isBroken: boolean;
  anchorText: string | null;
  nofollow: boolean;
}

export interface AuditPageRecord {
  url: string;
  canonicalUrl: string | null;
  httpStatus: number | null;
  depth: number;
  fromSitemap: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  renderedAt: string;
  pageDigest: string;
}

export interface AuditEventRecord {
  level: "info" | "warning" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export interface AuditEngineResult {
  status: AuditRunStatus;
  summary: AuditSummary;
  pages: AuditPageRecord[];
  links: AuditLinkRecord[];
  issues: AuditIssueRecord[];
  events: AuditEventRecord[];
}

export interface SessionUser {
  id: string;
  username: string;
  role: UserRole;
}

export function createEmptyCrawlRules(): CrawlRules {
  return {
    allow: [],
    deny: [],
  };
}

export function normalizeWebsiteUrl(input: string): { baseUrl: string; normalizedHost: string } {
  const value = input.trim();
  if (/^[a-z]+:\/\//i.test(value) && !/^https?:\/\//i.test(value)) {
    throw new Error("Only http and https websites are supported.");
  }
  const prefixed = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(prefixed);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https websites are supported.");
  }

  url.hash = "";
  url.search = "";
  if (url.pathname.endsWith("/") && url.pathname !== "/") {
    url.pathname = url.pathname.slice(0, -1);
  }

  return {
    baseUrl: url.toString(),
    normalizedHost: url.host.toLowerCase(),
  };
}

export interface ComparableIssue {
  code: string;
  pageUrl?: string | null;
  message: string;
  evidenceJson?: unknown;
}

const issueCodesKeyedByMessage = new Set(["broken_link", "invalid_link", "broken_canonical"]);

// Issues are matched across runs by what they describe, not by row id: page-level checks by code and page,
// link checks by their target (carried in the message), and duplicate titles by the shared title text.
export function issueComparisonKey(issue: ComparableIssue): string {
  const evidence = issue.evidenceJson && typeof issue.evidenceJson === "object"
    ? issue.evidenceJson as Record<string, unknown>
    : {};
  const detail = issueCodesKeyedByMessage.has(issue.code)
    ? issue.message
    : issue.code === "duplicate_title" && typeof evidence.title === "string"
      ? evidence.title
      : "";

  return [issue.code, issue.pageUrl ?? "", detail].join("|");
}

export function compareIssueSets<T extends ComparableIssue>(current: T[], previous: T[]): { newKeys: Set<string>; fixed: T[] } {
  const currentKeys = new Set(current.map(issueComparisonKey));
  const previousKeys = new Set(previous.map(issueComparisonKey));

  return {
    newKeys: new Set([...currentKeys].filter(key => !previousKeys.has(key))),
    fixed: previous.filter(issue => !currentKeys.has(issueComparisonKey(issue))),
  };
}
