<script setup lang="ts">
const route = useRoute();

interface CrawlRuleRow {
  matcher: "glob" | "exact" | "prefix";
  pattern: string;
}

interface DiscoveryEntryRow {
  url: string;
  source: "sitemap" | "fallback";
  status: "included" | "excluded";
  matchedRule: {
    mode: "allow" | "deny";
    matcher: "glob" | "exact" | "prefix";
    pattern: string;
  } | null;
}

interface WebsiteDetailResponse {
  website: {
    id: string;
    name: string;
    baseUrl: string;
    typoLanguage: "en" | "en-au" | "en-gb" | "en-us";
    crawlRulesJson: {
      allow: CrawlRuleRow[];
      deny: CrawlRuleRow[];
    };
    lighthouseTargetsJson: string[];
    latestRun: {
      id: string;
      status: string;
      pageCount: number;
      issueCount: number;
      brokenLinkCount: number;
    } | null;
  };
  latestIssueSummary: Record<string, number>;
}

interface DiscoveryResponse {
  discovery: {
    generatedAt: string;
    hasSitemap: boolean;
    source: string;
    total: number;
    included: number;
    excluded: number;
    sitemapUrls: string[];
    entries: DiscoveryEntryRow[];
  };
  allowSuggestions: Array<{
    matcher: "glob" | "exact" | "prefix";
    pattern: string;
    reason: string;
    matchedCount: number;
    exampleUrls: string[];
  }>;
  denySuggestions: Array<{
    matcher: "glob" | "exact" | "prefix";
    pattern: string;
    reason: string;
    matchedCount: number;
    exampleUrls: string[];
  }>;
}

interface AuditRunRow {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  issueCount: number;
}

const ruleOptions = [
  { label: "Glob", value: "glob" },
  { label: "Exact", value: "exact" },
  { label: "Prefix", value: "prefix" },
] as const;
const typoLanguageOptions = [
  { label: "English (generic)", value: "en" },
  { label: "English (Australia)", value: "en-au" },
  { label: "English (United Kingdom)", value: "en-gb" },
  { label: "English (United States)", value: "en-us" },
] as const;

const { data: websiteData, refresh: refreshWebsite } = await useAsyncData<WebsiteDetailResponse>(`website-${route.params.id}`, () =>
  $fetch(`/api/websites/${route.params.id}`));
const { data: discoveryPayload, refresh: refreshDiscovery, pending: discoveryPending } = useLazyAsyncData<DiscoveryResponse | null>(`website-discovery-${route.params.id}`, () =>
  $fetch(`/api/websites/${route.params.id}/discovery`), {
  default: () => null,
  server: false,
});
const { data: auditsData, refresh: refreshAudits } = await useAsyncData<{ auditRuns: AuditRunRow[] }>(`website-audits-${route.params.id}`, () =>
  $fetch(`/api/websites/${route.params.id}/audits`));

const ruleDraft = reactive<{
  allow: CrawlRuleRow[];
  deny: CrawlRuleRow[];
}>({
  allow: [],
  deny: [],
});
const rulesPending = ref(false);
const runPending = ref(false);
const errorMessage = ref("");
const typoLanguage = ref<"en" | "en-au" | "en-gb" | "en-us">("en");
const lighthouseTargets = ref<string[]>([]);
const lighthouseSearch = ref("");
const lighthouseSearchFocused = ref(false);

function cloneRules(rows: CrawlRuleRow[] = []) {
  return rows.map(row => ({
    matcher: row.matcher,
    pattern: row.pattern,
  }));
}

watch(() => websiteData.value?.website.crawlRulesJson, (rules) => {
  ruleDraft.allow = cloneRules(rules?.allow);
  ruleDraft.deny = cloneRules(rules?.deny);
}, { immediate: true });

watch(() => websiteData.value?.website.lighthouseTargetsJson, (targets) => {
  lighthouseTargets.value = [...(targets ?? [])];
}, { immediate: true });

watch(() => websiteData.value?.website.typoLanguage, (language) => {
  typoLanguage.value = language ?? "en";
}, { immediate: true });

function addRule(mode: "allow" | "deny") {
  ruleDraft[mode].push({
    matcher: "glob",
    pattern: "",
  });
}

