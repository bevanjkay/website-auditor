<script setup lang="ts">
const route = useRoute();
const auditId = computed(() => String(route.params.id));

interface AuditRunResponse {
  auditRun: {
    websiteName: string;
    baseUrl: string;
    status: string;
    cancelRequested: boolean;
    pageCount: number;
    issueCount: number;
    brokenLinkCount: number;
    typoCount: number;
    seoIssueCount: number;
    summaryJson?: {
      auditSummary?: string;
      lighthouse?: {
        pagesAudited: number;
        results: Array<{
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
            category: "performance" | "accessibility" | "best-practices" | "seo";
            title: string;
            description?: string | null;
            score?: number | null;
            displayValue?: string | null;
            targets?: Array<{
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
            }>;
          }>;
        }>;
      };
      progress?: {
        stage: string;
        currentUrl?: string;
        cancelRequested?: boolean;
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

interface TypoIssueWord {
  word: string;
  suggestions: string[];
}

interface AuditPageRow {
  id: string;
  url: string;
  title: string | null;
}

interface AuditLinkRow {
  id: string;
  targetUrl: string;
  targetType: string;
  sourceUrl: string | null;
  httpStatus: number | null;
  isBroken: boolean;
  anchorText: string | null;
  nofollow: boolean;
}

interface AuditEventRow {
  id: string;
  level: string;
  createdAt: string;
  message: string;
  contextJson?: Record<string, unknown>;
}

const [{ data: runData, refresh: refreshRun }, { data: issuesData, refresh: refreshIssues }, { data: pagesData, refresh: refreshPages }, { data: linksData, refresh: refreshLinks }, { data: eventsData, refresh: refreshEvents }] = await Promise.all([
  useAsyncData<AuditRunResponse>(`audit-${auditId.value}`, () => $fetch(`/api/audits/${auditId.value}`)),
  useAsyncData<{ issues: AuditIssueRow[] }>(`audit-issues-${auditId.value}`, () => $fetch(`/api/audits/${auditId.value}/issues`)),
  useAsyncData<{ pages: AuditPageRow[] }>(`audit-pages-${auditId.value}`, () => $fetch(`/api/audits/${auditId.value}/pages`)),
  useAsyncData<{ links: AuditLinkRow[] }>(`audit-links-${auditId.value}`, () => $fetch(`/api/audits/${auditId.value}/links`)),
  useAsyncData<{ events: AuditEventRow[] }>(`audit-events-${auditId.value}`, () => $fetch(`/api/audits/${auditId.value}/events`)),
]);

const isActiveRun = computed(() => {
  const status = runData.value?.auditRun.status;
  return status === "queued" || status === "running";
});

const stopPending = ref(false);
const typoAllowPending = ref<string[]>([]);
const issueSearch = ref("");
const issueCategoryFilter = ref("all");
const issueSeverityFilter = ref("all");
const canStopRun = computed(() => {
  return isActiveRun.value && !runData.value?.auditRun.cancelRequested && !stopPending.value;
});

const issueCategoryOptions = computed(() => {
  const counts = new Map<string, number>();

  for (const issue of issuesData.value?.issues ?? []) {
    counts.set(issue.category, (counts.get(issue.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => ({ value, count }));
});

const issueSeverityOptions = computed(() => {
  const ordered = ["error", "warning", "info"];

  return ordered
    .map(value => ({
      value,
      count: issuesData.value?.issues.filter(issue => issue.severity === value).length ?? 0,
    }))
    .filter(option => option.count > 0);
});

const filteredIssues = computed(() => {
  const query = issueSearch.value.trim().toLowerCase();

  return (issuesData.value?.issues ?? []).filter((issue) => {
    if (issueCategoryFilter.value !== "all" && issue.category !== issueCategoryFilter.value) {
      return false;
    }

    if (issueSeverityFilter.value !== "all" && issue.severity !== issueSeverityFilter.value) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      issue.title,
      issue.message,
      issue.category,
      issue.severity,
      issue.pageUrl ?? "",
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });
});

const groupedIssues = computed(() => {
  const groups = new Map<string, AuditIssueRow[]>();

  for (const issue of filteredIssues.value) {
    const existing = groups.get(issue.category) ?? [];
    existing.push(issue);
    groups.set(issue.category, existing);
  }

  return Array.from(groups.entries(), ([category, items]) => ({
    category,
    items,
  }))
    .sort((left, right) => right.items.length - left.items.length || left.category.localeCompare(right.category));
});

const pageTitleByUrl = computed(() => new Map(
  (pagesData.value?.pages ?? []).map(page => [page.url, page.title || page.url] as const),
));

const brokenLinkGroups = computed(() => {
  const groups = new Map<string, {
    targetUrl: string;
    targetType: string;
    httpStatus: number | null;
    nofollow: boolean;
    occurrenceCount: number;
    sourcePages: Array<{
      url: string;
      title: string;
      occurrences: number;
      anchorTexts: string[];
    }>;
  }>();

  for (const link of linksData.value?.links.filter(entry => entry.isBroken) ?? []) {
    const existing = groups.get(link.targetUrl) ?? {
      targetUrl: link.targetUrl,
      targetType: link.targetType,
      httpStatus: link.httpStatus,
      nofollow: link.nofollow,
      occurrenceCount: 0,
      sourcePages: [],
    };

    existing.occurrenceCount += 1;

    if (link.sourceUrl) {
      const existingSource = existing.sourcePages.find(source => source.url === link.sourceUrl);
      if (existingSource) {
        existingSource.occurrences += 1;
        if (link.anchorText && !existingSource.anchorTexts.includes(link.anchorText) && existingSource.anchorTexts.length < 3) {
          existingSource.anchorTexts.push(link.anchorText);
        }
      }
      else {
        existing.sourcePages.push({
          url: link.sourceUrl,
          title: pageTitleByUrl.value.get(link.sourceUrl) ?? link.sourceUrl,
          occurrences: 1,
          anchorTexts: link.anchorText ? [link.anchorText] : [],
        });
      }
    }

    groups.set(link.targetUrl, existing);
  }

  return Array.from(groups.values(), group => ({
    ...group,
    sourcePages: group.sourcePages.sort((left, right) => right.occurrences - left.occurrences || left.url.localeCompare(right.url)),
  }))
    .sort((left, right) => right.sourcePages.length - left.sourcePages.length || right.occurrenceCount - left.occurrenceCount || left.targetUrl.localeCompare(right.targetUrl));
});

function formatMetric(value: number | null | undefined, suffix = "ms") {
  if (value === null || value === undefined) {
    return "n/a";
  }

  if (suffix === "") {
    return `${Math.round(value * 100) / 100}`;
  }

  return `${Math.round(value)}${suffix}`;
}

function scoreTone(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return "muted";
  }

  if (score >= 90) {
    return "good";
  }

  if (score >= 50) {
    return "warn";
  }

  return "bad";
}

function formatSourceLocation(target: {
  url?: string | null;
  line?: number | null;
  column?: number | null;
  originalFile?: string | null;
  originalLine?: number | null;
  originalColumn?: number | null;
}) {
  if (target.originalFile) {
    return `${target.originalFile}:${target.originalLine ?? "?"}:${target.originalColumn ?? "?"}`;
  }

  if (target.url) {
    return `${target.url}:${target.line ?? "?"}:${target.column ?? "?"}`;
  }

  return null;
}

function getTypoIssueWords(issue: AuditIssueRow): TypoIssueWord[] {
  const words = Array.isArray(issue.evidenceJson?.words) ? issue.evidenceJson.words : [];

  return words.flatMap((entry) => {
    if (typeof entry === "string" && entry.trim()) {
      return [{
        word: entry.trim(),
        suggestions: [],
      }];
    }

    if (
      entry
      && typeof entry === "object"
      && "word" in entry
      && typeof entry.word === "string"
      && entry.word.trim()
    ) {
      return [{
        word: entry.word.trim(),
        suggestions: Array.isArray(entry.suggestions)
          ? entry.suggestions.filter((suggestion: unknown): suggestion is string => typeof suggestion === "string").slice(0, 5)
          : [],
      }];
    }

    return [];
  });
}

function typoAllowKey(issueId: string, word: string) {
  return `${issueId}:${word.toLowerCase()}`;
}

function isAllowingTypo(issueId: string, word: string) {
  return typoAllowPending.value.includes(typoAllowKey(issueId, word));
}

async function allowTypoWord(issueId: string, word: string) {
  const key = typoAllowKey(issueId, word);
  if (typoAllowPending.value.includes(key)) {
    return;
  }

  typoAllowPending.value = [...typoAllowPending.value, key];

  try {
    await $fetch(`/api/audits/${auditId.value}/typo-allowlist`, {
      method: "POST",
      credentials: "include",
      body: { word },
    });
    await Promise.all([
      refreshRun(),
      refreshIssues(),
    ]);
  }
  finally {
    typoAllowPending.value = typoAllowPending.value.filter(value => value !== key);
  }
}

let pollHandle: ReturnType<typeof setInterval> | undefined;

async function refreshActiveAudit() {
  await Promise.all([
    refreshRun(),
    refreshEvents(),
  ]);

  if (!isActiveRun.value) {
    await Promise.all([
      refreshIssues(),
      refreshPages(),
      refreshLinks(),
    ]);
  }
}

async function stopAudit() {
  if (!canStopRun.value) {
    return;
  }

  stopPending.value = true;

  try {
    await $fetch(`/api/audits/${auditId.value}/stop`, {
      method: "POST",
      credentials: "include",
    });
    await refreshActiveAudit();
  }
  finally {
    stopPending.value = false;
  }
}

function stopPolling() {
  if (pollHandle !== undefined) {
    clearInterval(pollHandle);
    pollHandle = undefined;
  }
}

function startPolling() {
  if (!import.meta.client || pollHandle !== undefined || !isActiveRun.value) {
    return;
  }

  pollHandle = setInterval(() => {
    void refreshActiveAudit();
  }, 3000);
}

watch(isActiveRun, (active) => {
  if (active) {
    startPolling();
    return;
  }

  stopPolling();
}, { immediate: true });

onBeforeUnmount(() => {
  stopPolling();
});
</script>

<template>
  <section class="stack">
    <div class="hero-card stack">
      <div>
        <p class="muted">
          Audit run
        </p>
        <h2>{{ runData?.auditRun.websiteName }}</h2>
        <p class="muted">
          {{ runData?.auditRun.baseUrl }}
        </p>
      </div>

      <div class="metric-grid">
        <MetricCard
          label="Status"
          :value="runData?.auditRun.status ?? 'queued'"
        />
        <MetricCard
          label="Pages"
          :value="runData?.auditRun.pageCount ?? 0"
        />
        <MetricCard
          label="Issues"
          :value="runData?.auditRun.issueCount ?? 0"
        />
        <MetricCard
          label="Broken links"
          :value="runData?.auditRun.brokenLinkCount ?? 0"
        />
        <MetricCard
          label="Typos"
          :value="runData?.auditRun.typoCount ?? 0"
        />
        <MetricCard
          label="SEO"
          :value="runData?.auditRun.seoIssueCount ?? 0"
        />
      </div>

      <div
        v-if="isActiveRun && runData?.auditRun.summaryJson?.progress"
        class="notice"
      >
        <div class="notice-actions">
          <strong>Current stage:</strong> {{ runData.auditRun.summaryJson.progress.stage }}
          <button
            class="secondary-button"
            :disabled="!canStopRun"
            @click="stopAudit"
          >
            {{ stopPending || runData?.auditRun.cancelRequested ? 'Stopping…' : 'Stop audit' }}
          </button>
        </div>
        <span v-if="runData.auditRun.summaryJson.progress.currentUrl">
          · {{ runData.auditRun.summaryJson.progress.currentUrl }}
        </span>
        <br>
        Pages crawled: {{ runData.auditRun.summaryJson.progress.pagesCrawled }}
        · Issues found: {{ runData.auditRun.summaryJson.progress.issuesFound }}
        · Links checked: {{ runData.auditRun.summaryJson.progress.linksChecked }}
        · Queue: {{ runData.auditRun.summaryJson.progress.queueSize }}
      </div>

      <div
        v-else-if="isActiveRun"
        class="notice"
      >
        <div class="notice-actions">
          <span>Audit is active.</span>
          <button
            class="secondary-button"
            :disabled="!canStopRun"
            @click="stopAudit"
          >
            {{ stopPending || runData?.auditRun.cancelRequested ? 'Stopping…' : 'Stop audit' }}
          </button>
        </div>
      </div>
    </div>

    <div class="stack">
      <section class="panel stack">
        <div
          v-if="runData?.auditRun.summaryJson?.auditSummary || runData?.auditRun.summaryJson?.lighthouse"
          class="issue stack"
        >
          <h3>Audit summary</h3>
          <p v-if="runData?.auditRun.summaryJson?.auditSummary">
            {{ runData.auditRun.summaryJson.auditSummary }}
          </p>

          <div
            v-if="runData?.auditRun.summaryJson?.lighthouse?.results?.length"
            class="stack"
          >
            <article
              v-for="result in runData.auditRun.summaryJson.lighthouse.results"
              :key="result.url"
              class="issue lighthouse-card stack"
            >
              <header>
                <strong>{{ result.url }}</strong>
                <span class="muted">Lighthouse</span>
              </header>
              <div class="lighthouse-score-grid">
                <div class="score-card" :data-tone="scoreTone(result.performanceScore)">
                  <small>Performance</small>
                  <strong>{{ result.performanceScore ?? 'n/a' }}</strong>
                </div>
                <div class="score-card" :data-tone="scoreTone(result.accessibilityScore)">
                  <small>Accessibility</small>
                  <strong>{{ result.accessibilityScore ?? 'n/a' }}</strong>
                </div>
                <div class="score-card" :data-tone="scoreTone(result.bestPracticesScore)">
                  <small>Best Practices</small>
                  <strong>{{ result.bestPracticesScore ?? 'n/a' }}</strong>
                </div>
                <div class="score-card" :data-tone="scoreTone(result.seoScore)">
                  <small>SEO</small>
                  <strong>{{ result.seoScore ?? 'n/a' }}</strong>
                </div>
              </div>

              <div class="lighthouse-metrics">
                <div>
                  <small>FCP</small>
                  <strong>{{ formatMetric(result.firstContentfulPaintMs) }}</strong>
                </div>
                <div>
                  <small>LCP</small>
                  <strong>{{ formatMetric(result.largestContentfulPaintMs) }}</strong>
                </div>
                <div>
                  <small>TBT</small>
                  <strong>{{ formatMetric(result.totalBlockingTimeMs) }}</strong>
                </div>
                <div>
                  <small>CLS</small>
                  <strong>{{ formatMetric(result.cumulativeLayoutShift, '') }}</strong>
                </div>
                <div>
                  <small>Speed Index</small>
                  <strong>{{ formatMetric(result.speedIndexMs) }}</strong>
                </div>
              </div>

              <div
                v-if="result.findings?.length"
                class="stack"
                style="gap: 12px;"
              >
                <div class="section-label">
                  Reviewable Lighthouse findings
                </div>
                <div
                  v-for="finding in result.findings"
                  :key="finding.id"
                  class="lighthouse-finding"
                >
                  <header>
                    <div class="issue-header">
                      <span class="pill" :class="scoreTone(finding.score)">
                        {{ finding.category }}
                      </span>
                      <strong>{{ finding.title }}</strong>
                    </div>
                    <span class="muted">
                      {{ finding.score ?? 'n/a' }}
                    </span>
                  </header>
                  <p
                    v-if="finding.description"
                    class="muted"
                  >
                    {{ finding.description }}
                  </p>
                  <p
                    v-if="finding.displayValue"
                    class="muted"
                  >
                    Lighthouse: {{ finding.displayValue }}
                  </p>
                  <div
                    v-if="finding.targets?.length"
                    class="lighthouse-targets stack"
                  >
                    <div class="section-label">
                      Possible code targets
                    </div>
                    <div
                      v-for="(target, targetIndex) in finding.targets"
                      :key="`${finding.id}-${target.kind}-${targetIndex}`"
                      class="lighthouse-target"
                    >
                      <template v-if="target.kind === 'node'">
                        <p v-if="target.nodeLabel"><strong>{{ target.nodeLabel }}</strong></p>
                        <p
                          v-if="target.selector"
                          class="muted"
                        >
                          Selector: <code>{{ target.selector }}</code>
                        </p>
                        <pre v-if="target.snippet">{{ target.snippet }}</pre>
                        <p
                          v-if="target.path"
                          class="muted"
                        >
                          DOM path: {{ target.path }}
                        </p>
                        <p
                          v-if="target.explanation"
                          class="muted"
                        >
                          {{ target.explanation }}
                        </p>
                      </template>
                      <template v-else-if="target.kind === 'source-location'">
                        <p><strong>Source location</strong></p>
                        <p
                          v-if="formatSourceLocation(target)"
                          class="muted"
                        >
                          {{ formatSourceLocation(target) }}
                        </p>
                        <p
                          v-if="target.url && target.originalFile"
                          class="muted"
                        >
                          Generated: {{ target.url }}:{{ target.line ?? '?' }}:{{ target.column ?? '?' }}
                        </p>
                      </template>
                      <template v-else-if="target.kind === 'url'">
                        <p><strong>Related URL</strong></p>
                        <p class="muted">{{ target.url }}</p>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="empty"
              >
                No retained Lighthouse findings for this page.
              </div>
            </article>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; gap: 16px; align-items: start; flex-wrap: wrap;">
          <div>
            <h3>Issues</h3>
            <p class="muted">
              Grouped by category so the repeated patterns are easier to scan.
            </p>
          </div>
          <div class="issue-toolbar">
            <input
              v-model="issueSearch"
              type="search"
              placeholder="Search issues"
            >
          </div>
        </div>

        <div
          v-if="issuesData?.issues.length"
          class="stack"
        >
          <div class="filter-row">
            <button
              class="secondary-button"
              :class="{ active: issueCategoryFilter === 'all' }"
              @click="issueCategoryFilter = 'all'"
            >
              All categories ({{ issuesData.issues.length }})
            </button>
            <button
              v-for="option in issueCategoryOptions"
              :key="option.value"
              class="secondary-button"
              :class="{ active: issueCategoryFilter === option.value }"
              @click="issueCategoryFilter = option.value"
            >
              {{ option.value }} ({{ option.count }})
            </button>
          </div>

          <div
            v-if="issueSeverityOptions.length"
            class="filter-row"
          >
            <button
              class="secondary-button"
              :class="{ active: issueSeverityFilter === 'all' }"
              @click="issueSeverityFilter = 'all'"
            >
              All severities
            </button>
            <button
              v-for="option in issueSeverityOptions"
              :key="option.value"
              class="secondary-button"
              :class="{ active: issueSeverityFilter === option.value }"
              @click="issueSeverityFilter = option.value"
            >
              {{ option.value }} ({{ option.count }})
            </button>
          </div>

          <div
            v-if="groupedIssues.length"
            class="stack"
          >
            <section
              v-for="group in groupedIssues"
              :key="group.category"
              class="issue-group stack"
            >
              <header class="issue-group-header">
                <strong>{{ group.category }}</strong>
                <span class="muted">{{ group.items.length }} issue{{ group.items.length === 1 ? '' : 's' }}</span>
              </header>

              <article
                v-for="issue in group.items"
                :key="issue.id"
                class="issue issue-compact"
              >
                <header>
                  <div class="issue-header">
                    <StatusPill :value="issue.severity" />
                    <strong>{{ issue.title }}</strong>
                  </div>
                </header>
                <p>{{ issue.message }}</p>
                <p
                  v-if="issue.pageUrl"
                  class="muted"
                >
                  {{ issue.pageUrl }}
                </p>
                <div
                  v-if="issue.code === 'possible_typos' && getTypoIssueWords(issue).length"
                  class="typo-match-list stack"
                >
                  <div
                    v-for="match in getTypoIssueWords(issue)"
                    :key="`${issue.id}:${match.word}`"
                    class="typo-match-item"
                  >
                    <div class="typo-match-copy">
                      <strong>{{ match.word }}</strong>
                      <p
                        v-if="match.suggestions.length"
                        class="muted"
                      >
                        Suggestions: {{ match.suggestions.join(', ') }}
                      </p>
                      <p
                        v-else
                        class="muted"
                      >
                        No spelling suggestions available.
                      </p>
                    </div>
                    <button
                      class="secondary-button"
                      :disabled="isAllowingTypo(issue.id, match.word)"
                      @click="allowTypoWord(issue.id, match.word)"
                    >
                      {{ isAllowingTypo(issue.id, match.word) ? 'Allowing…' : 'Allow for this site' }}
                    </button>
                  </div>
                </div>
                <pre
                  v-else-if="issue.evidenceJson && Object.keys(issue.evidenceJson).length"
                >{{ issue.evidenceJson }}</pre>
              </article>
            </section>
          </div>

          <div
            v-else
            class="empty"
          >
            No issues match the current filters.
          </div>
        </div>
        <div
          v-else
          class="empty"
        >
          No issues recorded for this run.
        </div>
      </section>

      <section class="panel stack">
        <h3>Broken links</h3>
        <div
          v-if="brokenLinkGroups.length"
          class="stack"
        >
          <details
            v-for="group in brokenLinkGroups"
            :key="group.targetUrl"
            class="issue broken-link-group"
            :open="group.sourcePages.length <= 3"
          >
            <summary class="broken-link-summary">
              <div class="stack" style="gap: 6px;">
                <strong>{{ group.targetUrl }}</strong>
                <p class="muted">
                  Status: {{ group.httpStatus ?? 'No response' }}
                  · {{ group.sourcePages.length }} page{{ group.sourcePages.length === 1 ? '' : 's' }}
                  · {{ group.occurrenceCount }} occurrence{{ group.occurrenceCount === 1 ? '' : 's' }}
                </p>
              </div>
              <span class="muted">{{ group.targetType }}</span>
            </summary>

            <div class="source-list stack">
              <div
                v-for="source in group.sourcePages"
                :key="source.url"
                class="source-item"
              >
                <strong>{{ source.title }}</strong>
                <p class="muted">{{ source.url }}</p>
                <p class="muted">
                  {{ source.occurrences }} occurrence{{ source.occurrences === 1 ? '' : 's' }}
                  <span v-if="source.anchorTexts.length">
                    · anchors: {{ source.anchorTexts.join(' · ') }}
                  </span>
                </p>
              </div>
            </div>
          </details>
        </div>
        <div
          v-else
          class="empty"
        >
          No broken links recorded.
        </div>
      </section>

      <section
        v-if="pagesData?.pages.length"
        class="panel stack"
      >
        <details class="collapsible-section">
          <summary class="collapsible-summary">
            <div>
              <h3>Pages</h3>
              <p class="muted">
                {{ pagesData.pages.length }} crawled page{{ pagesData.pages.length === 1 ? '' : 's' }}
              </p>
            </div>
            <span class="muted">Show list</span>
          </summary>

          <div class="stack">
            <div
              v-for="page in pagesData.pages"
              :key="page.id"
              class="issue"
            >
              <strong>{{ page.title || page.url }}</strong>
              <p class="muted">{{ page.url }}</p>
            </div>
          </div>
        </details>
      </section>

      <section class="panel stack">
        <h3>Worker events</h3>
        <div
          v-if="eventsData?.events.length"
          class="stack"
        >
          <div
            v-for="event in eventsData.events"
            :key="event.id"
            class="event issue"
          >
            <header>
              <StatusPill :value="event.level" />
              <span class="muted">{{ new Date(event.createdAt).toLocaleString() }}</span>
            </header>
            <p>{{ event.message }}</p>
            <pre v-if="event.contextJson && Object.keys(event.contextJson).length">{{ event.contextJson }}</pre>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>
