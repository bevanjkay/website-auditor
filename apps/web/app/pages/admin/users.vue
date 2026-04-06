<script setup lang="ts">
definePageMeta({
  middleware: "admin",
});

interface UserRow {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
}

const { data, refresh } = await useAsyncData<{ users: UserRow[] }>("users", () => $fetch("/api/users"));

const form = reactive({
  username: "",
  password: "",
  role: "user",
});

const passwordReset = reactive<Record<string, string>>({});
const message = ref("");

async function createNewUser() {
  await $fetch("/api/users", {
    method: "POST",
    body: form,
  });
  form.username = "";
  form.password = "";
  form.role = "user";
  message.value = "User created.";
  await refresh();
}

async function toggleUser(user: { id: string; isActive: boolean }) {
  await $fetch(`/api/users/${user.id}`, {
    method: "PATCH",
    body: {
      isActive: !user.isActive,
    },
  });
  await refresh();
}

async function resetPassword(userId: string) {
  if (!passwordReset[userId]) {
    return;
  }

  await $fetch(`/api/users/${userId}/reset-password`, {
    method: "POST",
    body: {
      password: passwordReset[userId],
    },
  });

  passwordReset[userId] = "";
  message.value = "Password updated.";
}
</script>

<template>
  <section class="split">
    <section class="hero-card stack">
      <div>
        <p class="muted">
          Admin
        </p>
        <h2>User management</h2>
        <p class="muted">
          Registration is disabled. Admins provision and disable accounts here.
        </p>
      </div>

      <form
        class="form-grid two"
        @submit.prevent="createNewUser"
      >
        <div class="field">
          <label for="new-username">Username</label>
          <input
            id="new-username"
            v-model="form.username"
            required
          >
        </div>

        <div class="field">
          <label for="new-password">Password</label>
          <input
            id="new-password"
            v-model="form.password"
            type="password"
            required
          >
        </div>

        <div class="field">
          <label for="new-role">Role</label>
          <select
            id="new-role"
            v-model="form.role"
          >
            <option value="user">
              User
            </option>
            <option value="admin">
              Admin
            </option>
          </select>
        </div>

        <div class="field" style="justify-content: end;">
          <label>&nbsp;</label>
          <button
            class="button button-primary"
            type="submit"
          >
            Create user
          </button>
        </div>
      </form>

      <p
        v-if="message"
        class="notice"
      >
        {{ message }}
      </p>
    </section>

    <aside class="panel stack">
      <h3>Existing users</h3>
      <div
        v-if="data?.users.length"
        class="stack"
      >
        <article
          v-for="user in data.users"
          :key="user.id"
          class="issue"
        >
          <header>
            <div>
              <strong>{{ user.username }}</strong>
              <p class="muted">{{ user.role }}</p>
            </div>
            <StatusPill :value="user.isActive ? 'completed' : 'failed'" />
          </header>
          <div class="form-grid">
            <div class="nav-links">
              <button @click="toggleUser(user)">
                {{ user.isActive ? 'Disable' : 'Enable' }}
              </button>
            </div>
            <div class="field">
              <label :for="`password-${user.id}`">Reset password</label>
              <input
                :id="`password-${user.id}`"
                v-model="passwordReset[user.id]"
                type="password"
                placeholder="New password"
              >
            </div>
            <button
              class="button"
              @click="resetPassword(user.id)"
            >
              Save new password
            </button>
          </div>
        </article>
      </div>
    </aside>
  </section>
</template>
