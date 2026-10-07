import type {
  ApiTokenScope,
  AuditEngineResult,
  AuditRunStatus,
  AuditSummary,
  CrawlRules,
  DiscoveryPreview,
  LighthouseTargets,
  LinkIgnore,
  SessionUser,
  TypoLanguage,
  UserRole,
} from "@website-auditor/shared";

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { apiTokenScopesSchema, createEmptyCrawlRules, isLinkIgnored, linkIgnoresSchema, typoAllowlistSchema } from "@website-auditor/shared";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  apiTokens,
  auditEvents,
  auditIssues,
  auditLinks,
  auditPages,
  auditRuns,
  sessions,
  users,
  websites,
} from "./schema.js";

let pool: Pool | undefined;
let database: NodePgDatabase | undefined;

function now(): Date {
  return new Date();
}

export function getDb(): NodePgDatabase {
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  database ??= drizzle(pool);
  return database;
}

function createId(): string {
  return randomUUID();
}

function mergeSummaryJson(
  current: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
) {
  const currentProgress = current?.progress && typeof current.progress === "object"
    ? current.progress as Record<string, unknown>
    : {};
  const nextProgress = next.progress && typeof next.progress === "object"
    ? next.progress as Record<string, unknown>
    : undefined;

  return {
    ...(current ?? {}),
    ...next,
    ...(nextProgress
      ? {
          progress: {
            ...currentProgress,
            ...nextProgress,
          },
        }
      : {}),
  };
}

function buildAuditSummaryText(input: {
  pageCount: number;
  issueCount: number;
  brokenLinkCount: number;
  typoCount: number;
  seoIssueCount: number;
  crawledFromSitemap: number;
  lighthouse?: {
    results?: Array<{ performanceScore?: number | null }>;
  };
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

  const homepageLighthouse = input.lighthouse?.results?.[0];
  if (homepageLighthouse?.performanceScore !== null && homepageLighthouse?.performanceScore !== undefined) {
    summary += ` Homepage Lighthouse performance score: ${homepageLighthouse.performanceScore}/100.`;
  }

  return summary;
}

export async function listUsers() {
  return getDb().select({
    id: users.id,
    username: users.username,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  }).from(users).orderBy(users.username);
}

export async function findUserByUsername(username: string) {
  const [user] = await getDb().select().from(users).where(eq(users.username, username));
  return user ?? null;
}

export async function findUserById(id: string) {
  const [user] = await getDb().select().from(users).where(eq(users.id, id));
  return user ?? null;
}

export async function hasAdminUser(): Promise<boolean> {
  const [admin] = await getDb().select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  return Boolean(admin);
}

export async function createUser(input: {
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive?: boolean;
}) {
  const createdAt = now();
  const [user] = await getDb().insert(users).values({
    id: createId(),
    username: input.username,
    passwordHash: input.passwordHash,
    role: input.role,
    isActive: input.isActive ?? true,
    createdAt,
    updatedAt: createdAt,
  }).returning();

  if (!user) {
    throw new Error("Failed to create user.");
  }

  return user;
}

export async function updateUser(
  id: string,
  changes: Partial<{ role: UserRole; isActive: boolean; passwordHash: string }>,
) {
  const [user] = await getDb().update(users).set({
    ...changes,
    updatedAt: now(),
  }).where(eq(users.id, id)).returning({
    id: users.id,
    username: users.username,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  });

  return user ?? null;
}

export async function createSession(userId: string, expiresAt: Date) {
  const createdAt = now();
  const [session] = await getDb().insert(sessions).values({
    id: createId(),
    userId,
    expiresAt,
    createdAt,
    lastSeenAt: createdAt,
  }).returning();

  if (!session) {
    throw new Error("Failed to create session.");
  }

  return session;
}

export async function getSessionUser(sessionId: string): Promise<SessionUser | null> {
  const [record] = await getDb().select({
    sessionId: sessions.id,
    expiresAt: sessions.expiresAt,
    id: users.id,
    username: users.username,
    role: users.role,
    isActive: users.isActive,
  }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(eq(sessions.id, sessionId));

  if (!record || !record.isActive || record.expiresAt.getTime() < Date.now()) {
    return null;
  }

  await getDb().update(sessions).set({
    lastSeenAt: now(),
  }).where(eq(sessions.id, sessionId));

  return {
    id: record.id,
    username: record.username,
    role: record.role as UserRole,
  };
}

export async function deleteSession(sessionId: string) {
  await getDb().delete(sessions).where(eq(sessions.id, sessionId));
}

const apiTokenLastUsedResolutionMs = 60_000;

function selectApiTokens() {
  return getDb().select({
    id: apiTokens.id,
    userId: apiTokens.userId,
    username: users.username,
    ownerIsActive: users.isActive,
    name: apiTokens.name,
    prefix: apiTokens.prefix,
    scopesJson: apiTokens.scopesJson,
    expiresAt: apiTokens.expiresAt,
    lastUsedAt: apiTokens.lastUsedAt,
    revokedAt: apiTokens.revokedAt,
    createdAt: apiTokens.createdAt,
  }).from(apiTokens).innerJoin(users, eq(apiTokens.userId, users.id));
}

function toApiTokenRecord({ scopesJson, ...row }: Awaited<ReturnType<typeof selectApiTokens>>[number]) {
  return { ...row, scopes: apiTokenScopesSchema.catch([]).parse(scopesJson) };
}

export async function listApiTokens(userId?: string) {
  const rows = await selectApiTokens()
    .where(userId ? eq(apiTokens.userId, userId) : undefined)
    .orderBy(desc(apiTokens.createdAt));
  return rows.map(toApiTokenRecord);
}

export async function getApiToken(id: string) {
  const [row] = await selectApiTokens().where(eq(apiTokens.id, id));
  return row ? toApiTokenRecord(row) : null;
}

export async function createApiToken(input: {
  userId: string;
  name: string;
  prefix: string;
  tokenHash: string;
  scopes: ApiTokenScope[];
  expiresAt: Date | null;
}) {
  const id = createId();
  await getDb().insert(apiTokens).values({
    id,
    userId: input.userId,
    name: input.name,
    prefix: input.prefix,
    tokenHash: input.tokenHash,
    scopesJson: input.scopes,
    expiresAt: input.expiresAt,
    createdAt: now(),
  });

  const token = await getApiToken(id);
  if (!token) {
    throw new Error("Failed to create API token.");
  }

  return token;
}

export async function revokeApiToken(id: string) {
  await getDb().update(apiTokens).set({ revokedAt: now() }).where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt)));
}

