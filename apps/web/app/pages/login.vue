<script setup lang="ts">
definePageMeta({
  public: true,
});

const form = reactive({
  username: "",
  password: "",
});
const errorMessage = ref("");
const pending = ref(false);

async function submit() {
  pending.value = true;
  errorMessage.value = "";

  try {
    await $fetch("/api/auth/login", {
      method: "POST",
      body: form,
      credentials: "include",
    });

    if (import.meta.client) {
      window.location.assign("/");
      return;
    }

    await navigateTo("/");
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Login failed.";
  }
  finally {
    pending.value = false;
  }
}
</script>

<template>
  <div class="login-shell">
    <section class="hero-card login-card stack">
      <div>
        <p class="muted">
          Private instance
        </p>
        <h2>Website Auditor</h2>
        <p class="muted">
          Sign in to manage websites, run browser-rendered audits, and review issue history.
        </p>
      </div>

      <form
        class="form-grid"
        @submit.prevent="submit"
      >
        <div class="field">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="form.username"
            autocomplete="username"
            required
          >
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            required
          >
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
          {{ pending ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </section>
  </div>
</template>
