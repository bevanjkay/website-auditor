<script setup lang="ts">
import type { LinkIgnore } from "@website-auditor/shared";

import { parseLinkIgnore } from "@website-auditor/shared";

type Matcher = "glob" | "exact" | "prefix";
type TypoLanguage = "en" | "en-au" | "en-gb" | "en-us";

interface CrawlRuleRow {
  matcher: Matcher;
  pattern: string;
}

interface DiscoveryEntryRow {
  url: string;
  source: "sitemap" | "fallback";
  status: "included" | "excluded";
  matchedRule: { mode: "allow" | "deny"; matcher: Matcher; pattern: string } | null;
}

interface RuleSuggestion {
  matcher: Matcher;
  pattern: string;
  reason: string;
  matchedCount: number;
  exampleUrls: string[];
}

interface WebsiteDetailResponse {
  website: {
    id: string;
    name: string;
    baseUrl: string;
    isActive: boolean;
    typoLanguage: TypoLanguage;
    typoAllowlistJson: string[];
    linkIgnoresJson: LinkIgnore[];
    crawlRulesJson: { allow: CrawlRuleRow[]; deny: CrawlRuleRow[] };
    lighthouseTargetsJson: string[];
    latestRun: { id: string; status: string } | null;
  };
}

interface DiscoveryResponse {
  discovery: {
    generatedAt: string;
    hasSitemap: boolean;
    source: "sitemap" | "fallback" | "mixed";
    total: number;
    included: number;
    excluded: number;
    entries: DiscoveryEntryRow[];
  };
  allowSuggestions: RuleSuggestion[];
  denySuggestions: RuleSuggestion[];
}

const maxLighthouseTargets = 10;
const maxListedUrls = 500;

const matcherOptions: Array<{ value: Matcher; label: string; placeholder: string }> = [
  { value: "glob", label: "Pattern", placeholder: "https://example.com/blog/*" },
  { value: "prefix", label: "Starts with", placeholder: "https://example.com/events/" },
  { value: "exact", label: "Exact URL", placeholder: "https://example.com/contact" },
];

const typoLanguageOptions: Array<{ value: TypoLanguage; label: string }> = [
  { value: "en", label: "English (generic)" },
  { value: "en-au", label: "English (Australia)" },
  { value: "en-gb", label: "English (United Kingdom)" },
  { value: "en-us", label: "English (United States)" },
];

const route = useRoute();
const websiteId = computed(() => String(route.params.id));

const { data: websiteData, refresh: refreshWebsite, error: websiteError } = await useAsyncData<WebsiteDetailResponse>(
  () => `website-${websiteId.value}`,
  () => $fetch(`/api/websites/${websiteId.value}`),
);
const {
  data: discoveryPayload,
  refresh: refreshDiscovery,
  pending: discoveryPending,
  error: discoveryError,
} = useLazyAsyncData<DiscoveryResponse | null>(
  () => `website-discovery-${websiteId.value}`,
  () => $fetch(`/api/websites/${websiteId.value}/discovery`),
  { default: () => null, server: false },
);

const website = computed(() => websiteData.value?.website ?? null);
useHead(() => ({ title: website.value ? `Crawl settings · ${website.value.name}` : "Crawl settings" }));

interface SettingsDraft {
  name: string;
  typoLanguage: TypoLanguage;
  lighthouseTargets: string[];
  typoAllowlist: string[];
  linkIgnores: LinkIgnore[];
  allow: CrawlRuleRow[];
  deny: CrawlRuleRow[];
}

function draftFromWebsite(source: WebsiteDetailResponse["website"] | undefined): SettingsDraft {
  return {
    name: source?.name ?? "",
    typoLanguage: source?.typoLanguage ?? "en",
    lighthouseTargets: [...(source?.lighthouseTargetsJson ?? [])],
    typoAllowlist: [...(source?.typoAllowlistJson ?? [])],
    linkIgnores: (source?.linkIgnoresJson ?? []).map(rule => ({ ...rule })),
    allow: (source?.crawlRulesJson.allow ?? []).map(rule => ({ ...rule })),
    deny: (source?.crawlRulesJson.deny ?? []).map(rule => ({ ...rule })),
  };
}

