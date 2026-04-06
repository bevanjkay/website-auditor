import { auditQueueName } from "@website-auditor/shared";

import { Queue } from "bullmq";

let queue: Queue | undefined;

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

export function getAuditQueue() {
  queue ??= new Queue(auditQueueName, {
    connection: getRedisConnection(),
  });

  return queue;
}