export async function getApiTokenUser(tokenHash: string): Promise<{ user: SessionUser; scopes: ApiTokenScope[] } | null> {
  const [record] = await getDb().select({
    tokenId: apiTokens.id,
    scopesJson: apiTokens.scopesJson,
    expiresAt: apiTokens.expiresAt,
    lastUsedAt: apiTokens.lastUsedAt,
    revokedAt: apiTokens.revokedAt,
    id: users.id,
    username: users.username,
    role: users.role,
    isActive: users.isActive,
  }).from(apiTokens).innerJoin(users, eq(apiTokens.userId, users.id)).where(eq(apiTokens.tokenHash, tokenHash));

  if (!record || !record.isActive || record.revokedAt || (record.expiresAt && record.expiresAt.getTime() < Date.now())) {
    return null;
  }

  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > apiTokenLastUsedResolutionMs) {
    await getDb().update(apiTokens).set({ lastUsedAt: now() }).where(eq(apiTokens.id, record.tokenId));
  }

  return {
    user: {
      id: record.id,
      username: record.username,
      role: record.role as UserRole,
    },
    scopes: apiTokenScopesSchema.catch([]).parse(record.scopesJson),
  };
}

const completedRunStatuses = ["completed", "completed_with_limits"];

export interface SeverityCounts {
  error: number;
  warning: number;
  info: number;
}

export async function countIssuesBySeverity(runIds: string[]): Promise<Map<string, SeverityCounts>> {
  const counts = new Map<string, SeverityCounts>(runIds.map(id => [id, { error: 0, warning: 0, info: 0 }]));
  if (runIds.length === 0) {
    return counts;
  }

  const rows = await getDb().select({
    auditRunId: auditIssues.auditRunId,
    severity: auditIssues.severity,
    count: sql<number>`count(*)::int`,
  }).from(auditIssues).where(inArray(auditIssues.auditRunId, runIds)).groupBy(auditIssues.auditRunId, auditIssues.severity);

  for (const row of rows) {
    const entry = counts.get(row.auditRunId);
    if (entry && (row.severity === "error" || row.severity === "warning" || row.severity === "info")) {
      entry[row.severity] = row.count;
    }
  }

  return counts;
}

