import type {
  AllowSuggestion,
  AuditEngineResult,
  AuditEventRecord,
  AuditIssueRecord,
  AuditLinkRecord,
  AuditPageRecord,
  AuditSummary,
  CrawlRule,
  CrawlRuleMatch,
  CrawlRules,
  DenySuggestion,
  DiscoveryPreview,
  DiscoverySource,
  DiscoverySourceMode,
  LighthouseTargets,
  TypoLanguage,
} from "@website-auditor/shared";

import { createHash } from "node:crypto";
import { createEmptyCrawlRules } from "@website-auditor/shared";
import { launch } from "chrome-launcher";
import dictionary from "dictionary-en";
import dictionaryAu from "dictionary-en-au";
import dictionaryGb from "dictionary-en-gb";
import { XMLParser } from "fast-xml-parser";
import lighthouse from "lighthouse";
import nspell from "nspell";

import pLimit from "p-limit";
import { chromium } from "playwright";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
});

const typoAllowList = new Set([
  "api",
  "apis",
  "canonical",
  "cms",
  "faq",
  "hreflang",
  "javascript",
  "json",
  "lighthouse",
  "metadata",
  "nuxt",
  "playwright",
  "redis",
  "schema",
  "seo",
  "sitemap",
  "sitemaps",
  "slug",
  "typescript",
  "url",
  "urls",
  "utm",
  "vue",
]);

interface TypoMatch {
  word: string;
  suggestions: string[];
}

type FetchLike = typeof fetch;

export interface AuditConfig {
  maxPages: number;
  maxDepth: number;
  pageTimeoutMs: number;
  browserConcurrency: number;
  linkConcurrency: number;
}

export interface AuditProgress {
  stage: "starting" | "sitemap" | "crawl" | "link_check" | "lighthouse" | "cancelled" | "complete";
  currentUrl?: string;
  pagesCrawled: number;
  issuesFound: number;
  linksChecked: number;
  queueSize: number;
}

type LighthouseSummary = NonNullable<AuditSummary["lighthouse"]>;
type LighthouseResult = LighthouseSummary["results"][number];
type LighthouseFinding = NonNullable<LighthouseResult["findings"]>[number];
type LighthouseFindingTarget = NonNullable<NonNullable<LighthouseFinding["targets"]>[number]>;

interface QueueItem {
  url: string;
  depth: number;
  fromSitemap: boolean;
}

interface DiscoveredCandidate {
  url: string;
  source: DiscoverySource;
}

interface ExtractedPage {
  finalUrl: string;
  httpStatus: number | null;
  title: string | null;
  metaDescription: string | null;
  h1s: string[];
  lang: string | null;
  canonicalUrl: string | null;
  links: Array<{ href: string; text: string | null; nofollow: boolean }>;
  visibleText: string;
  imageSourcesMissingAlt: string[];
  robotsMeta: string | null;
  structuredDataCount: number;
}

interface SiteContext {
  baseUrl: string;
  baseOrigin: string;
  host: string;
}

interface PageAnalysis {
  page: AuditPageRecord;
  links: AuditLinkRecord[];
  issues: AuditIssueRecord[];
  discoveredUrls: QueueItem[];
}

type SpellChecker = ReturnType<typeof nspell>;

const dictionaries: Record<TypoLanguage, unknown> = {
  "en": dictionary,
  "en-au": dictionaryAu,
  "en-gb": dictionaryGb,
  "en-us": dictionary,
};

const spellCheckers = new Map<TypoLanguage, SpellChecker>();

async function emit(
  events: AuditEventRecord[],
  level: AuditEventRecord["level"],
  message: string,
  context: Record<string, unknown> | undefined,
  onEvent?: (event: AuditEventRecord) => void | Promise<void>,
) {
  const event = { level, message, context };
  events.push(event);
  await onEvent?.(event);
}

async function getSpellChecker(language: TypoLanguage): Promise<SpellChecker> {
  const cached = spellCheckers.get(language);
  if (cached) {
    return cached;
  }

  const spellChecker = nspell(dictionaries[language] as Parameters<typeof nspell>[0]);
  spellCheckers.set(language, spellChecker);
  return spellChecker;
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls)];
}

export function isCheckableLinkTarget(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:";
  }
  catch {
    return false;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  const escaped = escapeRegex(pattern).replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesCrawlRule(url: string, rule: CrawlRule): boolean {
  if (rule.matcher === "exact") {
    return url === rule.pattern;
  }

  if (rule.matcher === "prefix") {
    return url.startsWith(rule.pattern);
  }

  return globToRegExp(rule.pattern).test(url);
}

function evaluateCrawlRules(url: string, crawlRules: CrawlRules): {
  status: "included" | "excluded";
  matchedRule: CrawlRuleMatch | null;
} {
  const allowMatch = crawlRules.allow.find(rule => matchesCrawlRule(url, rule));
  const denyMatch = crawlRules.deny.find(rule => matchesCrawlRule(url, rule));

  if (denyMatch) {
    return {
      status: "excluded",
      matchedRule: {
        mode: "deny",
        matcher: denyMatch.matcher,
        pattern: denyMatch.pattern,
      },
    };
  }

  if (crawlRules.allow.length === 0) {
    return {
      status: "included",
      matchedRule: null,
    };
  }

  if (allowMatch) {
    return {
      status: "included",
      matchedRule: {
        mode: "allow",
        matcher: allowMatch.matcher,
        pattern: allowMatch.pattern,
      },
    };
  }

  return {
    status: "excluded",
    matchedRule: null,
  };
}

function sourceModeFromEntries(entries: DiscoveredCandidate[]): DiscoverySourceMode {
  const sources = new Set(entries.map(entry => entry.source));

  if (sources.has("sitemap") && sources.has("fallback")) {
    return "mixed";
  }

  if (sources.has("sitemap")) {
    return "sitemap";
  }

  return "fallback";
}

function normalizeDiscoveredUrl(candidate: string, context: SiteContext): string | null {
  try {
    const url = new URL(candidate, context.baseUrl);
    url.hash = "";
    if (url.host !== context.host) {
      return null;
    }

    if (url.pathname.endsWith("/") && url.pathname !== "/") {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  }
  catch {
    return null;
  }
}

export function redirectsAwayFromSite(candidate: string, context: Pick<SiteContext, "host">): boolean {
  try {
    return new URL(candidate).host !== context.host;
  }
  catch {
    return false;
  }
}

export function parseRobotsForSitemaps(robotsText: string, baseUrl: string): string[] {
  return dedupeUrls(
    robotsText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.toLowerCase().startsWith("sitemap:"))
      .map(line => line.slice(line.indexOf(":") + 1).trim())
      .map((value) => {
        try {
          return new URL(value, baseUrl).toString();
        }
        catch {
          return null;
        }
      })
      .filter((value): value is string => Boolean(value)),
  );
}

function arrayFromXmlNode(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value as Array<Record<string, unknown>>;
  }

  return value ? [value as Record<string, unknown>] : [];
}

