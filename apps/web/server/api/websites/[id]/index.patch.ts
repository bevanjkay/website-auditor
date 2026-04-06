import { updateWebsite } from "@website-auditor/db";

import { crawlRulesSchema, lighthouseTargetsSchema, typoAllowlistSchema, typoLanguageSchema, websiteUpdateSchema } from "@website-auditor/shared";
import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";
import { readValidatedBody } from "../../../utils/validation.js";

export default defineEventHandler(async (event) => {
  await requireUser(event);
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
  });
  if (!website) {
    throw createError({
      statusCode: 404,
      statusMessage: "Website not found.",
    });
  }

  return { website };
});
