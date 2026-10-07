import { buildAllowSuggestions, buildDenySuggestions, buildDiscoveryPreview, discoverAuditCandidates } from "@website-auditor/audit-engine";

import { getWebsiteById } from "@website-auditor/db";
import { crawlRulesSchema } from "@website-auditor/shared";
import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";

defineRouteMeta({
  openAPI: {
    tags: ["Websites"],
    summary: "Preview crawl discovery",
    description: "Reads the website's sitemaps now and returns `{ discovery, allowSuggestions, denySuggestions }` with the saved crawl rules applied.",
    security: [{ bearerAuth: ["read"] }],
  },
});

export default defineEventHandler(async (event) => {
  await requireUser(event, "read");
  const websiteId = getRouterParam(event, "id");

  if (!websiteId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Website id is required.",
    });
  }

  const website = await getWebsiteById(websiteId);
  if (!website) {
    throw createError({
      statusCode: 404,
      statusMessage: "Website not found.",
    });
  }

  const crawlRules = crawlRulesSchema.parse(website.crawlRulesJson ?? {});
  const discovery = buildDiscoveryPreview(
    await discoverAuditCandidates(website.baseUrl),
    crawlRules,
  );

  return {
    discovery,
    allowSuggestions: buildAllowSuggestions(discovery)
      .filter(suggestion => !crawlRules.allow.some(rule => rule.matcher === suggestion.matcher && rule.pattern === suggestion.pattern)),
    denySuggestions: buildDenySuggestions(discovery)
      .filter(suggestion => !crawlRules.deny.some(rule => rule.matcher === suggestion.matcher && rule.pattern === suggestion.pattern)),
  };
});
