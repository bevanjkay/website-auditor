<script setup lang="ts">
import type { SeverityCounts, SiteHealth } from "../composables/useStatus";

interface CompletedRunSummary {
  id: string;
  finishedAt: string | null;
  severityCounts: SeverityCounts;
}

interface WebsiteRow {
  id: string;
  name: string;
  baseUrl: string;
  normalizedHost: string;
  isActive: boolean;
  lastAuditRunId: string | null;
  lastAuditStatus: string | null;
  lastAuditFinishedAt: string | null;
  lastCompletedRun: CompletedRunSummary | null;
  previousCompletedRun: CompletedRunSummary | null;
}

type HealthFilter = "all" | "errors" | "warnings" | "clean" | "failed" | "not_audited" | "active";
type SortKey = "name" | "health" | "errors" | "warnings" | "change" | "lastAudit";

useHead({ title: "Websites" });

const route = useRoute();
const router = useRouter();

const { data, refresh, error: loadError } = await useAsyncData<{ websites: WebsiteRow[] }>("websites", () =>
  $fetch("/api/websites"));

const healthRank: Record<SiteHealth, number> = {
  failed: 0,
  errors: 1,
  warnings: 2,
  running: 3,
  queued: 4,
  cancelled: 5,
  not_audited: 6,
  clean: 7,
  archived: 8,
};

const filterDefinitions: Array<{ value: HealthFilter; label: string; dot: string; matches: (health: SiteHealth) => boolean }> = [
  { value: "errors", label: "Errors", dot: "dot-error", matches: health => health === "errors" },
  { value: "warnings", label: "Warnings", dot: "dot-warning", matches: health => health === "warnings" },
  { value: "failed", label: "Run failed", dot: "dot-error", matches: health => health === "failed" || health === "cancelled" },
  { value: "active", label: "Running", dot: "dot-accent", matches: health => health === "running" || health === "queued" },
  { value: "not_audited", label: "Not audited", dot: "dot-neutral", matches: health => health === "not_audited" },
  { value: "clean", label: "Clean", dot: "dot-success", matches: health => health === "clean" },
];

const healthFilter = computed<HealthFilter>(() => {
  const value = String(route.query.status ?? "all");
  return filterDefinitions.some(definition => definition.value === value) ? value as HealthFilter : "all";
});
const search = ref(String(route.query.q ?? ""));
const showArchived = computed(() => route.query.archived === "1");
const sortKey = ref<SortKey>("health");
const sortDirection = ref<"asc" | "desc">("asc");

function updateQuery(changes: Record<string, string | undefined>) {
  void router.replace({ query: { ...route.query, ...changes } });
}

watch(search, (value) => {
  updateQuery({ q: value.trim() || undefined });
});

function totalIssues(counts: SeverityCounts | undefined) {
  return counts ? counts.error + counts.warning + counts.info : 0;
}

const rows = computed(() => (data.value?.websites ?? []).map((website) => {
  const health = deriveSiteHealth(website);
  const latest = website.lastCompletedRun?.severityCounts;
  const previous = website.previousCompletedRun?.severityCounts;
  return {
    ...website,
    health,
    errors: latest?.error ?? null,
    warnings: latest?.warning ?? null,
    change: latest && previous ? totalIssues(latest) - totalIssues(previous) : null,
    lastAuditAt: website.lastAuditFinishedAt ?? website.lastCompletedRun?.finishedAt ?? null,
  };
}));

const activeRows = computed(() => rows.value.filter(row => row.isActive));
const archivedCount = computed(() => rows.value.length - activeRows.value.length);

const filterCounts = computed(() => new Map(filterDefinitions.map(definition => [
  definition.value,
  activeRows.value.filter(row => definition.matches(row.health)).length,
])));

const visibleFilters = computed(() => filterDefinitions.filter(definition =>
  (filterCounts.value.get(definition.value) ?? 0) > 0 || definition.value === healthFilter.value));

const filteredRows = computed(() => {
  const needle = search.value.trim().toLowerCase();
  const definition = filterDefinitions.find(item => item.value === healthFilter.value);

  return rows.value
    .filter(row => showArchived.value || row.isActive)
    .filter(row => !definition || definition.matches(row.health))
    .filter(row => !needle || row.name.toLowerCase().includes(needle) || row.normalizedHost.includes(needle));
});