export function parseSitemapXml(xml: string): { urls: string[]; sitemapIndexes: string[] } {
  const parsed = xmlParser.parse(xml) as {
    urlset?: { url?: Array<{ loc?: string }> | { loc?: string } };
    sitemapindex?: { sitemap?: Array<{ loc?: string }> | { loc?: string } };
  };

  const urls = arrayFromXmlNode(parsed.urlset?.url)
    .map(entry => typeof entry.loc === "string" ? entry.loc : null)
    .filter((entry): entry is string => Boolean(entry));

  const sitemapIndexes = arrayFromXmlNode(parsed.sitemapindex?.sitemap)
    .map(entry => typeof entry.loc === "string" ? entry.loc : null)
    .filter((entry): entry is string => Boolean(entry));

  return {
    urls,
    sitemapIndexes,
  };
}

export async function discoverSitemaps(baseUrl: string, fetchImpl: FetchLike = fetch): Promise<string[]> {
  const robotsUrl = new URL("/robots.txt", baseUrl).toString();
  const discovered = new Set<string>([
    new URL("/sitemap.xml", baseUrl).toString(),
    new URL("/sitemap_index.xml", baseUrl).toString(),
  ]);

  try {
    const response = await fetchImpl(robotsUrl);
    if (response.ok) {
      const text = await response.text();
      for (const sitemap of parseRobotsForSitemaps(text, baseUrl)) {
        discovered.add(sitemap);
      }
    }
  }
  catch {
    // Best effort only.
  }

  return [...discovered];
}

async function expandSitemapUrls(
  baseUrl: string,
  fetchImpl: FetchLike,
  events: AuditEventRecord[],
  onEvent?: (event: AuditEventRecord) => void | Promise<void>,
): Promise<string[]> {
  const queue = await discoverSitemaps(baseUrl, fetchImpl);
  const seen = new Set<string>();
  const pageUrls = new Set<string>();

  while (queue.length > 0) {
    const sitemapUrl = queue.shift();

    if (!sitemapUrl || seen.has(sitemapUrl)) {
      continue;
    }

    seen.add(sitemapUrl);
    await emit(events, "info", "Fetching sitemap", { sitemapUrl }, onEvent);

    try {
      const response = await fetchImpl(sitemapUrl);
      if (!response.ok) {
        await emit(events, "warning", "Sitemap fetch returned non-success status", {
          sitemapUrl,
          status: response.status,
        }, onEvent);
        continue;
      }

      const xml = await response.text();
      const parsed = parseSitemapXml(xml);
      for (const nextSitemap of parsed.sitemapIndexes) {
        queue.push(nextSitemap);
      }
      for (const url of parsed.urls) {
        try {
          const normalized = new URL(url, baseUrl);
          normalized.hash = "";
          pageUrls.add(normalized.toString());
        }
        catch {
          await emit(events, "warning", "Skipping invalid sitemap URL", { sitemapUrl, url }, onEvent);
        }
      }
    }
    catch (error) {
      await emit(events, "warning", "Sitemap fetch failed", {
        sitemapUrl,
        error: error instanceof Error ? error.message : "Unknown error",
      }, onEvent);
    }
  }

  return [...pageUrls];
}

function extractAnchorHrefs(html: string): string[] {
  const matches = html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi);
  return Array.from(matches, match => match[1]?.trim() ?? "")
    .filter(Boolean);
}

async function discoverFallbackUrls(
  baseUrl: string,
  fetchImpl: FetchLike,
  events: AuditEventRecord[],
  onEvent?: (event: AuditEventRecord) => void | Promise<void>,
): Promise<string[]> {
  await emit(events, "info", "No sitemap URLs discovered, using homepage fallback discovery", {
    baseUrl,
  }, onEvent);

  try {
    const response = await fetchImpl(baseUrl);
    if (!response.ok) {
      await emit(events, "warning", "Homepage fallback discovery returned non-success status", {
        baseUrl,
        status: response.status,
      }, onEvent);
      return [baseUrl];
    }

    const html = await response.text();
    const candidates = new Set<string>([baseUrl]);

    for (const href of extractAnchorHrefs(html)) {
      try {
        const normalized = new URL(href, baseUrl);
        normalized.hash = "";
        if (normalized.host === new URL(baseUrl).host) {
          if (normalized.pathname.endsWith("/") && normalized.pathname !== "/") {
            normalized.pathname = normalized.pathname.slice(0, -1);
          }
          candidates.add(normalized.toString());
        }
      }
      catch {
        // Ignore malformed fallback links.
      }
    }

    return [...candidates];
  }
  catch (error) {
    await emit(events, "warning", "Homepage fallback discovery failed", {
      baseUrl,
      error: error instanceof Error ? error.message : "Unknown error",
    }, onEvent);
    return [baseUrl];
  }
}

