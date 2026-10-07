import { createError, defineEventHandler, toWebRequest } from "h3";

import { version } from "../../package.json";
import { createAuditorMcpHandler } from "../mcp/server.js";
import { requireApiToken } from "../utils/auth.js";
import { getMcpStatus } from "../utils/mcp-settings.js";

defineRouteMeta({
  openAPI: {
    tags: ["MCP"],
    summary: "MCP server",
    description: "Streamable HTTP endpoint for MCP clients. Authenticate with an API token; the tools on offer follow its scopes. Responds 404 while the MCP server is turned off.",
    security: [{ bearerAuth: [] }],
  },
});

let handler: ReturnType<typeof createAuditorMcpHandler> | undefined;

export default defineEventHandler(async (event) => {
  const status = await getMcpStatus();
  if (!status.enabled) {
    throw createError({
      statusCode: 404,
      statusMessage: "The MCP server is turned off.",
    });
  }

  const { user, scopes, token } = await requireApiToken(event);
  handler ??= createAuditorMcpHandler({
    version,
    createApiCaller: apiToken => (path, options) => $fetch(path, { ...options, headers: { authorization: `Bearer ${apiToken}` } }),
  });

  return handler.fetch(toWebRequest(event), {
    authInfo: { token, clientId: user.id, scopes, extra: { username: user.username } },
  });
});