export async function listWebsites() {
  const rows = await getDb().select({
    id: websites.id,
    name: websites.name,
    baseUrl: websites.baseUrl,
    normalizedHost: websites.normalizedHost,
    typoLanguage: websites.typoLanguage,
    typoAllowlistJson: websites.typoAllowlistJson,
    crawlRulesJson: websites.crawlRulesJson,
    lighthouseTargetsJson: websites.lighthouseTargetsJson,
    isActive: websites.isActive,
    createdAt: websites.createdAt,
    updatedAt: websites.updatedAt,
    lastAuditRunId: websites.lastAuditRunId,
    lastAuditStatus: auditRuns.status,
    lastAuditFinishedAt: auditRuns.finishedAt,
    pageCount: auditRuns.pageCount,
    issueCount: auditRuns.issueCount,
    brokenLinkCount: auditRuns.brokenLinkCount,
    typoCount: auditRuns.typoCount,
    seoIssueCount: auditRuns.seoIssueCount,
  }).from(websites).leftJoin(auditRuns, eq(websites.lastAuditRunId, auditRuns.id)).orderBy(websites.name);

  const completedRuns = await getDb().select({
    id: auditRuns.id,
    websiteId: auditRuns.websiteId,
    finishedAt: auditRuns.finishedAt,
  }).from(auditRuns).where(inArray(auditRuns.status, completedRunStatuses)).orderBy(desc(auditRuns.finishedAt));

  const recentCompletedByWebsite = new Map<string, typeof completedRuns>();
  for (const run of completedRuns) {
    const recent = recentCompletedByWebsite.get(run.websiteId) ?? [];
    if (recent.length < 2) {
      recent.push(run);
      recentCompletedByWebsite.set(run.websiteId, recent);
    }
  }

  const severityCounts = await countIssuesBySeverity([...recentCompletedByWebsite.values()].flat().map(run => run.id));

  return rows.map((row) => {
    const [latest, previous] = recentCompletedByWebsite.get(row.id) ?? [];
    return {
      ...row,
      lastCompletedRun: latest
        ? { id: latest.id, finishedAt: latest.finishedAt, severityCounts: severityCounts.get(latest.id)! }
        : null,
      previousCompletedRun: previous
        ? { id: previous.id, finishedAt: previous.finishedAt, severityCounts: severityCounts.get(previous.id)! }
        : null,
    };
  });
}

export async function getWebsiteById(id: string) {
  const [website] = await getDb().select().from(websites).where(eq(websites.id, id));
  return website ?? null;
}

export async function createWebsite(input: {
  name: string;
  baseUrl: string;
  normalizedHost: string;
  createdByUserId: string;
  typoLanguage?: TypoLanguage;
  typoAllowlist?: string[];
  crawlRules?: CrawlRules;
  lighthouseTargets?: LighthouseTargets;
}) {
  const createdAt = now();
  const [website] = await getDb().insert(websites).values({
    id: createId(),
    name: input.name,
    baseUrl: input.baseUrl,
    normalizedHost: input.normalizedHost,
    typoLanguage: input.typoLanguage ?? "en",
    typoAllowlistJson: input.typoAllowlist ?? [],
    crawlRulesJson: input.crawlRules ?? createEmptyCrawlRules(),
    lighthouseTargetsJson: input.lighthouseTargets ?? [],
    createdByUserId: input.createdByUserId,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  }).returning();

  if (!website) {
    throw new Error("Failed to create website.");
  }

  return website;
}

export async function updateWebsite(
  id: string,
  changes: Partial<{ name: string; isActive: boolean; typoLanguage: TypoLanguage; typoAllowlist: string[]; crawlRules: CrawlRules; lighthouseTargets: LighthouseTargets; linkIgnores: LinkIgnore[] }>,
) {
  const { crawlRules, lighthouseTargets, typoAllowlist, linkIgnores, ...rest } = changes;
  const [website] = await getDb().update(websites).set({
    ...rest,
    ...(typoAllowlist
      ? {
          typoAllowlistJson: typoAllowlist,
        }
      : {}),
    ...(crawlRules
      ? {
          crawlRulesJson: crawlRules,
        }
      : {}),
    ...(lighthouseTargets
      ? {
          lighthouseTargetsJson: lighthouseTargets,
        }
      : {}),
    ...(linkIgnores
      ? {
          linkIgnoresJson: linkIgnores,
        }
      : {}),
    updatedAt: now(),
  }).where(eq(websites.id, id)).returning();

  return website ?? null;
}