export async function discoverAuditCandidates(
  baseUrl: string,
  options: {
    fetchImpl?: FetchLike;
    events?: AuditEventRecord[];
    onEvent?: (event: AuditEventRecord) => void | Promise<void>;
  } = {},
): Promise<{
  generatedAt: string;
  hasSitemap: boolean;
  sitemapUrls: string[];
  entries: DiscoveredCandidate[];
  source: DiscoverySourceMode;
}> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const events = options.events ?? [];
  const normalizedBase = new URL(baseUrl).toString();
  const sitemapUrls = await expandSitemapUrls(normalizedBase, fetchImpl, events, options.onEvent);
  const seen = new Set<string>();
  const entries: DiscoveredCandidate[] = [];

  for (const url of sitemapUrls) {
    if (!seen.has(url)) {
      seen.add(url);
      entries.push({
        url,
        source: "sitemap",
      });
    }
  }

  if (!seen.has(normalizedBase)) {
    seen.add(normalizedBase);
    entries.push({
      url: normalizedBase,
      source: sitemapUrls.includes(normalizedBase) ? "sitemap" : "fallback",
    });
  }

  if (sitemapUrls.length === 0) {
    for (const url of await discoverFallbackUrls(normalizedBase, fetchImpl, events, options.onEvent)) {
      if (!seen.has(url)) {
        seen.add(url);
        entries.push({
          url,
          source: "fallback",
        });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    hasSitemap: sitemapUrls.length > 0,
    sitemapUrls,
    entries: entries.sort((left, right) => left.url.localeCompare(right.url)),
    source: sourceModeFromEntries(entries),
  };
}

export function buildDiscoveryPreview(
  candidates: {
    generatedAt: string;
    hasSitemap: boolean;
    sitemapUrls: string[];
    entries: DiscoveredCandidate[];
    source: DiscoverySourceMode;
  },
  crawlRules: CrawlRules = createEmptyCrawlRules(),
): DiscoveryPreview {
  const entries = candidates.entries.map((entry) => {
    const evaluation = evaluateCrawlRules(entry.url, crawlRules);
    return {
      url: entry.url,
      source: entry.source,
      status: evaluation.status,
      matchedRule: evaluation.matchedRule,
    };
  });

  return {
    generatedAt: candidates.generatedAt,
    hasSitemap: candidates.hasSitemap,
    source: candidates.source,
    total: entries.length,
    included: entries.filter(entry => entry.status === "included").length,
    excluded: entries.filter(entry => entry.status === "excluded").length,
    sitemapUrls: candidates.sitemapUrls,
    entries,
  };
}

export function buildDenySuggestions(preview: DiscoveryPreview): DenySuggestion[] {
  const heuristics: Array<{
    matcher: DenySuggestion["matcher"];
    pattern: string;
    reason: string;
    matches: (url: URL) => boolean;
  }> = [
    {
      matcher: "glob",
      pattern: "**/tag/**",
      reason: "WordPress tag archive URLs",
      matches: url => url.pathname.includes("/tag/"),
    },
    {
      matcher: "glob",
      pattern: "**/category/**",
      reason: "Category archive URLs",
      matches: url => url.pathname.includes("/category/"),
    },
    {
      matcher: "glob",
      pattern: "**/author/**",
      reason: "Author archive URLs",
      matches: url => url.pathname.includes("/author/"),
    },
    {
      matcher: "glob",
      pattern: "**/feed/**",
      reason: "Feed URLs",
      matches: url => url.pathname.includes("/feed/"),
    },
    {
      matcher: "glob",
      pattern: "**/feed",
      reason: "Feed endpoints",
      matches: url => url.pathname.endsWith("/feed"),
    },
    {
      matcher: "glob",
      pattern: "**/attachment/**",
      reason: "Attachment pages",
      matches: url => url.pathname.includes("/attachment/"),
    },
    {
      matcher: "glob",
      pattern: "**?replytocom=*",
      reason: "WordPress reply-to-comment URLs",
      matches: url => url.searchParams.has("replytocom"),
    },
    {
      matcher: "glob",
      pattern: "**?s=*",
      reason: "Search result URLs",
      matches: url => url.searchParams.has("s"),
    },
    {
      matcher: "glob",
      pattern: "**/page/*",
      reason: "Paginated archive URLs",
      matches: url => /\/page\/\d+\/?$/.test(url.pathname),
    },
  ];

  return heuristics.map((heuristic) => {
    const matches = preview.entries.filter((entry) => {
      try {
        return heuristic.matches(new URL(entry.url));
      }
      catch {
        return false;
      }
    });

    if (matches.length === 0) {
      return null;
    }

    return {
      matcher: heuristic.matcher,
      pattern: heuristic.pattern,
      reason: heuristic.reason,
      matchedCount: matches.length,
      exampleUrls: matches.slice(0, 5).map(entry => entry.url),
    } satisfies DenySuggestion;
  }).filter((suggestion): suggestion is DenySuggestion => Boolean(suggestion));
}

export function buildAllowSuggestions(preview: DiscoveryPreview): AllowSuggestion[] {
  const ignoredSegments = new Set([
    "attachment",
    "author",
    "category",
    "feed",
    "page",
    "tag",
    "wp-admin",
    "wp-json",
  ]);
  const suggestions = new Map<string, AllowSuggestion>();

  for (const entry of preview.entries) {
    try {
      const url = new URL(entry.url);
      if (url.search) {
        continue;
      }

      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length === 0) {
        continue;
      }

      const [firstSegment] = segments;
      if (!firstSegment) {
        continue;
      }
      if (ignoredSegments.has(firstSegment)) {
        continue;
      }

      const pattern = `${url.origin}/${firstSegment}`;
      const existing = suggestions.get(pattern);
      if (existing) {
        existing.matchedCount += 1;
        if (existing.exampleUrls.length < 5 && !existing.exampleUrls.includes(entry.url)) {
          existing.exampleUrls.push(entry.url);
        }
        continue;
      }

      suggestions.set(pattern, {
        matcher: "prefix",
        pattern,
        reason: `Common "${firstSegment}" section discovered in the sitemap`,
        matchedCount: 1,
        exampleUrls: [entry.url],
      });
    }
    catch {
      continue;
    }
  }

  return [...suggestions.values()]
    .filter(suggestion => suggestion.matchedCount >= 2)
    .sort((left, right) => right.matchedCount - left.matchedCount || left.pattern.localeCompare(right.pattern))
    .slice(0, 8);
}

function normalizeLighthouseTargets(baseUrl: string, extraTargets: LighthouseTargets = []): string[] {
  const homepage = new URL(baseUrl).toString();
  const targets = new Set<string>([homepage]);

  for (const target of extraTargets) {
    try {
      targets.add(new URL(target, homepage).toString());
    }
    catch {
      // Ignore invalid explicit targets.
    }
  }

  return [...targets];
}

async function runLighthouseAudit(url: string): Promise<LighthouseSummary["results"][number] | null> {
  const chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const runnerResult = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });
    const lhr = runnerResult?.lhr;

    if (!lhr) {
      return null;
    }

    const categoryScore = (name: "performance" | "accessibility" | "best-practices" | "seo") => {
      const score = lhr.categories[name]?.score;
      return typeof score === "number" ? Math.round(score * 100) : null;
    };
    const metricValue = (name: "first-contentful-paint" | "largest-contentful-paint" | "total-blocking-time" | "cumulative-layout-shift" | "speed-index") => {
      const value = lhr.audits[name]?.numericValue;
      return typeof value === "number" ? value : null;
    };

    return {
      url,
      performanceScore: categoryScore("performance"),
      accessibilityScore: categoryScore("accessibility"),
      bestPracticesScore: categoryScore("best-practices"),
      seoScore: categoryScore("seo"),
      firstContentfulPaintMs: metricValue("first-contentful-paint"),
      largestContentfulPaintMs: metricValue("largest-contentful-paint"),
      totalBlockingTimeMs: metricValue("total-blocking-time"),
      cumulativeLayoutShift: metricValue("cumulative-layout-shift"),
      speedIndexMs: metricValue("speed-index"),
      findings: extractLighthouseFindings(lhr),
    };
  }
  finally {
    await chrome.kill();
  }
}

