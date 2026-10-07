import { mcpSettingsSchema } from "@website-auditor/shared";
import { createError, defineEventHandler } from "h3";

import { requireAdmin } from "../../utils/auth.js";
import { isMcpDisabledByEnv, setMcpEnabled } from "../../utils/mcp-settings.js";
import { readValidatedBody } from "../../utils/validation.js";

defineRouteMeta({
  openAPI: {
    tags: ["Settings"],
    summary: "Turn the MCP server on or off",
    description: "Takes `{ enabled }` and returns the new status. Responds 409 when the `MCP_DISABLED` environment variable has turned the MCP server off. Administrators only, from a browser session; API tokens get 403.",
  },
});

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const body = await readValidatedBody(event, mcpSettingsSchema);

  if (isMcpDisabledByEnv()) {
    throw createError({
      statusCode: 409,
      statusMessage: "The MCP server is turned off by the MCP_DISABLED environment variable.",
    });
  }

  return setMcpEnabled(body.enabled, admin.id);
});
