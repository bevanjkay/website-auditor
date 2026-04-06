import { buildDiscoveryPreview, discoverAuditCandidates } from "@website-auditor/audit-engine";

import { createAuditRun, getWebsiteById } from "@website-auditor/db";
import { crawlRulesSchema, lighthouseTargetsSchema, typoAllowlistSchema, typoLanguageSchema } from "@website-auditor/shared";
import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";
import { getAuditQueue } from "../../../utils/queue.js";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
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
  const lighthouseTargets = lighthouseTargetsSchema.parse(website.lighthouseTargetsJson ?? []);
  const typoLanguage = typoLanguageSchema.parse(website.typoLanguage ?? "en");
  const typoAllowlist = typoAllowlistSchema.parse(website.typoAllowlistJson ?? []);
  const discovery = buildDiscoveryPreview(
    await discoverAuditCandidates(website.baseUrl),
    crawlRules,
  );

  if (discovery.included === 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "No URLs remain after applying the current crawl rules.",
    });
  }

  const run = await createAuditRun({
    websiteId,
    triggeredByUserId: user.id,
    typoLanguage,
    typoAllowlist,
    crawlRules,
    discovery,
    lighthouseTargets,
  });

  await getAuditQueue().add(run.id, {
    websiteId,
    auditRunId: run.id,
  }, {
    jobId: run.id,
  });

  return { auditRun: run };
});
