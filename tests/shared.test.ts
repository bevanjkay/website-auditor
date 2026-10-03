import type { ComparableIssue } from "@website-auditor/shared";

import { compareIssueSets, issueComparisonKey, normalizeWebsiteUrl } from "@website-auditor/shared";

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
