import { listWebsites } from "@website-auditor/db";

import { defineEventHandler } from "h3";

import { requireUser } from "../../utils/auth.js";

export default defineEventHandler(async (event) => {
  await requireUser(event);
  return {
    websites: await listWebsites(),
  };
});
