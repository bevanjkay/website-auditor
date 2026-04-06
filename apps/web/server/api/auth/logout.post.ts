import { defineEventHandler } from "h3";

import { endSession } from "../../utils/auth.js";

export default defineEventHandler(async (event) => {
  await endSession(event);
  return { ok: true };
});