const draft = reactive<SettingsDraft>(draftFromWebsite(undefined));
const savedSnapshot = ref("");

function normalise(value: SettingsDraft) {
  const rules = (rows: CrawlRuleRow[]) => rows
    .map(rule => ({ matcher: rule.matcher, pattern: rule.pattern.trim() }))
    .filter(rule => rule.pattern);
  return {
    name: value.name.trim(),
    typoLanguage: value.typoLanguage,
    lighthouseTargets: [...new Set(value.lighthouseTargets.map(target => target.trim()).filter(Boolean))],
    typoAllowlist: [...value.typoAllowlist],
    linkIgnores: value.linkIgnores.map(rule => ({ kind: rule.kind, value: rule.value })),
    crawlRules: { allow: rules(value.allow), deny: rules(value.deny) },
  };
}

function resetDraft() {
  Object.assign(draft, draftFromWebsite(websiteData.value?.website));
  savedSnapshot.value = JSON.stringify(normalise(draft));
}

watch(() => websiteData.value?.website, resetDraft, { immediate: true });

const isDirty = computed(() => savedSnapshot.value !== "" && JSON.stringify(normalise(draft)) !== savedSnapshot.value);
const nameError = computed(() => (draft.name.trim() ? "" : "Enter a name."));

const savePending = ref(false);
const saveError = ref("");
const saveMessage = ref("");
const justCreated = ref(route.query.new === "1");

async function save() {
  if (nameError.value) {
    saveError.value = "Fix the highlighted fields before saving.";
    return false;
  }

  savePending.value = true;
  saveError.value = "";
  saveMessage.value = "";

  try {
    await $fetch(`/api/websites/${websiteId.value}`, {
      method: "PATCH",
      body: normalise(draft),
    });
    await refreshWebsite();
    void refreshDiscovery();
    saveMessage.value = "Settings saved. The discovery preview has been refreshed.";
    return true;
  }
  catch (error) {
    saveError.value = getErrorMessage(error, "Couldn't save the settings.");
    return false;
  }
  finally {
    savePending.value = false;
  }
}

const { runPending, archivePending, actionError, runAudit, setArchived } = useWebsiteActions(websiteId, refreshWebsite);
const activeRun = computed(() => isActiveRunStatus(website.value?.latestRun?.status));

async function saveAndRun() {
  if (isDirty.value && !(await save())) {
    return;
  }
  await runAudit();
}

onBeforeRouteLeave(() => {
  // eslint-disable-next-line no-alert -- the browser's own confirm is the expected unsaved-changes guard
  if (isDirty.value && !savePending.value && !window.confirm("You have unsaved crawl settings. Leave without saving?")) {
    return false;
  }
});

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (isDirty.value) {
    event.preventDefault();
  }
}

onMounted(() => window.addEventListener("beforeunload", onBeforeUnload));
onBeforeUnmount(() => window.removeEventListener("beforeunload", onBeforeUnload));

function addRule(mode: "allow" | "deny", rule: CrawlRuleRow = { matcher: "glob", pattern: "" }) {
  if (rule.pattern && draft[mode].some(existing => existing.matcher === rule.matcher && existing.pattern === rule.pattern)) {
    return;
  }
  draft[mode].push({ ...rule });
  if (!rule.pattern) {
    void nextTick(() => document.getElementById(`${mode}-pattern-${draft[mode].length - 1}`)?.focus());
  }
}

function removeRule(mode: "allow" | "deny", index: number) {
  draft[mode].splice(index, 1);
}

function placeholderFor(matcher: Matcher) {
  return matcherOptions.find(option => option.value === matcher)?.placeholder ?? "";
}

