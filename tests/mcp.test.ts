import type { ApiCaller, ApiCallOptions } from "../apps/web/server/mcp/server";

import { apiTokenScopes, mcpTools, mcpToolsForScopes } from "@website-auditor/shared";

import { describe, expect, it, vi } from "vitest";

import { compactEvidence, mapWithConcurrency, paginate, truncate } from "../apps/web/server/mcp/format";
import { createAuditorMcpHandler } from "../apps/web/server/mcp/server";

type Route = (options?: ApiCallOptions) => unknown;

function fakeApi(routes: Record<string, Route>) {
  return vi.fn(async (path: string, options?: ApiCallOptions) => {
    const route = routes[`${options?.method ?? "GET"} ${path}`];
    if (!route) {
      throw Object.assign(new Error("Not found"), { statusCode: 404, data: { statusMessage: `No fixture for ${path}` } });
    }
    return route(options);
  });
}

function apiError(statusCode: number, statusMessage: string, data?: Record<string, unknown>) {
  return () => {
    throw Object.assign(new Error(statusMessage), { statusCode, data: { statusMessage, data } });
  };
}

async function rpc(api: ReturnType<typeof fakeApi>, scopes: string[], method: string, params: Record<string, unknown> = {}) {
  const handler = createAuditorMcpHandler({ version: "test", createApiCaller: () => api as unknown as ApiCaller });
  const response = await handler.fetch(new Request("http://localhost/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }), { authInfo: { token: "wa_test", clientId: "user-1", scopes } });
  const body = await response.text();
  const message = response.headers.get("content-type")?.includes("text/event-stream")
    ? body.split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6))).at(-1)
    : JSON.parse(body);
  return message as { result?: Record<string, any>; error?: { message: string } };
}

async function callTool(api: ReturnType<typeof fakeApi>, scopes: string[], name: string, args: Record<string, unknown>) {
  const { result, error } = await rpc(api, scopes, "tools/call", { name, arguments: args });
  if (!result) {
    throw new Error(error?.message ?? "No result");
  }
  const text = result.content[0].text as string;
  return { isError: Boolean(result.isError), text, data: result.isError ? null : JSON.parse(text) };
}

const allScopes = [...apiTokenScopes];

