import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
});

export const websites = pgTable("websites", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  normalizedHost: text("normalized_host").notNull().unique(),
  typoLanguage: text("typo_language").notNull().default("en"),
  typoAllowlistJson: jsonb("typo_allowlist_json").notNull().default([]),
  crawlRulesJson: jsonb("crawl_rules_json").notNull().default({ allow: [], deny: [] }),
  lighthouseTargetsJson: jsonb("lighthouse_targets_json").notNull().default([]),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  lastAuditRunId: text("last_audit_run_id"),
});

export const auditRuns = pgTable("audit_runs", {
  id: text("id").primaryKey(),
  websiteId: text("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  triggeredByUserId: text("triggered_by_user_id").notNull().references(() => users.id),
  status: text("status").notNull(),
  cancelRequested: boolean("cancel_requested").notNull().default(false),
  typoLanguage: text("typo_language").notNull().default("en"),
  typoAllowlistJson: jsonb("typo_allowlist_json").notNull().default([]),
  crawlRulesJson: jsonb("crawl_rules_json").notNull().default({ allow: [], deny: [] }),
  lighthouseTargetsJson: jsonb("lighthouse_targets_json").notNull().default([]),
  discoveryJson: jsonb("discovery_json").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  pageCount: integer("page_count").notNull().default(0),
  issueCount: integer("issue_count").notNull().default(0),
  brokenLinkCount: integer("broken_link_count").notNull().default(0),
  typoCount: integer("typo_count").notNull().default(0),
  seoIssueCount: integer("seo_issue_count").notNull().default(0),
  summaryJson: jsonb("summary_json").notNull().default({}),
});

export const auditPages = pgTable("audit_pages", {
  id: text("id").primaryKey(),
  auditRunId: text("audit_run_id").notNull().references(() => auditRuns.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  canonicalUrl: text("canonical_url"),
  httpStatus: integer("http_status"),
  depth: integer("depth").notNull(),
  fromSitemap: boolean("from_sitemap").notNull().default(false),
  title: text("title"),
  metaDescription: text("meta_description"),
  h1: text("h1"),
  wordCount: integer("word_count").notNull().default(0),
  renderedAt: timestamp("rendered_at", { withTimezone: true }).notNull(),
  pageDigest: text("page_digest").notNull(),
});

export const auditLinks = pgTable("audit_links", {
  id: text("id").primaryKey(),
  auditRunId: text("audit_run_id").notNull().references(() => auditRuns.id, { onDelete: "cascade" }),
  sourcePageId: text("source_page_id").references(() => auditPages.id, { onDelete: "set null" }),
  targetUrl: text("target_url").notNull(),
  targetType: text("target_type").notNull(),
  httpStatus: integer("http_status"),
  isBroken: boolean("is_broken").notNull().default(false),
  anchorText: text("anchor_text"),
  nofollow: boolean("nofollow").notNull().default(false),
});

export const auditIssues = pgTable("audit_issues", {
  id: text("id").primaryKey(),
  auditRunId: text("audit_run_id").notNull().references(() => auditRuns.id, { onDelete: "cascade" }),
  pageId: text("page_id").references(() => auditPages.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  code: text("code").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  evidenceJson: jsonb("evidence_json").notNull().default({}),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  auditRunId: text("audit_run_id").notNull().references(() => auditRuns.id, { onDelete: "cascade" }),
  level: text("level").notNull(),
  message: text("message").notNull(),
  contextJson: jsonb("context_json").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
