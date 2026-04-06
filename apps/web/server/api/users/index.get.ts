import { listUsers } from "@website-auditor/db";

import { defineEventHandler } from "h3";

import { requireAdmin } from "../../utils/auth.js";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  return {
    users: await listUsers(),
  };
});