export async function createAuditRun(input: {
  websiteId: string;
  triggeredByUserId: string;
  typoLanguage?: TypoLanguage;
  typoAllowlist?: string[];
  crawlRules?: CrawlRules;
  discovery?: DiscoveryPreview;
  lighthouseTargets?: LighthouseTargets;
  linkIgnores?: LinkIgnore[];
}) {
  const [run] = await getDb().insert(auditRuns).values({
    id: createId(),
    websiteId: input.websiteId,
    triggeredByUserId: input.triggeredByUserId,
    status: "queued",
    cancelRequested: false,
    typoLanguage: input.typoLanguage ?? "en",
    typoAllowlistJson: input.typoAllowlist ?? [],
    crawlRulesJson: input.crawlRules ?? createEmptyCrawlRules(),
    lighthouseTargetsJson: input.lighthouseTargets ?? [],
    linkIgnoresJson: input.linkIgnores ?? [],
    discoveryJson: input.discovery ?? {},
    summaryJson: {},
  }).returning();

  if (!run) {
    throw new Error("Failed to create audit run.");
  }

  await getDb().update(websites).set({
    lastAuditRunId: run.id,
    updatedAt: now(),
  }).where(eq(websites.id, input.websiteId));

  return run;
}

export async function listAuditRunsForWebsite(websiteId: string) {
  const runs = await getDb().select({
    id: auditRuns.id,
    status: auditRuns.status,
    startedAt: auditRuns.startedAt,
    finishedAt: auditRuns.finishedAt,
    pageCount: auditRuns.pageCount,
    issueCount: auditRuns.issueCount,
    brokenLinkCount: auditRuns.brokenLinkCount,
  }).from(auditRuns).where(eq(auditRuns.websiteId, websiteId)).orderBy(sql`${auditRuns.startedAt} desc nulls first`, desc(auditRuns.finishedAt));
  const severityCounts = await countIssuesBySeverity(runs.map(run => run.id));

  return runs.map(run => ({
    ...run,
    severityCounts: severityCounts.get(run.id)!,
  }));
}

export async function getPreviousCompletedAuditRun(run: { id: string; websiteId: string; startedAt: Date | null; finishedAt: Date | null }) {
  const cutoff = run.finishedAt ?? run.startedAt ?? now();
  const candidates = await getDb().select({
    id: auditRuns.id,
    status: auditRuns.status,
    startedAt: auditRuns.startedAt,
    finishedAt: auditRuns.finishedAt,
  }).from(auditRuns).where(and(
    eq(auditRuns.websiteId, run.websiteId),
    inArray(auditRuns.status, completedRunStatuses),
  )).orderBy(desc(auditRuns.finishedAt));

  return candidates.find(candidate => candidate.id !== run.id && candidate.finishedAt !== null && candidate.finishedAt < cutoff) ?? null;
}

export async function getAuditRun(id: string) {
  const [run] = await getDb().select({
    id: auditRuns.id,
    websiteId: auditRuns.websiteId,
    triggeredByUserId: auditRuns.triggeredByUserId,
    status: auditRuns.status,
    cancelRequested: auditRuns.cancelRequested,
    typoLanguage: auditRuns.typoLanguage,
    typoAllowlistJson: auditRuns.typoAllowlistJson,
    crawlRulesJson: auditRuns.crawlRulesJson,
    lighthouseTargetsJson: auditRuns.lighthouseTargetsJson,
    linkIgnoresJson: auditRuns.linkIgnoresJson,
    discoveryJson: auditRuns.discoveryJson,
    startedAt: auditRuns.startedAt,
    finishedAt: auditRuns.finishedAt,
    pageCount: auditRuns.pageCount,
    issueCount: auditRuns.issueCount,
    brokenLinkCount: auditRuns.brokenLinkCount,
    typoCount: auditRuns.typoCount,
    seoIssueCount: auditRuns.seoIssueCount,
    summaryJson: auditRuns.summaryJson,
    websiteName: websites.name,
    baseUrl: websites.baseUrl,
  }).from(auditRuns).innerJoin(websites, eq(auditRuns.websiteId, websites.id)).where(eq(auditRuns.id, id));

  return run ?? null;
}

export async function markAuditRunStatus(runId: string, status: AuditRunStatus) {
  const values = status === "running"
    ? { status, startedAt: now(), cancelRequested: false }
    : { status };

  await getDb().update(auditRuns).set(values).where(eq(auditRuns.id, runId));
}

export async function requestAuditRunCancellation(runId: string) {
  const [run] = await getDb().select({
    cancelRequested: auditRuns.cancelRequested,
    summaryJson: auditRuns.summaryJson,
  }).from(auditRuns).where(eq(auditRuns.id, runId)).limit(1);

  if (!run) {
    return null;
  }

  const summaryJson = mergeSummaryJson(run.summaryJson as Record<string, unknown> | undefined, {
    progress: {
      cancelRequested: true,
    },
  });

  const [updatedRun] = await getDb().update(auditRuns).set({
    cancelRequested: true,
    summaryJson,
  }).where(eq(auditRuns.id, runId)).returning();

  return updatedRun ?? null;
}

