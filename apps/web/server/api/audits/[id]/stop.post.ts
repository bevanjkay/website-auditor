import {
  appendAuditEvent,
  cancelAuditRun,
  getAuditRun,
  requestAuditRunCancellation,
} from "@website-auditor/db";

import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";
import { getAuditQueue } from "../../../utils/queue.js";

defineRouteMeta({
  openAPI: {
    tags: ["Audits"],
    summary: "Stop an audit",
    description: "Stops a queued or running audit and returns `{ auditRun }`. Responds 409 once the audit has finished.",
    security: [{ bearerAuth: ["audit:run"] }],
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, "audit:run");
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

  if (!["queued", "running"].includes(auditRun.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: "Only queued or running audits can be stopped.",
    });
  }

  if (auditRun.status === "queued") {
    const job = await getAuditQueue().getJob(auditRun.id);
    // remove() throws once a worker has claimed the job; that worker then honours the cancellation request below.
    const removed = await (job?.remove() ?? Promise.resolve()).then(() => true, () => false);
    if (removed && await cancelAuditRun(auditRun.id, "Audit stopped before execution started.", ["queued"])) {
      return {
        auditRun: await getAuditRun(auditRun.id),
      };
    }
  }

  if (!auditRun.cancelRequested && await requestAuditRunCancellation(auditRun.id)) {
    await appendAuditEvent(auditRun.id, {
      level: "warning",
      message: "Audit stop requested",
      context: {
        requestedByUserId: user.id,
        requestedByUsername: user.username,
      },
    });
  }

  return {
    auditRun: await getAuditRun(auditRun.id),
  };
});
