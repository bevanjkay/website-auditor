import { defineEventHandler } from "h3";

import { getSessionUserFromEvent } from "../../utils/auth.js";

defineRouteMeta({
  openAPI: {
    tags: ["Session"],
    summary: "Get the signed-in user",
    description: "Returns `{ user }` for the browser session, or `null`. API tokens are ignored.",
  },
});

export default defineEventHandler(async event => ({
  user: await getSessionUserFromEvent(event),
}));