export async function cancelAuditRun(runId: string, message: string) {
  await appendAuditEvent(runId, {
    level: "warning",
    message,
  });

  const [run] = await getDb().select({
    summaryJson: auditRuns.summaryJson,
  }).from(auditRuns).where(eq(auditRuns.id, runId)).limit(1);

  const summaryJson = mergeSummaryJson(run?.summaryJson as Record<string, unknown> | undefined, {
    progress: {
      stage: "cancelled",
      cancelRequested: false,
    },
  });

  await getDb().update(auditRuns).set({
    status: "cancelled",
    cancelRequested: false,
    finishedAt: now(),
    summaryJson,
  }).where(eq(auditRuns.id, runId));
}

export async function failAuditRun(runId: string, message: string) {
  await appendAuditEvent(runId, {
    level: "error",
    message,
  });

  await getDb().update(auditRuns).set({
    status: "failed",
    cancelRequested: false,
    finishedAt: now(),
  }).where(eq(auditRuns.id, runId));
}

export async function appendAuditEvent(
  auditRunId: string,
  event: { level: "info" | "warning" | "error"; message: string; context?: Record<string, unknown> },
) {
  await getDb().insert(auditEvents).values({
    id: createId(),
    auditRunId,
    level: event.level,
    message: event.message,
    contextJson: event.context ?? {},
    createdAt: now(),
  });
}

export async function updateAuditRunProgress(input: {
  runId: string;
  pageCount: number;
  issueCount: number;
  summaryJson: Record<string, unknown>;
}) {
  const [run] = await getDb().select({
    summaryJson: auditRuns.summaryJson,
  }).from(auditRuns).where(eq(auditRuns.id, input.runId)).limit(1);

  await getDb().update(auditRuns).set({
    pageCount: input.pageCount,
    issueCount: input.issueCount,
    summaryJson: mergeSummaryJson(run?.summaryJson as Record<string, unknown> | undefined, input.summaryJson),
  }).where(eq(auditRuns.id, input.runId));
}

// PostgreSQL caps a single statement at 65535 bind parameters. Split bulk
// inserts so `rows * columnsPerRow` stays comfortably below that limit.
const MAX_BIND_PARAMS = 60000;

