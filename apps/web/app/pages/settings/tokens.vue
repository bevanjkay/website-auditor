<script setup lang="ts">
import type { ApiTokenScope } from "@website-auditor/shared";
import type { Tone } from "../../composables/useStatus";

import { apiTokenScopesForRole } from "@website-auditor/shared";

useHead({ title: "API tokens" });

interface TokenRow {
  id: string;
  userId: string;
  username: string;
  ownerIsActive: boolean;
  name: string;
  prefix: string;
  scopes: ApiTokenScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const expiryOptions = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: null, label: "Never" },
];

const { user: currentUser } = useSessionState();
const isAdmin = computed(() => currentUser.value?.role === "admin");
const grantableOptions = computed(() => {
  const allowed = currentUser.value ? apiTokenScopesForRole(currentUser.value.role) : [];
  return apiTokenScopeOptions.filter(option => allowed.includes(option.scope));
});
const origin = useRequestURL().origin;

const { data, refresh, error: loadError } = await useAsyncData<{ tokens: TokenRow[] }>("api-tokens", () => $fetch("/api/tokens"));

function tokenStatus(token: TokenRow): { label: string; tone: Tone } {
  if (token.revokedAt) {
    return { label: "Revoked", tone: "neutral" };
  }
  if (token.expiresAt && new Date(token.expiresAt).getTime() < Date.now()) {
    return { label: "Expired", tone: "warning" };
  }
  if (!token.ownerIsActive) {
    return { label: "Owner disabled", tone: "neutral" };
  }
  return { label: "Active", tone: "success" };
}

const tokens = computed(() => [...(data.value?.tokens ?? [])].sort((left, right) =>
  Number(tokenStatus(right).label === "Active") - Number(tokenStatus(left).label === "Active")));
const activeCount = computed(() => tokens.value.filter(token => tokenStatus(token).label === "Active").length);

function scopeLabels(scopes: ApiTokenScope[]) {
  return apiTokenScopeOptions.filter(option => scopes.includes(option.scope)).map(option => option.label).join(", ");
}

const form = reactive<{ name: string; scopes: ApiTokenScope[]; expiresInDays: number | null }>({
  name: "",
  scopes: ["read"],
  expiresInDays: 90,
});
const createPending = ref(false);
const createError = ref("");
const notice = ref<{ tone: "success" | "error"; message: string } | null>(null);
const created = ref<{ name: string; token: string } | null>(null);
const copyState = ref<"idle" | "copied" | "blocked">("idle");
const tokenField = ref<HTMLInputElement | null>(null);

async function createToken() {
  createPending.value = true;
  createError.value = "";
  try {
    const response = await $fetch<{ token: string; apiToken: TokenRow }>("/api/tokens", {
      method: "POST",
      body: { ...form, name: form.name.trim() },
    });
    created.value = { name: response.apiToken.name, token: response.token };
    copyState.value = "idle";
    notice.value = null;
    form.name = "";
    form.scopes = ["read"];
    form.expiresInDays = 90;
    await refresh();
    await nextTick();
    tokenField.value?.focus();
  }
  catch (error) {
    createError.value = getErrorMessage(error, "Couldn't create the token.");
  }
  finally {
    createPending.value = false;
  }
}

async function copyToken() {
  if (!created.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(created.value.token);
    copyState.value = "copied";
  }
  catch {
    tokenField.value?.select();
    copyState.value = "blocked";
  }
}

const pendingTokenId = ref<string | null>(null);
const confirmRevokeId = ref<string | null>(null);

async function revoke(token: TokenRow) {
  pendingTokenId.value = token.id;
  try {
    await $fetch(`/api/tokens/${token.id}`, { method: "DELETE" });
    notice.value = { tone: "success", message: `Revoked ${token.name}. Requests using it are now refused.` };
    confirmRevokeId.value = null;
    await refresh();
  }
  catch (error) {
    notice.value = { tone: "error", message: getErrorMessage(error, `Couldn't revoke ${token.name}.`) };
  }
  finally {
    pendingTokenId.value = null;
  }
}
</script>

