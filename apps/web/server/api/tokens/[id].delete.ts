import { getApiToken, revokeApiToken } from "@website-auditor/db";

import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireSessionUser } from "../../utils/auth.js";

defineRouteMeta({
  openAPI: {
    tags: ["API tokens"],
    summary: "Revoke an API token",
    description: "Browser session only; API tokens get 403.",
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Token id is required." });
  }

  const apiToken = await getApiToken(id);
  if (!apiToken || (apiToken.userId !== user.id && user.role !== "admin")) {
    throw createError({ statusCode: 404, statusMessage: "API token not found." });
  }

  await revokeApiToken(id);
  return { ok: true };
});
