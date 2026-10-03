<script setup lang="ts">
type TabId = "issues" | "links" | "lighthouse" | "pages" | "log";
type LighthouseCategory = "performance" | "accessibility" | "best-practices" | "seo";

interface LighthouseTarget {
  kind: "node" | "source-location" | "url";
  selector?: string | null;
  snippet?: string | null;
  nodeLabel?: string | null;
  path?: string | null;
  explanation?: string | null;
  url?: string | null;
  line?: number | null;
  column?: number | null;
  originalFile?: string | null;
  originalLine?: number | null;
  originalColumn?: number | null;
}

interface LighthouseResult {
  url: string;
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  firstContentfulPaintMs?: number | null;
  largestContentfulPaintMs?: number | null;
  totalBlockingTimeMs?: number | null;
  cumulativeLayoutShift?: number | null;
  speedIndexMs?: number | null;
  findings?: Array<{
    id: string;
    category: LighthouseCategory;
    title: string;
    description?: string | null;
    score?: number | null;
    displayValue?: string | null;
    targets?: LighthouseTarget[];
  }>;
}

interface AuditRunResponse {
  auditRun: {
    id: string;
    websiteId: string;
    websiteName: string;
    baseUrl: string;
    status: string;
    cancelRequested: boolean;
    startedAt: string | null;
    finishedAt: string | null;
    pageCount: number;
    issueCount: number;
    brokenLinkCount: number;
    typoCount: number;
    seoIssueCount: number;
    summaryJson?: {
      auditSummary?: string;
      maxPagesReached?: boolean;
      maxDepthReached?: boolean;
      lighthouse?: { pagesAudited: number; results: LighthouseResult[] };
      progress?: {
        stage: string;
        currentUrl?: string;
        pagesCrawled: number;
        issuesFound: number;
        linksChecked: number;
        queueSize: number;
      };
    };
  };
}

interface AuditIssueRow {
  id: string;
  code: string;
  severity: string;
  title: string;
  category: string;
  message: string;
  pageUrl?: string | null;
  evidenceJson?: Record<string, unknown>;
}

interface AuditPageRow {
  id: string;
  url: string;
  title: string | null;
  httpStatus: number | null;
  depth: number;
  fromSitemap: boolean;
  wordCount: number;
}

interface AuditLinkRow {
  id: string;
  targetUrl: string;
  targetType: string;
  sourceUrl: string | null;
  httpStatus: number | null;
  isBroken: boolean;
  anchorText: string | null;
}

interface AuditEventRow {
  id: string;
  level: string;
  createdAt: string;
  message: string;
  contextJson?: Record<string, unknown>;
}

interface ComparisonResponse {
  previousRun: { id: string; startedAt: string | null; finishedAt: string | null; severityCounts: { error: number; warning: number; info: number } } | null;
  newIssueIds: string[];
  fixedIssues: AuditIssueRow[];
}

const route = useRoute();
const router = useRouter();
const auditId = computed(() => String(route.params.id));

const [
  { data: runData, refresh: refreshRun, error: runError },
  { data: issuesData, refresh: refreshIssues },
  { data: pagesData, refresh: refreshPages },
  { data: linksData, refresh: refreshLinks },
  { data: eventsData, refresh: refreshEvents },
  { data: comparisonData, refresh: refreshComparison },
] = await Promise.all([
  useAsyncData<AuditRunResponse>(() => `audit-${auditId.value}`, () => $fetch(`/api/audits/${auditId.value}`)),
  useAsyncData<{ issues: AuditIssueRow[] }>(() => `audit-issues-${auditId.value}`, () => $fetch(`/api/audits/${auditId.value}/issues`)),
  useAsyncData<{ pages: AuditPageRow[] }>(() => `audit-pages-${auditId.value}`, () => $fetch(`/api/audits/${auditId.value}/pages`)),
  useAsyncData<{ links: AuditLinkRow[] }>(() => `audit-links-${auditId.value}`, () => $fetch(`/api/audits/${auditId.value}/links`)),
  useAsyncData<{ events: AuditEventRow[] }>(() => `audit-events-${auditId.value}`, () => $fetch(`/api/audits/${auditId.value}/events`)),
  useAsyncData<ComparisonResponse>(() => `audit-comparison-${auditId.value}`, () => $fetch(`/api/audits/${auditId.value}/comparison`)),
]);

const run = computed(() => runData.value?.auditRun ?? null);
const statusMeta = computed(() => runStatusMeta(run.value?.status));
const isActive = computed(() => isActiveRunStatus(run.value?.status));
const isCompleted = computed(() => isCompletedRunStatus(run.value?.status));
const progress = computed(() => run.value?.summaryJson?.progress ?? null);
const lighthouseResults = computed(() => run.value?.summaryJson?.lighthouse?.results ?? []);
const issues = computed(() => issuesData.value?.issues ?? []);
const events = computed(() => eventsData.value?.events ?? []);
const pages = computed(() => pagesData.value?.pages ?? []);
const lastErrorEvent = computed(() => events.value.find(event => event.level === "error") ?? null);
const runDate = computed(() => formatDateTime(run.value?.startedAt, "Queued"));

useHead(() => ({ title: run.value ? `${isActive.value ? "Running · " : ""}Audit · ${run.value.websiteName}` : "Audit" }));

const stageLabels: Record<string, string> = {
  starting: "Starting up",
  sitemap: "Reading the sitemap",
  crawl: "Crawling pages",
  link_check: "Checking links",
  lighthouse: "Running Lighthouse",
  cancelled: "Stopping",
  complete: "Finishing up",
};

const stageTrack = [
  { id: "discover", label: "Discover", stages: ["starting", "sitemap"] },
  { id: "crawl", label: "Crawl pages", stages: ["crawl"] },
  { id: "links", label: "Check links", stages: ["link_check"] },
  { id: "lighthouse", label: "Lighthouse", stages: ["lighthouse", "complete"] },
];