<template>
  <div>
    <PageHeader title="API tokens">
      <template #subtitle>
        <span>
          Scripts, CI jobs and MCP clients can call the API as you, limited to the scopes you choose.
          The endpoints are described at <a href="/_openapi.json">/_openapi.json</a>.
        </span>
      </template>
    </PageHeader>

    <div class="stack-lg">
      <section
        v-if="created"
        class="panel"
        aria-labelledby="new-token-heading"
      >
        <div class="panel-header">
          <h2 id="new-token-heading">
            Copy your new token
          </h2>
        </div>
        <div class="panel-body stack">
          <AlertMessage tone="warning">
            This is the only time the token for {{ created.name }} is shown. Store it somewhere safe, such as a CI secret.
          </AlertMessage>
          <div class="field">
            <label for="new-token">Token</label>
            <div class="input-with-action">
              <input
                id="new-token"
                ref="tokenField"
                class="mono"
                :value="created.token"
                readonly
                spellcheck="false"
                autocomplete="off"
                aria-describedby="new-token-hint"
                @focus="tokenField?.select()"
              >
              <button
                type="button"
                class="btn"
                @click="copyToken"
              >
                <AppIcon :name="copyState === 'copied' ? 'check' : 'copy'" />
                {{ copyState === 'copied' ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <span
              id="new-token-hint"
              class="field-hint"
              aria-live="polite"
            >
              <template v-if="copyState === 'blocked'">Your browser blocked copying. The token is selected, so press Ctrl+C or ⌘C.</template>
              <template v-else>
                Send it in the Authorization header, for example <code>curl -H "Authorization: Bearer $TOKEN" {{ origin }}/api/websites</code>,
                or <NuxtLink to="/settings/mcp">set up an MCP client</NuxtLink> with it.
              </template>
            </span>
          </div>
        </div>
        <div class="panel-footer">
          <span />
          <button
            type="button"
            class="btn btn-primary"
            @click="created = null"
          >
            Done
          </button>
        </div>
      </section>

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
        title="Couldn't load API tokens"
      >
        {{ getErrorMessage(loadError, 'The server did not respond.') }}
      </AlertMessage>

      <section
        class="panel"
        aria-labelledby="tokens-heading"
      >
        <div class="panel-header">
          <h2 id="tokens-heading">
            {{ isAdmin ? 'All tokens' : 'Your tokens' }}
          </h2>
          <span
            v-if="tokens.length"
            class="text-sm text-muted"
          >{{ pluralize(activeCount, 'active token') }}</span>
        </div>
        <div
          v-if="tokens.length"
          class="table-wrap"
        >
          <table class="data-table responsive-table">
            <thead>
              <tr>
                <th scope="col">
                  Name
                </th>
                <th
                  v-if="isAdmin"
                  scope="col"
                >
                  Owner
                </th>
                <th scope="col">
                  Scopes
                </th>
                <th scope="col">
                  Last used
                </th>
                <th scope="col">
                  Expires
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
              <tr
                v-for="token in tokens"
                :key="token.id"
              >
                <td class="cell-lead">
                  <strong>{{ token.name }}</strong>
                  <div class="mono text-xs text-muted">
                    {{ token.prefix }}…
                  </div>
                </td>
                <td
                  v-if="isAdmin"
                  data-label="Owner"
                >
                  {{ token.userId === currentUser?.id ? 'You' : token.username }}
                </td>
                <td data-label="Scopes">
                  {{ scopeLabels(token.scopes) }}
                </td>
                <td data-label="Last used">
                  {{ formatRelativeTime(token.lastUsedAt, 'Never') }}
                </td>
                <td data-label="Expires">
                  {{ formatDate(token.expiresAt, 'Never') }}
                </td>
                <td data-label="Status">
                  <StatusBadge
                    :label="tokenStatus(token).label"
                    :tone="tokenStatus(token).tone"
                  />
                </td>
                <td class="shrink">
                  <div
                    v-if="confirmRevokeId === token.id"
                    class="row"
                    role="group"
                    :aria-label="`Confirm revoking ${token.name}`"
                  >
                    <span class="text-sm">Revoke {{ token.name }}?</span>
                    <button
                      type="button"
                      class="btn btn-sm btn-danger-solid"
                      :disabled="pendingTokenId === token.id"
                      @click="revoke(token)"
                    >
                      Revoke
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-ghost"
                      @click="confirmRevokeId = null"
                    >
                      Cancel
                    </button>
                  </div>
                  <button
                    v-else-if="!token.revokedAt && tokenStatus(token).label !== 'Expired'"
                    type="button"
                    class="btn btn-sm btn-danger"
                    :disabled="pendingTokenId === token.id"
                    @click="confirmRevokeId = token.id"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-else
          class="panel-body"
        >
          <p class="empty-inline">
            No API tokens yet. Create one below to call the API from a script or CI job.
          </p>
        </div>
      </section>

      <form
        class="panel"
        aria-labelledby="create-token-heading"
        novalidate
        @submit.prevent="createToken"
      >
        <div class="panel-header">
          <h2 id="create-token-heading">
            Create a token
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
              <label for="token-name">Name</label>
              <input
                id="token-name"
                v-model="form.name"
                autocomplete="off"
                maxlength="100"
                required
                aria-describedby="token-name-hint"
              >
              <span
                id="token-name-hint"
                class="field-hint"
              >Something you'll recognise later, like the CI job or tool using it.</span>
            </div>
            <div class="field">
              <label for="token-expiry">Expires after</label>
              <select
                id="token-expiry"
                v-model="form.expiresInDays"
                aria-describedby="token-expiry-hint"
              >
                <option
                  v-for="option in expiryOptions"
                  :key="option.label"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
              <span
                id="token-expiry-hint"
                class="field-hint"
              >Expired tokens stop working on their own. You can revoke a token at any time.</span>
            </div>
          </div>
          <fieldset class="field">
            <legend class="field-label">
              Scopes
            </legend>
            <div class="stack-sm">
              <label
                v-for="option in grantableOptions"
                :key="option.scope"
                class="checkbox checkbox-option"
              >
                <input
                  v-model="form.scopes"
                  type="checkbox"
                  :value="option.scope"
                >
                <span>
                  <strong>{{ option.label }}</strong>
                  <span class="field-hint">{{ option.hint }}</span>
                </span>
              </label>
            </div>
            <span
              v-if="!isAdmin"
              class="field-hint"
            >Only administrators can create tokens that manage websites.</span>
          </fieldset>
        </div>
        <div class="panel-footer">
          <span class="text-sm text-muted">Tokens can't manage users or other tokens.</span>
          <button
            class="btn btn-primary"
            type="submit"
            :disabled="createPending || !form.name.trim() || !form.scopes.length"
          >
            <AppIcon name="key" />
            {{ createPending ? 'Creating…' : 'Create token' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
