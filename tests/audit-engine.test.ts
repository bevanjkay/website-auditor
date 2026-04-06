import {
  buildAllowSuggestions,
  buildDenySuggestions,
  buildDiscoveryPreview,
  buildDuplicateContentIssues,
  detectTypos,
  extractLighthouseFindings,
  isCheckableLinkTarget,
  parseRobotsForSitemaps,
  parseSitemapXml,
  redirectsAwayFromSite,
  runAudit,
} from "@website-auditor/audit-engine";

import { describe, expect, it } from "vitest";

describe("audit-engine helpers", () => {
  it("parses robots sitemap directives", () => {
    expect(parseRobotsForSitemaps(`
      User-agent: *
      Sitemap: https://example.com/sitemap.xml
      Sitemap: /news-sitemap.xml
    `, "https://example.com")).toEqual([
      "https://example.com/sitemap.xml",
      "https://example.com/news-sitemap.xml",
    ]);
  });

  it("parses sitemap index and url set xml", () => {
    expect(parseSitemapXml(`
      <sitemapindex>
        <sitemap><loc>https://example.com/sitemap-a.xml</loc></sitemap>
      </sitemapindex>
    `)).toEqual({
      urls: [],
      sitemapIndexes: ["https://example.com/sitemap-a.xml"],
    });

    expect(parseSitemapXml(`
      <urlset>
        <url><loc>https://example.com/</loc></url>
        <url><loc>https://example.com/about</loc></url>
      </urlset>
    `)).toEqual({
      urls: ["https://example.com/", "https://example.com/about"],
      sitemapIndexes: [],
    });
  });

  it("flags duplicate page titles", () => {
    const issues = buildDuplicateContentIssues([
      {
        url: "https://example.com",
        canonicalUrl: null,
        httpStatus: 200,
        depth: 0,
        fromSitemap: true,
        title: "Home",
        metaDescription: "Desc",
        h1: "Home",
        wordCount: 10,
        renderedAt: new Date().toISOString(),
        pageDigest: "a",
      },
      {
        url: "https://example.com/about",
        canonicalUrl: null,
        httpStatus: 200,
        depth: 1,
        fromSitemap: true,
        title: "Home",
        metaDescription: "Other",
        h1: "About",
        wordCount: 9,
        renderedAt: new Date().toISOString(),
        pageDigest: "b",
      },
    ]);

    const duplicateTitleIssues = issues.filter(issue => issue.code === "duplicate_title");
    expect(duplicateTitleIssues).toHaveLength(1);
    expect(duplicateTitleIssues[0]).toMatchObject({
      evidence: {
        title: "Home",
        urls: ["https://example.com", "https://example.com/about"],
      },
    });
  });

  it("does not flag duplicate titles when the same page URL is repeated", () => {
    const issues = buildDuplicateContentIssues([
      {
        url: "https://example.com/connecthub",
        canonicalUrl: null,
        httpStatus: 200,
        depth: 0,
        fromSitemap: true,
        title: "Connect | Example",
        metaDescription: "Desc",
        h1: "Connect",
        wordCount: 10,
        renderedAt: new Date().toISOString(),
        pageDigest: "a",
      },
      {
        url: "https://example.com/connecthub",
        canonicalUrl: null,
        httpStatus: 200,
        depth: 1,
        fromSitemap: false,
        title: "Connect | Example",
        metaDescription: "Desc",
        h1: "Connect",
        wordCount: 10,
        renderedAt: new Date().toISOString(),
        pageDigest: "b",
      },
    ]);

    expect(issues.some(issue => issue.code === "duplicate_title")).toBe(false);
    expect(issues.some(issue => issue.code === "duplicate_meta_description")).toBe(false);
  });

  it("detects likely typos while ignoring allowlisted terms", async () => {
    const matches = await detectTypos("The langing page has a typo but nuxt should not trigger.");
    expect(matches.some(match => match.word === "langing")).toBe(true);
    expect(matches.some(match => match.word === "nuxt")).toBe(false);
  });

  it("uses the configured dictionary for typo checks", async () => {
    await expect(detectTypos("colour", "en-gb")).resolves.toEqual([]);
    await expect(detectTypos("colour", "en-us")).resolves.toEqual([
      expect.objectContaining({
        word: "colour",
      }),
    ]);
  });

  it("preserves original casing for case-sensitive dictionary words", async () => {
    await expect(detectTypos("Watch on YouTube from your iPhone.")).resolves.toEqual([]);
  });

  it("returns spelling suggestions and suppresses allowlisted words", async () => {
    const matches = await detectTypos("langing", "en");
    expect(matches).toEqual([
      expect.objectContaining({
        word: "langing",
        suggestions: expect.any(Array),
      }),
    ]);
    expect(matches[0]?.suggestions.length).toBeGreaterThan(0);

    await expect(detectTypos("langing", "en", ["langing"])).resolves.toEqual([]);
  });

  it("skips URLs and css selector-like tokens during typo detection", async () => {
    const matches = await detectTypos("Visit https://example.com/test-page and check .btn-primary on www.example.com.");
    expect(matches.some(match => match.word === "btn")).toBe(false);
    expect(matches.some(match => match.word === "primary")).toBe(false);
    expect(matches.some(match => match.word === "example")).toBe(false);
  });

  it("ignores non-http link targets for broken-link checking", () => {
    expect(isCheckableLinkTarget("https://example.com/contact")).toBe(true);
    expect(isCheckableLinkTarget("http://example.com/contact")).toBe(true);
    expect(isCheckableLinkTarget("mailto:test@example.com")).toBe(false);
    expect(isCheckableLinkTarget("tel:+61312345678")).toBe(false);
    expect(isCheckableLinkTarget("javascript:void(0)")).toBe(false);
  });

  it("treats redirects outside the audited host as off-site", () => {
    expect(redirectsAwayFromSite("https://www.youtube.com/@gatewaychurchgeelong", { host: "gc.org.au" })).toBe(true);
    expect(redirectsAwayFromSite("https://gc.org.au/connecthub", { host: "gc.org.au" })).toBe(false);
  });

  it("applies allow and deny discovery rules with deny taking precedence", () => {
    const preview = buildDiscoveryPreview({
      generatedAt: new Date().toISOString(),
      hasSitemap: true,
      source: "sitemap",
      sitemapUrls: [
        "https://example.com/blog/post-a",
        "https://example.com/blog/tag/seo",
      ],
      entries: [
        { url: "https://example.com/blog/post-a", source: "sitemap" },
        { url: "https://example.com/blog/tag/seo", source: "sitemap" },
        { url: "https://example.com/about", source: "sitemap" },
      ],
    }, {
      allow: [
        { matcher: "glob", pattern: "https://example.com/blog/**" },
      ],
      deny: [
        { matcher: "glob", pattern: "**/tag/**" },
      ],
    });

    expect(preview.included).toBe(1);
    expect(preview.excluded).toBe(2);
    expect(preview.entries.find(entry => entry.url.endsWith("/post-a"))?.status).toBe("included");
    expect(preview.entries.find(entry => entry.url.endsWith("/tag/seo"))?.matchedRule?.mode).toBe("deny");
    expect(preview.entries.find(entry => entry.url.endsWith("/about"))?.matchedRule).toBeNull();
  });

  it("suggests deny patterns for common WordPress archive URLs", () => {
    const suggestions = buildDenySuggestions(buildDiscoveryPreview({
      generatedAt: new Date().toISOString(),
      hasSitemap: true,
      source: "sitemap",
      sitemapUrls: [],
      entries: [
        { url: "https://example.com/category/news", source: "sitemap" },
        { url: "https://example.com/tag/seo", source: "sitemap" },
        { url: "https://example.com/post-a?replytocom=123", source: "sitemap" },
      ],
    }));

    expect(suggestions.some(suggestion => suggestion.pattern === "**/category/**")).toBe(true);
    expect(suggestions.some(suggestion => suggestion.pattern === "**/tag/**")).toBe(true);
    expect(suggestions.some(suggestion => suggestion.pattern === "**?replytocom=*")).toBe(true);
  });

  it("suggests allow presets for common discovered sections", () => {
    const suggestions = buildAllowSuggestions(buildDiscoveryPreview({
      generatedAt: new Date().toISOString(),
      hasSitemap: true,
      source: "sitemap",
      sitemapUrls: [],
      entries: [
        { url: "https://example.com/blog/post-a", source: "sitemap" },
        { url: "https://example.com/blog/post-b", source: "sitemap" },
        { url: "https://example.com/docs/getting-started", source: "sitemap" },
        { url: "https://example.com/docs/api", source: "sitemap" },
        { url: "https://example.com/category/news", source: "sitemap" },
      ],
    }));

    expect(suggestions.some(suggestion => suggestion.matcher === "prefix" && suggestion.pattern === "https://example.com/blog")).toBe(true);
    expect(suggestions.some(suggestion => suggestion.matcher === "prefix" && suggestion.pattern === "https://example.com/docs")).toBe(true);
    expect(suggestions.some(suggestion => suggestion.pattern === "https://example.com/category")).toBe(false);
  });

  it("extracts reviewable lighthouse findings from failed audits", () => {
    const findings = extractLighthouseFindings({
      categories: {
        performance: {
          auditRefs: [{ id: "largest-contentful-paint" }],
        },
        seo: {
          auditRefs: [{ id: "document-title" }],
        },
      },
      audits: {
        "largest-contentful-paint": {
          id: "largest-contentful-paint",
          title: "Largest Contentful Paint element",
          description: "Largest Contentful Paint marks the render time of the largest image or text block visible within the viewport.",
          score: 0.31,
          scoreDisplayMode: "numeric",
          displayValue: "4.4 s",
          details: {
            type: "table",
            items: [
              {
                node: {
                  type: "node",
                  selector: "main img.hero",
                  snippet: "<img class=\"hero\" src=\"/hero.jpg\">",
                  nodeLabel: "Hero image",
                },
              },
              {
                location: {
                  type: "source-location",
                  url: "https://example.com/assets/app.js",
                  line: 24,
                  column: 7,
                },
              },
            ],
          },
        },
        "document-title": {
          id: "document-title",
          title: "Document has a `<title>` element",
          description: "Titles are critical to giving users a quick insight into the content of a result and why it is relevant to their query.",
          score: 1,
          scoreDisplayMode: "binary",
          displayValue: "Passed",
        },
      },
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      id: "largest-contentful-paint",
      category: "performance",
      title: "Largest Contentful Paint element",
      score: 31,
      displayValue: "4.4 s",
      targets: [
        expect.objectContaining({
          kind: "node",
          selector: "main img.hero",
          nodeLabel: "Hero image",
        }),
        expect.objectContaining({
          kind: "source-location",
          url: "https://example.com/assets/app.js",
          line: 25,
          column: 8,
        }),
      ],
    });
  });

  it("returns a cancelled result when stop is requested before crawling begins", async () => {
    const result = await runAudit("https://example.com", {
      maxPages: 10,
      maxDepth: 2,
      pageTimeoutMs: 1000,
      browserConcurrency: 1,
      linkConcurrency: 1,
    }, {
      fetchImpl: async () => new Response("", {
        status: 404,
      }),
      shouldCancel: async () => true,
    });

    expect(result.status).toBe("cancelled");
    expect(result.pages).toHaveLength(0);
    expect(result.links).toHaveLength(0);
    expect(result.events.some(event => event.message === "Audit cancelled")).toBe(true);
  });
});
