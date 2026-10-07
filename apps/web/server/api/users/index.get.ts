import { listUsers } from "@website-auditor/db";

import { defineEventHandler } from "h3";

import { requireAdmin } from "../../utils/auth.js";

defineRouteMeta({
  openAPI: {
    tags: ["Users"],
    summary: "List users",
    description: "Administrators only, from a browser session; API tokens get 403.",
  },
});

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  return {
    users: await listUsers(),
  };
});
