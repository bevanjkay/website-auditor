<script setup lang="ts">
definePageMeta({
  public: true,
});

useHead({ title: "Sign in" });

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
    const status = (error as { statusCode?: number }).statusCode;
    errorMessage.value = status === 401 || status === 400
      ? "That username and password don't match. Check them and try again."
      : getErrorMessage(error, "Couldn't sign in. Try again in a moment.");
  }
  finally {
    pending.value = false;
  }
}
</script>

<template>
  <div class="login-shell">
    <div class="login-card">
      <div class="login-brand">
        <span class="brand-mark">
          <AppIcon
            name="brand"
            :size="16"
          />
        </span>
        Website Auditor
      </div>

      <form
        class="panel"
        @submit.prevent="submit"
      >
        <div class="panel-body form-grid">
          <div class="stack-sm">
            <h1>Sign in</h1>
            <p class="text-secondary">
              This is a private installation. Ask an administrator if you need an account.
            </p>
          </div>

          <AlertMessage
            v-if="errorMessage"
            tone="error"
          >
            {{ errorMessage }}
          </AlertMessage>

          <div class="field">
            <label for="username">Username</label>
            <input
              id="username"
              v-model="form.username"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
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

          <button
            class="btn btn-primary"
            :disabled="pending"
            type="submit"
          >
            <AppIcon
              v-if="pending"
              name="loader"
              class="spin"
            />
            {{ pending ? 'Signing in…' : 'Sign in' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
