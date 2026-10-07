import { getWebsiteDetails, summarizeRunIssues } from "@website-auditor/db";

import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";

defineRouteMeta({
  openAPI: {
    tags: ["Websites"],
    summary: "Get a website",
    description: "Returns `{ website, latestIssueSummary }`.",
    security: [{ bearerAuth: ["read"] }],
  },
});

export default defineEventHandler(async (event) => {
  await requireUser(event, "read");
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Website id is required.",
    });
  }

  const website = await getWebsiteDetails(id);
  if (!website) {
    throw createError({
      statusCode: 404,
      statusMessage: "Website not found.",
    });
  }

  return {
    website,
    latestIssueSummary: website.lastAuditRunId ? await summarizeRunIssues(website.lastAuditRunId) : {},
  };
});
