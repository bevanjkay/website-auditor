<script setup lang="ts">
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

async function submit() {
  pending.value = true;
  errorMessage.value = "";

  try {
    const response = await $fetch<{ website: { id: string } }>("/api/websites", {
      method: "POST",
      body: form,
    });
    await navigateTo(`/websites/${response.website.id}`);
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to create website.";
  }
  finally {
    pending.value = false;
  }
}
</script>

<template>
  <section class="split">
    <div class="hero-card stack">
      <div>
        <p class="muted">
          New website
        </p>
        <h2>Add a site to audit</h2>
        <p class="muted">
          Create the website record first, then review sitemap discovery and crawl rules before queueing the first audit.
        </p>
      </div>

      <form
        class="form-grid"
        @submit.prevent="submit"
      >
        <div class="field">
          <label for="name">Display name</label>
          <input
            id="name"
            v-model="form.name"
            placeholder="Acme Marketing Site"
            required
          >
        </div>

        <div class="field">
          <label for="url">Base URL</label>
          <input
            id="url"
            v-model="form.baseUrl"
            placeholder="https://example.com"
            required
          >
        </div>

        <div class="field">
          <label for="typo-language">Typo audit language</label>
          <select
            id="typo-language"
            v-model="form.typoLanguage"
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

        <p
          v-if="errorMessage"
          class="notice"
        >
          {{ errorMessage }}
        </p>

        <button
          class="button button-primary"
          :disabled="pending"
          type="submit"
        >
          {{ pending ? 'Creating…' : 'Create website' }}
        </button>
      </form>
    </div>

    <aside class="panel stack">
      <h3>What happens next</h3>
      <ul class="muted">
        <li>`robots.txt` and XML sitemaps are loaded into a discovery preview.</li>
        <li>You can choose the dictionary used for typo detection per site.</li>
        <li>You can save allowlist and denylist rules before running the first audit.</li>
        <li>The queued audit snapshots those rules and stores a full run history.</li>
      </ul>
    </aside>
  </section>
</template>
