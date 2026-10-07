import { getAuditRun, ignoreBrokenLinkForWebsiteAndRun } from "@website-auditor/db";

import { linkIgnoreSchema } from "@website-auditor/shared";
import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";
import { readValidatedBody } from "../../../utils/validation.js";

defineRouteMeta({
  openAPI: {
    tags: ["Audit results"],
    summary: "Ignore a broken link",
    description: "Adds the rule to the website's ignored links and drops matching broken links from this audit. Returns `{ linkIgnores }`.",
    security: [{ bearerAuth: ["websites:write"] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/LinkIgnore" },
        },
      },
    },
  },
});

export default defineEventHandler(async (event) => {
  await requireUser(event, "websites:write");
  const id = getRouterParam(event, "id");
  const rule = await readValidatedBody(event, linkIgnoreSchema);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Audit id is required." });
  }

  const auditRun = await getAuditRun(id);
  if (!auditRun) {
    throw createError({ statusCode: 404, statusMessage: "Audit run not found." });
  }

  return ignoreBrokenLinkForWebsiteAndRun({
    websiteId: auditRun.websiteId,
    runId: auditRun.id,
    rule: rule.kind === "domain" ? { kind: "domain", value: rule.value.toLowerCase() } : rule,
  });
});
