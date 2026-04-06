import { runAudit } from "@website-auditor/audit-engine";

import {
  appendAuditEvent,
  cancelAuditRun,
  completeAuditRun,
  failAuditRun,
  getAuditRun,
  getWebsiteById,
  markAuditRunStatus,
  updateAuditRunProgress,
} from "@website-auditor/db";
import {
  auditQueueName,
  crawlRulesSchema,
  discoveryPreviewSchema,
  lighthouseTargetsSchema,
  typoAllowlistSchema,
  typoLanguageSchema,
} from "@website-auditor/shared";
import { Worker } from "bullmq";

interface AuditJobPayload {
  websiteId: string;
  auditRunId: string;
}

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is required.");
  }

  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname ? Number(url.pathname.replace("/", "") || 0) : 0,
  };
}

function getAuditConfig() {
  return {
    maxPages: Number(process.env.AUDIT_MAX_PAGES ?? 500),
    maxDepth: Number(process.env.AUDIT_MAX_DEPTH ?? 5),
    pageTimeoutMs: Number(process.env.AUDIT_PAGE_TIMEOUT_MS ?? 15000),
    browserConcurrency: Number(process.env.AUDIT_BROWSER_CONCURRENCY ?? 3),
    linkConcurrency: Number(process.env.AUDIT_LINK_CONCURRENCY ?? 10),
  };
}

const worker = new Worker<AuditJobPayload>(
  auditQueueName,
  async (job) => {
    const run = await getAuditRun(job.data.auditRunId);
    const website = await getWebsiteById(job.data.websiteId);

    if (!run || !website) {
      throw new Error("Missing audit run or website for job.");
    }

    if (run.status === "cancelled") {
      return {
        status: "cancelled",
        skipped: true,
      };
    }

    if (run.cancelRequested) {
      await cancelAuditRun(run.id, "Audit cancelled before execution started.");
      return {
        status: "cancelled",
        skipped: true,
      };
    }

    await markAuditRunStatus(run.id, "running");
    await appendAuditEvent(run.id, {
      level: "info",
      message: "Worker accepted audit job",
      context: {
        websiteId: website.id,
      },
    });

    try {
      const crawlRules = crawlRulesSchema.parse(run.crawlRulesJson ?? {});
      const discovery = Object.keys((run.discoveryJson ?? {}) as Record<string, unknown>).length > 0
        ? discoveryPreviewSchema.parse(run.discoveryJson)
        : undefined;
      const lighthouseTargets = lighthouseTargetsSchema.parse(run.lighthouseTargetsJson ?? []);
      const typoLanguage = typoLanguageSchema.parse(run.typoLanguage ?? "en");
      const typoAllowlist = typoAllowlistSchema.parse(run.typoAllowlistJson ?? []);

      const result = await runAudit(website.baseUrl, getAuditConfig(), {
        crawlRules,
        discovery,
        lighthouseTargets,
        typoLanguage,
        getTypoAllowlist: async () => {
          const latestRun = await getAuditRun(run.id);
          return typoAllowlistSchema.parse(latestRun?.typoAllowlistJson ?? typoAllowlist);
        },
        onEvent: async (event) => {
          await appendAuditEvent(run.id, event);
        },
        onProgress: async (progress) => {
          await updateAuditRunProgress({
            runId: run.id,
            pageCount: progress.pagesCrawled,
            issueCount: progress.issuesFound,
            summaryJson: {
              progress,
            },
          });
        },
        shouldCancel: async () => {
          const latestRun = await getAuditRun(run.id);
          return latestRun?.cancelRequested === true;
        },
      });
      if (result.status === "cancelled") {
        await completeAuditRun(run.id, result);
        await cancelAuditRun(run.id, "Audit stopped by user.");
      }
      else {
        await completeAuditRun(run.id, result);
      }
      return {
        status: result.status,
        pages: result.pages.length,
        issues: result.issues.length,
      };
    }
    catch (error) {
      await failAuditRun(
        run.id,
        error instanceof Error ? error.message : "Unknown audit failure",
      );
      throw error;
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  },
);

worker.on("completed", (job, result) => {
  console.log("Audit completed", {
    jobId: job.id,
    result,
  });
});

worker.on("failed", (job, error) => {
  console.error("Audit failed", {
    jobId: job?.id,
    error: error.message,
  });
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await worker.close();
    process.exit(0);
  });
}
