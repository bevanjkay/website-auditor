import { defineEventHandler } from "h3";

import { endSession } from "../../utils/auth.js";

defineRouteMeta({
  openAPI: {
    tags: ["Session"],
    summary: "Sign out",
    description: "Ends the browser session.",
  },
});

export default defineEventHandler(async (event) => {
  await endSession(event);
  return { ok: true };
});