describe("mCP tools", () => {
  it("offers exactly the catalogued tools a token's scopes allow", async () => {
    for (const scopes of [["read"], ["read", "audit:run"], allScopes]) {
      const { result } = await rpc(fakeApi({}), scopes, "tools/list");
      const names = (result?.tools as Array<{ name: string }>).map(tool => tool.name).sort();
      expect(names).toEqual(mcpToolsForScopes(scopes as typeof allScopes).map(tool => tool.name).sort());
    }
    expect(mcpToolsForScopes(allScopes)).toHaveLength(mcpTools.length);
  });

  it("lists active websites with their latest results", async () => {
    const api = fakeApi({
      "GET /api/websites": () => ({
        websites: [
          { id: "w1", name: "Live", baseUrl: "https://live.test/", isActive: true, lastAuditRunId: "a1", lastAuditStatus: "completed", lastAuditFinishedAt: "2026-10-01T00:00:00.000Z", lastCompletedRun: { id: "a1", finishedAt: "2026-10-01T00:00:00.000Z", severityCounts: { error: 1, warning: 2, info: 3 } }, previousCompletedRun: null, typoAllowlistJson: ["noise"] },
          { id: "w2", name: "Old", baseUrl: "https://old.test/", isActive: false, lastAuditRunId: null, lastAuditStatus: null, lastAuditFinishedAt: null, lastCompletedRun: null, previousCompletedRun: null },
        ],
      }),
    });

    const { data } = await callTool(api, ["read"], "list_websites", {});
    expect(data.websites).toEqual([{
      id: "w1",
      name: "Live",
      baseUrl: "https://live.test/",
      latestAudit: { id: "a1", status: "completed", finishedAt: "2026-10-01T00:00:00.000Z" },
      latestCompletedAudit: { id: "a1", finishedAt: "2026-10-01T00:00:00.000Z", issues: { error: 1, warning: 2, info: 3 } },
      previousCompletedAudit: null,
    }]);

    const archived = await callTool(api, ["read"], "list_websites", { includeArchived: true });
    expect(archived.data.websites.map((website: { id: string; archived?: boolean }) => [website.id, website.archived])).toEqual([["w1", undefined], ["w2", true]]);
  });

  it("filters, orders and pages issues, flagging what's new", async () => {
    const issue = (id: string, severity: string, code: string, pageUrl: string, message = "Message") => ({ id, severity, code, category: "seo", title: code, message, evidenceJson: {}, pageUrl });
    const api = fakeApi({
      "GET /api/audits/a1/issues": () => ({
        issues: [
          issue("i1", "info", "short_title", "https://site.test/b"),
          issue("i2", "error", "broken_link", "https://site.test/a", "x".repeat(500)),
          { ...issue("i3", "warning", "missing_title", "https://site.test/a"), evidenceJson: { words: Array.from({ length: 15 }, (_, index) => `word${index}`) } },
          issue("i4", "error", "broken_link", "https://site.test/c"),
        ],
      }),
      "GET /api/audits/a1/comparison": () => ({ previousRun: { id: "a0", finishedAt: null }, newIssueIds: ["i2", "i3"], fixedIssues: [] }),
    });

    const all = await callTool(api, ["read"], "list_issues", { auditId: "a1", limit: 3 });
    expect(all.data.issues.map((item: { id: string }) => item.id)).toEqual(["i2", "i4", "i3"]);
    expect(all.data).toMatchObject({ total: 4, offset: 0, nextOffset: 3, comparedWithAuditId: "a0" });
    expect(all.data.issues[0].message).toHaveLength(300);
    expect(all.data.issues[2].evidence.words).toHaveLength(11);

    const newOnes = await callTool(api, ["read"], "list_issues", { auditId: "a1", onlyNew: true, severity: ["warning"] });
    expect(newOnes.data.issues.map((item: { id: string; isNew: boolean }) => [item.id, item.isNew])).toEqual([["i3", true]]);
  });

  it("groups broken links by target", async () => {
    const link = (targetUrl: string, sourceUrl: string, isBroken = true) => ({ targetUrl, sourceUrl, isBroken, targetType: "external", httpStatus: 404, anchorText: "Read more" });
    const api = fakeApi({
      "GET /api/audits/a1/links": () => ({
        links: [
          link("https://gone.test/x", "https://site.test/a"),
          link("https://gone.test/y", "https://site.test/a"),
          link("https://gone.test/y", "https://site.test/b"),
          link("https://fine.test/", "https://site.test/a", false),
        ],
      }),
    });

    const { data } = await callTool(api, ["read"], "list_broken_links", { auditId: "a1" });
    expect(data.brokenLinks.map((item: { targetUrl: string; linkedFrom: number }) => [item.targetUrl, item.linkedFrom])).toEqual([
      ["https://gone.test/y", 2],
      ["https://gone.test/x", 1],
    ]);
  });

  it("reports progress, results and failure reasons", async () => {
    const run = (id: string, status: string, summaryJson: Record<string, unknown> = {}) => ({ auditRun: { id, websiteId: "w1", websiteName: "Site", baseUrl: "https://site.test/", status, cancelRequested: false, startedAt: null, finishedAt: null, pageCount: 12, summaryJson } });
    const api = fakeApi({
      "GET /api/audits/running": () => run("running", "running", { progress: { stage: "crawl", pagesCrawled: 4, linksChecked: 9, issuesFound: 2, queueSize: 7 } }),
      "GET /api/audits/done": () => run("done", "completed_with_limits", { auditSummary: "Crawled 12 pages.", maxPagesReached: true }),
      "GET /api/audits/done/issues": () => ({ issues: [{ id: "i1", severity: "error", category: "broken_link" }, { id: "i2", severity: "info", category: "seo" }] }),
      "GET /api/audits/done/comparison": () => ({ previousRun: { id: "before" }, newIssueIds: ["i1"], fixedIssues: [{}, {}] }),
      "GET /api/audits/failed": () => run("failed", "failed"),
      "GET /api/audits/failed/events": () => ({ events: [{ level: "error", message: "Browser crashed" }, { level: "info", message: "Worker accepted audit job" }] }),
    });

    const { data } = await callTool(api, ["read"], "get_audit_status", { auditIds: ["running", "done", "failed", "missing", "done"] });
    const [running, done, failed, missing] = data.audits;
    expect(data.audits).toHaveLength(4);
    expect(running.progress).toMatchObject({ stage: "crawl", pagesCrawled: 4, pagesQueued: 7 });
    expect(done).toMatchObject({
      note: "The audit reached its page limit, so some pages weren't audited.",
      issues: { total: 2, bySeverity: { error: 1, warning: 0, info: 1 }, byCategory: { broken_link: 1, seo: 1 } },
      changes: { previousAuditId: "before", newIssues: 1, fixedIssues: 2 },
    });
    expect(failed.reason).toBe("Browser crashed");
    expect(missing).toEqual({ auditId: "missing", error: "404: No fixture for /api/audits/missing" });
  });

  it("starts audits in a batch and points at audits already running", async () => {
    const api = fakeApi({
      "POST /api/websites/w1/audits": () => ({ auditRun: { id: "a1", status: "queued" } }),
      "POST /api/websites/w2/audits": apiError(409, "An audit is already queued or running for this website.", { auditRunId: "a0" }),
    });

    const result = await callTool(api, allScopes, "start_audits", { websiteIds: ["w1", "w2", "w1"] });
    expect(result.isError).toBe(false);
    expect(result.data.results).toEqual([
      { websiteId: "w1", auditId: "a1", status: "queued" },
      { websiteId: "w2", error: "409: An audit is already queued or running for this website.", activeAuditId: "a0" },
    ]);
    expect(api).toHaveBeenCalledTimes(2);

    const allFailed = await callTool(api, allScopes, "start_audits", { websiteIds: ["w2"] });
    expect(allFailed.isError).toBe(true);
  });

  it("allows typo words one at a time and reports each failure", async () => {
    const api = fakeApi({
      "POST /api/audits/a1/typo-allowlist": (options) => {
        const word = String(options?.body?.word);
        if (word.length < 2) {
          return apiError(400, "Validation failed.")();
        }
        return { word: word.toLowerCase() };
      },
    });

    const { data } = await callTool(api, allScopes, "allow_typo_words", { auditId: "a1", words: ["Bevan", "x", "Bevan"] });
    expect(data.results).toEqual([{ word: "bevan" }, { word: "x", error: "400: Validation failed." }]);
  });

  it("ignores broken links by URL or domain", async () => {
    const api = fakeApi({ "POST /api/audits/a1/link-ignores": () => ({ linkIgnores: [] }) });

    const { data } = await callTool(api, allScopes, "ignore_broken_links", { auditId: "a1", links: ["facebook.com", "https://site.test/old#top", "mailto:hi@site.test"] });
    expect(data.results).toEqual([
      { link: "facebook.com", ignored: { kind: "domain", value: "facebook.com" } },
      { link: "https://site.test/old#top", ignored: { kind: "url", value: "https://site.test/old" } },
      { link: "mailto:hi@site.test", error: "Not a valid URL or domain." },
    ]);
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("turns API errors into tool errors", async () => {
    const api = fakeApi({ "GET /api/websites": apiError(403, "This API token is missing the read scope.") });

    const result = await callTool(api, ["read"], "list_websites", {});
    expect(result).toMatchObject({ isError: true, text: "403: This API token is missing the read scope." });
  });
});

describe("mCP formatting", () => {
  it("caps long strings, arrays and nesting", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(compactEvidence({ a: { b: { c: { d: 1 } } } })).toEqual({ a: { b: { c: "…" } } });
    expect(compactEvidence(Array.from({ length: 12 }, (_, index) => index))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, "…and 2 more"]);
  });

  it("pages through results", () => {
    expect(paginate([1, 2, 3], 0, 2)).toEqual({ total: 3, offset: 0, nextOffset: 2, items: [1, 2] });
    expect(paginate([1, 2, 3], 2, 2)).toEqual({ total: 3, offset: 2, nextOffset: null, items: [3] });
  });

  it("keeps results in input order under concurrency", async () => {
    const results = await mapWithConcurrency([30, 10, 20], 2, async (delay) => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return delay;
    });
    expect(results).toEqual([30, 10, 20]);
  });
});