// A cancelling run reports stage "cancelled", so hold the last real position rather than resetting the track.
const lastStageIndex = ref(0);
watch(() => progress.value?.stage, (stage) => {
  const index = stageTrack.findIndex(entry => stage && entry.stages.includes(stage));
  if (index >= 0) {
    lastStageIndex.value = index;
  }
}, { immediate: true });

const currentStageIndex = computed(() => (run.value?.status === "queued" ? -1 : lastStageIndex.value));
const crawlFraction = computed(() => {
  const crawled = progress.value?.pagesCrawled ?? 0;
  return crawled / Math.max(1, crawled + (progress.value?.queueSize ?? 0));
});

const justFinished = ref(false);
const finishAnnouncement = ref("");
watch(isActive, (active, wasActive) => {
  if (wasActive && !active) {
    justFinished.value = true;
  }
});

// Query-backed view state, so a filtered report can be shared and survives a refresh.
function queryValue(key: string, fallback: string) {
  const value = route.query[key];
  return typeof value === "string" && value ? value : fallback;
}

function setQuery(changes: Record<string, string | undefined>) {
  void router.replace({ query: { ...route.query, ...changes } });
}

const severityFilter = computed(() => queryValue("severity", "all"));
const categoryFilter = computed(() => queryValue("category", "all"));
const newOnly = computed(() => route.query.new === "1");
const issueSearch = ref(queryValue("q", ""));
watch(issueSearch, value => setQuery({ q: value.trim() || undefined }));

const newIssueIds = computed(() => new Set(comparisonData.value?.newIssueIds ?? []));
const previousRun = computed(() => comparisonData.value?.previousRun ?? null);
const fixedIssues = computed(() => comparisonData.value?.fixedIssues ?? []);

const severityCounts = computed(() => {
  const counts = { error: 0, warning: 0, info: 0 } as Record<string, number>;
  for (const issue of issues.value) {
    counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
  }
  return counts;
});

const verdictCounts = computed(() => ({
  error: severityCounts.value.error ?? 0,
  warning: severityCounts.value.warning ?? 0,
  info: severityCounts.value.info ?? 0,
}));

const categoryCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const issue of issues.value) {
    counts.set(issue.category, (counts.get(issue.category) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
});

const filteredIssues = computed(() => {
  const needle = issueSearch.value.trim().toLowerCase();
  return issues.value.filter((issue) => {
    if (severityFilter.value !== "all" && issue.severity !== severityFilter.value) {
      return false;
    }
    if (categoryFilter.value !== "all" && issue.category !== categoryFilter.value) {
      return false;
    }
    if (newOnly.value && !newIssueIds.value.has(issue.id)) {
      return false;
    }
    return !needle || [issue.title, issue.message, issue.pageUrl ?? ""].join(" ").toLowerCase().includes(needle);
  });
});

const issueGroups = computed(() => {
  const groups = new Map<string, { key: string; code: string; title: string; severity: string; category: string; items: AuditIssueRow[]; newCount: number; pageCount: number }>();
  for (const issue of filteredIssues.value) {
    // Broken links split into internal and external targets with different severities, so name the target type.
    const targetType = issue.code === "broken_link" && typeof issue.evidenceJson?.targetType === "string" ? issue.evidenceJson.targetType : "";
    const key = `${issue.code}|${issue.severity}|${targetType}`;
    const title = targetType ? `Broken ${targetType} link` : issue.title;
    const group = groups.get(key) ?? { key, code: issue.code, title, severity: issue.severity, category: issue.category, items: [], newCount: 0, pageCount: 0 };
    group.items.push(issue);
    if (newIssueIds.value.has(issue.id)) {
      group.newCount += 1;
    }
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(group => ({ ...group, pageCount: new Set(group.items.map(item => item.pageUrl ?? "")).size }))
    .sort((left, right) =>
      (severityMeta[left.severity]?.rank ?? 9) - (severityMeta[right.severity]?.rank ?? 9)
      || right.items.length - left.items.length
      || left.title.localeCompare(right.title));
});

const groupLimit = ref(30);
const visibleGroups = computed(() => issueGroups.value.slice(0, groupLimit.value));
const occurrenceLimit = 50;
watch([severityFilter, categoryFilter, newOnly, issueSearch], () => {
  groupLimit.value = 30;
});

const hasIssueFilters = computed(() => severityFilter.value !== "all" || categoryFilter.value !== "all" || newOnly.value || Boolean(issueSearch.value.trim()));

function clearIssueFilters() {
  issueSearch.value = "";
  setQuery({ severity: undefined, category: undefined, new: undefined, q: undefined });
}

function showSeverity(severity: string) {
  setQuery({ tab: undefined, severity: severityFilter.value === severity ? undefined : severity, new: undefined });
}

function showNew() {
  setQuery({ tab: undefined, new: newOnly.value ? undefined : "1", severity: undefined });
}

const fixedGroups = computed(() => {
  const groups = new Map<string, { title: string; severity: string; items: AuditIssueRow[] }>();
  for (const issue of fixedIssues.value) {
    const key = `${issue.code}|${issue.severity}`;
    const group = groups.get(key) ?? { title: issue.title, severity: issue.severity, items: [] };
    group.items.push(issue);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) =>
    (severityMeta[left.severity]?.rank ?? 9) - (severityMeta[right.severity]?.rank ?? 9) || right.items.length - left.items.length);
});

const fixedOpen = ref(false);

function scrollToFixed() {
  fixedOpen.value = true;
  setQuery({ tab: undefined });
  void nextTick(() => document.getElementById("fixed-issues")?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function getTypoWords(issue: AuditIssueRow) {
  const words = Array.isArray(issue.evidenceJson?.words) ? issue.evidenceJson.words : [];
  return words.flatMap((entry: unknown) => {
    if (typeof entry === "string" && entry.trim()) {
      return [{ word: entry.trim(), suggestions: [] as string[] }];
    }
    if (entry && typeof entry === "object" && "word" in entry && typeof entry.word === "string" && entry.word.trim()) {
      const suggestions = "suggestions" in entry && Array.isArray(entry.suggestions)
        ? entry.suggestions.filter((suggestion: unknown): suggestion is string => typeof suggestion === "string").slice(0, 5)
        : [];
      return [{ word: entry.word.trim(), suggestions }];
    }
    return [];
  });
}

function humanise(key: string) {
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Link issues already state their target and status in the message; the Broken links tab carries the detail.
const evidenceHiddenCodes = new Set(["broken_link", "broken_canonical"]);

function evidenceEntries(issue: AuditIssueRow) {
  if (evidenceHiddenCodes.has(issue.code)) {
    return [];
  }
  return Object.entries(issue.evidenceJson ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      if (Array.isArray(value) && value.every(item => typeof item === "string" || typeof item === "number")) {
        return { key, label: humanise(key), list: value.map(String), text: null as string | null };
      }
      if (typeof value === "object") {
        return { key, label: humanise(key), list: null, text: JSON.stringify(value, null, 2) };
      }
      return { key, label: humanise(key), list: null, text: String(value) };
    });
}

const typoPending = ref<string[]>([]);
const typoNotice = ref<{ tone: "success" | "error"; message: string } | null>(null);

async function allowTypoWord(word: string) {
  const key = word.toLowerCase();
  if (typoPending.value.includes(key)) {
    return;
  }
  typoPending.value = [...typoPending.value, key];
  try {
    await $fetch(`/api/audits/${auditId.value}/typo-allowlist`, { method: "POST", body: { word } });
    typoNotice.value = { tone: "success", message: `“${word}” added to this site's allowed words. It won't be reported again.` };
    await Promise.all([refreshRun(), refreshIssues()]);
  }
  catch (error) {
    typoNotice.value = { tone: "error", message: getErrorMessage(error, `Couldn't allow “${word}”.`) };
  }
  finally {
    typoPending.value = typoPending.value.filter(value => value !== key);
  }
}

const pageTitleByUrl = computed(() => new Map(pages.value.map(page => [page.url, page.title || page.url] as const)));

const brokenLinkGroups = computed(() => {
  const groups = new Map<string, { targetUrl: string; targetType: string; httpStatus: number | null; occurrenceCount: number; sources: Array<{ url: string; title: string; occurrences: number; anchors: string[] }> }>();
  for (const link of linksData.value?.links ?? []) {
    if (!link.isBroken) {
      continue;
    }
    const group = groups.get(link.targetUrl) ?? { targetUrl: link.targetUrl, targetType: link.targetType, httpStatus: link.httpStatus, occurrenceCount: 0, sources: [] };
    group.occurrenceCount += 1;
    if (link.sourceUrl) {
      const source = group.sources.find(item => item.url === link.sourceUrl);
      if (source) {
        source.occurrences += 1;
        if (link.anchorText && !source.anchors.includes(link.anchorText) && source.anchors.length < 3) {
          source.anchors.push(link.anchorText);
        }
      }
      else {
        group.sources.push({ url: link.sourceUrl, title: pageTitleByUrl.value.get(link.sourceUrl) ?? link.sourceUrl, occurrences: 1, anchors: link.anchorText ? [link.anchorText] : [] });
      }
    }
    groups.set(link.targetUrl, group);
  }
  return [...groups.values()]
    .map(group => ({ ...group, sources: group.sources.sort((left, right) => right.occurrences - left.occurrences || left.url.localeCompare(right.url)) }))
    .sort((left, right) =>
      Number(right.targetType === "internal") - Number(left.targetType === "internal")
      || right.sources.length - left.sources.length
      || left.targetUrl.localeCompare(right.targetUrl));
});

const linkLimit = ref(50);

const tabs = computed<Array<{ id: TabId; label: string; short: string; count: number | null }>>(() => [
  { id: "issues", label: "Issues", short: "Issues", count: issues.value.length },
  { id: "links", label: "Broken links", short: "Links", count: brokenLinkGroups.value.length },
  { id: "lighthouse", label: "Lighthouse", short: "Lighthouse", count: lighthouseResults.value.length },
  { id: "pages", label: "Pages", short: "Pages", count: pages.value.length },
  { id: "log", label: "Activity log", short: "Log", count: null },
]);
const activeTab = computed<TabId>(() => {
  const value = queryValue("tab", "issues");
  return tabs.value.some(tab => tab.id === value) ? value as TabId : "issues";
});

function selectTab(id: TabId) {
  setQuery({ tab: id === "issues" ? undefined : id });
  void nextTick(() => document.getElementById(`tab-${id}`)?.scrollIntoView({ block: "nearest", inline: "nearest" }));
}

function onTabKeydown(event: KeyboardEvent, index: number) {
  const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (!direction) {
    return;
  }
  event.preventDefault();
  const next = tabs.value[(index + direction + tabs.value.length) % tabs.value.length]!;
  selectTab(next.id);
  void nextTick(() => document.getElementById(`tab-${next.id}`)?.focus());
}

function scoreTone(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return "neutral";
  }
  return score >= 90 ? "success" : score >= 50 ? "warning" : "error";
}

const lighthouseCategoryLabels: Record<LighthouseCategory, string> = {
  "performance": "Performance",
  "accessibility": "Accessibility",
  "best-practices": "Best practices",
  "seo": "SEO",
};

function formatMs(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "n/a";
  }
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}

function formatCls(value: number | null | undefined) {
  return value === null || value === undefined ? "n/a" : (Math.round(value * 1000) / 1000).toString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderAuditMarkdown(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }

  const rendered = escapeHtml(trimmed)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label: string, url: string) => {
      return `<a href="${url}" target="_blank" rel="noreferrer noopener">${label}</a>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  return rendered
    .split(/\n{2,}/)
    .map(block => `<p>${block.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function formatSourceLocation(target: LighthouseTarget) {
  if (target.originalFile) {
    return `${target.originalFile}:${target.originalLine ?? "?"}:${target.originalColumn ?? "?"}`;
  }
  if (target.url) {
    return `${target.url}:${target.line ?? "?"}:${target.column ?? "?"}`;
  }
  return null;
}

const stopPending = ref(false);
const actionError = ref("");
const canStop = computed(() => isActive.value && !run.value?.cancelRequested && !stopPending.value);

async function stopAudit() {
  if (!canStop.value) {
    return;
  }
  stopPending.value = true;
  actionError.value = "";
  try {
    await $fetch(`/api/audits/${auditId.value}/stop`, { method: "POST" });
    await refreshActive();
  }
  catch (error) {
    actionError.value = getErrorMessage(error, "Couldn't stop the audit.");
  }
  finally {
    stopPending.value = false;
  }
}

const websiteIdForActions = computed(() => run.value?.websiteId ?? "");
const { runPending, actionError: rerunError, runAudit } = useWebsiteActions(websiteIdForActions, async () => {});

async function refreshActive() {
  await Promise.all([refreshRun(), refreshEvents()]);
  if (!isActive.value) {
    await Promise.all([refreshIssues(), refreshPages(), refreshLinks(), refreshComparison()]);
    if (justFinished.value) {
      const counts = severityCounts.value;
      finishAnnouncement.value = `Audit ${statusMeta.value.label.toLowerCase()}: ${pluralize(counts.error ?? 0, "error")}, ${pluralize(counts.warning ?? 0, "warning")}, ${counts.info ?? 0} info.`;
    }
  }
}

let pollHandle: ReturnType<typeof setInterval> | undefined;

watch(isActive, (active) => {
  if (active && pollHandle === undefined && import.meta.client) {
    pollHandle = setInterval(() => void refreshActive(), 3000);
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
      v-if="runError"
      tone="error"
      title="Couldn't load this audit"
    >
      {{ getErrorMessage(runError, 'It may have been removed.') }}
      <template #actions>
        <NuxtLink
          class="btn btn-sm"
          to="/"
        >
          Back to websites
        </NuxtLink>
      </template>
    </AlertMessage>

    <template v-else-if="run">
      <PageHeader
        :title="`Audit of ${run.websiteName}`"
        :breadcrumbs="[
          { label: 'Websites', to: '/' },
          { label: run.websiteName, to: `/websites/${run.websiteId}` },
          { label: runDate },
        ]"
      >
        <template #badge>
          <StatusBadge
            :label="statusMeta.label"
            :tone="statusMeta.tone"
            :spinning="run.status === 'running'"
          />
        </template>
        <template #subtitle>
          <span>{{ runDate }}</span>
          <span v-if="formatDuration(run.startedAt, run.finishedAt)">Took {{ formatDuration(run.startedAt, run.finishedAt) }}</span>
          <span v-if="isCompleted">{{ pluralize(run.pageCount, 'page') }} crawled</span>
          <a
            :href="run.baseUrl"
            target="_blank"
            rel="noreferrer noopener"
            class="url"
          >{{ run.baseUrl }}<span class="visually-hidden"> (opens in a new tab)</span></a>
        </template>
        <template #actions>
          <button
            v-if="isActive"
            type="button"
            class="btn btn-danger"
            :disabled="!canStop"
            @click="stopAudit"
          >
            <AppIcon name="square" />
            {{ stopPending || run.cancelRequested ? 'Stopping…' : 'Stop audit' }}
          </button>
          <template v-else>
            <NuxtLink
              class="btn"
              :to="`/websites/${run.websiteId}/settings`"
            >
              <AppIcon name="settings" />
              Crawl settings
            </NuxtLink>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="runPending"
              @click="runAudit"
            >
              <AppIcon
                :name="runPending ? 'loader' : 'refresh'"
                :class="{ spin: runPending }"
              />
              Run again
            </button>
          </template>
        </template>
      </PageHeader>

      <div class="stack-lg">
        <AlertMessage
          v-if="actionError || rerunError"
          tone="error"
          dismissible
          @dismiss="actionError = ''; rerunError = ''"
        >
          {{ actionError || rerunError }}
        </AlertMessage>

        <p
          class="visually-hidden"
          role="status"
        >
          {{ finishAnnouncement }}
        </p>

        <Transition name="settle">
          <section
            v-if="isActive"
            class="progress-panel"
            aria-labelledby="progress-heading"
          >
            <div class="progress-head">
              <div
                id="progress-heading"
                class="progress-stage"
                role="status"
                aria-live="polite"
              >
                <AppIcon
                  name="loader"
                  class="spin"
                />
                {{ run.status === 'queued' ? 'Waiting for a worker' : stageLabels[progress?.stage ?? ''] ?? 'Working' }}{{ run.cancelRequested ? ' (stopping)' : '' }}
              </div>
              <span class="text-sm text-secondary">Results appear here when the audit finishes.</span>
            </div>
            <ol
              class="stage-track"
              aria-label="Audit stages"
            >
              <li
                v-for="(stage, index) in stageTrack"
                :key="stage.id"
                class="stage"
                :class="{ 'stage-indeterminate': index === currentStageIndex && stage.id !== 'crawl' }"
                :data-state="index < currentStageIndex ? 'done' : index === currentStageIndex ? 'current' : 'upcoming'"
                :aria-current="index === currentStageIndex ? 'step' : undefined"
              >
                <span
                  class="stage-bar"
                  aria-hidden="true"
                >
                  <span
                    class="stage-fill"
                    :style="index === currentStageIndex && stage.id === 'crawl' ? { transform: `scaleX(${crawlFraction})` } : undefined"
                  />
                </span>
                <span>
                  {{ stage.label }}
                  <span
                    v-if="index < currentStageIndex"
                    class="visually-hidden"
                  >(done)</span>
                </span>
              </li>
            </ol>
            <p
              v-if="progress?.currentUrl"
              class="progress-url mono"
            >
              {{ progress.currentUrl }}
            </p>
            <dl
              v-if="progress"
              class="progress-stats"
            >
              <div>
                <dt>Pages crawled</dt>
                <dd>
                  <TweenNumber
                    :value="progress.pagesCrawled"
                    :duration="900"
                  />
                </dd>
              </div>
              <div>
                <dt>Pages queued</dt>
                <dd>
                  <TweenNumber
                    :value="progress.queueSize"
                    :duration="900"
                  />
                </dd>
              </div>
              <div>
                <dt>Links checked</dt>
                <dd>
                  <TweenNumber
                    :value="progress.linksChecked"
                    :duration="900"
                  />
                </dd>
              </div>
              <div>
                <dt>Issues so far</dt>
                <dd>
                  <TweenNumber
                    :value="progress.issuesFound"
                    :duration="900"
                  />
                </dd>
              </div>
            </dl>
          </section>
        </Transition>

        <AlertMessage
          v-if="run.status === 'failed'"
          tone="error"
          title="This audit failed"
        >
          {{ lastErrorEvent?.message ?? 'The worker stopped before the audit finished.' }}
          <template #actions>
            <button
              type="button"
              class="btn btn-sm"
              :disabled="runPending"
              @click="runAudit"
            >
              Try again
            </button>
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              @click="selectTab('log')"
            >
              View activity log
            </button>
          </template>
        </AlertMessage>

        <AlertMessage
          v-if="run.status === 'cancelled'"
          title="This audit was stopped"
        >
          Results below cover only what was checked before it stopped.
        </AlertMessage>

        <AlertMessage
          v-if="run.status === 'completed_with_limits'"
          tone="warning"
          title="Not every page was audited"
        >
          The crawl reached its {{ run.summaryJson?.maxPagesReached ? 'page limit' : run.summaryJson?.maxDepthReached ? 'depth limit' : 'limit' }},
          so some pages were skipped. Narrow the crawl rules or raise <code>AUDIT_MAX_PAGES</code> / <code>AUDIT_MAX_DEPTH</code> on the worker.
        </AlertMessage>

        <section
          v-if="isCompleted || run.status === 'cancelled'"
          aria-label="Summary"
          class="stack-sm"
        >
          <VerdictSummary
            :counts="verdictCounts"
            :previous-counts="previousRun?.severityCounts ?? null"
            :new-count="previousRun ? newIssueIds.size : null"
            :fixed-count="previousRun ? fixedIssues.length : null"
            :active-severity="severityFilter"
            :new-active="newOnly"
            :arriving="justFinished"
            interactive
            @severity="showSeverity"
            @show-new="showNew"
            @show-fixed="scrollToFixed"
          />
          <p class="text-sm text-muted">
            <template v-if="previousRun">
              Compared with the
              <NuxtLink :to="`/audits/${previousRun.id}`">
                audit from {{ formatDateTime(previousRun.startedAt ?? previousRun.finishedAt) }}
              </NuxtLink>.
            </template>
            <template v-else>
              This is the first completed audit for this site, so there's nothing to compare yet.
            </template>
          </p>
        </section>

        <div v-if="!isActive">
          <div
            class="tabs"
            role="tablist"
            aria-label="Report sections"
          >
            <button
              v-for="(tab, index) in tabs"
              :id="`tab-${tab.id}`"
              :key="tab.id"
              type="button"
              role="tab"
              class="tab"
              :aria-selected="activeTab === tab.id"
              :aria-controls="`panel-${tab.id}`"
              :tabindex="activeTab === tab.id ? 0 : -1"
              @click="selectTab(tab.id)"
              @keydown="onTabKeydown($event, index)"
            >
              <span class="tab-label-full">{{ tab.label }}</span>
              <span class="tab-label-short">{{ tab.short }}</span>
              <span
                v-if="tab.count !== null"
                class="tab-count"
              >{{ tab.count.toLocaleString() }}</span>
            </button>
          </div>

          <!-- Issues -->
          <div
            v-if="activeTab === 'issues'"
            id="panel-issues"
            role="tabpanel"
            aria-labelledby="tab-issues"
            class="tab-panel stack"
          >
            <AlertMessage
              v-if="typoNotice"
              :tone="typoNotice.tone"
              dismissible
              @dismiss="typoNotice = null"
            >
              {{ typoNotice.message }}
              <template
                v-if="typoNotice.tone === 'success'"
                #actions
              >
                <NuxtLink
                  class="btn btn-sm"
                  :to="`/websites/${run.websiteId}/settings#allowlist-heading`"
                >
                  Manage allowed words
                </NuxtLink>
              </template>
            </AlertMessage>

            <template v-if="issues.length">
              <div class="toolbar">
                <div class="search-field">
                  <AppIcon name="search" />
                  <label
                    for="issue-search"
                    class="visually-hidden"
                  >Search issues</label>
                  <input
                    id="issue-search"
                    v-model="issueSearch"
                    type="search"
                    placeholder="Search issues or page URLs"
                  >
                </div>
                <div
                  class="segmented"
                  role="group"
                  aria-label="Severity"
                >
                  <button
                    type="button"
                    :aria-pressed="severityFilter === 'all'"
                    @click="setQuery({ severity: undefined })"
                  >
                    All
                  </button>
                  <button
                    v-for="severity in severityOrder.filter(item => severityCounts[item])"
                    :key="severity"
                    type="button"
                    :aria-pressed="severityFilter === severity"
                    @click="setQuery({ severity })"
                  >
                    {{ severityMeta[severity]!.plural }}
                    <span class="count">{{ severityCounts[severity]!.toLocaleString() }}</span>
                  </button>
                </div>
                <label
                  for="issue-category"
                  class="visually-hidden"
                >Category</label>
                <select
                  id="issue-category"
                  :value="categoryFilter"
                  @change="setQuery({ category: ($event.target as HTMLSelectElement).value === 'all' ? undefined : ($event.target as HTMLSelectElement).value })"
                >
                  <option value="all">
                    All categories
                  </option>
                  <option
                    v-for="[category, count] in categoryCounts"
                    :key="category"
                    :value="category"
                  >
                    {{ categoryLabel(category) }} ({{ count.toLocaleString() }})
                  </option>
                </select>
                <label
                  v-if="previousRun"
                  class="checkbox"
                >
                  <input
                    type="checkbox"
                    :checked="newOnly"
                    @change="setQuery({ new: ($event.target as HTMLInputElement).checked ? '1' : undefined })"
                  >
                  New only
                </label>
              </div>

              <p
                class="text-sm text-secondary"
                aria-live="polite"
              >
                {{ pluralize(filteredIssues.length, 'issue') }} in {{ pluralize(issueGroups.length, 'group') }}, most severe first.
                <button
                  v-if="hasIssueFilters"
                  type="button"
                  class="link-button"
                  @click="clearIssueFilters"
                >
                  Clear filters
                </button>
              </p>

              <div
                v-if="issueGroups.length"
                class="disclosure-list"
              >
                <details
                  v-for="group in visibleGroups"
                  :key="group.key"
                  class="disclosure"
                  :open="issueGroups.length === 1 || undefined"
                >
                  <summary>
                    <AppIcon
                      name="chevron-right"
                      class="disclosure-chevron"
                    />
                    <span class="disclosure-title">
                      <StatusBadge
                        :label="severityMeta[group.severity]?.label ?? group.severity"
                        :tone="severityMeta[group.severity]?.tone ?? 'neutral'"
                      />
                      <strong>{{ group.title }}</strong>
                      <span
                        v-if="group.newCount"
                        class="tag-new"
                      >{{ group.newCount === group.items.length ? 'New' : `${group.newCount} new` }}</span>
                    </span>
                    <span class="disclosure-meta">
                      <span>{{ categoryLabel(group.category) }}</span>
                      <span>{{ group.pageCount > 1 ? pluralize(group.pageCount, 'page') : pluralize(group.items.length, 'occurrence') }}</span>
                    </span>
                  </summary>
                  <div class="disclosure-body">
                    <ul class="occurrence-list">
                      <li
                        v-for="issue in group.items.slice(0, occurrenceLimit)"
                        :key="issue.id"
                        class="occurrence"
                      >
                        <div class="occurrence-head">
                          <a
                            v-if="issue.pageUrl"
                            :href="issue.pageUrl"
                            target="_blank"
                            rel="noreferrer noopener"
                            class="mono text-sm"
                          >{{ issue.pageUrl }}</a>
                          <span
                            v-else
                            class="text-sm text-muted"
                          >Site-wide</span>
                          <span
                            v-if="newIssueIds.has(issue.id)"
                            class="tag-new"
                          >New</span>
                        </div>
                        <p>{{ issue.message }}</p>

                        <div
                          v-if="issue.code === 'possible_typos' && getTypoWords(issue).length"
                          class="word-list"
                        >
                          <div
                            v-for="match in getTypoWords(issue)"
                            :key="`${issue.id}:${match.word}`"
                            class="word-row"
                          >
                            <div>
                              <strong>{{ match.word }}</strong>
                              <p>{{ match.suggestions.length ? `Did you mean ${match.suggestions.join(', ')}?` : 'No suggestions' }}</p>
                            </div>
                            <button
                              type="button"
                              class="btn btn-sm"
                              :disabled="typoPending.includes(match.word.toLowerCase())"
                              :aria-label="`Allow “${match.word}” on this site`"
                              @click="allowTypoWord(match.word)"
                            >
                              <AppIcon
                                :name="typoPending.includes(match.word.toLowerCase()) ? 'loader' : 'check'"
                                :size="14"
                                :class="{ spin: typoPending.includes(match.word.toLowerCase()) }"
                              />
                              Allow word
                            </button>
                          </div>
                        </div>

                        <dl
                          v-else-if="evidenceEntries(issue).length"
                          class="meta-list"
                        >
                          <template
                            v-for="entry in evidenceEntries(issue)"
                            :key="entry.key"
                          >
                            <dt>{{ entry.label }}</dt>
                            <dd>
                              <ul
                                v-if="entry.list"
                                class="stack-sm mono"
                                style="list-style: none; padding: 0;"
                              >
                                <li
                                  v-for="item in entry.list.slice(0, 10)"
                                  :key="item"
                                  class="url"
                                >
                                  {{ item }}
                                </li>
                                <li
                                  v-if="entry.list.length > 10"
                                  class="text-muted"
                                >
                                  And {{ entry.list.length - 10 }} more
                                </li>
                              </ul>
                              <pre v-else-if="entry.text?.includes('\n')">{{ entry.text }}</pre>
                              <span
                                v-else
                                class="url"
                              >{{ entry.text }}</span>
                            </dd>
                          </template>
                        </dl>
                      </li>
                      <li
                        v-if="group.items.length > occurrenceLimit"
                        class="occurrence text-sm text-muted"
                      >
                        Showing {{ occurrenceLimit }} of {{ group.items.length.toLocaleString() }}. Search or filter to narrow the list.
                      </li>
                    </ul>
                  </div>
                </details>
                <div
                  v-if="issueGroups.length > visibleGroups.length"
                  class="show-more"
                >
                  <button
                    type="button"
                    class="btn btn-sm"
                    @click="groupLimit += 30"
                  >
                    Show more ({{ issueGroups.length - visibleGroups.length }} more groups)
                  </button>
                </div>
              </div>

              <div
                v-else
                class="panel empty-state"
              >
                <h3>No issues match these filters</h3>
                <div class="form-actions">
                  <button
                    type="button"
                    class="btn"
                    @click="clearIssueFilters"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            </template>

            <div
              v-else
              class="panel empty-state"
            >
              <AppIcon
                name="check-circle"
                :size="28"
              />
              <h3>{{ run.status === 'failed' ? 'No issues were recorded' : 'No issues found' }}</h3>
              <p v-if="run.status !== 'failed'">
                Every crawled page passed the checks in this audit.
              </p>
            </div>

            <details
              v-if="fixedGroups.length"
              id="fixed-issues"
              class="panel"
              :open="fixedOpen"
              @toggle="fixedOpen = ($event.target as HTMLDetailsElement).open"
            >
              <summary class="panel-header">
                <span class="row">
                  <AppIcon
                    name="chevron-right"
                    class="disclosure-chevron"
                  />
                  <AppIcon
                    name="check-circle"
                    class="dot-success"
                  />
                  Fixed since the last audit ({{ fixedIssues.length.toLocaleString() }})
                </span>
              </summary>
              <ul class="occurrence-list panel-body">
                <li
                  v-for="group in fixedGroups"
                  :key="`${group.title}-${group.severity}`"
                  class="occurrence"
                >
                  <div class="row">
                    <StatusBadge
                      :label="severityMeta[group.severity]?.label ?? group.severity"
                      :tone="severityMeta[group.severity]?.tone ?? 'neutral'"
                    />
                    <strong>{{ group.title }}</strong>
                    <span class="text-sm text-muted">{{ pluralize(group.items.length, 'occurrence') }}</span>
                  </div>
                  <ul
                    class="text-sm text-secondary mono"
                    style="list-style: none; padding: 0;"
                  >
                    <li
                      v-for="item in group.items.slice(0, 5)"
                      :key="item.id"
                      class="url"
                    >
                      {{ item.pageUrl ?? item.message }}
                    </li>
                    <li
                      v-if="group.items.length > 5"
                      class="text-muted"
                    >
                      And {{ group.items.length - 5 }} more
                    </li>
                  </ul>
                </li>
              </ul>
            </details>
          </div>

          <!-- Broken links -->
          <div
            v-else-if="activeTab === 'links'"
            id="panel-links"
            role="tabpanel"
            aria-labelledby="tab-links"
            class="tab-panel stack"
          >
            <template v-if="brokenLinkGroups.length">
              <p class="text-sm text-secondary">
                {{ pluralize(brokenLinkGroups.length, 'broken link target') }}. Internal links first, then by how many pages link to them.
              </p>
              <div class="disclosure-list">
                <details
                  v-for="group in brokenLinkGroups.slice(0, linkLimit)"
                  :key="group.targetUrl"
                  class="disclosure"
                >
                  <summary>
                    <AppIcon
                      name="chevron-right"
                      class="disclosure-chevron"
                    />
                    <span class="disclosure-title">
                      <StatusBadge
                        :label="formatHttpStatus(group.httpStatus)"
                        :tone="group.targetType === 'internal' ? 'error' : 'warning'"
                      />
                      <strong class="mono text-sm">{{ group.targetUrl }}</strong>
                    </span>
                    <span class="disclosure-meta">
                      <span>{{ group.targetType === 'internal' ? 'Internal' : group.targetType === 'external' ? 'External' : humanise(group.targetType) }}</span>
                      <span>{{ pluralize(group.sources.length, 'page') }}</span>
                    </span>
                  </summary>
                  <div class="disclosure-body">
                    <ul class="occurrence-list">
                      <li
                        v-for="source in group.sources"
                        :key="source.url"
                        class="occurrence"
                      >
                        <div class="occurrence-head">
                          <div class="cell-primary">
                            <strong>{{ source.title }}</strong>
                            <a
                              :href="source.url"
                              target="_blank"
                              rel="noreferrer noopener"
                              class="mono text-sm"
                            >{{ source.url }}</a>
                          </div>
                          <span class="text-sm text-muted num">{{ source.occurrences > 1 ? `${source.occurrences}×` : '' }}</span>
                        </div>
                        <p
                          v-if="source.anchors.length"
                          class="text-sm"
                        >
                          Link text: {{ source.anchors.map(anchor => `“${anchor}”`).join(', ') }}
                        </p>
                      </li>
                    </ul>
                  </div>
                </details>
                <div
                  v-if="brokenLinkGroups.length > linkLimit"
                  class="show-more"
                >
                  <button
                    type="button"
                    class="btn btn-sm"
                    @click="linkLimit += 50"
                  >
                    Show more ({{ brokenLinkGroups.length - linkLimit }} more)
                  </button>
                </div>
              </div>
            </template>
            <div
              v-else
              class="panel empty-state"
            >
              <AppIcon
                name="check-circle"
                :size="28"
              />
              <h3>No broken links</h3>
              <p>Every link checked in this audit responded successfully.</p>
            </div>
          </div>

          <!-- Lighthouse -->
          <div
            v-else-if="activeTab === 'lighthouse'"
            id="panel-lighthouse"
            role="tabpanel"
            aria-labelledby="tab-lighthouse"
            class="tab-panel stack"
          >
            <template v-if="lighthouseResults.length">
              <details
                v-for="(result, resultIndex) in lighthouseResults"
                :key="result.url"
                class="panel"
                :open="resultIndex === 0 || undefined"
              >
                <summary class="panel-header">
                  <span class="row">
                    <AppIcon
                      name="chevron-right"
                      class="disclosure-chevron"
                    />
                    <strong class="mono text-sm url">{{ result.url }}</strong>
                  </span>
                  <span class="score-row">
                    <span
                      v-for="score in [
                        { label: 'Performance', value: result.performanceScore },
                        { label: 'Accessibility', value: result.accessibilityScore },
                        { label: 'Best practices', value: result.bestPracticesScore },
                        { label: 'SEO', value: result.seoScore },
                      ]"
                      :key="score.label"
                      class="score"
                    >
                      <span
                        class="score-value"
                        :data-tone="scoreTone(score.value)"
                      >{{ score.value ?? '–' }}</span>
                      {{ score.label }}
                    </span>
                  </span>
                </summary>
                <div class="panel-body stack">
                  <dl class="vitals">
                    <div>
                      <dt>First Contentful Paint</dt>
                      <dd>{{ formatMs(result.firstContentfulPaintMs) }}</dd>
                    </div>
                    <div>
                      <dt>Largest Contentful Paint</dt>
                      <dd>{{ formatMs(result.largestContentfulPaintMs) }}</dd>
                    </div>
                    <div>
                      <dt>Total Blocking Time</dt>
                      <dd>{{ formatMs(result.totalBlockingTimeMs) }}</dd>
                    </div>
                    <div>
                      <dt>Cumulative Layout Shift</dt>
                      <dd>{{ formatCls(result.cumulativeLayoutShift) }}</dd>
                    </div>
                    <div>
                      <dt>Speed Index</dt>
                      <dd>{{ formatMs(result.speedIndexMs) }}</dd>
                    </div>
                  </dl>

                  <div
                    v-if="result.findings?.length"
                    class="disclosure-list"
                  >
                    <details
                      v-for="finding in result.findings"
                      :key="finding.id"
                      class="disclosure"
                    >
                      <summary>
                        <AppIcon
                          name="chevron-right"
                          class="disclosure-chevron"
                        />
                        <span class="disclosure-title">
                          <span
                            class="score-value"
                            :data-tone="scoreTone(finding.score)"
                            :title="`Score ${finding.score ?? 'n/a'} out of 100`"
                          >{{ finding.score ?? '–' }}</span>
                          <strong>{{ finding.title }}</strong>
                        </span>
                        <span class="disclosure-meta">
                          <span v-if="finding.displayValue">{{ finding.displayValue }}</span>
                          <span>{{ lighthouseCategoryLabels[finding.category] }}</span>
                        </span>
                      </summary>
                      <div class="disclosure-body stack-sm">
                        <div
                          v-if="finding.description"
                          class="markdown-copy text-secondary"
                          v-html="renderAuditMarkdown(finding.description)"
                        />
                        <div
                          v-if="finding.targets?.length"
                          class="target-list"
                        >
                          <div
                            v-for="(target, targetIndex) in finding.targets"
                            :key="`${finding.id}-${targetIndex}`"
                            class="target"
                          >
                            <template v-if="target.kind === 'node'">
                              <strong v-if="target.nodeLabel">{{ target.nodeLabel }}</strong>
                              <p v-if="target.selector">
                                <code>{{ target.selector }}</code>
                              </p>
                              <pre v-if="target.snippet">{{ target.snippet }}</pre>
                              <div
                                v-if="target.explanation"
                                class="markdown-copy"
                                v-html="renderAuditMarkdown(target.explanation)"
                              />
                            </template>
                            <template v-else-if="target.kind === 'source-location'">
                              <strong>Source</strong>
                              <p
                                v-if="formatSourceLocation(target)"
                                class="mono"
                              >
                                {{ formatSourceLocation(target) }}
                              </p>
                              <p
                                v-if="target.url && target.originalFile"
                                class="mono"
                              >
                                Compiled: {{ target.url }}:{{ target.line ?? '?' }}:{{ target.column ?? '?' }}
                              </p>
                            </template>
                            <template v-else-if="target.kind === 'url'">
                              <strong>Related URL</strong>
                              <p class="mono">
                                {{ target.url }}
                              </p>
                            </template>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                  <p
                    v-else
                    class="empty-inline"
                  >
                    No opportunities or diagnostics were flagged for this page.
                  </p>
                </div>
              </details>
            </template>
            <div
              v-else
              class="panel empty-state"
            >
              <h3>No Lighthouse results</h3>
              <p>Lighthouse runs on the homepage and any extra pages chosen in crawl settings once the crawl completes.</p>
            </div>
          </div>

          <!-- Pages -->
          <div
            v-else-if="activeTab === 'pages'"
            id="panel-pages"
            role="tabpanel"
            aria-labelledby="tab-pages"
            class="tab-panel"
          >
            <div
              v-if="pages.length"
              class="panel table-wrap"
            >
              <table class="data-table responsive-table">
                <thead>
                  <tr>
                    <th scope="col">
                      Page
                    </th>
                    <th scope="col">
                      Status
                    </th>
                    <th
                      scope="col"
                      class="align-end"
                    >
                      Depth
                    </th>
                    <th
                      scope="col"
                      class="align-end"
                    >
                      Words
                    </th>
                    <th scope="col">
                      In sitemap
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="page in pages"
                    :key="page.id"
                  >
                    <td class="cell-lead">
                      <div class="cell-primary">
                        <strong>{{ page.title || 'Untitled page' }}</strong>
                        <a
                          :href="page.url"
                          target="_blank"
                          rel="noreferrer noopener"
                          class="mono"
                        >{{ page.url }}</a>
                      </div>
                    </td>
                    <td data-label="Status">
                      <span :class="page.httpStatus && page.httpStatus >= 400 ? 'count-error' : 'text-secondary'">{{ formatHttpStatus(page.httpStatus) }}</span>
                    </td>
                    <td
                      class="align-end"
                      data-label="Depth"
                    >
                      {{ page.depth }}
                    </td>
                    <td
                      class="align-end"
                      data-label="Words"
                    >
                      {{ page.wordCount.toLocaleString() }}
                    </td>
                    <td
                      data-label="In sitemap"
                      class="text-secondary"
                    >
                      {{ page.fromSitemap ? 'Yes' : 'No' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div
              v-else
              class="panel empty-state"
            >
              <h3>No pages were crawled</h3>
            </div>
          </div>

          <!-- Activity log -->
          <div
            v-else-if="activeTab === 'log'"
            id="panel-log"
            role="tabpanel"
            aria-labelledby="tab-log"
            class="tab-panel"
          >
            <div
              v-if="events.length"
              class="disclosure-list"
            >
              <div
                v-for="event in events"
                :key="event.id"
                class="disclosure"
              >
                <details v-if="event.contextJson && Object.keys(event.contextJson).length">
                  <summary
                    class="row"
                    style="padding: var(--space-3) var(--space-4); cursor: pointer;"
                  >
                    <StatusBadge
                      :label="severityMeta[event.level]?.label ?? event.level"
                      :tone="severityMeta[event.level]?.tone ?? 'neutral'"
                    />
                    <span class="spacer">{{ event.message }}</span>
                    <time
                      class="text-sm text-muted"
                      :datetime="event.createdAt"
                    >{{ formatDateTime(event.createdAt) }}</time>
                  </summary>
                  <div class="disclosure-body">
                    <pre>{{ JSON.stringify(event.contextJson, null, 2) }}</pre>
                  </div>
                </details>
                <div
                  v-else
                  class="row"
                  style="padding: var(--space-3) var(--space-4);"
                >
                  <StatusBadge
                    :label="severityMeta[event.level]?.label ?? event.level"
                    :tone="severityMeta[event.level]?.tone ?? 'neutral'"
                  />
                  <span class="spacer">{{ event.message }}</span>
                  <time
                    class="text-sm text-muted"
                    :datetime="event.createdAt"
                  >{{ formatDateTime(event.createdAt) }}</time>
                </div>
              </div>
            </div>
            <div
              v-else
              class="panel empty-state"
            >
              <h3>No activity recorded</h3>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
