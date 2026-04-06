import {
  appendAuditEvent,
  cancelAuditRun,
  getAuditRun,
  requestAuditRunCancellation,
} from "@website-auditor/db";

import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireUser } from "../../../utils/auth.js";
import { getAuditQueue } from "../../../utils/queue.js";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
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
    try {
      await job?.remove();
    }
    catch {
      // If the worker has already claimed the job, the persisted cancelled state
      // still causes the worker to exit before doing useful work.
    }
    await cancelAuditRun(auditRun.id, "Audit stopped before execution started.");

    return {
      auditRun: await getAuditRun(auditRun.id),
    };
  }

  if (!auditRun.cancelRequested) {
    await requestAuditRunCancellation(auditRun.id);
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