const sortedRows = computed(() => {
  const direction = sortDirection.value === "asc" ? 1 : -1;
  const nullsLast = (value: number | null) => value ?? (direction === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);

  return [...filteredRows.value].sort((left, right) => {
    let result = 0;
    switch (sortKey.value) {
      case "name":
        result = left.name.localeCompare(right.name);
        break;
      case "health":
        result = (healthRank[left.health] ?? 9) - (healthRank[right.health] ?? 9) || (right.errors ?? 0) - (left.errors ?? 0);
        break;
      case "errors":
        result = nullsLast(left.errors) - nullsLast(right.errors);
        break;
      case "warnings":
        result = nullsLast(left.warnings) - nullsLast(right.warnings);
        break;
      case "change":
        result = nullsLast(left.change) - nullsLast(right.change);
        break;
      case "lastAudit":
        result = nullsLast(left.lastAuditAt ? new Date(left.lastAuditAt).getTime() : null) - nullsLast(right.lastAuditAt ? new Date(right.lastAuditAt).getTime() : null);
        break;
    }
    return result * direction || left.name.localeCompare(right.name);
  });
});

const columns: Array<{ key: SortKey; label: string; align?: "end"; defaultDirection: "asc" | "desc" }> = [
  { key: "name", label: "Website", defaultDirection: "asc" },
  { key: "health", label: "Status", defaultDirection: "asc" },
  { key: "errors", label: "Errors", align: "end", defaultDirection: "desc" },
  { key: "warnings", label: "Warnings", align: "end", defaultDirection: "desc" },
  { key: "change", label: "Change", align: "end", defaultDirection: "desc" },
  { key: "lastAudit", label: "Last audit", defaultDirection: "desc" },
];

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortKey.value = key;
  sortDirection.value = columns.find(column => column.key === key)?.defaultDirection ?? "asc";
}

function clearFilters() {
  search.value = "";
  updateQuery({ status: undefined, q: undefined });
}

const notice = ref<{ tone: "success" | "error" | "neutral"; message: string; auditId?: string; settingsFor?: string; undoArchive?: { id: string; name: string } } | null>(null);
const pendingRows = ref<string[]>([]);

function setPending(id: string, pending: boolean) {
  pendingRows.value = pending ? [...pendingRows.value, id] : pendingRows.value.filter(value => value !== id);
}

async function runAudit(row: { id: string; name: string }) {
  setPending(row.id, true);
  try {
    const response = await $fetch<{ auditRun: { id: string } }>(`/api/websites/${row.id}/audits`, { method: "POST" });
    notice.value = { tone: "success", message: `Audit queued for ${row.name}.`, auditId: response.auditRun.id };
    await refresh();
  }
  catch (error) {
    const message = getErrorMessage(error, `Couldn't start an audit for ${row.name}.`);
    notice.value = { tone: "error", message, settingsFor: message.includes("crawl rules") ? row.id : undefined };
  }
  finally {
    setPending(row.id, false);
  }
}

async function setArchived(row: { id: string; name: string }, archived: boolean, fromUndo = false) {
  setPending(row.id, true);
  try {
    await $fetch(`/api/websites/${row.id}`, { method: "PATCH", body: { isActive: !archived } });
    notice.value = archived
      ? { tone: "neutral", message: `${row.name} archived. Its audit history is kept.`, undoArchive: { id: row.id, name: row.name } }
      : fromUndo ? null : { tone: "success", message: `${row.name} restored.` };
    await refresh();
  }
  catch (error) {
    notice.value = { tone: "error", message: getErrorMessage(error, `Couldn't update ${row.name}.`) };
  }
  finally {
    setPending(row.id, false);
  }
}

// Briefly highlight rows whose status changed while the list was open, such as an audit finishing.
const updatedRows = ref<string[]>([]);
let previousHealth = new Map<string, SiteHealth>();
watch(rows, (current) => {
  const changed = current.filter(row => previousHealth.has(row.id) && previousHealth.get(row.id) !== row.health).map(row => row.id);
  previousHealth = new Map(current.map(row => [row.id, row.health]));
  if (!changed.length) {
    return;
  }
  updatedRows.value = [...updatedRows.value.filter(id => !changed.includes(id)), ...changed];
  setTimeout(() => {
    updatedRows.value = updatedRows.value.filter(id => !changed.includes(id));
  }, 1700);
}, { immediate: true });

const hasActiveRuns = computed(() => rows.value.some(row => row.health === "running" || row.health === "queued"));
let pollHandle: ReturnType<typeof setInterval> | undefined;