export function extractLighthouseFindings(lhr: {
  audits?: Record<string, {
    id?: string;
    title?: string;
    description?: string;
    score?: number | null;
    scoreDisplayMode?: string;
    displayValue?: string;
    details?: unknown;
  }>;
  categories?: Record<string, {
    auditRefs?: Array<{ id?: string }>;
  }>;
}): NonNullable<LighthouseResult["findings"]> {
  const categoryOrder = ["performance", "accessibility", "best-practices", "seo"] as const;
  const findings: NonNullable<LighthouseResult["findings"]> = [];
  const seen = new Set<string>();

  for (const category of categoryOrder) {
    const auditRefs = lhr.categories?.[category]?.auditRefs ?? [];

    for (const ref of auditRefs) {
      const id = ref.id;
      if (!id || seen.has(id)) {
        continue;
      }

      const audit = lhr.audits?.[id];
      if (!audit?.title) {
        continue;
      }

      const mode = audit.scoreDisplayMode;
      if (mode === "manual" || mode === "notApplicable" || mode === "informative") {
        continue;
      }

      const score = typeof audit.score === "number" ? Math.round(audit.score * 100) : null;
      if (score !== null && score >= 100) {
        continue;
      }

      seen.add(id);
      findings.push({
        id,
        category,
        title: audit.title,
        description: audit.description ?? null,
        score,
        displayValue: audit.displayValue ?? null,
        targets: extractLighthouseTargets(audit.details),
      });
    }
  }

  return findings
    .sort((left, right) => {
      const leftScore = left.score ?? Number.POSITIVE_INFINITY;
      const rightScore = right.score ?? Number.POSITIVE_INFINITY;
      return leftScore - rightScore || left.title.localeCompare(right.title);
    })
    .slice(0, 12);
}

function pushUniqueTarget(
  targets: LighthouseFindingTarget[],
  target: LighthouseFindingTarget,
) {
  const key = JSON.stringify(target);
  if (targets.some(entry => JSON.stringify(entry) === key)) {
    return;
  }

  targets.push(target);
}

function maybeExtractNodeTarget(value: unknown): LighthouseFindingTarget | null {
  if (!value || typeof value !== "object" || (value as { type?: unknown }).type !== "node") {
    return null;
  }

  const node = value as {
    selector?: unknown;
    snippet?: unknown;
    nodeLabel?: unknown;
    path?: unknown;
    explanation?: unknown;
  };

  if (
    typeof node.selector !== "string"
    && typeof node.snippet !== "string"
    && typeof node.nodeLabel !== "string"
    && typeof node.path !== "string"
  ) {
    return null;
  }

  return {
    kind: "node",
    selector: typeof node.selector === "string" ? node.selector : null,
    snippet: typeof node.snippet === "string" ? node.snippet : null,
    nodeLabel: typeof node.nodeLabel === "string" ? node.nodeLabel : null,
    path: typeof node.path === "string" ? node.path : null,
    explanation: typeof node.explanation === "string" ? node.explanation : null,
  };
}

function maybeExtractSourceTarget(value: unknown): LighthouseFindingTarget | null {
  if (!value || typeof value !== "object" || (value as { type?: unknown }).type !== "source-location") {
    return null;
  }

  const source = value as {
    url?: unknown;
    line?: unknown;
    column?: unknown;
    original?: {
      file?: unknown;
      line?: unknown;
      column?: unknown;
    } | null;
  };

  if (typeof source.url !== "string") {
    return null;
  }

  return {
    kind: "source-location",
    url: source.url,
    line: typeof source.line === "number" ? source.line + 1 : null,
    column: typeof source.column === "number" ? source.column + 1 : null,
    originalFile: typeof source.original?.file === "string" ? source.original.file : null,
    originalLine: typeof source.original?.line === "number" ? source.original.line + 1 : null,
    originalColumn: typeof source.original?.column === "number" ? source.original.column + 1 : null,
  };
}

function maybeExtractUrlTarget(value: unknown): LighthouseFindingTarget | null {
  if (!value || typeof value !== "object" || (value as { type?: unknown }).type !== "url") {
    return null;
  }

  const urlValue = value as { value?: unknown };
  if (typeof urlValue.value !== "string") {
    return null;
  }

  return {
    kind: "url",
    url: urlValue.value,
  };
}

function walkLighthouseDetailValue(
  value: unknown,
  targets: LighthouseFindingTarget[],
) {
  if (!value || targets.length >= 8) {
    return;
  }

  const nodeTarget = maybeExtractNodeTarget(value);
  if (nodeTarget) {
    pushUniqueTarget(targets, nodeTarget);
  }

  const sourceTarget = maybeExtractSourceTarget(value);
  if (sourceTarget) {
    pushUniqueTarget(targets, sourceTarget);
  }

  const urlTarget = maybeExtractUrlTarget(value);
  if (urlTarget) {
    pushUniqueTarget(targets, urlTarget);
  }

  if (targets.length >= 8) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      walkLighthouseDetailValue(entry, targets);
      if (targets.length >= 8) {
        return;
      }
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  for (const nestedValue of Object.values(value)) {
    walkLighthouseDetailValue(nestedValue, targets);
    if (targets.length >= 8) {
      return;
    }
  }
}

function extractLighthouseTargets(details: unknown): LighthouseFindingTarget[] {
  const targets: LighthouseFindingTarget[] = [];
  walkLighthouseDetailValue(details, targets);
  return targets;
}