function removeRule(mode: "allow" | "deny", index: number) {
  ruleDraft[mode].splice(index, 1);
}

function sanitizeRules() {
  return {
    allow: ruleDraft.allow
      .map(rule => ({
        matcher: rule.matcher,
        pattern: rule.pattern.trim(),
      }))
      .filter(rule => rule.pattern.length > 0),
    deny: ruleDraft.deny
      .map(rule => ({
        matcher: rule.matcher,
        pattern: rule.pattern.trim(),
      }))
      .filter(rule => rule.pattern.length > 0),
  };
}

function sanitizeLighthouseTargets() {
  return [...new Set(lighthouseTargets.value
    .map(target => target.trim())
    .filter(Boolean))];
}

const includedEntries = computed(() =>
  discoveryPayload.value?.discovery.entries.filter((entry: DiscoveryEntryRow) => entry.status === "included") ?? [],
);
const excludedEntries = computed(() =>
  discoveryPayload.value?.discovery.entries.filter((entry: DiscoveryEntryRow) => entry.status === "excluded") ?? [],
);
const discovery = computed(() => discoveryPayload.value?.discovery ?? null);
const allowSuggestions = computed(() => discoveryPayload.value?.allowSuggestions ?? []);
const denySuggestions = computed(() => discoveryPayload.value?.denySuggestions ?? []);
const discoveredLighthouseOptions = computed(() => {
  const homepage = websiteData.value?.website.baseUrl;
  const selected = new Set(lighthouseTargets.value);

  return includedEntries.value
    .map((entry: DiscoveryEntryRow) => entry.url)
    .filter((url: string, index: number, urls: string[]) => urls.indexOf(url) === index)
    .filter((url: string) => url !== homepage && !selected.has(url))
    .sort((left: string, right: string) => left.localeCompare(right));
});
const filteredLighthouseOptions = computed(() => {
  const query = lighthouseSearch.value.trim().toLowerCase();
  const options = discoveredLighthouseOptions.value;

  if (!query) {
    return options.slice(0, 12);
  }

  return options
    .filter((url: string) => url.toLowerCase().includes(query))
    .slice(0, 12);
});
const canAddManualLighthouseUrl = computed(() => {
  const candidate = lighthouseSearch.value.trim();
  if (!candidate || lighthouseTargets.value.includes(candidate) || discoveredLighthouseOptions.value.includes(candidate)) {
    return false;
  }

  try {
    // Keep manual entry available for exceptional pages outside discovery.
    // The homepage is always audited, so there is no need to add it here.
    return new URL(candidate).toString() !== websiteData.value?.website.baseUrl;
  }
  catch {
    return false;
  }
});

async function saveRules() {
  rulesPending.value = true;
  errorMessage.value = "";

  try {
    await $fetch(`/api/websites/${route.params.id}`, {
      method: "PATCH",
      body: {
        crawlRules: sanitizeRules(),
        lighthouseTargets: sanitizeLighthouseTargets(),
        typoLanguage: typoLanguage.value,
      },
    });
    await Promise.all([refreshWebsite(), refreshDiscovery()]);
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to save crawl rules.";
  }
  finally {
    rulesPending.value = false;
  }
}

async function runAudit() {
  runPending.value = true;
  errorMessage.value = "";

  try {
    const response = await $fetch<{ auditRun: { id: string } }>(`/api/websites/${route.params.id}/audits`, {
      method: "POST",
    });
    await Promise.all([refreshWebsite(), refreshAudits()]);
    await navigateTo(`/audits/${response.auditRun.id}`);
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to start audit.";
  }
  finally {
    runPending.value = false;
  }
}

function addSuggestedDenyRule(pattern: string, matcher: "glob" | "exact" | "prefix") {
  if (ruleDraft.deny.some(rule => rule.matcher === matcher && rule.pattern === pattern)) {
    return;
  }

  ruleDraft.deny.push({
    matcher,
    pattern,
  });
}

function addSuggestedAllowRule(pattern: string, matcher: "glob" | "exact" | "prefix") {
  if (ruleDraft.allow.some(rule => rule.matcher === matcher && rule.pattern === pattern)) {
    return;
  }

  ruleDraft.allow.push({
    matcher,
    pattern,
  });
}

