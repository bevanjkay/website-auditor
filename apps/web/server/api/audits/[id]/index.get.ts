import { getAuditRun } from "@website-auditor/db";

import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";

export default defineEventHandler(async (event) => {
  await requireUser(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Audit id is required.",
    });
  }

  const auditRun = await getAuditRun(id);
  if (!auditRun) {
    throw createError({
      statusCode: 404,
      statusMessage: "Audit run not found.",
    });
  }

  return { auditRun };
});