const discovery = computed(() => discoveryPayload.value?.discovery ?? null);
const includedEntries = computed(() => discovery.value?.entries.filter(entry => entry.status === "included") ?? []);
const excludedEntries = computed(() => discovery.value?.entries.filter(entry => entry.status === "excluded") ?? []);
const suggestions = computed(() => [
  ...(discoveryPayload.value?.denySuggestions ?? []).map(suggestion => ({ ...suggestion, recommended: "deny" as const })),
  ...(discoveryPayload.value?.allowSuggestions ?? []).map(suggestion => ({ ...suggestion, recommended: "allow" as const })),
]);

const lighthouseOptions = computed(() => {
  const selected = new Set(draft.lighthouseTargets);
  return [...new Set(includedEntries.value.map(entry => entry.url))]
    .filter(url => url !== website.value?.baseUrl && !selected.has(url))
    .sort((left, right) => left.localeCompare(right));
});

function canAddCustomLighthouseUrl(candidate: string) {
  if (draft.lighthouseTargets.includes(candidate) || lighthouseOptions.value.includes(candidate)) {
    return false;
  }
  try {
    const url = new URL(candidate);
    return (url.protocol === "https:" || url.protocol === "http:") && url.toString() !== website.value?.baseUrl;
  }
  catch {
    return false;
  }
}

function addLighthouseTarget(url: string) {
  if (draft.lighthouseTargets.length >= maxLighthouseTargets || draft.lighthouseTargets.includes(url)) {
    return;
  }
  draft.lighthouseTargets.push(url);
}

function removeLighthouseTarget(url: string) {
  draft.lighthouseTargets = draft.lighthouseTargets.filter(item => item !== url);
}

const linkIgnoreInput = ref("");
const linkIgnoreError = ref("");

function addLinkIgnore() {
  const rule = parseLinkIgnore(linkIgnoreInput.value);
  if (!rule) {
    linkIgnoreError.value = "Enter a full URL, or a domain like linkedin.com.";
    return;
  }
  linkIgnoreError.value = "";
  if (!draft.linkIgnores.some(existing => existing.kind === rule.kind && existing.value === rule.value)) {
    draft.linkIgnores.push(rule);
  }
  linkIgnoreInput.value = "";
}

function removeLinkIgnore(rule: LinkIgnore) {
  draft.linkIgnores = draft.linkIgnores.filter(existing => existing.kind !== rule.kind || existing.value !== rule.value);
}

function removeAllowlistWord(word: string) {
  draft.typoAllowlist = draft.typoAllowlist.filter(item => item !== word);
}

function describeRule(rule: DiscoveryEntryRow["matchedRule"]) {
  if (!rule) {
    return "No allow rule matched";
  }
  return `${rule.mode === "deny" ? "Denied" : "Allowed"} by ${rule.pattern}`;
}
</script>

