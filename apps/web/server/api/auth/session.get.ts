import { defineEventHandler } from "h3";

import { getSessionUserFromEvent } from "../../utils/auth.js";

export default defineEventHandler(async event => ({
  user: await getSessionUserFromEvent(event),
}));
