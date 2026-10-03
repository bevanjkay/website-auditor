<script setup lang="ts">
definePageMeta({
  middleware: "admin",
});

useHead({ title: "Users" });

interface UserRow {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
}

const { user: currentUser } = useSessionState();
const { data, refresh, error: loadError } = await useAsyncData<{ users: UserRow[] }>("users", () => $fetch("/api/users"));

const users = computed(() => [...(data.value?.users ?? [])].sort((left, right) =>
  Number(right.isActive) - Number(left.isActive) || left.username.localeCompare(right.username)));

const form = reactive({ username: "", password: "", role: "user" });
const createPending = ref(false);
const createError = ref("");
const notice = ref<{ tone: "success" | "error"; message: string } | null>(null);

const usernameError = computed(() => form.username && !/^[\w.-]{3,100}$/.test(form.username.trim())
  ? "Use at least 3 letters, numbers, dots, dashes or underscores."
  : "");
const passwordError = computed(() => form.password && form.password.length < 8 ? "Use at least 8 characters." : "");

async function createNewUser() {
  if (usernameError.value || passwordError.value) {
    return;
  }
  createPending.value = true;
  createError.value = "";
  try {
    await $fetch("/api/users", { method: "POST", body: { ...form, username: form.username.trim() } });
    notice.value = { tone: "success", message: `Added ${form.username.trim()}. Share the password with them securely.` };
    form.username = "";
    form.password = "";
    form.role = "user";
    await refresh();
  }
  catch (error) {
    createError.value = getErrorMessage(error, "Couldn't add the user.");
  }
  finally {
    createPending.value = false;
  }
}

const pendingUserId = ref<string | null>(null);
const confirmDisableId = ref<string | null>(null);
const resetForId = ref<string | null>(null);
const resetPassword = ref("");
const resetError = ref("");

async function setActive(user: UserRow, isActive: boolean) {
  pendingUserId.value = user.id;
  try {
    await $fetch(`/api/users/${user.id}`, { method: "PATCH", body: { isActive } });
    notice.value = { tone: "success", message: isActive ? `${user.username} can sign in again.` : `${user.username} has been disabled and can no longer sign in.` };
    confirmDisableId.value = null;
    await refresh();
  }
  catch (error) {
    notice.value = { tone: "error", message: getErrorMessage(error, `Couldn't update ${user.username}.`) };
  }
  finally {
    pendingUserId.value = null;
  }
}

function openReset(user: UserRow) {
  resetForId.value = resetForId.value === user.id ? null : user.id;
  resetPassword.value = "";
  resetError.value = "";
  if (resetForId.value) {
    void nextTick(() => document.getElementById(`reset-${user.id}`)?.focus());
  }
}

async function submitReset(user: UserRow) {
  if (resetPassword.value.length < 8) {
    resetError.value = "Use at least 8 characters.";
    return;
  }
  pendingUserId.value = user.id;
  resetError.value = "";
  try {
    await $fetch(`/api/users/${user.id}/reset-password`, { method: "POST", body: { password: resetPassword.value } });
    notice.value = { tone: "success", message: `Password updated for ${user.username}.` };
    resetForId.value = null;
    resetPassword.value = "";
  }
  catch (error) {
    resetError.value = getErrorMessage(error, "Couldn't update the password.");
  }
  finally {
    pendingUserId.value = null;
  }
}
</script>

