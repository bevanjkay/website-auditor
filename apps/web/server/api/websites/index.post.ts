import { createWebsite, getWebsiteByHost } from "@website-auditor/db";

import { normalizeWebsiteUrl, websiteInputSchema } from "@website-auditor/shared";
import { createError, defineEventHandler } from "h3";

import { requireUser } from "../../utils/auth.js";
import { readValidatedBody } from "../../utils/validation.js";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = await readValidatedBody(event, websiteInputSchema);
  const normalized = normalizeWebsiteUrl(body.baseUrl);
  const existing = await getWebsiteByHost(normalized.normalizedHost);

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: "A website with this host already exists.",
    });
  }

  const website = await createWebsite({
    name: body.name,
    baseUrl: normalized.baseUrl,
    normalizedHost: normalized.normalizedHost,
    createdByUserId: user.id,
    typoLanguage: body.typoLanguage,
  });

  return {
    website,
  };
});
