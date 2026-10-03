import type { AuditReportInput, ReportIssue } from "@website-auditor/shared";

import { buildAuditMarkdown, groupIssues } from "@website-auditor/shared";

import { describe, expect, it } from "vitest";

let nextId = 0;
function issue(overrides: Partial<ReportIssue>): ReportIssue {
  nextId += 1;
  return {
    id: `i${nextId}`,
    code: "missing_meta_description",
    severity: "warning",
    category: "seo",
    title: "Missing meta description",
    message: "The page has no meta description.",
    pageUrl: `https://example.com/page-${nextId}/`,
    evidenceJson: {},
    ...overrides,
  };
}

function input(overrides: Partial<AuditReportInput> = {}): AuditReportInput {
  return {
    run: {
      websiteName: "Example Church",
      baseUrl: "https://example.com/",
      status: "completed",
      startedAt: "2026-10-03T09:54:00.000Z",
      finishedAt: "2026-10-03T10:01:00.000Z",
      pageCount: 42,
      summary: {},
    },
    issues: [],
    brokenLinks: [],
    comparison: { previousRun: null, newIssueIds: [], fixedIssues: [] },
    ...overrides,
  };
}

describe("groupIssues", () => {
  it("splits broken links by target type and names each group after it", () => {
    const groups = groupIssues([
      issue({ code: "broken_link", severity: "error", category: "broken_link", title: "Broken link detected", evidenceJson: { targetType: "internal" } }),
      issue({ code: "broken_link", severity: "warning", category: "broken_link", title: "Broken link detected", evidenceJson: { targetType: "external" } }),
    ]);

    expect(groups.map(group => group.title)).toEqual(["Broken internal link", "Broken external link"]);
  });

  it("orders groups by severity, then by how many issues they hold", () => {
    const groups = groupIssues([
      issue({ code: "missing_structured_data", severity: "info", title: "Missing structured data" }),
      issue({ code: "missing_h1", severity: "warning", title: "Missing H1" }),
      issue({ code: "missing_meta_description" }),
      issue({ code: "missing_meta_description" }),
      issue({ code: "mixed_content", severity: "error", category: "security", title: "Mixed content" }),
    ]);

    expect(groups.map(group => group.code)).toEqual(["mixed_content", "missing_meta_description", "missing_h1", "missing_structured_data"]);
  });
});

describe("buildAuditMarkdown", () => {
  it("leads with the site, run details and a severity summary", () => {
    const markdown = buildAuditMarkdown(input({
      issues: [issue({ severity: "error", code: "mixed_content", title: "Mixed content" }), issue({})],
    }));

    expect(markdown).toContain("# Website audit: Example Church");
    expect(markdown).toContain("- Site: https://example.com/");
    expect(markdown).toContain("- Started: 2026-10-03 09:54 UTC");
    expect(markdown).toContain("| Errors | 1 |");
    expect(markdown).toContain("| Warnings | 1 |");
    expect(markdown).toContain("First completed audit for this site");
  });

  it("shows change against the previous audit and marks new issues", () => {
    const added = issue({ code: "missing_h1", title: "Missing H1", pageUrl: "https://example.com/about/" });
    const markdown = buildAuditMarkdown(input({
      issues: [added],
      comparison: {
        previousRun: { startedAt: "2026-09-26T11:30:00.000Z", finishedAt: "2026-09-26T11:38:00.000Z", severityCounts: { error: 2, warning: 0, info: 0 } },
        newIssueIds: [added.id],
        fixedIssues: [issue({ code: "noindex", title: "Page marked as noindex", pageUrl: "https://example.com/old/" })],
      },
    }));

    expect(markdown).toContain("| Errors | 0 | −2 |");
    expect(markdown).toContain("| Warnings | 1 | +1 |");
    expect(markdown).toContain("- https://example.com/about/ (new)");
    expect(markdown).toContain("## Fixed since the previous audit");
    expect(markdown).toContain("Page marked as noindex");
  });

  it("lists typo words with suggestions so they can be fixed or allowed", () => {
    const markdown = buildAuditMarkdown(input({
      issues: [issue({
        code: "possible_typos",
        severity: "info",
        category: "typo",
        title: "Possible typos detected",
        evidenceJson: { words: [{ word: "registraton", suggestions: ["registration"] }] },
      })],
    }));

    expect(markdown).toContain("registraton → registration");
  });

  it("caps long occurrence lists so the export stays usable", () => {
    const markdown = buildAuditMarkdown(input({
      issues: Array.from({ length: 130 }, () => issue({})),
    }));

    expect(markdown).toContain("…and 30 more");
  });

  it("groups broken links by target with the pages that link to them", () => {
    const markdown = buildAuditMarkdown(input({
      brokenLinks: [
        { targetUrl: "https://example.com/gone/", targetType: "internal", httpStatus: 404, sourceUrl: "https://example.com/", anchorText: "Old page" },
        { targetUrl: "https://example.com/gone/", targetType: "internal", httpStatus: 404, sourceUrl: "https://example.com/news/", anchorText: null },
      ],
    }));

    expect(markdown).toContain("## Broken links");
    expect(markdown).toContain("### https://example.com/gone/ (404, internal, 2 pages)");
    expect(markdown).toContain("- https://example.com/ — link text “Old page”");
  });
});
