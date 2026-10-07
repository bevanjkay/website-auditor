import { buildDiscoveryPreview, discoverAuditCandidates } from "@website-auditor/audit-engine";

import { createAuditRun, getWebsiteById } from "@website-auditor/db";
import { crawlRulesSchema, lighthouseTargetsSchema, linkIgnoresSchema, typoAllowlistSchema, typoLanguageSchema } from "@website-auditor/shared";
import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";
import { getAuditQueue } from "../../../utils/queue.js";

defineRouteMeta({
  openAPI: {
    tags: ["Audits"],
    summary: "Start an audit",
    description: "Queues an audit with the website's saved settings and returns `{ auditRun }` straight away. Poll `GET /api/audits/{id}` until `status` is no longer `queued` or `running`.",
    security: [{ bearerAuth: ["audit:run"] }],
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, "audit:run");
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

  if (!website.isActive) {
    throw createError({
      statusCode: 409,
      statusMessage: "This website is archived. Restore it before running an audit.",
    });
  }

  const crawlRules = crawlRulesSchema.parse(website.crawlRulesJson ?? {});
  const lighthouseTargets = lighthouseTargetsSchema.parse(website.lighthouseTargetsJson ?? []);
  const typoLanguage = typoLanguageSchema.parse(website.typoLanguage ?? "en");
  const typoAllowlist = typoAllowlistSchema.parse(website.typoAllowlistJson ?? []);
  const linkIgnores = linkIgnoresSchema.parse(website.linkIgnoresJson ?? []);
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
    linkIgnores,
  });

  await getAuditQueue().add(run.id, {
    websiteId,
    auditRunId: run.id,
  }, {
    jobId: run.id,
  });

  return { auditRun: run };
});