export function chunkRowsForInsert<T>(rows: T[], columnsPerRow: number): T[][] {
  const chunkSize = Math.max(1, Math.floor(MAX_BIND_PARAMS / Math.max(1, columnsPerRow)));
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

async function insertInChunks<TRow, TResult>(
  rows: TRow[],
  columnsPerRow: number,
  run: (chunk: TRow[]) => PromiseLike<TResult[]>,
): Promise<TResult[]> {
  const results: TResult[] = [];
  for (const chunk of chunkRowsForInsert(rows, columnsPerRow)) {
    results.push(...await run(chunk));
  }
  return results;
}

export async function completeAuditRun(runId: string, result: AuditEngineResult) {
  const insertedPages = await insertInChunks(
    result.pages.map(page => ({
      id: createId(),
      auditRunId: runId,
      url: page.url,
      canonicalUrl: page.canonicalUrl,
      httpStatus: page.httpStatus,
      depth: page.depth,
      fromSitemap: page.fromSitemap,
      title: page.title,
      metaDescription: page.metaDescription,
      h1: page.h1,
      wordCount: page.wordCount,
      renderedAt: new Date(page.renderedAt),
      pageDigest: page.pageDigest,
    })),
    13,
    chunk => getDb().insert(auditPages).values(chunk).returning({
      id: auditPages.id,
      url: auditPages.url,
    }),
  );

  const pageIdByUrl = new Map(insertedPages.map(page => [page.url, page.id]));

  await insertInChunks(
    result.links.map(link => ({
      id: createId(),
      auditRunId: runId,
      sourcePageId: pageIdByUrl.get(link.sourceUrl) ?? null,
      targetUrl: link.targetUrl,
      targetType: link.targetType,
      httpStatus: link.httpStatus,
      isBroken: link.isBroken,
      anchorText: link.anchorText,
      nofollow: link.nofollow,
    })),
    9,
    async (chunk) => {
      await getDb().insert(auditLinks).values(chunk);
      return [];
    },
  );

  await insertInChunks(
    result.issues.map(issue => ({
      id: createId(),
      auditRunId: runId,
      pageId: issue.pageUrl ? pageIdByUrl.get(issue.pageUrl) ?? null : null,
      category: issue.category,
      code: issue.code,
      severity: issue.severity,
      title: issue.title,
      message: issue.message,
      evidenceJson: issue.evidence ?? {},
    })),
    9,
    async (chunk) => {
      await getDb().insert(auditIssues).values(chunk);
      return [];
    },
  );

  await insertInChunks(
    result.events.map(event => ({
      id: createId(),
      auditRunId: runId,
      level: event.level,
      message: event.message,
      contextJson: event.context ?? {},
      createdAt: now(),
    })),
    6,
    async (chunk) => {
      await getDb().insert(auditEvents).values(chunk);
      return [];
    },
  );

  const typoCount = result.issues.filter(issue => issue.category === "typo").length;
  const seoIssueCount = result.issues.filter(issue => issue.category === "seo").length;
  const brokenLinkCount = result.links.filter(link => link.isBroken).length;

  await getDb().update(auditRuns).set({
    status: result.status,
    cancelRequested: false,
    finishedAt: now(),
    pageCount: result.pages.length,
    issueCount: result.issues.length,
    brokenLinkCount,
    typoCount,
    seoIssueCount,
    summaryJson: result.summary as unknown as Record<string, unknown>,
  }).where(eq(auditRuns.id, runId));
}

export async function listAuditPagesForRun(auditRunId: string) {
  return getDb().select().from(auditPages).where(eq(auditPages.auditRunId, auditRunId)).orderBy(auditPages.depth, auditPages.url);
}

export async function listAuditIssuesForRun(auditRunId: string) {
  return getDb().select({
    id: auditIssues.id,
    category: auditIssues.category,
    code: auditIssues.code,
    severity: auditIssues.severity,
    title: auditIssues.title,
    message: auditIssues.message,
    evidenceJson: auditIssues.evidenceJson,
    pageUrl: auditPages.url,
  }).from(auditIssues).leftJoin(auditPages, eq(auditIssues.pageId, auditPages.id)).where(eq(auditIssues.auditRunId, auditRunId)).orderBy(desc(auditIssues.severity), auditIssues.title);
}

export async function listAuditLinksForRun(auditRunId: string) {
  return getDb().select({
    id: auditLinks.id,
    targetUrl: auditLinks.targetUrl,
    targetType: auditLinks.targetType,
    httpStatus: auditLinks.httpStatus,
    isBroken: auditLinks.isBroken,
    anchorText: auditLinks.anchorText,
    nofollow: auditLinks.nofollow,
    sourceUrl: auditPages.url,
  }).from(auditLinks).leftJoin(auditPages, eq(auditLinks.sourcePageId, auditPages.id)).where(eq(auditLinks.auditRunId, auditRunId)).orderBy(desc(auditLinks.isBroken), auditLinks.targetUrl);
}

export async function listAuditEventsForRun(auditRunId: string) {
  return getDb().select().from(auditEvents).where(eq(auditEvents.auditRunId, auditRunId)).orderBy(desc(auditEvents.createdAt));
}

export async function getWebsiteRuns(runIds: string[]) {
  if (runIds.length === 0) {
    return [];
  }

  return getDb().select().from(auditRuns).where(inArray(auditRuns.id, runIds));
}

export async function getWebsiteByHost(normalizedHost: string) {
  const [website] = await getDb().select().from(websites).where(eq(websites.normalizedHost, normalizedHost));
  return website ?? null;
}

export async function getWebsiteDetails(id: string) {
  const [website] = await getDb().select({
    id: websites.id,
    name: websites.name,
    baseUrl: websites.baseUrl,
    normalizedHost: websites.normalizedHost,
    typoLanguage: websites.typoLanguage,
    typoAllowlistJson: websites.typoAllowlistJson,
    crawlRulesJson: websites.crawlRulesJson,
    lighthouseTargetsJson: websites.lighthouseTargetsJson,
    linkIgnoresJson: websites.linkIgnoresJson,
    createdByUserId: websites.createdByUserId,
    isActive: websites.isActive,
    createdAt: websites.createdAt,
    updatedAt: websites.updatedAt,
    lastAuditRunId: websites.lastAuditRunId,
  }).from(websites).where(eq(websites.id, id));

  if (!website) {
    return null;
  }

  const [latestRun] = website.lastAuditRunId
    ? await getDb().select().from(auditRuns).where(eq(auditRuns.id, website.lastAuditRunId)).limit(1)
    : [];

  return {
    ...website,
    latestRun: latestRun ?? null,
  };
}

export async function summarizeRunIssues(runId: string) {
  const issues = await getDb().select({
    category: auditIssues.category,
  }).from(auditIssues).where(eq(auditIssues.auditRunId, runId));

  return issues.reduce<Record<string, number>>((accumulator, issue) => {
    accumulator[issue.category] = (accumulator[issue.category] ?? 0) + 1;
    return accumulator;
  }, {});
}

export async function allowTypoWordForWebsiteAndRun(input: {
  websiteId: string;
  runId: string;
  word: string;
}) {
  const normalizedWord = typoAllowlistSchema.parse([input.word])[0];

  const [website] = await getDb().select({
    typoAllowlistJson: websites.typoAllowlistJson,
  }).from(websites).where(eq(websites.id, input.websiteId)).limit(1);

  const websiteAllowlist = typoAllowlistSchema.parse(website?.typoAllowlistJson ?? []);
  const nextWebsiteAllowlist = [...new Set([...websiteAllowlist, normalizedWord])];

  await getDb().update(websites).set({
    typoAllowlistJson: nextWebsiteAllowlist,
    updatedAt: now(),
  }).where(eq(websites.id, input.websiteId));

  const [run] = await getDb().select({
    status: auditRuns.status,
    typoAllowlistJson: auditRuns.typoAllowlistJson,
    pageCount: auditRuns.pageCount,
    brokenLinkCount: auditRuns.brokenLinkCount,
    seoIssueCount: auditRuns.seoIssueCount,
    summaryJson: auditRuns.summaryJson,
  }).from(auditRuns).where(eq(auditRuns.id, input.runId)).limit(1);

  const runAllowlist = typoAllowlistSchema.parse(run?.typoAllowlistJson ?? []);
  const nextRunAllowlist = [...new Set([...runAllowlist, normalizedWord])];

  await getDb().update(auditRuns).set({
    typoAllowlistJson: nextRunAllowlist,
  }).where(eq(auditRuns.id, input.runId));

  if (!run || run.status === "queued" || run.status === "running") {
    return {
      word: normalizedWord,
      typoAllowlist: nextWebsiteAllowlist,
    };
  }

  const typoIssues = await getDb().select({
    id: auditIssues.id,
    evidenceJson: auditIssues.evidenceJson,
  }).from(auditIssues).where(and(
    eq(auditIssues.auditRunId, input.runId),
    eq(auditIssues.category, "typo"),
  ));

  for (const issue of typoIssues) {
    const words = Array.isArray((issue.evidenceJson as Record<string, unknown> | undefined)?.words)
      ? ((issue.evidenceJson as { words?: Array<string | { word?: string; suggestions?: string[] }> }).words ?? [])
      : [];

    const nextWords = words
      .map(entry => typeof entry === "string"
        ? { word: entry, suggestions: [] as string[] }
        : { word: entry.word ?? "", suggestions: entry.suggestions ?? [] })
      .filter(entry => entry.word && !nextRunAllowlist.includes(entry.word.toLowerCase()));

    if (nextWords.length === 0) {
      await getDb().delete(auditIssues).where(eq(auditIssues.id, issue.id));
      continue;
    }

    await getDb().update(auditIssues).set({
      message: `Potential misspellings were detected: ${nextWords.slice(0, 10).map(entry => entry.word).join(", ")}`,
      evidenceJson: {
        words: nextWords.slice(0, 50),
      },
    }).where(eq(auditIssues.id, issue.id));
  }

  const issueCounts = await getDb().select({
    category: auditIssues.category,
    count: sql<number>`count(*)::int`,
  }).from(auditIssues).where(eq(auditIssues.auditRunId, input.runId)).groupBy(auditIssues.category);

  const issueCount = issueCounts.reduce((total, row) => total + row.count, 0);
  const typoCount = issueCounts.find(row => row.category === "typo")?.count ?? 0;
  const summaryJson = (run.summaryJson ?? {}) as Record<string, unknown>;
  const currentLighthouse = summaryJson.lighthouse && typeof summaryJson.lighthouse === "object"
    ? summaryJson.lighthouse as { results?: Array<{ performanceScore?: number | null }> }
    : undefined;

  await getDb().update(auditRuns).set({
    issueCount,
    typoCount,
    summaryJson: {
      ...summaryJson,
      auditSummary: buildAuditSummaryText({
        pageCount: run.pageCount,
        issueCount,
        brokenLinkCount: run.brokenLinkCount,
        typoCount,
        seoIssueCount: run.seoIssueCount,
        crawledFromSitemap: typeof summaryJson.crawledFromSitemap === "number" ? summaryJson.crawledFromSitemap : 0,
        lighthouse: currentLighthouse,
      }),
    },
  }).where(eq(auditRuns.id, input.runId));

  return {
    word: normalizedWord,
    typoAllowlist: nextWebsiteAllowlist,
  };
}

// Broken-link issues carry their target in evidence from now on; older runs only have it at the start of the message.
export function brokenLinkTarget(issue: { message: string; evidenceJson: unknown }): string {
  const evidence = issue.evidenceJson && typeof issue.evidenceJson === "object" ? issue.evidenceJson as Record<string, unknown> : {};
  return typeof evidence.targetUrl === "string" ? evidence.targetUrl : issue.message.split(" ")[0] ?? "";
}

export async function ignoreBrokenLinkForWebsiteAndRun(input: {
  websiteId: string;
  runId: string;
  rule: LinkIgnore;
}) {
  const [website] = await getDb().select({ linkIgnoresJson: websites.linkIgnoresJson }).from(websites).where(eq(websites.id, input.websiteId)).limit(1);
  const [run] = await getDb().select({
    status: auditRuns.status,
    linkIgnoresJson: auditRuns.linkIgnoresJson,
    pageCount: auditRuns.pageCount,
    typoCount: auditRuns.typoCount,
    seoIssueCount: auditRuns.seoIssueCount,
    summaryJson: auditRuns.summaryJson,
  }).from(auditRuns).where(eq(auditRuns.id, input.runId)).limit(1);

  const withRule = (current: unknown) => {
    const rules = linkIgnoresSchema.parse(current ?? []);
    return rules.some(rule => rule.kind === input.rule.kind && rule.value === input.rule.value) ? rules : [...rules, input.rule];
  };
  const linkIgnores = withRule(website?.linkIgnoresJson);

  await getDb().update(websites).set({ linkIgnoresJson: linkIgnores, updatedAt: now() }).where(eq(websites.id, input.websiteId));
  await getDb().update(auditRuns).set({ linkIgnoresJson: withRule(run?.linkIgnoresJson) }).where(eq(auditRuns.id, input.runId));

  if (!run || run.status === "queued" || run.status === "running") {
    return { linkIgnores };
  }

  const brokenLinks = await getDb().select({ id: auditLinks.id, targetUrl: auditLinks.targetUrl }).from(auditLinks).where(and(eq(auditLinks.auditRunId, input.runId), eq(auditLinks.isBroken, true)));
  const ignoredLinkIds = brokenLinks.filter(link => isLinkIgnored(link.targetUrl, [input.rule])).map(link => link.id);
  if (ignoredLinkIds.length) {
    await getDb().update(auditLinks).set({ isBroken: false }).where(inArray(auditLinks.id, ignoredLinkIds));
  }

  const brokenLinkIssues = await getDb().select({ id: auditIssues.id, message: auditIssues.message, evidenceJson: auditIssues.evidenceJson }).from(auditIssues).where(and(eq(auditIssues.auditRunId, input.runId), eq(auditIssues.code, "broken_link")));
  const ignoredIssueIds = brokenLinkIssues.filter(issue => isLinkIgnored(brokenLinkTarget(issue), [input.rule])).map(issue => issue.id);
  if (ignoredIssueIds.length) {
    await getDb().delete(auditIssues).where(inArray(auditIssues.id, ignoredIssueIds));
  }

  const [{ issueCount } = { issueCount: 0 }] = await getDb().select({ issueCount: sql<number>`count(*)::int` }).from(auditIssues).where(eq(auditIssues.auditRunId, input.runId));
  const [{ brokenLinkCount } = { brokenLinkCount: 0 }] = await getDb().select({ brokenLinkCount: sql<number>`count(*)::int` }).from(auditLinks).where(and(eq(auditLinks.auditRunId, input.runId), eq(auditLinks.isBroken, true)));
  const summaryJson = (run.summaryJson ?? {}) as Record<string, unknown>;

  await getDb().update(auditRuns).set({
    issueCount,
    brokenLinkCount,
    summaryJson: {
      ...summaryJson,
      auditSummary: buildAuditSummaryText({
        pageCount: run.pageCount,
        issueCount,
        brokenLinkCount,
        typoCount: run.typoCount,
        seoIssueCount: run.seoIssueCount,
        crawledFromSitemap: typeof summaryJson.crawledFromSitemap === "number" ? summaryJson.crawledFromSitemap : 0,
        lighthouse: summaryJson.lighthouse && typeof summaryJson.lighthouse === "object"
          ? summaryJson.lighthouse as { results?: Array<{ performanceScore?: number | null }> }
          : undefined,
      }),
    },
  }).where(eq(auditRuns.id, input.runId));

  return { linkIgnores, removedIssues: ignoredIssueIds.length };
}

export type AuditRunRecord = Awaited<ReturnType<typeof getAuditRun>>;
export type AuditSummaryRecord = AuditSummary;
