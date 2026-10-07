import { createWebsite, getWebsiteByHost } from "@website-auditor/db";

import { normalizeWebsiteUrl, websiteInputSchema } from "@website-auditor/shared";
import { createError, defineEventHandler } from "h3";

import { requireUser } from "../../utils/auth.js";
import { readValidatedBody } from "../../utils/validation.js";

defineRouteMeta({
  openAPI: {
    tags: ["Websites"],
    summary: "Add a website",
    description: "Returns `{ website }`. Responds 409 when a website with the same host already exists.",
    security: [{ bearerAuth: ["websites:write"] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "baseUrl"],
            properties: {
              name: { type: "string", description: "Up to 120 characters." },
              baseUrl: { type: "string", description: "The site's address. `https://` is added when it's missing." },
              typoLanguage: { type: "string", enum: ["en", "en-au", "en-gb", "en-us"] },
            },
          },
        },
      },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, "websites:write");
  const body = await readValidatedBody(event, websiteInputSchema);
  const normalized = normalizeWebsiteUrl(body.baseUrl);
  const existing = await getWebsiteByHost(normalized.normalizedHost);

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: existing.isActive
        ? "A website with this host already exists."
        : "A website with this host is archived. Restore it from the archived list on the dashboard.",
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
