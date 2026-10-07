import { allowTypoWordForWebsiteAndRun, getAuditRun } from "@website-auditor/db";

import { addTypoAllowlistWordSchema } from "@website-auditor/shared";
import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";
import { readValidatedBody } from "../../../utils/validation.js";

defineRouteMeta({
  openAPI: {
    tags: ["Audit results"],
    summary: "Allow a typo word",
    description: "Adds the word to the website's typo allowlist and drops matching typo issues from this audit. Returns `{ word, typoAllowlist }`.",
    security: [{ bearerAuth: ["websites:write"] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["word"],
            properties: {
              word: { type: "string", description: "2 to 100 characters, stored in lowercase." },
            },
          },
        },
      },
    },
  },
});

export default defineEventHandler(async (event) => {
  await requireUser(event, "websites:write");
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Audit id is required.",
    });
  }

  const body = await readValidatedBody(event, addTypoAllowlistWordSchema);
  const auditRun = await getAuditRun(id);

  if (!auditRun) {
    throw createError({
      statusCode: 404,
      statusMessage: "Audit run not found.",
    });
  }

  const result = await allowTypoWordForWebsiteAndRun({
    websiteId: auditRun.websiteId,
    runId: id,
    word: body.word,
  });

  return result;
});
