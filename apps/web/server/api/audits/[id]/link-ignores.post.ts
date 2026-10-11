import { getAuditRun, ignoreBrokenLinkForWebsiteAndRun } from "@website-auditor/db";

import { linkIgnoreRequestSchema } from "@website-auditor/shared";
import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";
import { readValidatedBody } from "../../../utils/validation.js";

defineRouteMeta({
  openAPI: {
    tags: ["Audit results"],
    summary: "Ignore a broken link or failed resource",
    description: "Drops matching broken links and failed page resources from this audit. With `scope: \"website\"` (the default) the rule is also saved to the website so future audits skip it; `scope: \"audit\"` dismisses it for this audit only. Returns `{ linkIgnores }`, the rules now in effect for that scope.",
    security: [{ bearerAuth: ["websites:write"] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            allOf: [
              { $ref: "#/components/schemas/LinkIgnore" },
              {
                type: "object",
                properties: {
                  scope: { type: "string", enum: ["audit", "website"], default: "website", description: "`audit` dismisses for this audit only; `website` also saves the rule for future audits." },
                },
              },
            ],
          },
        },
      },
    },
  },
});

export default defineEventHandler(async (event) => {
  await requireUser(event, "websites:write");
  const id = getRouterParam(event, "id");
  const { scope, ...rule } = await readValidatedBody(event, linkIgnoreRequestSchema);

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
    scope,
  });
});