<template>
  <div>
    <AlertMessage
      v-if="websiteError"
      tone="error"
      title="Couldn't load this website"
    >
      {{ getErrorMessage(websiteError, 'It may have been removed.') }}
    </AlertMessage>

    <template v-else-if="website">
      <WebsiteHeader
        :website="website"
        current="settings"
      >
        <template
          v-if="website.isActive"
          #actions
        >
          <button
            type="button"
            class="btn btn-primary"
            :disabled="runPending || savePending || activeRun || Boolean(nameError)"
            :title="activeRun ? 'An audit is already running' : undefined"
            @click="saveAndRun"
          >
            <AppIcon
              :name="runPending ? 'loader' : 'play'"
              :class="{ spin: runPending }"
            />
            {{ isDirty ? 'Save and run audit' : 'Run audit' }}
          </button>
        </template>
        <template
          v-else
          #actions
        >
          <button
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

      <div class="stack">
        <AlertMessage
          v-if="justCreated"
          tone="success"
          title="Website added"
          dismissible
          @dismiss="justCreated = false"
        >
          Check the pages discovery found below, adjust the rules if needed, then run the first audit.
        </AlertMessage>
        <AlertMessage
          v-if="saveError || actionError"
          tone="error"
          dismissible
          @dismiss="saveError = ''; actionError = ''"
        >
          {{ saveError || actionError }}
        </AlertMessage>
        <AlertMessage
          v-else-if="saveMessage && !isDirty"
          tone="success"
          dismissible
          @dismiss="saveMessage = ''"
        >
          {{ saveMessage }}
        </AlertMessage>
      </div>

      <div
        class="settings-layout"
        :style="{ marginTop: 'var(--space-5)' }"
      >
        <form
          class="stack-lg"
          novalidate
          @submit.prevent="save"
        >
          <section
            class="panel"
            aria-labelledby="general-heading"
          >
            <div class="panel-header">
              <h2 id="general-heading">
                General
              </h2>
            </div>
            <div class="panel-body form-grid cols-2">
              <div class="field">
                <label for="site-name">Name</label>
                <input
                  id="site-name"
                  v-model="draft.name"
                  maxlength="120"
                  required
                  :aria-invalid="Boolean(nameError)"
                  :aria-describedby="nameError ? 'site-name-error' : undefined"
                >
                <span
                  v-if="nameError"
                  id="site-name-error"
                  class="field-error"
                >{{ nameError }}</span>
              </div>
              <div class="field">
                <label for="typo-language">Spelling dictionary</label>
                <select
                  id="typo-language"
                  v-model="draft.typoLanguage"
                >
                  <option
                    v-for="option in typoLanguageOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>
            </div>
          </section>

          <section
            class="panel"
            aria-labelledby="rules-heading"
          >
            <div class="panel-header">
              <div>
                <h2 id="rules-heading">
                  Crawl rules
                </h2>
                <p>With no allow rules, every discovered page is crawled. Deny rules always win.</p>
              </div>
            </div>
            <div class="panel-body stack-lg">
              <div
                v-for="mode in (['allow', 'deny'] as const)"
                :key="mode"
                class="stack-sm"
              >
                <div class="section-heading">
                  <h3>{{ mode === 'allow' ? 'Only crawl pages matching' : 'Never crawl pages matching' }}</h3>
                  <button
                    type="button"
                    class="btn btn-sm"
                    @click="addRule(mode)"
                  >
                    <AppIcon
                      name="plus"
                      :size="14"
                    />
                    Add {{ mode }} rule
                  </button>
                </div>
                <div
                  v-if="draft[mode].length"
                  class="rule-list"
                >
                  <div
                    v-for="(rule, index) in draft[mode]"
                    :key="`${mode}-${index}`"
                    class="rule-row"
                  >
                    <select
                      v-model="rule.matcher"
                      :aria-label="`${mode === 'allow' ? 'Allow' : 'Deny'} rule ${index + 1} match type`"
                    >
                      <option
                        v-for="option in matcherOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                    <input
                      :id="`${mode}-pattern-${index}`"
                      v-model="rule.pattern"
                      class="mono"
                      spellcheck="false"
                      autocomplete="off"
                      :placeholder="placeholderFor(rule.matcher)"
                      :aria-label="`${mode === 'allow' ? 'Allow' : 'Deny'} rule ${index + 1} URL`"
                    >
                    <button
                      type="button"
                      class="btn btn-ghost btn-icon"
                      :aria-label="`Remove ${mode} rule ${index + 1}${rule.pattern ? `: ${rule.pattern}` : ''}`"
                      @click="removeRule(mode, index)"
                    >
                      <AppIcon name="x" />
                    </button>
                  </div>
                </div>
                <p
                  v-else
                  class="empty-inline"
                >
                  {{ mode === 'allow' ? 'No allow rules. All discovered pages on this site are eligible.' : 'No deny rules.' }}
                </p>
              </div>
              <details class="text-sm text-secondary">
                <summary class="link-button">
                  <AppIcon
                    name="chevron-right"
                    :size="14"
                    class="disclosure-chevron"
                  />
                  How matching works
                </summary>
                <ul class="stack-sm" :style="{ marginTop: 'var(--space-2)' }">
                  <li><strong>Pattern</strong> matches the full URL, where <code>*</code> stands for any characters. <code>https://example.com/blog/*</code> covers every blog page; <code>*?page=*</code> catches paginated URLs.</li>
                  <li><strong>Starts with</strong> matches any URL that begins with the text.</li>
                  <li><strong>Exact URL</strong> matches one URL only.</li>
                </ul>
              </details>
            </div>
          </section>

          <section
            class="panel"
            aria-labelledby="lighthouse-heading"
          >
            <div class="panel-header">
              <div>
                <h2 id="lighthouse-heading">
                  Lighthouse pages
                </h2>
                <p>The homepage is always tested. Add up to {{ maxLighthouseTargets }} more pages.</p>
              </div>
              <span class="text-sm text-muted num">{{ draft.lighthouseTargets.length }} / {{ maxLighthouseTargets }}</span>
            </div>
            <div class="panel-body stack">
              <div class="field">
                <label for="lighthouse-search">Add a page</label>
                <UrlCombobox
                  input-id="lighthouse-search"
                  :options="lighthouseOptions"
                  :can-add-custom="canAddCustomLighthouseUrl"
                  :disabled="draft.lighthouseTargets.length >= maxLighthouseTargets"
                  described-by="lighthouse-hint"
                  placeholder="Search discovered pages or paste a URL"
                  @select="addLighthouseTarget"
                />
                <span
                  id="lighthouse-hint"
                  class="field-hint"
                >{{ draft.lighthouseTargets.length >= maxLighthouseTargets ? 'Limit reached. Remove a page to add another.' : 'Use the arrow keys to choose, Enter to add.' }}</span>
              </div>
              <ul
                v-if="draft.lighthouseTargets.length"
                class="chip-list"
              >
                <li
                  v-for="target in draft.lighthouseTargets"
                  :key="target"
                  class="chip-row"
                >
                  <span
                    class="mono"
                    :title="target"
                  >{{ target }}</span>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm btn-icon"
                    :aria-label="`Remove ${target} from Lighthouse pages`"
                    @click="removeLighthouseTarget(target)"
                  >
                    <AppIcon name="x" />
                  </button>
                </li>
              </ul>
            </div>
          </section>

          <section
            class="panel"
            aria-labelledby="allowlist-heading"
          >
            <div class="panel-header">
              <div>
                <h2 id="allowlist-heading">
                  Allowed words
                </h2>
                <p>Words never reported as typos on this site. Add them from an audit report.</p>
              </div>
            </div>
            <div class="panel-body">
              <ul
                v-if="draft.typoAllowlist.length"
                class="word-chips"
              >
                <li
                  v-for="word in draft.typoAllowlist"
                  :key="word"
                  class="word-chip"
                >
                  {{ word }}
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm btn-icon"
                    :aria-label="`Remove “${word}” from allowed words`"
                    @click="removeAllowlistWord(word)"
                  >
                    <AppIcon
                      name="x"
                      :size="14"
                    />
                  </button>
                </li>
              </ul>
              <p
                v-else
                class="empty-inline"
              >
                No allowed words yet.
              </p>
            </div>
          </section>

          <section
            class="panel"
            aria-labelledby="ignored-links-heading"
          >
            <div class="panel-header">
              <div>
                <h2 id="ignored-links-heading">
                  Ignored links
                </h2>
                <p>Links that are never checked or reported as broken. Useful for sites that block automated checks.</p>
              </div>
            </div>
            <div class="panel-body stack">
              <div class="field">
                <label for="link-ignore-input">Add a URL or domain</label>
                <div class="row">
                  <input
                    id="link-ignore-input"
                    v-model="linkIgnoreInput"
                    class="mono"
                    style="flex: 1 1 240px;"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder="linkedin.com or https://example.com/old-page"
                    :aria-invalid="Boolean(linkIgnoreError)"
                    aria-describedby="link-ignore-hint"
                    @keydown.enter.prevent="addLinkIgnore"
                  >
                  <button
                    type="button"
                    class="btn"
                    :disabled="!linkIgnoreInput.trim()"
                    @click="addLinkIgnore"
                  >
                    Add
                  </button>
                </div>
                <span
                  id="link-ignore-hint"
                  :class="linkIgnoreError ? 'field-error' : 'field-hint'"
                >{{ linkIgnoreError || 'A domain also covers its subdomains, so linkedin.com includes www.linkedin.com.' }}</span>
              </div>
              <ul
                v-if="draft.linkIgnores.length"
                class="chip-list"
              >
                <li
                  v-for="rule in draft.linkIgnores"
                  :key="`${rule.kind}:${rule.value}`"
                  class="chip-row"
                >
                  <span
                    class="mono"
                    :title="rule.value"
                  >{{ rule.value }}</span>
                  <span class="row">
                    <span class="badge badge-square">{{ rule.kind === 'domain' ? 'Domain' : 'URL' }}</span>
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm btn-icon"
                      :aria-label="`Stop ignoring ${rule.value}`"
                      @click="removeLinkIgnore(rule)"
                    >
                      <AppIcon name="x" />
                    </button>
                  </span>
                </li>
              </ul>
              <p
                v-else
                class="empty-inline"
              >
                No ignored links. You can also ignore a link from the Broken links tab of a report.
              </p>
            </div>
          </section>

          <button
            type="submit"
            class="visually-hidden"
            tabindex="-1"
          >
            Save
          </button>
        </form>

        <aside
          class="settings-aside panel"
          aria-labelledby="discovery-heading"
        >
          <div class="panel-header">
            <div>
              <h2 id="discovery-heading">
                Discovery preview
              </h2>
              <p v-if="discovery">
                {{ discovery.source === 'fallback' ? 'No sitemap found, so this starts from the homepage.' : 'From the sitemap.' }}
                Checked {{ formatRelativeTime(discovery.generatedAt) }}.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-sm"
              :disabled="discoveryPending"
              @click="refreshDiscovery()"
            >
              <AppIcon
                name="refresh"
                :size="14"
                :class="{ spin: discoveryPending }"
              />
              {{ discoveryPending ? 'Checking…' : 'Refresh' }}
            </button>
          </div>

          <div
            class="panel-body stack"
            aria-live="polite"
            :aria-busy="discoveryPending"
          >
            <AlertMessage
              v-if="isDirty"
              tone="warning"
            >
              This preview uses the saved rules. Save to see your changes.
            </AlertMessage>

            <AlertMessage
              v-if="discoveryError && !discoveryPending"
              tone="error"
              title="Couldn't check the site"
            >
              {{ getErrorMessage(discoveryError, 'The site may be unreachable.') }}
              <template #actions>
                <button
                  type="button"
                  class="btn btn-sm"
                  @click="refreshDiscovery()"
                >
                  Try again
                </button>
              </template>
            </AlertMessage>

            <div
              v-else-if="!discovery"
              class="stack-sm"
              aria-label="Loading discovery preview"
            >
              <span
                class="skeleton"
                style="height: 20px; width: 60%;"
              />
              <span
                class="skeleton"
                style="height: 160px;"
              />
            </div>

            <template v-else>
              <p>
                <strong class="num">{{ discovery.included.toLocaleString() }}</strong>
                of {{ pluralize(discovery.total, 'page') }} will be crawled.
                <span
                  v-if="discovery.excluded"
                  class="text-secondary"
                >{{ discovery.excluded.toLocaleString() }} excluded by rules.</span>
              </p>

              <AlertMessage
                v-if="discovery.included === 0"
                tone="error"
                title="Nothing to crawl"
              >
                Every discovered page is excluded, so an audit can't run. Loosen the allow rules or remove a deny rule.
              </AlertMessage>

              <ul
                v-if="includedEntries.length"
                class="url-list"
                aria-label="Pages that will be crawled"
              >
                <li
                  v-for="entry in includedEntries.slice(0, maxListedUrls)"
                  :key="entry.url"
                >
                  <span
                    class="mono"
                    :title="entry.url"
                  >{{ entry.url }}</span>
                  <span
                    v-if="entry.source === 'fallback'"
                    class="text-xs text-muted"
                  >homepage</span>
                </li>
                <li
                  v-if="includedEntries.length > maxListedUrls"
                  class="text-muted"
                >
                  And {{ (includedEntries.length - maxListedUrls).toLocaleString() }} more
                </li>
              </ul>

              <details
                v-if="excludedEntries.length"
                class="stack-sm"
              >
                <summary class="link-button">
                  <AppIcon
                    name="chevron-right"
                    :size="14"
                    class="disclosure-chevron"
                  />
                  Show {{ pluralize(excludedEntries.length, 'excluded page') }}
                </summary>
                <ul
                  class="url-list"
                  :style="{ marginTop: 'var(--space-2)' }"
                >
                  <li
                    v-for="entry in excludedEntries.slice(0, maxListedUrls)"
                    :key="entry.url"
                  >
                    <span
                      class="mono"
                      :title="entry.url"
                    >{{ entry.url }}</span>
                    <span class="text-xs text-muted">{{ describeRule(entry.matchedRule) }}</span>
                  </li>
                </ul>
              </details>

              <div
                v-if="suggestions.length"
                class="stack-sm"
              >
                <h3>Suggested rules</h3>
                <div
                  v-for="suggestion in suggestions"
                  :key="`${suggestion.recommended}-${suggestion.matcher}-${suggestion.pattern}`"
                  class="suggestion"
                >
                  <div class="stack-sm">
                    <strong class="mono url">{{ suggestion.pattern }}</strong>
                    <p>{{ suggestion.reason }} · matches {{ pluralize(suggestion.matchedCount, 'page') }}</p>
                    <p
                      v-if="suggestion.exampleUrls.length"
                      class="text-xs"
                    >
                      e.g. {{ suggestion.exampleUrls.slice(0, 2).join(', ') }}
                    </p>
                  </div>
                  <div class="row">
                    <button
                      type="button"
                      class="btn btn-sm"
                      :aria-label="`Add deny rule ${suggestion.pattern}`"
                      @click="addRule('deny', { matcher: suggestion.matcher, pattern: suggestion.pattern })"
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm"
                      :aria-label="`Add allow rule ${suggestion.pattern}`"
                      @click="addRule('allow', { matcher: suggestion.matcher, pattern: suggestion.pattern })"
                    >
                      Allow
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </aside>
      </div>

      <Transition name="rise">
        <div
          v-if="isDirty"
          class="unsaved-bar"
          role="region"
          aria-label="Unsaved changes"
        >
          <p>
            <span
              class="badge-dot dot-warning"
              aria-hidden="true"
            />
            You have unsaved changes
          </p>
          <div class="row">
            <button
              type="button"
              class="btn btn-ghost"
              :disabled="savePending"
              @click="resetDraft"
            >
              Discard
            </button>
            <button
              type="button"
              class="btn"
              :class="{ 'btn-primary': !website.isActive }"
              :disabled="savePending || Boolean(nameError)"
              @click="save"
            >
              {{ savePending ? 'Saving…' : 'Save' }}
            </button>
            <button
              v-if="website.isActive"
              type="button"
              class="btn btn-primary"
              :disabled="savePending || runPending || activeRun || Boolean(nameError)"
              @click="saveAndRun"
            >
              Save and run audit
            </button>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>