watch(hasActiveRuns, (active) => {
  if (active && pollHandle === undefined) {
    pollHandle = setInterval(() => void refresh(), 5000);
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
    <PageHeader title="Websites">
      <template #subtitle>
        <span>{{ pluralize(activeRows.length, 'website') }} monitored</span>
      </template>
      <template #actions>
        <NuxtLink
          class="btn btn-primary"
          to="/websites/new"
        >
          <AppIcon name="plus" />
          Add website
        </NuxtLink>
      </template>
    </PageHeader>

    <div class="stack">
      <AlertMessage
        v-if="loadError"
        tone="error"
        title="Couldn't load websites"
      >
        {{ getErrorMessage(loadError, 'The server did not respond.') }}
        <template #actions>
          <button
            type="button"
            class="btn btn-sm"
            @click="refresh()"
          >
            Try again
          </button>
        </template>
      </AlertMessage>

      <AlertMessage
        v-if="notice"
        :tone="notice.tone"
        dismissible
        @dismiss="notice = null"
      >
        {{ notice.message }}
        <template
          v-if="notice.auditId || notice.settingsFor || notice.undoArchive"
          #actions
        >
          <NuxtLink
            v-if="notice.auditId"
            class="btn btn-sm"
            :to="`/audits/${notice.auditId}`"
          >
            View progress
          </NuxtLink>
          <NuxtLink
            v-if="notice.settingsFor"
            class="btn btn-sm"
            :to="`/websites/${notice.settingsFor}/settings`"
          >
            Review crawl rules
          </NuxtLink>
          <button
            v-if="notice.undoArchive"
            type="button"
            class="btn btn-sm"
            @click="setArchived(notice.undoArchive, false, true)"
          >
            Undo
          </button>
        </template>
      </AlertMessage>

      <template v-if="rows.length">
        <div
          class="filter-group"
          role="group"
          aria-label="Filter by status"
        >
          <button
            type="button"
            class="filter-chip"
            :aria-pressed="healthFilter === 'all'"
            @click="updateQuery({ status: undefined })"
          >
            All
            <span class="count">{{ activeRows.length }}</span>
          </button>
          <button
            v-for="definition in visibleFilters"
            :key="definition.value"
            type="button"
            class="filter-chip"
            :aria-pressed="healthFilter === definition.value"
            @click="updateQuery({ status: healthFilter === definition.value ? undefined : definition.value })"
          >
            <span
              class="badge-dot"
              :class="definition.dot"
              aria-hidden="true"
            />
            {{ definition.label }}
            <span class="count">{{ filterCounts.get(definition.value) }}</span>
          </button>
        </div>

        <section
          class="panel"
          aria-label="Websites"
        >
          <div class="panel-header">
            <div class="toolbar">
              <div class="search-field">
                <AppIcon name="search" />
                <label
                  for="website-search"
                  class="visually-hidden"
                >Search websites</label>
                <input
                  id="website-search"
                  v-model="search"
                  type="search"
                  placeholder="Search by name or host"
                >
              </div>
            </div>
            <label
              v-if="archivedCount"
              class="checkbox"
            >
              <input
                type="checkbox"
                :checked="showArchived"
                @change="updateQuery({ archived: ($event.target as HTMLInputElement).checked ? '1' : undefined })"
              >
              Show archived ({{ archivedCount }})
            </label>
          </div>

          <div
            v-if="sortedRows.length"
            class="table-wrap"
          >
            <table class="data-table sites-table">
              <caption class="visually-hidden">
                Websites with their latest audit status, issue counts and change since the previous audit
              </caption>
              <thead>
                <tr>
                  <th
                    v-for="column in columns"
                    :key="column.key"
                    scope="col"
                    :class="{ 'align-end': column.align === 'end' }"
                    :aria-sort="sortKey === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined"
                  >
                    <button
                      type="button"
                      class="sort-button"
                      @click="toggleSort(column.key)"
                    >
                      {{ column.label }}
                      <AppIcon
                        :name="sortKey === column.key ? (sortDirection === 'asc' ? 'arrow-up' : 'arrow-down') : 'chevrons-up-down'"
                        :size="12"
                      />
                    </button>
                  </th>
                  <th
                    scope="col"
                    class="shrink"
                  >
                    <span class="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in sortedRows"
                  :key="row.id"
                  :class="{ 'row-archived': !row.isActive, 'row-updated': updatedRows.includes(row.id) }"
                >
                  <td class="cell-lead">
                    <div class="cell-primary">
                      <NuxtLink :to="`/websites/${row.id}`">
                        {{ row.name }}
                      </NuxtLink>
                      <span>{{ row.normalizedHost }}</span>
                    </div>
                  </td>
                  <td class="cell-status">
                    <NuxtLink
                      v-if="(row.health === 'running' || row.health === 'queued' || row.health === 'failed') && row.lastAuditRunId"
                      :to="`/audits/${row.lastAuditRunId}`"
                      :aria-label="`${siteHealthMeta[row.health].label}: open audit for ${row.name}`"
                    >
                      <StatusBadge
                        :label="siteHealthMeta[row.health].label"
                        :tone="siteHealthMeta[row.health].tone"
                        :spinning="row.health === 'running'"
                      />
                    </NuxtLink>
                    <StatusBadge
                      v-else
                      :label="siteHealthMeta[row.health].label"
                      :tone="siteHealthMeta[row.health].tone"
                    />
                  </td>
                  <td
                    class="align-end cell-count"
                    data-short="Errors"
                  >
                    <span
                      v-if="row.errors !== null"
                      :class="row.errors ? 'count-error' : 'count-zero'"
                    >{{ row.errors.toLocaleString() }}</span>
                    <span
                      v-else
                      class="count-zero"
                    >—</span>
                  </td>
                  <td
                    class="align-end cell-count"
                    data-short="Warnings"
                  >
                    <span
                      v-if="row.warnings !== null"
                      :class="row.warnings ? 'count-warning' : 'count-zero'"
                    >{{ row.warnings.toLocaleString() }}</span>
                    <span
                      v-else
                      class="count-zero"
                    >—</span>
                  </td>
                  <td class="align-end">
                    <DeltaValue :value="row.change" />
                  </td>
                  <td>
                    <NuxtLink
                      v-if="row.lastCompletedRun && row.lastAuditAt"
                      :to="`/audits/${row.lastCompletedRun.id}`"
                      :title="formatDateTime(row.lastAuditAt)"
                      class="text-secondary"
                    >
                      {{ formatRelativeTime(row.lastAuditAt) }}
                    </NuxtLink>
                    <span
                      v-else-if="row.lastAuditAt"
                      class="text-secondary"
                      :title="formatDateTime(row.lastAuditAt)"
                    >{{ formatRelativeTime(row.lastAuditAt) }}</span>
                    <span
                      v-else
                      class="text-muted"
                    >Never</span>
                  </td>
                  <td class="shrink">
                    <div class="row">
                      <template v-if="row.isActive">
                        <button
                          type="button"
                          class="btn btn-sm"
                          :disabled="pendingRows.includes(row.id) || row.health === 'running' || row.health === 'queued'"
                          :aria-label="`Run audit for ${row.name}`"
                          @click="runAudit(row)"
                        >
                          <AppIcon
                            :name="pendingRows.includes(row.id) ? 'loader' : 'play'"
                            :size="14"
                            :class="{ spin: pendingRows.includes(row.id) }"
                          />
                          <span class="run-label">Run</span>
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-ghost btn-icon"
                          :disabled="pendingRows.includes(row.id) || row.health === 'running' || row.health === 'queued'"
                          :aria-label="`Archive ${row.name}`"
                          :title="`Archive ${row.name}`"
                          @click="setArchived(row, true)"
                        >
                          <AppIcon name="archive" />
                        </button>
                      </template>
                      <button
                        v-else
                        type="button"
                        class="btn btn-sm"
                        :disabled="pendingRows.includes(row.id)"
                        :aria-label="`Restore ${row.name}`"
                        @click="setArchived(row, false)"
                      >
                        <AppIcon
                          name="restore"
                          :size="14"
                        />
                        Restore
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-else
            class="empty-state"
          >
            <template v-if="!activeRows.length && !showArchived">
              <AppIcon
                name="archive"
                :size="24"
              />
              <h2>Every website is archived</h2>
              <p>Restore a website to see it here and run audits again.</p>
              <div class="form-actions">
                <button
                  type="button"
                  class="btn"
                  @click="updateQuery({ archived: '1' })"
                >
                  Show archived
                </button>
              </div>
            </template>
            <template v-else>
              <AppIcon
                name="search"
                :size="24"
              />
              <h2>No websites match</h2>
              <p>Try a different search, or clear the status filter.</p>
              <div class="form-actions">
                <button
                  type="button"
                  class="btn"
                  @click="clearFilters"
                >
                  Clear filters
                </button>
              </div>
            </template>
          </div>
        </section>
      </template>

      <section
        v-else-if="!loadError"
        class="panel empty-state"
      >
        <AppIcon
          name="globe"
          :size="28"
        />
        <h2>Add your first website</h2>
        <p>Website Auditor crawls a site in a real browser and reports broken links, typos, SEO issues and Lighthouse scores, keeping every run so you can see what changed.</p>
        <div class="form-actions">
          <NuxtLink
            class="btn btn-primary"
            to="/websites/new"
          >
            <AppIcon name="plus" />
            Add website
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
