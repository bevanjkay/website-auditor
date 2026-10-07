import { defineEventHandler } from "h3";

import { requireSessionUser } from "../../utils/auth.js";
import { getMcpStatus } from "../../utils/mcp-settings.js";

defineRouteMeta({
  openAPI: {
    tags: ["Settings"],
    summary: "Get MCP server status",
    description: "Returns `{ enabled, disabledByEnv, updatedAt, updatedBy }`. Browser session only; API tokens get 403.",
  },
});

export default defineEventHandler(async (event) => {
  await requireSessionUser(event);
  return getMcpStatus();
});