function buildAuditSummaryText(input: {
  pageCount: number;
  issueCount: number;
  brokenLinkCount: number;
  typoCount: number;
  seoIssueCount: number;
  crawledFromSitemap: number;
  lighthouse?: LighthouseSummary;
}) {
  const parts = [
    `Crawled ${input.pageCount} page${input.pageCount === 1 ? "" : "s"}`,
    input.crawledFromSitemap > 0
      ? `${input.crawledFromSitemap} from sitemap discovery`
      : "using homepage fallback discovery",
    `and found ${input.issueCount} issue${input.issueCount === 1 ? "" : "s"}`,
  ];

  const categories = [
    input.brokenLinkCount > 0 ? `${input.brokenLinkCount} broken link${input.brokenLinkCount === 1 ? "" : "s"}` : null,
    input.typoCount > 0 ? `${input.typoCount} typo warning${input.typoCount === 1 ? "" : "s"}` : null,
    input.seoIssueCount > 0 ? `${input.seoIssueCount} SEO issue${input.seoIssueCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  let summary = `${parts.join(" ")}.`;
  if (categories.length > 0) {
    summary += ` Main findings: ${categories.join(", ")}.`;
  }

  const homepageLighthouse = input.lighthouse?.results[0];
  if (homepageLighthouse?.performanceScore !== null && homepageLighthouse?.performanceScore !== undefined) {
    summary += ` Homepage Lighthouse performance score: ${homepageLighthouse.performanceScore}/100.`;
  }

  return summary;
}

function hashPage(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

function stripNonProseText(text: string): string {
  return text
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, " ")
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?/gi, " ")
    .replace(/(?<=^|\s)[.#][\w-]+/g, " ");
}

function tokenize(text: string): string[] {
  return stripNonProseText(text)
    .split(/[^A-Z']+/gi)
    .map(token => token.trim().toLowerCase())
    .filter(token => token.length >= 3);
}

function normalizeTypoAllowlist(words: string[]): Set<string> {
  return new Set(words.map(word => word.trim().toLowerCase()).filter(Boolean));
}

function extractTypoMatches(issue: AuditIssueRecord): TypoMatch[] {
  const rawWords = Array.isArray(issue.evidence?.words) ? issue.evidence.words : [];

  return rawWords
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          word: entry,
          suggestions: [],
        };
      }

      if (entry && typeof entry === "object" && typeof entry.word === "string") {
        return {
          word: entry.word,
          suggestions: Array.isArray(entry.suggestions)
            ? entry.suggestions.filter((suggestion: unknown): suggestion is string => typeof suggestion === "string").slice(0, 5)
            : [],
        };
      }

      return null;
    })
    .filter((entry): entry is TypoMatch => Boolean(entry?.word));
}

function rebuildTypoIssue(issue: AuditIssueRecord, matches: TypoMatch[]): AuditIssueRecord | null {
  if (matches.length === 0) {
    return null;
  }

  return {
    ...issue,
    message: `Potential misspellings were detected: ${matches.slice(0, 10).map(match => match.word).join(", ")}`,
    evidence: {
      words: matches.slice(0, 50),
    },
  };
}

function filterTypoIssuesByAllowlist(issues: AuditIssueRecord[], allowlist: string[]): AuditIssueRecord[] {
  const allowlistSet = normalizeTypoAllowlist(allowlist);

  return issues.flatMap((issue) => {
    if (issue.category !== "typo" || issue.code !== "possible_typos") {
      return [issue];
    }

    const matches = extractTypoMatches(issue)
      .filter(match => !allowlistSet.has(match.word.toLowerCase()));
    const rebuilt = rebuildTypoIssue(issue, matches);
    return rebuilt ? [rebuilt] : [];
  });
}

export async function detectTypos(
  text: string,
  language: TypoLanguage = "en",
  allowlist: string[] = [],
): Promise<TypoMatch[]> {
  const spell = await getSpellChecker(language);
  const uniqueWords = [...new Set(tokenize(text))];
  const localAllowlist = new Set(allowlist.map(word => word.toLowerCase()));

  return uniqueWords.flatMap((word) => {
    if (typoAllowList.has(word)) {
      return [];
    }

    if (/^[0-9-]+$/.test(word)) {
      return [];
    }

    if (localAllowlist.has(word)) {
      return [];
    }

    if (spell.correct(word)) {
      return [];
    }

    return [{
      word,
      suggestions: spell.suggest(word).slice(0, 5),
    }];
  });
}

async function extractPage(url: string, timeout: number): Promise<ExtractedPage> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout,
    });

    const extracted = await page.evaluate(() => {
      const textRoot = document.querySelector("main, article, [role=\"main\"]") ?? document.body;
      const clone = textRoot.cloneNode(true) as HTMLElement;
      for (const node of clone.querySelectorAll("nav, header, footer, aside, script, style, noscript, code, pre, svg, iframe, form, button, input, textarea, select")) {
        node.remove();
      }

      const title = document.title || null;
      const metaDescription = document.querySelector("meta[name=\"description\"]")?.getAttribute("content")?.trim() || null;
      const canonicalUrl = document.querySelector("link[rel=\"canonical\"]")?.getAttribute("href")?.trim() || null;
      const robotsMeta = document.querySelector("meta[name=\"robots\"]")?.getAttribute("content")?.trim() || null;
      const lang = document.documentElement.getAttribute("lang")?.trim() || null;
      const h1s = Array.from(document.querySelectorAll("h1"), heading => heading.textContent?.trim()).filter(Boolean) as string[];
      const structuredDataCount = document.querySelectorAll("script[type=\"application/ld+json\"], [itemscope]").length;
      const links = Array.from(document.querySelectorAll("a[href]"), anchor => ({
        href: anchor.getAttribute("href") ?? "",
        text: anchor.textContent?.trim() || null,
        nofollow: (anchor.getAttribute("rel") ?? "").toLowerCase().includes("nofollow"),
      }));
      const imageSourcesMissingAlt = [...document.querySelectorAll("img[src]")]
        .filter(image => !(image.getAttribute("alt") ?? "").trim())
        .map(image => image.getAttribute("src") ?? "");
      const measurementRoot = document.createElement("div");
      measurementRoot.style.position = "fixed";
      measurementRoot.style.left = "-99999px";
      measurementRoot.style.top = "0";
      measurementRoot.style.width = "1px";
      measurementRoot.style.height = "1px";
      measurementRoot.style.opacity = "0";
      measurementRoot.style.pointerEvents = "none";
      measurementRoot.style.overflow = "hidden";
      measurementRoot.append(clone);
      document.body.append(measurementRoot);

      // eslint-disable-next-line unicorn/prefer-dom-node-text-content
      const visibleText = (clone.innerText || clone.textContent || "").replace(/\s+/g, " ").trim();

      measurementRoot.remove();

      return {
        title,
        metaDescription,
        canonicalUrl,
        robotsMeta,
        lang,
        h1s,
        structuredDataCount,
        links,
        imageSourcesMissingAlt,
        visibleText,
      };
    });

    await context.close();

    return {
      finalUrl: page.url(),
      httpStatus: response?.status() ?? null,
      ...extracted,
    };
  }
  finally {
    await browser.close();
  }
}

async function checkUrl(targetUrl: string, fetchImpl: FetchLike): Promise<number | null> {
  if (!isCheckableLinkTarget(targetUrl)) {
    return null;
  }

  try {
    const headResponse = await fetchImpl(targetUrl, {
      method: "HEAD",
      redirect: "follow",
    });
    if (headResponse.status === 405 || headResponse.status === 501) {
      const getResponse = await fetchImpl(targetUrl, {
        method: "GET",
        redirect: "follow",
      });
      return getResponse.status;
    }

    return headResponse.status;
  }
  catch {
    try {
      const response = await fetchImpl(targetUrl, {
        method: "GET",
        redirect: "follow",
      });
      return response.status;
    }
    catch {
      return null;
    }
  }
}

function buildPageIssues(pageUrl: string, extracted: ExtractedPage, typoMatches: TypoMatch[]): AuditIssueRecord[] {
  const issues: AuditIssueRecord[] = [];

  if (!extracted.title) {
    issues.push({
      pageUrl,
      category: "seo",
      code: "missing_title",
      severity: "error",
      title: "Missing page title",
      message: "The page does not define a <title> element.",
    });
  }

  if (!extracted.metaDescription) {
    issues.push({
      pageUrl,
      category: "seo",
      code: "missing_meta_description",
      severity: "warning",
      title: "Missing meta description",
      message: "The page does not define a meta description.",
    });
  }
  else if (extracted.metaDescription.length > 160) {
    issues.push({
      pageUrl,
      category: "seo",
      code: "long_meta_description",
      severity: "info",
      title: "Long meta description",
      message: "The meta description is longer than 160 characters.",
      evidence: {
        length: extracted.metaDescription.length,
      },
    });
  }

  if (extracted.h1s.length === 0) {
    issues.push({
      pageUrl,
      category: "seo",
      code: "missing_h1",
      severity: "warning",
      title: "Missing H1",
      message: "The page does not include a visible H1 heading.",
    });
  }
  else if (extracted.h1s.length > 1) {
    issues.push({
      pageUrl,
      category: "seo",
      code: "multiple_h1",
      severity: "info",
      title: "Multiple H1 headings",
      message: "More than one H1 heading was found.",
      evidence: {
        count: extracted.h1s.length,
      },
    });
  }

  if (!extracted.lang) {
    issues.push({
      pageUrl,
      category: "seo",
      code: "missing_lang",
      severity: "warning",
      title: "Missing lang attribute",
      message: "The page does not define a document language.",
    });
  }

  if (!extracted.canonicalUrl) {
    issues.push({
      pageUrl,
      category: "seo",
      code: "missing_canonical",
      severity: "warning",
      title: "Missing canonical URL",
      message: "The page does not define a canonical link.",
    });
  }

  if (extracted.robotsMeta?.toLowerCase().includes("noindex")) {
    issues.push({
      pageUrl,
      category: "seo",
      code: "noindex",
      severity: "info",
      title: "Page marked as noindex",
      message: "The page includes a noindex directive in its robots meta tag.",
      evidence: {
        robotsMeta: extracted.robotsMeta,
      },
    });
  }

  if (extracted.structuredDataCount === 0) {
    issues.push({
      pageUrl,
      category: "seo",
      code: "missing_structured_data",
      severity: "info",
      title: "Missing structured data",
      message: "No structured data markup was detected on the page.",
    });
  }

  if (extracted.imageSourcesMissingAlt.length > 0) {
    issues.push({
      pageUrl,
      category: "seo",
      code: "missing_image_alt",
      severity: "warning",
      title: "Images missing alt text",
      message: `${extracted.imageSourcesMissingAlt.length} image(s) are missing alt text.`,
      evidence: {
        images: extracted.imageSourcesMissingAlt,
      },
    });
  }

  if (typoMatches.length > 0) {
    issues.push({
      pageUrl,
      category: "typo",
      code: "possible_typos",
      severity: "warning",
      title: "Possible typos detected",
      message: `Potential misspellings were detected: ${typoMatches.slice(0, 10).map(match => match.word).join(", ")}`,
      evidence: {
        words: typoMatches.slice(0, 50),
      },
    });
  }

  return issues;
}

export function buildDuplicateContentIssues(pages: AuditPageRecord[]): AuditIssueRecord[] {
  const issues: AuditIssueRecord[] = [];
  const titleMap = new Map<string, string[]>();
  const descriptionMap = new Map<string, string[]>();

  for (const page of pages) {
    if (page.title) {
      titleMap.set(page.title, [...new Set([...(titleMap.get(page.title) ?? []), page.url])]);
    }
    if (page.metaDescription) {
      descriptionMap.set(page.metaDescription, [...new Set([...(descriptionMap.get(page.metaDescription) ?? []), page.url])]);
    }
  }

  for (const [title, urls] of titleMap) {
    if (urls.length > 1) {
      issues.push({
        category: "seo",
        code: "duplicate_title",
        severity: "warning",
        title: "Duplicate page title",
        message: `The title "${title}" is shared by ${urls.length} pages.`,
        evidence: {
          title,
          urls,
        },
      });
    }
  }

  for (const [description, urls] of descriptionMap) {
    if (urls.length > 1) {
      for (const url of urls) {
        issues.push({
          pageUrl: url,
          category: "seo",
          code: "duplicate_meta_description",
          severity: "info",
          title: "Duplicate meta description",
          message: `The meta description "${description}" is shared by ${urls.length} pages.`,
          evidence: {
            urls,
          },
        });
      }
    }
  }

  return issues;
}

async function analysePage(
  item: QueueItem,
  context: SiteContext,
  config: AuditConfig,
  crawlRules: CrawlRules,
  typoLanguage: TypoLanguage,
  typoAllowlist: string[],
): Promise<PageAnalysis> {
  const extracted = await extractPage(item.url, config.pageTimeoutMs);
  const normalizedFinalUrl = normalizeDiscoveredUrl(extracted.finalUrl, context);
  const pageUrl = normalizedFinalUrl ?? item.url;

  if (!normalizedFinalUrl && redirectsAwayFromSite(extracted.finalUrl, context)) {
    return {
      page: {
        url: item.url,
        canonicalUrl: null,
        httpStatus: extracted.httpStatus,
        depth: item.depth,
        fromSitemap: item.fromSitemap,
        title: null,
        metaDescription: null,
        h1: null,
        wordCount: 0,
        renderedAt: new Date().toISOString(),
        pageDigest: hashPage(`${item.url}|${extracted.finalUrl}`),
      },
      links: [],
      issues: [
        {
          pageUrl: item.url,
          category: "crawl",
          code: "redirected_offsite",
          severity: "info",
          title: "Redirected off-site",
          message: `The URL redirected to ${extracted.finalUrl}, which is outside the audited host, so the destination page was not analyzed.`,
          evidence: {
            requestedUrl: item.url,
            finalUrl: extracted.finalUrl,
            status: extracted.httpStatus,
          },
        },
      ],
      discoveredUrls: [],
    };
  }

  const typoMatches = await detectTypos(extracted.visibleText, typoLanguage, typoAllowlist);
  const issues = buildPageIssues(pageUrl, extracted, typoMatches);

  const links: AuditLinkRecord[] = [];
  const discoveredUrls: QueueItem[] = [];

  for (const link of extracted.links) {
    const normalized = normalizeDiscoveredUrl(link.href, context);
    if (normalized) {
      const evaluation = evaluateCrawlRules(normalized, crawlRules);
      if (evaluation.status === "excluded") {
        continue;
      }

      links.push({
        sourceUrl: pageUrl,
        targetUrl: normalized,
        targetType: "internal",
        httpStatus: null,
        isBroken: false,
        anchorText: link.text,
        nofollow: link.nofollow,
      });

      if (!link.nofollow) {
        discoveredUrls.push({
          url: normalized,
          depth: item.depth + 1,
          fromSitemap: false,
        });
      }
      continue;
    }

    try {
      const external = new URL(link.href, pageUrl).toString();
      if (!isCheckableLinkTarget(external)) {
        continue;
      }

      links.push({
        sourceUrl: pageUrl,
        targetUrl: external,
        targetType: "external",
        httpStatus: null,
        isBroken: false,
        anchorText: link.text,
        nofollow: link.nofollow,
      });
    }
    catch {
      issues.push({
        pageUrl,
        category: "broken_link",
        code: "invalid_link",
        severity: "warning",
        title: "Invalid link URL",
        message: `A link could not be parsed: ${link.href}`,
      });
    }
  }

  if (extracted.canonicalUrl) {
    const canonicalTarget = (() => {
      try {
        return new URL(extracted.canonicalUrl, pageUrl).toString();
      }
      catch {
        return extracted.canonicalUrl;
      }
    })();

    if (
      isCheckableLinkTarget(canonicalTarget)
      && (
        !normalizeDiscoveredUrl(canonicalTarget, context)
        || evaluateCrawlRules(canonicalTarget, crawlRules).status === "included"
      )
    ) {
      links.push({
        sourceUrl: pageUrl,
        targetUrl: canonicalTarget,
        targetType: "canonical",
        httpStatus: null,
        isBroken: false,
        anchorText: null,
        nofollow: false,
      });
    }
  }

  return {
    page: {
      url: pageUrl,
      canonicalUrl: extracted.canonicalUrl ? new URL(extracted.canonicalUrl, pageUrl).toString() : null,
      httpStatus: extracted.httpStatus,
      depth: item.depth,
      fromSitemap: item.fromSitemap,
      title: extracted.title,
      metaDescription: extracted.metaDescription,
      h1: extracted.h1s[0] ?? null,
      wordCount: tokenize(extracted.visibleText).length,
      renderedAt: new Date().toISOString(),
      pageDigest: hashPage([
        extracted.title ?? "",
        extracted.metaDescription ?? "",
        extracted.visibleText,
      ].join("|")),
    },
    links,
    issues,
    discoveredUrls,
  };
}

function markBrokenLinkIssues(links: AuditLinkRecord[]): AuditIssueRecord[] {
  return links
    .filter(link => link.isBroken)
    .map(link => ({
      pageUrl: link.sourceUrl,
      category: "broken_link" as const,
      code: "broken_link",
      severity: link.targetType === "internal" || link.targetType === "canonical" ? "error" : "warning",
      title: "Broken link detected",
      message: `${link.targetUrl} returned ${link.httpStatus ?? "no response"}.`,
      evidence: {
        targetType: link.targetType,
        status: link.httpStatus,
      },
    }));
}

function markCanonicalIssues(links: AuditLinkRecord[]): AuditIssueRecord[] {
  return links
    .filter(link => link.targetType === "canonical" && link.isBroken)
    .map(link => ({
      pageUrl: link.sourceUrl,
      category: "seo" as const,
      code: "broken_canonical",
      severity: "warning",
      title: "Broken canonical target",
      message: `The canonical target ${link.targetUrl} returned ${link.httpStatus ?? "no response"}.`,
    }));
}

function buildSummary(
  pages: AuditPageRecord[],
  issues: AuditIssueRecord[],
  checkedLinks: number,
  maxPagesReached: boolean,
  maxDepthReached: boolean,
  meta: Partial<Pick<AuditSummary, "auditSummary" | "lighthouse">> = {},
): AuditSummary {
  return {
    completedWithLimits: maxPagesReached || maxDepthReached,
    maxPagesReached,
    maxDepthReached,
    crawledFromSitemap: pages.filter(page => page.fromSitemap).length,
    uniqueInternalPages: pages.length,
    checkedLinks,
    duplicateTitles: issues.filter(issue => issue.code === "duplicate_title").length,
    duplicateDescriptions: issues.filter(issue => issue.code === "duplicate_meta_description").length,
    ...meta,
  };
}

export async function runAudit(
  baseUrl: string,
  config: AuditConfig,
  options: {
    fetchImpl?: FetchLike;
    onEvent?: (event: AuditEventRecord) => void | Promise<void>;
    onProgress?: (progress: AuditProgress) => void | Promise<void>;
    shouldCancel?: () => boolean | Promise<boolean>;
    getTypoAllowlist?: () => string[] | Promise<string[]>;
    crawlRules?: CrawlRules;
    discovery?: DiscoveryPreview;
    lighthouseTargets?: LighthouseTargets;
    typoLanguage?: TypoLanguage;
  } = {},
): Promise<AuditEngineResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const normalizedBase = new URL(baseUrl).toString();
  const crawlRules = options.crawlRules ?? createEmptyCrawlRules();
  const explicitLighthouseTargets = options.lighthouseTargets ?? [];
  const typoLanguage = options.typoLanguage ?? "en";
  const siteContext: SiteContext = {
    baseUrl: normalizedBase,
    baseOrigin: new URL(normalizedBase).origin,
    host: new URL(normalizedBase).host,
  };

  const events: AuditEventRecord[] = [];
  const pages: AuditPageRecord[] = [];
  const links: AuditLinkRecord[] = [];
  const issues: AuditIssueRecord[] = [];
  let maxPagesReached = false;
  let maxDepthReached = false;
  let checkedLinks = 0;

  async function getCurrentTypoAllowlist() {
    return options.getTypoAllowlist ? await options.getTypoAllowlist() : [];
  }

  async function buildCancelledResult(stage: AuditProgress["stage"], currentUrl?: string): Promise<AuditEngineResult> {
    const filteredIssues = filterTypoIssuesByAllowlist(issues, await getCurrentTypoAllowlist());
    await emit(events, "warning", "Audit cancelled", {
      stage,
      currentUrl,
      pages: pages.length,
      issues: filteredIssues.length,
      checkedLinks,
    }, options.onEvent);
    await options.onProgress?.({
      stage: "cancelled",
      currentUrl,
      pagesCrawled: pages.length,
      issuesFound: issues.length,
      linksChecked: checkedLinks,
      queueSize: 0,
    });

    return {
      status: "cancelled",
      summary: buildSummary(pages, filteredIssues, checkedLinks, maxPagesReached, maxDepthReached),
      pages,
      links,
      issues: filteredIssues,
      events,
    };
  }

  async function shouldCancel(stage: AuditProgress["stage"], currentUrl?: string) {
    if (!await options.shouldCancel?.()) {
      return null;
    }

    return buildCancelledResult(stage, currentUrl);
  }

  await emit(events, "info", "Audit started", { baseUrl: normalizedBase }, options.onEvent);
  await options.onProgress?.({
    stage: "starting",
    pagesCrawled: 0,
    issuesFound: 0,
    linksChecked: 0,
    queueSize: 1,
  });

  const discovery = options.discovery ?? buildDiscoveryPreview(
    await discoverAuditCandidates(normalizedBase, {
      fetchImpl,
      events,
      onEvent: options.onEvent,
    }),
    crawlRules,
  );
  const includedEntries = discovery.entries.filter(entry => entry.status === "included");
  const cancelledAfterSitemaps = await shouldCancel("sitemap");
  if (cancelledAfterSitemaps) {
    return cancelledAfterSitemaps;
  }
  await options.onProgress?.({
    stage: "sitemap",
    pagesCrawled: 0,
    issuesFound: 0,
    linksChecked: 0,
    queueSize: includedEntries.length,
  });
  const queue: QueueItem[] = includedEntries.map(entry => ({
    url: entry.url,
    depth: 0,
    fromSitemap: entry.source === "sitemap",
  }));

  const visited = new Set<string>();
  const queued = new Set(queue.map(item => item.url));
  const recordedPages = new Set<string>();
  const browserLimit = pLimit(config.browserConcurrency);

  while (queue.length > 0 && pages.length < config.maxPages) {
    const cancelledBeforeBatch = await shouldCancel("crawl", queue[0]?.url);
    if (cancelledBeforeBatch) {
      return cancelledBeforeBatch;
    }

    const batch = queue.splice(0, config.browserConcurrency);
    const analyses = await Promise.all(batch.map(item => browserLimit(async () => {
      if (await options.shouldCancel?.()) {
        return null;
      }

      if (visited.has(item.url)) {
        return null;
      }
      visited.add(item.url);

      if (item.depth > config.maxDepth) {
        maxDepthReached = true;
        return null;
      }

      await emit(events, "info", "Rendering page", { url: item.url, depth: item.depth }, options.onEvent);

      try {
        return await analysePage(
          item,
          siteContext,
          config,
          crawlRules,
          typoLanguage,
          await getCurrentTypoAllowlist(),
        );
      }
      catch (error) {
        issues.push({
          pageUrl: item.url,
          category: "crawl",
          code: "page_render_failed",
          severity: "error",
          title: "Page render failed",
          message: error instanceof Error ? error.message : "Unknown rendering error",
        });
        await emit(events, "error", "Page render failed", {
          url: item.url,
          error: error instanceof Error ? error.message : "Unknown error",
        }, options.onEvent);
        return null;
      }
    })));

    for (const analysis of analyses) {
      if (!analysis) {
        continue;
      }

      if (recordedPages.has(analysis.page.url)) {
        continue;
      }

      recordedPages.add(analysis.page.url);
      pages.push(analysis.page);
      links.push(...analysis.links);
      issues.push(...analysis.issues);

      for (const discovered of analysis.discoveredUrls) {
        if (discovered.depth > config.maxDepth) {
          maxDepthReached = true;
          continue;
        }

        if (!visited.has(discovered.url) && !queued.has(discovered.url)) {
          queued.add(discovered.url);
          queue.push(discovered);
        }
      }
    }

    await options.onProgress?.({
      stage: "crawl",
      currentUrl: batch.at(-1)?.url,
      pagesCrawled: pages.length,
      issuesFound: issues.length,
      linksChecked: 0,
      queueSize: queue.length,
    });

    const cancelledAfterBatch = await shouldCancel("crawl", batch.at(-1)?.url);
    if (cancelledAfterBatch) {
      return cancelledAfterBatch;
    }

    if (pages.length >= config.maxPages && queue.length > 0) {
      maxPagesReached = true;
    }
  }

  const uniqueLinks = dedupeUrls(links.map(link => link.targetUrl));
  const linkStatusMap = new Map<string, number | null>();
  const linkLimit = pLimit(config.linkConcurrency);

  for (let index = 0; index < uniqueLinks.length; index += config.linkConcurrency) {
    const batch = uniqueLinks.slice(index, index + config.linkConcurrency);
    const cancelledBeforeBatch = await shouldCancel("link_check", batch[0]);
    if (cancelledBeforeBatch) {
      return cancelledBeforeBatch;
    }

    await Promise.all(batch.map(url => linkLimit(async () => {
      linkStatusMap.set(url, await checkUrl(url, fetchImpl));
      checkedLinks += 1;
    })));

    await options.onProgress?.({
      stage: "link_check",
      currentUrl: batch.at(-1),
      pagesCrawled: pages.length,
      issuesFound: issues.length,
      linksChecked: checkedLinks,
      queueSize: Math.max(uniqueLinks.length - checkedLinks, 0),
    });
  }

  for (const link of links) {
    const status = linkStatusMap.get(link.targetUrl) ?? null;
    link.httpStatus = status;
    link.isBroken = status === null || status >= 400;
  }

  issues.push(...buildDuplicateContentIssues(pages));
  issues.push(...markBrokenLinkIssues(links));
  issues.push(...markCanonicalIssues(links));

  const filteredIssues = filterTypoIssuesByAllowlist(issues, await getCurrentTypoAllowlist());

  let lighthouseSummary: LighthouseSummary | undefined;
  const lighthouseTargets = normalizeLighthouseTargets(normalizedBase, explicitLighthouseTargets);
  if (lighthouseTargets.length > 0) {
    const results: LighthouseSummary["results"] = [];
    await emit(events, "info", "Starting Lighthouse audits", {
      targets: lighthouseTargets,
    }, options.onEvent);

    for (const target of lighthouseTargets) {
      const cancelledBeforeLighthouse = await shouldCancel("lighthouse", target);
      if (cancelledBeforeLighthouse) {
        return cancelledBeforeLighthouse;
      }

      await options.onProgress?.({
        stage: "lighthouse",
        currentUrl: target,
        pagesCrawled: pages.length,
        issuesFound: issues.length,
        linksChecked: uniqueLinks.length,
        queueSize: Math.max(lighthouseTargets.length - results.length, 0),
      });

      try {
        const result = await runLighthouseAudit(target);
        if (result) {
          results.push(result);
        }
      }
      catch (error) {
        await emit(events, "warning", "Lighthouse audit failed", {
          target,
          error: error instanceof Error ? error.message : "Unknown error",
        }, options.onEvent);
      }
    }

    lighthouseSummary = {
      pagesAudited: results.length,
      results,
    };
  }

  const sitemapMisses = discovery.sitemapUrls
    .filter(url => evaluateCrawlRules(url, crawlRules).status === "included")
    .filter(url => !pages.some(page => page.url === url));
  if (sitemapMisses.length > 0) {
    filteredIssues.push({
      category: "seo",
      code: "sitemap_inconsistency",
      severity: "info",
      title: "Sitemap URLs were not crawled",
      message: `${sitemapMisses.length} sitemap URLs were discovered but not crawled.`,
      evidence: {
        urls: sitemapMisses.slice(0, 100),
      },
    });
  }

  const brokenLinkCount = links.filter(link => link.isBroken).length;
  const typoCount = filteredIssues.filter(issue => issue.category === "typo").length;
  const seoIssueCount = filteredIssues.filter(issue => issue.category === "seo").length;
  const summary = buildSummary(pages, filteredIssues, uniqueLinks.length, maxPagesReached, maxDepthReached, {
    lighthouse: lighthouseSummary,
  });
  summary.auditSummary = buildAuditSummaryText({
    pageCount: pages.length,
    issueCount: filteredIssues.length,
    brokenLinkCount,
    typoCount,
    seoIssueCount,
    crawledFromSitemap: summary.crawledFromSitemap,
    lighthouse: lighthouseSummary,
  });

  await emit(events, "info", "Audit completed", {
    pages: pages.length,
    issues: filteredIssues.length,
    status: summary.completedWithLimits ? "completed_with_limits" : "completed",
  }, options.onEvent);
  await options.onProgress?.({
    stage: "complete",
    pagesCrawled: pages.length,
    issuesFound: filteredIssues.length,
    linksChecked: uniqueLinks.length,
    queueSize: 0,
  });

  return {
    status: summary.completedWithLimits ? "completed_with_limits" : "completed",
    summary,
    pages,
    links,
    issues: filteredIssues,
    events,
  };
}
