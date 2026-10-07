import type { ComparableIssue } from "@website-auditor/shared";

import { apiTokenScopesForRole, compareIssueSets, createApiTokenSchema, isLinkIgnored, issueComparisonKey, normalizeWebsiteUrl, parseLinkIgnore } from "@website-auditor/shared";

import { describe, expect, it } from "vitest";

describe("normalizeWebsiteUrl", () => {
  it("adds https when missing and strips fragments", () => {
    expect(normalizeWebsiteUrl("example.com/path/#section")).toEqual({
      baseUrl: "https://example.com/path",
      normalizedHost: "example.com",
    });
  });

  it("rejects non-http protocols", () => {
    expect(() => normalizeWebsiteUrl("ftp://example.com")).toThrow("Only http and https websites are supported.");
  });
});

describe("compareIssueSets", () => {
  const issue = (overrides: Partial<ComparableIssue>): ComparableIssue => ({
    code: "missing_title",
    pageUrl: "https://example.com/",
    message: "The page has no title.",
    evidenceJson: {},
    ...overrides,
  });

  it("keys page-level issues by code and page so reworded messages still match", () => {
    expect(issueComparisonKey(issue({ message: "a" }))).toBe(issueComparisonKey(issue({ message: "b" })));
  });

  it("keys link issues by message so each broken target is distinct", () => {
    expect(issueComparisonKey(issue({ code: "broken_link", message: "https://a.test returned 404." })))
      .not
      .toBe(issueComparisonKey(issue({ code: "broken_link", message: "https://b.test returned 404." })));
  });

  it("keys duplicate titles by the shared title rather than the page count", () => {
    expect(issueComparisonKey(issue({ code: "duplicate_title", pageUrl: null, message: "shared by 2 pages", evidenceJson: { title: "Home" } })))
      .toBe(issueComparisonKey(issue({ code: "duplicate_title", pageUrl: null, message: "shared by 3 pages", evidenceJson: { title: "Home" } })));
  });

  it("reports issues new in the current run and issues fixed since the previous run", () => {
    const kept = issue({ code: "missing_h1" });
    const added = issue({ code: "missing_lang" });
    const fixed = issue({ code: "noindex" });

    const result = compareIssueSets([kept, added], [kept, fixed]);

    expect([...result.newKeys]).toEqual([issueComparisonKey(added)]);
    expect(result.fixed).toEqual([fixed]);
  });
});

describe("link ignores", () => {
  it("reads a bare host as a domain rule and a URL with a path as a URL rule", () => {
    expect(parseLinkIgnore(" LinkedIn.com ")).toEqual({ kind: "domain", value: "linkedin.com" });
    expect(parseLinkIgnore("*.instagram.com")).toEqual({ kind: "domain", value: "instagram.com" });
    expect(parseLinkIgnore("https://example.com/old-page/")).toEqual({ kind: "url", value: "https://example.com/old-page/" });
    expect(parseLinkIgnore("example.com/old-page")).toEqual({ kind: "url", value: "https://example.com/old-page" });
  });

  it("rejects input that is neither a URL nor a domain", () => {
    expect(parseLinkIgnore("not a domain")).toBeNull();
    expect(parseLinkIgnore("mailto:someone@example.com")).toBeNull();
  });

  it("matches a domain rule against the domain and its subdomains only", () => {
    const rules = [{ kind: "domain" as const, value: "linkedin.com" }];
    expect(isLinkIgnored("https://www.linkedin.com/company/acme", rules)).toBe(true);
    expect(isLinkIgnored("https://linkedin.com/", rules)).toBe(true);
    expect(isLinkIgnored("https://notlinkedin.com/", rules)).toBe(false);
  });

  it("matches a URL rule regardless of a trailing slash or fragment", () => {
    const rules = [{ kind: "url" as const, value: "https://example.com/old-page/" }];
    expect(isLinkIgnored("https://example.com/old-page", rules)).toBe(true);
    expect(isLinkIgnored("https://example.com/old-page/#top", rules)).toBe(true);
    expect(isLinkIgnored("https://example.com/old-page/2", rules)).toBe(false);
  });
});

describe("aPI token input", () => {
  it("dedupes scopes and accepts tokens that never expire", () => {
    expect(createApiTokenSchema.parse({ name: " CI ", scopes: ["read", "read", "audit:run"], expiresInDays: null }))
      .toEqual({ name: "CI", scopes: ["read", "audit:run"], expiresInDays: null });
  });

  it("rejects unknown scopes, empty scopes and unsupported expiries", () => {
    expect(createApiTokenSchema.safeParse({ name: "CI", scopes: ["admin"], expiresInDays: 90 }).success).toBe(false);
    expect(createApiTokenSchema.safeParse({ name: "CI", scopes: [], expiresInDays: 90 }).success).toBe(false);
    expect(createApiTokenSchema.safeParse({ name: "CI", scopes: ["read"], expiresInDays: 7 }).success).toBe(false);
  });

  it("keeps website management to administrators", () => {
    expect(apiTokenScopesForRole("user")).not.toContain("websites:write");
    expect(apiTokenScopesForRole("admin")).toContain("websites:write");
  });
});
