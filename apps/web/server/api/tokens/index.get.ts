import { listApiTokens } from "@website-auditor/db";

import { defineEventHandler } from "h3";

import { requireSessionUser } from "../../utils/auth.js";

defineRouteMeta({
  openAPI: {
    tags: ["API tokens"],
    summary: "List API tokens",
    description: "Returns `{ tokens }`: your own, or everyone's for administrators. Browser session only; API tokens get 403.",
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event);
  return {
    tokens: await listApiTokens(user.role === "admin" ? undefined : user.id),
  };
});
