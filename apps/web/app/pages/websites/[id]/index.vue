<script setup lang="ts">
import type { SeverityCounts } from "../../../composables/useStatus";

interface WebsiteDetailResponse {
  website: {
    id: string;
    name: string;
    baseUrl: string;
    isActive: boolean;
    lastAuditRunId: string | null;
    latestRun: { id: string; status: string } | null;
  };
  latestIssueSummary: Record<string, number>;
}

interface AuditRunRow {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  pageCount: number;
  issueCount: number;
  brokenLinkCount: number;
  severityCounts: SeverityCounts;
}

const route = useRoute();
const websiteId = computed(() => String(route.params.id));

const { data: websiteData, refresh: refreshWebsite, error: websiteError } = await useAsyncData<WebsiteDetailResponse>(
  () => `website-${websiteId.value}`,
  () => $fetch(`/api/websites/${websiteId.value}`),
);
const { data: auditsData, refresh: refreshAudits } = await useAsyncData<{ auditRuns: AuditRunRow[] }>(
  () => `website-audits-${websiteId.value}`,
  () => $fetch(`/api/websites/${websiteId.value}/audits`),
);

const website = computed(() => websiteData.value?.website ?? null);
useHead(() => ({ title: website.value?.name ?? "Website" }));

async function refreshAll() {
  await Promise.all([refreshWebsite(), refreshAudits()]);
}

const { runPending, archivePending, actionError, runAudit, setArchived } = useWebsiteActions(websiteId, refreshAll);

const runs = computed(() => auditsData.value?.auditRuns ?? []);
const completedRuns = computed(() => runs.value.filter(run => isCompletedRunStatus(run.status)));
const latestCompleted = computed(() => completedRuns.value[0] ?? null);
const previousCompleted = computed(() => completedRuns.value[1] ?? null);
const activeRun = computed(() => runs.value.find(run => isActiveRunStatus(run.status)) ?? null);
const latestRun = computed(() => runs.value[0] ?? null);

const historyLimit = ref(20);
const visibleRuns = computed(() => runs.value.slice(0, historyLimit.value));

const categoryBreakdown = computed(() => {
  if (!latestCompleted.value || website.value?.lastAuditRunId !== latestCompleted.value.id) {
    return [];
  }
  const entries = Object.entries(websiteData.value?.latestIssueSummary ?? {}).sort((left, right) => right[1] - left[1]);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return entries.map(([category, count]) => ({ category, count, share: count / max }));
});

let pollHandle: ReturnType<typeof setInterval> | undefined;
watch(() => Boolean(activeRun.value), (active) => {
  if (active && pollHandle === undefined) {
    pollHandle = setInterval(() => void refreshAll(), 5000);
  }
  else if (!active && pollHandle !== undefined) {
    clearInterval(pollHandle);
    pollHandle = undefined;
  }
}, { immediate: true });

onBeforeUnmount(() => {
  if (pollHandle !== undefined) {
    clearInterval(pollHandle);
  }
});
</script>