function addLighthouseTarget(target: string) {
  if (lighthouseTargets.value.includes(target) || target === websiteData.value?.website.baseUrl) {
    lighthouseSearch.value = "";
    return;
  }

  lighthouseTargets.value = [...lighthouseTargets.value, target];
  lighthouseSearch.value = "";
}

function removeLighthouseTarget(target: string) {
  lighthouseTargets.value = lighthouseTargets.value.filter(item => item !== target);
}
</script>

<template>
  <section class="stack">
    <div class="hero-card stack">
      <div style="display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: start;">
        <div>
          <p class="muted">
            Website
          </p>
          <h2>{{ websiteData?.website.name }}</h2>
          <p class="muted">
            {{ websiteData?.website.baseUrl }}
          </p>
        </div>

        <div class="nav-links">
          <button
            class="button button-primary"
            :disabled="runPending || !discovery?.included"
            @click="runAudit"
          >
            {{ runPending ? 'Queueing…' : 'Run filtered audit' }}
          </button>
          <button
            :disabled="discoveryPending"
            @click="refreshDiscovery()"
          >
            {{ discoveryPending ? 'Refreshing…' : 'Refresh discovery' }}
          </button>
        </div>
      </div>

      <div class="metric-grid">
        <MetricCard
          label="Latest status"
          :value="websiteData?.website.latestRun?.status ?? 'queued'"
        />
        <MetricCard
          label="Preview URLs"
          :value="discovery?.total ?? 0"
        />
        <MetricCard
          label="Included"
          :value="discovery?.included ?? 0"
        />
        <MetricCard
          label="Excluded"
          :value="discovery?.excluded ?? 0"
        />
      </div>

      <p
        v-if="errorMessage"
        class="notice"
      >
        {{ errorMessage }}
      </p>
    </div>

    <div class="split">
      <section class="panel stack">
        <div style="display: flex; justify-content: space-between; gap: 16px; align-items: start; flex-wrap: wrap;">
          <div>
            <h3>Discovery preview</h3>
            <p class="muted">
              Sitemap candidates are loaded first. If no sitemap is found, the homepage is used for a shallow internal-link seed pass.
            </p>
          </div>
          <div class="stack" style="gap: 4px; text-align: right;">
            <span class="muted">Source: {{ discovery?.source ?? 'n/a' }}</span>
            <span class="muted">Generated: {{ discovery?.generatedAt ? new Date(discovery.generatedAt).toLocaleString() : 'Pending' }}</span>
          </div>
        </div>

        <div
          v-if="discovery"
          class="stack"
        >
          <div class="split" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
            <section class="issue stack">
              <header>
                <strong>Included URLs</strong>
                <span>{{ includedEntries.length }}</span>
              </header>
              <div
                v-if="includedEntries.length"
                class="preview-list"
              >
                <div
                  v-for="entry in includedEntries"
                  :key="entry.url"
                  class="preview-item"
                >
                  <div>
                    <strong>{{ entry.url }}</strong>
                    <p class="muted">{{ entry.source }}</p>
                  </div>
                  <span
                    v-if="entry.matchedRule"
                    class="muted"
                  >
                    {{ entry.matchedRule.mode }} · {{ entry.matchedRule.matcher }}
                  </span>
                </div>
              </div>
              <div
                v-else
                class="empty"
              >
                No URLs are currently included.
              </div>
            </section>

            <section class="issue stack">
              <header>
                <strong>Excluded URLs</strong>
                <span>{{ excludedEntries.length }}</span>
              </header>
              <div
                v-if="excludedEntries.length"
                class="preview-list"
              >
                <div
                  v-for="entry in excludedEntries"
                  :key="entry.url"
                  class="preview-item"
                >
                  <div>
                    <strong>{{ entry.url }}</strong>
                    <p class="muted">{{ entry.source }}</p>
                  </div>
                  <span class="muted">
                    {{ entry.matchedRule ? `${entry.matchedRule.mode} · ${entry.matchedRule.matcher}` : 'No allow rule matched' }}
                  </span>
                </div>
              </div>
              <div
                v-else
                class="empty"
              >
                No URLs are excluded by the current rules.
              </div>
            </section>
          </div>
        </div>
        <div
          v-else-if="discoveryPending"
          class="empty"
        >
          Loading discovery preview in the background…
        </div>
        <div
          v-else
          class="empty"
        >
          Discovery preview has not loaded yet.
        </div>

        <section
          v-if="allowSuggestions.length || denySuggestions.length"
          class="issue stack"
        >
          <header>
            <strong>Rule presets</strong>
            <span>{{ allowSuggestions.length + denySuggestions.length }}</span>
          </header>

          <div
            v-if="allowSuggestions.length"
            class="stack"
            style="gap: 12px;"
          >
            <strong>Suggested allow presets</strong>
            <div
              v-for="suggestion in allowSuggestions"
              :key="`allow-${suggestion.matcher}:${suggestion.pattern}`"
              class="preview-item"
            >
              <div>
                <strong>{{ suggestion.pattern }}</strong>
                <p class="muted">
                  {{ suggestion.reason }} · matches {{ suggestion.matchedCount }} URL{{ suggestion.matchedCount === 1 ? '' : 's' }}
                </p>
                <p class="muted">
                  {{ suggestion.exampleUrls.join(' · ') }}
                </p>
              </div>
              <div class="preset-actions">
                <button @click="addSuggestedAllowRule(suggestion.pattern, suggestion.matcher)">
                  Add to allowlist
                </button>
                <button @click="addSuggestedDenyRule(suggestion.pattern, suggestion.matcher)">
                  Add to denylist
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="denySuggestions.length"
            class="stack"
            style="gap: 12px;"
          >
            <strong>Suggested deny presets</strong>
            <div
              v-for="suggestion in denySuggestions"
              :key="`deny-${suggestion.matcher}:${suggestion.pattern}`"
              class="preview-item"
            >
              <div>
                <strong>{{ suggestion.pattern }}</strong>
                <p class="muted">
                  {{ suggestion.reason }} · matches {{ suggestion.matchedCount }} URL{{ suggestion.matchedCount === 1 ? '' : 's' }}
                </p>
                <p class="muted">
                  {{ suggestion.exampleUrls.join(' · ') }}
                </p>
              </div>
              <div class="preset-actions">
                <button @click="addSuggestedAllowRule(suggestion.pattern, suggestion.matcher)">
                  Add to allowlist
                </button>
                <button @click="addSuggestedDenyRule(suggestion.pattern, suggestion.matcher)">
                  Add to denylist
                </button>
              </div>
            </div>
          </div>
        </section>
      </section>

      <aside class="stack">
        <section class="panel stack">
          <div style="display: flex; justify-content: space-between; gap: 16px; align-items: center;">
            <div>
              <h3>Crawl rules</h3>
              <p class="muted">
                Allowlist runs first, then denylist wins on conflict. Rules are matched against normalized full URLs.
              </p>
            </div>
            <button
              class="button button-primary"
              :disabled="rulesPending"
              @click="saveRules"
            >
              {{ rulesPending ? 'Saving…' : 'Save rules' }}
            </button>
          </div>

          <div class="stack">
            <div class="field">
              <label for="typo-language">Typo audit language</label>
              <select
                id="typo-language"
                v-model="typoLanguage"
              >
                <option
                  v-for="option in typoLanguageOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
              <p class="muted">
                Choose which English dictionary the typo audit should use for this site.
              </p>
            </div>

            <div class="field">
              <label for="lighthouse-targets">Additional Lighthouse URLs</label>
              <div class="picker stack">
                <div class="picker-selected">
                  <span
                    v-for="target in lighthouseTargets"
                    :key="target"
                    class="picker-chip"
                  >
                    <span>{{ target }}</span>
                    <button @click="removeLighthouseTarget(target)">
                      Remove
                    </button>
                  </span>
                  <span
                    v-if="!lighthouseTargets.length"
                    class="muted"
                  >
                    No additional Lighthouse URLs selected.
                  </span>
                </div>

                <div class="picker-search">
                  <input
                    id="lighthouse-targets"
                    v-model="lighthouseSearch"
                    type="search"
                    placeholder="Search discovered pages or paste a full URL"
                    @focus="lighthouseSearchFocused = true"
                    @blur="lighthouseSearchFocused = false"
                  >
                </div>

                <div
                  v-if="lighthouseSearchFocused || lighthouseSearch"
                  class="picker-dropdown"
                >
                  <button
                    v-for="target in filteredLighthouseOptions"
                    :key="target"
                    class="picker-option"
                    @mousedown.prevent="addLighthouseTarget(target)"
                  >
                    {{ target }}
                  </button>
                  <button
                    v-if="canAddManualLighthouseUrl"
                    class="picker-option"
                    @mousedown.prevent="addLighthouseTarget(lighthouseSearch.trim())"
                  >
                    Add manual URL: {{ lighthouseSearch.trim() }}
                  </button>
                  <div
                    v-if="!filteredLighthouseOptions.length && !canAddManualLighthouseUrl"
                    class="empty"
                  >
                    No matching discovered pages.
                  </div>
                </div>
              </div>
              <p class="muted">
                The homepage is always audited. Search discovered pages to add them here, or paste a full URL as a manual fallback.
              </p>
            </div>
          </div>

          <div class="stack">
            <div style="display: flex; justify-content: space-between; gap: 16px; align-items: center;">
              <h4>Allowlist</h4>
              <button @click="addRule('allow')">
                Add allow rule
              </button>
            </div>
            <div
              v-if="ruleDraft.allow.length"
              class="stack"
            >
              <div
                v-for="(rule, index) in ruleDraft.allow"
                :key="`allow-${index}`"
                class="rule-row"
              >
                <select v-model="rule.matcher">
                  <option
                    v-for="option in ruleOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <input
                  v-model="rule.pattern"
                  placeholder="https://example.com/blog/**"
                >
                <button @click="removeRule('allow', index)">
                  Remove
                </button>
              </div>
            </div>
            <div
              v-else
              class="empty"
            >
              No allow rules. All discovered internal URLs are eligible unless denied.
            </div>
          </div>

          <div class="stack">
            <div style="display: flex; justify-content: space-between; gap: 16px; align-items: center;">
              <h4>Denylist</h4>
              <button @click="addRule('deny')">
                Add deny rule
              </button>
            </div>
            <div
              v-if="ruleDraft.deny.length"
              class="stack"
            >
              <div
                v-for="(rule, index) in ruleDraft.deny"
                :key="`deny-${index}`"
                class="rule-row"
              >
                <select v-model="rule.matcher">
                  <option
                    v-for="option in ruleOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <input
                  v-model="rule.pattern"
                  placeholder="**/tag/**"
                >
                <button @click="removeRule('deny', index)">
                  Remove
                </button>
              </div>
            </div>
            <div
              v-else
              class="empty"
            >
              No deny rules.
            </div>
          </div>
        </section>

        <section class="panel stack">
          <h3>Latest issue mix</h3>
          <div
            v-if="websiteData?.latestIssueSummary && Object.keys(websiteData.latestIssueSummary).length"
            class="stack"
          >
            <div
              v-for="(count, category) in websiteData.latestIssueSummary"
              :key="category"
              class="issue"
            >
              <header>
                <strong>{{ category }}</strong>
                <span>{{ count }}</span>
              </header>
            </div>
          </div>
          <div
            v-else
            class="empty"
          >
            No issue summary yet.
          </div>
        </section>
      </aside>
    </div>

    <section class="panel stack">
      <h3>Audit history</h3>
      <table
        v-if="auditsData?.auditRuns.length"
        class="table"
      >
        <thead>
          <tr>
            <th>Run</th>
            <th>Status</th>
            <th>Started</th>
            <th>Finished</th>
            <th>Issues</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="audit in auditsData.auditRuns"
            :key="audit.id"
          >
            <td>
              <NuxtLink :to="`/audits/${audit.id}`">
                {{ audit.id }}
              </NuxtLink>
            </td>
            <td><StatusPill :value="audit.status" /></td>
            <td>{{ audit.startedAt ? new Date(audit.startedAt).toLocaleString() : 'Queued' }}</td>
            <td>{{ audit.finishedAt ? new Date(audit.finishedAt).toLocaleString() : 'Running' }}</td>
            <td>{{ audit.issueCount }}</td>
          </tr>
        </tbody>
      </table>
      <div
        v-else
        class="empty"
      >
        No audit runs yet.
      </div>
    </section>
  </section>
</template>
