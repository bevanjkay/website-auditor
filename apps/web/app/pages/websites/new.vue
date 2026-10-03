<script setup lang="ts">
useHead({ title: "Add website" });

const typoLanguageOptions = [
  { label: "English (generic)", value: "en" },
  { label: "English (Australia)", value: "en-au" },
  { label: "English (United Kingdom)", value: "en-gb" },
  { label: "English (United States)", value: "en-us" },
] as const;

const form = reactive({
  name: "",
  baseUrl: "",
  typoLanguage: "en",
});

const pending = ref(false);
const errorMessage = ref("");
const archivedConflict = ref(false);

async function submit() {
  pending.value = true;
  errorMessage.value = "";
  archivedConflict.value = false;

  try {
    const response = await $fetch<{ website: { id: string } }>("/api/websites", {
      method: "POST",
      body: form,
    });
    await navigateTo(`/websites/${response.website.id}/settings?new=1`);
  }
  catch (error) {
    errorMessage.value = getErrorMessage(error, "Couldn't add the website. Check the URL and try again.");
    archivedConflict.value = errorMessage.value.includes("archived");
  }
  finally {
    pending.value = false;
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="Add website"
      :breadcrumbs="[{ label: 'Websites', to: '/' }, { label: 'Add website' }]"
    >
      <template #subtitle>
        <span>Next you'll review which pages will be crawled before the first audit.</span>
      </template>
    </PageHeader>

    <div class="overview-grid">
      <form
        class="panel"
        novalidate
        @submit.prevent="submit"
      >
        <div class="panel-body form-grid">
          <AlertMessage
            v-if="errorMessage"
            tone="error"
          >
            {{ errorMessage }}
            <template
              v-if="archivedConflict"
              #actions
            >
              <NuxtLink
                class="btn btn-sm"
                to="/?archived=1"
              >
                Show archived websites
              </NuxtLink>
            </template>
          </AlertMessage>

          <div class="field">
            <label for="name">Name</label>
            <input
              id="name"
              v-model="form.name"
              autocomplete="off"
              maxlength="120"
              required
              aria-describedby="name-hint"
            >
            <span
              id="name-hint"
              class="field-hint"
            >How the site appears in lists, for example “Youth Alive Victoria”.</span>
          </div>

          <div class="field">
            <label for="url">Website URL</label>
            <input
              id="url"
              v-model="form.baseUrl"
              type="url"
              inputmode="url"
              autocomplete="url"
              spellcheck="false"
              placeholder="https://example.com"
              required
              aria-describedby="url-hint"
            >
            <span
              id="url-hint"
              class="field-hint"
            >The homepage to start from. Each host can only be added once.</span>
          </div>

          <div class="field">
            <label for="typo-language">Spelling dictionary</label>
            <select
              id="typo-language"
              v-model="form.typoLanguage"
              aria-describedby="typo-hint"
            >
              <option
                v-for="option in typoLanguageOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <span
              id="typo-hint"
              class="field-hint"
            >Used to flag likely typos. You can change it later.</span>
          </div>
        </div>
        <div class="panel-footer">
          <NuxtLink
            class="btn btn-ghost"
            to="/"
          >
            Cancel
          </NuxtLink>
          <button
            class="btn btn-primary"
            :disabled="pending || !form.name.trim() || !form.baseUrl.trim()"
            type="submit"
          >
            <AppIcon
              v-if="pending"
              name="loader"
              class="spin"
            />
            {{ pending ? 'Adding…' : 'Add website' }}
          </button>
        </div>
      </form>

      <aside
        class="panel panel-body stack-sm"
        aria-labelledby="next-steps"
      >
        <h2 id="next-steps">
          What happens next
        </h2>
        <ol class="stack-sm text-secondary">
          <li>We read the site's <code>robots.txt</code> and XML sitemaps to preview the pages a crawl would cover.</li>
          <li>You can narrow the crawl with allow and deny rules, and pick extra pages for Lighthouse.</li>
          <li>Each audit saves a snapshot of those settings, so every run stays comparable.</li>
        </ol>
      </aside>
    </div>
  </div>
</template>