<template>
  <div>
    <AlertMessage
      v-if="websiteError"
      tone="error"
      title="Couldn't load this website"
    >
      {{ getErrorMessage(websiteError, 'It may have been removed.') }}
      <template #actions>
        <NuxtLink
          class="btn btn-sm"
          to="/"
        >
          Back to websites
        </NuxtLink>
      </template>
    </AlertMessage>

    <template v-else-if="website">
      <WebsiteHeader
        :website="website"
        current="overview"
      >
        <template #actions>
          <template v-if="website.isActive">
            <button
              type="button"
              class="btn"
              :disabled="archivePending || Boolean(activeRun)"
              :title="activeRun ? 'Wait for the running audit to finish before archiving' : undefined"
              @click="setArchived(true)"
            >
              <AppIcon name="archive" />
              Archive
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="runPending || Boolean(activeRun)"
              @click="runAudit"
            >
              <AppIcon
                :name="runPending ? 'loader' : 'play'"
                :class="{ spin: runPending }"
              />
              {{ runPending ? 'Starting…' : activeRun ? 'Audit running' : 'Run audit' }}
            </button>
          </template>
          <button
            v-else
            type="button"
            class="btn btn-primary"
            :disabled="archivePending"
            @click="setArchived(false)"
          >
            <AppIcon name="restore" />
            Restore website
          </button>
        </template>
      </WebsiteHeader>

      <div class="stack-lg">
        <AlertMessage
          v-if="actionError"
          tone="error"
          dismissible
          @dismiss="actionError = ''"
        >
          {{ actionError }}
          <template
            v-if="actionError.includes('crawl rules')"
            #actions
          >
            <NuxtLink
              class="btn btn-sm"
              :to="`/websites/${website.id}/settings`"
            >
              Review crawl rules
            </NuxtLink>
          </template>
        </AlertMessage>

        <AlertMessage
          v-if="!website.isActive"
          title="This website is archived"
        >
          It's hidden from the websites list and can't be audited. Its audit history is kept, and restoring it brings everything back.
        </AlertMessage>

        <AlertMessage
          v-if="activeRun"
          tone="accent"
          :title="activeRun.status === 'queued' ? 'An audit is queued' : 'An audit is running'"
        >
          Started {{ formatRelativeTime(activeRun.startedAt, 'just now') }}. Results appear here when it finishes.
          <template #actions>
            <NuxtLink
              class="btn btn-sm"
              :to="`/audits/${activeRun.id}`"
            >
              View progress
            </NuxtLink>
          </template>
        </AlertMessage>

        <AlertMessage
          v-else-if="latestRun?.status === 'failed'"
          tone="error"
          title="The last audit failed"
        >
          {{ formatRelativeTime(latestRun.finishedAt ?? latestRun.startedAt) }}. The report shows what went wrong.
          <template #actions>
            <NuxtLink
              class="btn btn-sm"
              :to="`/audits/${latestRun.id}`"
            >
              See what happened
            </NuxtLink>
          </template>
        </AlertMessage>

        <section
          aria-labelledby="latest-heading"
          class="stack"
        >
          <div class="section-heading">
            <h2 id="latest-heading">
              Latest results
            </h2>
            <p v-if="latestCompleted">
              <NuxtLink :to="`/audits/${latestCompleted.id}`">
                Audit from {{ formatDateTime(latestCompleted.startedAt) }}
              </NuxtLink>
              <template v-if="previousCompleted">
                · compared with {{ formatShortDate(previousCompleted.startedAt) }}
              </template>
            </p>
          </div>

          <template v-if="latestCompleted">
            <VerdictSummary
              :counts="latestCompleted.severityCounts"
              :previous-counts="previousCompleted?.severityCounts ?? null"
            >
              <p class="verdict-line">
                {{ pluralize(latestCompleted.pageCount, 'page') }} crawled · {{ pluralize(latestCompleted.brokenLinkCount, 'broken link') }}
              </p>
              <p class="verdict-line">
                <NuxtLink :to="`/audits/${latestCompleted.id}`">
                  Open the full report
                </NuxtLink>
              </p>
            </VerdictSummary>

            <div
              v-if="categoryBreakdown.length"
              class="panel panel-body stack"
            >
              <h3>Issues by category</h3>
              <ul class="bar-list">
                <li
                  v-for="entry in categoryBreakdown"
                  :key="entry.category"
                  class="bar-row"
                >
                  <NuxtLink :to="`/audits/${latestCompleted.id}?category=${entry.category}`">
                    {{ categoryLabel(entry.category) }}
                  </NuxtLink>
                  <span
                    class="bar-track"
                    aria-hidden="true"
                  ><span
                    class="bar-fill"
                    :style="{ width: `${Math.max(2, entry.share * 100)}%` }"
                  /></span>
                  <span class="num align-end">{{ entry.count.toLocaleString() }}</span>
                </li>
              </ul>
            </div>
          </template>

          <div
            v-else-if="!activeRun"
            class="panel empty-state"
          >
            <AppIcon
              name="list"
              :size="24"
            />
            <h3>No completed audits yet</h3>
            <p>Check which pages will be crawled, then run the first audit. It usually takes a few minutes.</p>
            <div
              v-if="website.isActive"
              class="form-actions"
            >
              <NuxtLink
                class="btn"
                :to="`/websites/${website.id}/settings`"
              >
                <AppIcon name="settings" />
                Review crawl settings
              </NuxtLink>
              <button
                type="button"
                class="btn btn-primary"
                :disabled="runPending"
                @click="runAudit"
              >
                <AppIcon name="play" />
                Run first audit
              </button>
            </div>
          </div>
        </section>

        <section
          v-if="runs.length"
          aria-labelledby="history-heading"
          class="stack"
        >
          <div class="section-heading">
            <h2 id="history-heading">
              Audit history
            </h2>
            <p>{{ pluralize(runs.length, 'audit') }}</p>
          </div>
          <div class="panel table-wrap">
            <table class="data-table responsive-table">
              <thead>
                <tr>
                  <th scope="col">
                    Started
                  </th>
                  <th scope="col">
                    Status
                  </th>
                  <th
                    scope="col"
                    class="align-end"
                  >
                    Errors
                  </th>
                  <th
                    scope="col"
                    class="align-end"
                  >
                    Warnings
                  </th>
                  <th
                    scope="col"
                    class="align-end"
                  >
                    All issues
                  </th>
                  <th
                    scope="col"
                    class="align-end"
                  >
                    Pages
                  </th>
                  <th
                    scope="col"
                    class="align-end"
                  >
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="run in visibleRuns"
                  :key="run.id"
                >
                  <td class="cell-lead">
                    <div class="cell-primary">
                      <NuxtLink :to="`/audits/${run.id}`">
                        {{ formatDateTime(run.startedAt, 'Waiting to start') }}
                      </NuxtLink>
                      <span v-if="run.startedAt">{{ formatRelativeTime(run.startedAt) }}</span>
                    </div>
                  </td>
                  <td data-label="Status">
                    <StatusBadge
                      :label="runStatusMeta(run.status).label"
                      :tone="runStatusMeta(run.status).tone"
                      :spinning="run.status === 'running'"
                    />
                  </td>
                  <td
                    class="align-end"
                    data-label="Errors"
                  >
                    <span :class="run.severityCounts.error ? 'count-error' : 'count-zero'">{{ isCompletedRunStatus(run.status) ? run.severityCounts.error.toLocaleString() : '—' }}</span>
                  </td>
                  <td
                    class="align-end"
                    data-label="Warnings"
                  >
                    <span :class="run.severityCounts.warning ? 'count-warning' : 'count-zero'">{{ isCompletedRunStatus(run.status) ? run.severityCounts.warning.toLocaleString() : '—' }}</span>
                  </td>
                  <td
                    class="align-end"
                    data-label="All issues"
                  >
                    {{ isCompletedRunStatus(run.status) ? run.issueCount.toLocaleString() : '—' }}
                  </td>
                  <td
                    class="align-end"
                    data-label="Pages"
                  >
                    {{ run.pageCount.toLocaleString() }}
                  </td>
                  <td
                    class="align-end text-secondary"
                    data-label="Duration"
                  >
                    {{ formatDuration(run.startedAt, run.finishedAt) ?? '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-if="runs.length > visibleRuns.length"
              class="show-more"
            >
              <button
                type="button"
                class="btn btn-sm"
                @click="historyLimit += 50"
              >
                Show older audits ({{ runs.length - visibleRuns.length }} more)
              </button>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
