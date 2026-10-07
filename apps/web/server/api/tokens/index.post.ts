import { createApiToken } from "@website-auditor/db";

import { apiTokenScopesForRole, createApiTokenSchema } from "@website-auditor/shared";
import { createError, defineEventHandler } from "h3";

import { requireSessionUser } from "../../utils/auth.js";
import { generateApiToken } from "../../utils/security.js";
import { readValidatedBody } from "../../utils/validation.js";

const dayMs = 1000 * 60 * 60 * 24;

defineRouteMeta({
  openAPI: {
    tags: ["API tokens"],
    summary: "Create an API token",
    description: "Returns `{ token, apiToken }`. The token is only ever shown in this response. Browser session only; API tokens get 403.",
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event);
  const body = await readValidatedBody(event, createApiTokenSchema);
  const allowedScopes = apiTokenScopesForRole(user.role);
  const deniedScope = body.scopes.find(scope => !allowedScopes.includes(scope));

  if (deniedScope) {
    throw createError({
      statusCode: 403,
      statusMessage: `Only administrators can grant the ${deniedScope} scope.`,
    });
  }

  const { token, prefix, tokenHash } = generateApiToken();
  const apiToken = await createApiToken({
    userId: user.id,
    name: body.name,
    prefix,
    tokenHash,
    scopes: body.scopes,
    expiresAt: body.expiresInDays === null ? null : new Date(Date.now() + body.expiresInDays * dayMs),
  });

  return { token, apiToken };
});
