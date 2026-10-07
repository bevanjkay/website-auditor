import { updateWebsite } from "@website-auditor/db";

import { crawlRulesSchema, lighthouseTargetsSchema, linkIgnoresSchema, typoAllowlistSchema, typoLanguageSchema, websiteUpdateSchema } from "@website-auditor/shared";
import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";
import { readValidatedBody } from "../../../utils/validation.js";

defineRouteMeta({
  openAPI: {
    tags: ["Websites"],
    summary: "Update a website",
    description: "Fields left out are unchanged. Returns `{ website }`.",
    security: [{ bearerAuth: ["websites:write"] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Up to 120 characters." },
              isActive: { type: "boolean", description: "`false` archives the website and `true` restores it." },
              crawlRules: {
                type: "object",
                description: "Replaces both lists. The allowlist applies first and the denylist wins on conflict.",
                properties: {
                  allow: { type: "array", maxItems: 50, items: { $ref: "#/components/schemas/CrawlRule" } },
                  deny: { type: "array", maxItems: 50, items: { $ref: "#/components/schemas/CrawlRule" } },
                },
              },
              lighthouseTargets: { type: "array", maxItems: 10, description: "URLs audited with Lighthouse in addition to the homepage.", items: { type: "string", format: "uri" } },
              typoLanguage: { type: "string", enum: ["en", "en-au", "en-gb", "en-us"] },
              typoAllowlist: { type: "array", maxItems: 500, description: "Replaces the whole allowlist.", items: { type: "string" } },
              linkIgnores: { type: "array", maxItems: 200, description: "Replaces the whole list.", items: { $ref: "#/components/schemas/LinkIgnore" } },
            },
          },
        },
      },
    },
  },
});

export default defineEventHandler(async (event) => {
  await requireUser(event, "websites:write");
  const id = getRouterParam(event, "id");
  const body = await readValidatedBody(event, websiteUpdateSchema);

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Website id is required.",
    });
  }

  const website = await updateWebsite(id, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    ...(body.typoLanguage !== undefined ? { typoLanguage: typoLanguageSchema.parse(body.typoLanguage) } : {}),
    ...(body.typoAllowlist !== undefined ? { typoAllowlist: typoAllowlistSchema.parse(body.typoAllowlist) } : {}),
    ...(body.crawlRules ? { crawlRules: crawlRulesSchema.parse(body.crawlRules) } : {}),
    ...(body.lighthouseTargets ? { lighthouseTargets: lighthouseTargetsSchema.parse(body.lighthouseTargets) } : {}),
    ...(body.linkIgnores ? { linkIgnores: linkIgnoresSchema.parse(body.linkIgnores) } : {}),
  });
  if (!website) {
    throw createError({
      statusCode: 404,
      statusMessage: "Website not found.",
    });
  }

  return { website };
});