<template>
  <div>
    <PageHeader title="Users">
      <template #subtitle>
        <span>Registration is turned off. Add people here and they can sign in straight away.</span>
      </template>
    </PageHeader>

    <div class="stack-lg">
      <AlertMessage
        v-if="notice"
        :tone="notice.tone"
        dismissible
        @dismiss="notice = null"
      >
        {{ notice.message }}
      </AlertMessage>

      <AlertMessage
        v-if="loadError"
        tone="error"
        title="Couldn't load users"
      >
        {{ getErrorMessage(loadError, 'The server did not respond.') }}
      </AlertMessage>

      <section
        class="panel"
        aria-labelledby="users-heading"
      >
        <div class="panel-header">
          <h2 id="users-heading">
            People
          </h2>
          <span class="text-sm text-muted">{{ pluralize(users.filter(user => user.isActive).length, 'active account') }}</span>
        </div>
        <div class="table-wrap">
          <table class="data-table responsive-table">
            <thead>
              <tr>
                <th scope="col">
                  Username
                </th>
                <th scope="col">
                  Role
                </th>
                <th scope="col">
                  Status
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
              <template
                v-for="user in users"
                :key="user.id"
              >
                <tr>
                  <td class="cell-lead">
                    <div class="row">
                      <strong>{{ user.username }}</strong>
                      <span
                        v-if="user.id === currentUser?.id"
                        class="badge badge-square"
                      >You</span>
                    </div>
                  </td>
                  <td data-label="Role">
                    {{ user.role === 'admin' ? 'Administrator' : 'Member' }}
                  </td>
                  <td data-label="Status">
                    <StatusBadge
                      :label="user.isActive ? 'Active' : 'Disabled'"
                      :tone="user.isActive ? 'success' : 'neutral'"
                    />
                  </td>
                  <td class="shrink">
                    <div
                      v-if="confirmDisableId === user.id"
                      class="row"
                      role="group"
                      :aria-label="`Confirm disabling ${user.username}`"
                    >
                      <span class="text-sm">Disable {{ user.username }}?</span>
                      <button
                        type="button"
                        class="btn btn-sm btn-danger-solid"
                        :disabled="pendingUserId === user.id"
                        @click="setActive(user, false)"
                      >
                        Disable
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-ghost"
                        @click="confirmDisableId = null"
                      >
                        Cancel
                      </button>
                    </div>
                    <div
                      v-else
                      class="row"
                    >
                      <button
                        type="button"
                        class="btn btn-sm"
                        :aria-expanded="resetForId === user.id"
                        :aria-controls="`reset-row-${user.id}`"
                        @click="openReset(user)"
                      >
                        <AppIcon
                          name="key"
                          :size="14"
                        />
                        Reset password
                      </button>
                      <button
                        v-if="user.isActive"
                        type="button"
                        class="btn btn-sm btn-danger"
                        :disabled="user.id === currentUser?.id || pendingUserId === user.id"
                        :title="user.id === currentUser?.id ? 'You can’t disable your own account' : undefined"
                        @click="confirmDisableId = user.id"
                      >
                        Disable
                      </button>
                      <button
                        v-else
                        type="button"
                        class="btn btn-sm"
                        :disabled="pendingUserId === user.id"
                        @click="setActive(user, true)"
                      >
                        Enable
                      </button>
                    </div>
                  </td>
                </tr>
                <tr
                  v-if="resetForId === user.id"
                  :id="`reset-row-${user.id}`"
                >
                  <td colspan="4">
                    <form
                      class="row"
                      novalidate
                      @submit.prevent="submitReset(user)"
                    >
                      <div
                        class="field"
                        style="flex: 1 1 260px; max-width: 360px;"
                      >
                        <label :for="`reset-${user.id}`">New password for {{ user.username }}</label>
                        <input
                          :id="`reset-${user.id}`"
                          v-model="resetPassword"
                          type="password"
                          autocomplete="new-password"
                          minlength="8"
                          :aria-invalid="Boolean(resetError)"
                          :aria-describedby="`reset-hint-${user.id}`"
                        >
                        <span
                          :id="`reset-hint-${user.id}`"
                          :class="resetError ? 'field-error' : 'field-hint'"
                        >{{ resetError || 'At least 8 characters.' }}</span>
                      </div>
                      <button
                        type="submit"
                        class="btn btn-primary"
                        :disabled="pendingUserId === user.id"
                      >
                        Update password
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost"
                        @click="resetForId = null"
                      >
                        Cancel
                      </button>
                    </form>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <form
        class="panel"
        aria-labelledby="add-user-heading"
        novalidate
        @submit.prevent="createNewUser"
      >
        <div class="panel-header">
          <h2 id="add-user-heading">
            Add a user
          </h2>
        </div>
        <div class="panel-body stack">
          <AlertMessage
            v-if="createError"
            tone="error"
          >
            {{ createError }}
          </AlertMessage>
          <div class="form-grid cols-2">
            <div class="field">
              <label for="new-username">Username</label>
              <input
                id="new-username"
                v-model="form.username"
                autocomplete="off"
                spellcheck="false"
                required
                :aria-invalid="Boolean(usernameError)"
                aria-describedby="new-username-hint"
              >
              <span
                id="new-username-hint"
                :class="usernameError ? 'field-error' : 'field-hint'"
              >{{ usernameError || 'Letters, numbers, dots, dashes and underscores.' }}</span>
            </div>
            <div class="field">
              <label for="new-password">Temporary password</label>
              <input
                id="new-password"
                v-model="form.password"
                type="password"
                autocomplete="new-password"
                required
                :aria-invalid="Boolean(passwordError)"
                aria-describedby="new-password-hint"
              >
              <span
                id="new-password-hint"
                :class="passwordError ? 'field-error' : 'field-hint'"
              >{{ passwordError || 'At least 8 characters.' }}</span>
            </div>
            <div class="field">
              <label for="new-role">Role</label>
              <select
                id="new-role"
                v-model="form.role"
                aria-describedby="new-role-hint"
              >
                <option value="user">
                  Member
                </option>
                <option value="admin">
                  Administrator
                </option>
              </select>
              <span
                id="new-role-hint"
                class="field-hint"
              >Administrators can also manage users.</span>
            </div>
          </div>
        </div>
        <div class="panel-footer">
          <span />
          <button
            class="btn btn-primary"
            type="submit"
            :disabled="createPending || !form.username.trim() || !form.password || Boolean(usernameError || passwordError)"
          >
            <AppIcon name="plus" />
            {{ createPending ? 'Adding…' : 'Add user' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
