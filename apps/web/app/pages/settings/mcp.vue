<script setup lang="ts">
import { mcpTools } from "@website-auditor/shared";

useHead({ title: "MCP server" });

interface McpStatus {
  enabled: boolean;
  disabledByEnv: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

type ClientId = "claude-code" | "claude-desktop" | "cursor" | "vscode" | "codex" | "other";

const { user: currentUser } = useSessionState();
const isAdmin = computed(() => currentUser.value?.role === "admin");
const endpoint = `${useRequestURL().origin}/mcp`;
const tokenVariable = "WEBSITE_AUDITOR_TOKEN";

const { data: status, error: loadError } = await useAsyncData<McpStatus>("mcp-status", () => $fetch("/api/settings/mcp"));

const togglePending = ref(false);
const confirmTurnOff = ref(false);
const notice = ref<{ tone: "success" | "error"; message: string } | null>(null);

async function setEnabled(enabled: boolean) {
  togglePending.value = true;
  try {
    status.value = await $fetch<McpStatus>("/api/settings/mcp", { method: "PATCH", body: { enabled } });
    confirmTurnOff.value = false;
    notice.value = enabled
      ? { tone: "success", message: "The MCP server is on. Clients with an API token can connect now." }
      : { tone: "success", message: "The MCP server is off. Clients get an error on their next request." };
  }
  catch (error) {
    notice.value = { tone: "error", message: getErrorMessage(error, "Couldn't change the MCP server setting.") };
  }
  finally {
    togglePending.value = false;
  }
}

const clients: Array<{ id: ClientId; label: string; snippetLabel: string; code: string }> = [
  {
    id: "claude-code",
    label: "Claude Code",
    snippetLabel: "Terminal",
    code: `claude mcp add --transport http --scope user website-auditor ${endpoint} \\\n  --header "Authorization: Bearer $${tokenVariable}"`,
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    snippetLabel: "claude_desktop_config.json",
    code: JSON.stringify({
      mcpServers: {
        "website-auditor": {
          command: "npx",
          args: ["-y", "mcp-remote", endpoint, "--header", `Authorization:\${AUTH_HEADER}`],
          env: { AUTH_HEADER: "Bearer wa_…" },
        },
      },
    }, null, 2),
  },
  {
    id: "cursor",
    label: "Cursor",
    snippetLabel: "~/.cursor/mcp.json",
    code: JSON.stringify({
      mcpServers: {
        "website-auditor": {
          url: endpoint,
          headers: { Authorization: `Bearer \${env:${tokenVariable}}` },
        },
      },
    }, null, 2),
  },
  {
    id: "vscode",
    label: "VS Code",
    snippetLabel: ".vscode/mcp.json",
    code: JSON.stringify({
      inputs: [
        { type: "promptString", id: "website-auditor-token", description: "Website Auditor API token", password: true },
      ],
      servers: {
        "website-auditor": {
          type: "http",
          url: endpoint,
          headers: { Authorization: `Bearer \${input:website-auditor-token}` },
        },
      },
    }, null, 2),
  },
  {
    id: "codex",
    label: "Codex",
    snippetLabel: "~/.codex/config.toml",
    code: `[mcp_servers.website-auditor]\nurl = "${endpoint}"\nbearer_token_env_var = "${tokenVariable}"`,
  },
  {
    id: "other",
    label: "Other clients",
    snippetLabel: "Connection details",
    code: `URL: ${endpoint}\nAuthorization: Bearer wa_…`,
  },
];

const activeClient = ref<ClientId>("claude-code");
const client = computed(() => clients.find(entry => entry.id === activeClient.value) ?? clients[0]!);

function selectClient(id: ClientId) {
  activeClient.value = id;
  void nextTick(() => document.getElementById(`client-tab-${id}`)?.focus());
}

function onClientTabKeydown(event: KeyboardEvent, index: number) {
  const target = event.key === "ArrowRight"
    ? (index + 1) % clients.length
    : event.key === "ArrowLeft"
      ? (index - 1 + clients.length) % clients.length
      : event.key === "Home"
        ? 0
        : event.key === "End" ? clients.length - 1 : null;
  if (target !== null) {
    event.preventDefault();
    selectClient(clients[target]!.id);
  }
}
</script>

<template>
  <div>
    <PageHeader title="MCP server">
      <template #subtitle>
        <span>
          Connect an AI assistant such as Claude Code to Website Auditor. It can check results, start audits and clear
          false positives, limited to what its API token allows.
        </span>
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
        title="Couldn't load the MCP server status"
      >
        {{ getErrorMessage(loadError, 'The server did not respond.') }}
      </AlertMessage>

      <section
        v-if="status"
        class="panel"
        aria-labelledby="mcp-status-heading"
      >
        <div class="panel-header">
          <h2 id="mcp-status-heading">
            Status
          </h2>
          <StatusBadge
            :label="status.enabled ? 'On' : 'Off'"
            :tone="status.enabled ? 'success' : 'neutral'"
          />
        </div>
        <div class="panel-body stack-sm">
          <p v-if="status.disabledByEnv">
            The <code>MCP_DISABLED</code> environment variable turns the MCP server off for this installation. Remove it
            and restart the web service to manage the server here.
          </p>
          <p v-else-if="status.enabled">
            Clients with an API token can connect at <code>{{ endpoint }}</code>.
          </p>
          <p v-else-if="isAdmin">
            The server is off, so MCP clients can't connect. Turn it on to let anyone with an API token use it.
          </p>
          <p v-else>
            The server is off, so MCP clients can't connect. Ask an administrator to turn it on.
          </p>
          <p
            v-if="status.updatedBy && !status.disabledByEnv"
            class="text-sm text-muted"
          >
            Turned {{ status.enabled ? 'on' : 'off' }} by {{ status.updatedBy }} {{ formatRelativeTime(status.updatedAt) }}.
          </p>
        </div>
        <div
          v-if="isAdmin && !status.disabledByEnv"
          class="panel-footer"
        >
          <span class="text-sm text-muted">Only administrators can turn the server on or off.</span>
          <div
            v-if="confirmTurnOff"
            class="row"
            role="group"
            aria-label="Confirm turning off the MCP server"
          >
            <span class="text-sm">Connected clients will stop working.</span>
            <button
              type="button"
              class="btn btn-sm btn-danger-solid"
              :disabled="togglePending"
              @click="setEnabled(false)"
            >
              Turn off
            </button>
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              @click="confirmTurnOff = false"
            >
              Cancel
            </button>
          </div>
          <button
            v-else-if="status.enabled"
            type="button"
            class="btn btn-danger"
            @click="confirmTurnOff = true"
          >
            Turn off
          </button>
          <button
            v-else
            type="button"
            class="btn btn-primary"
            :disabled="togglePending"
            @click="setEnabled(true)"
          >
            <AppIcon name="plug" />
            {{ togglePending ? 'Turning on…' : 'Turn on' }}
          </button>
        </div>
      </section>

      <section
        class="panel"
        aria-labelledby="mcp-setup-heading"
      >
        <div class="panel-header">
          <h2 id="mcp-setup-heading">
            Set up a client
          </h2>
        </div>
        <div class="panel-body stack">
          <AlertMessage
            v-if="status && !status.enabled"
            tone="warning"
          >
            The server is off, so clients can't connect until {{ isAdmin && !status.disabledByEnv ? 'you turn it on above' : 'it is turned on' }}.
          </AlertMessage>

          <ol class="setup-steps">
            <li>
              <h3>Create an API token</h3>
              <p>
                Create a token on the <NuxtLink to="/settings/tokens">
                  API tokens
                </NuxtLink> page. The assistant acts as you and only gets the
                tools its scopes allow:
              </p>
              <ul class="setup-scopes">
                <li><strong>Read</strong> to look up websites, audits and their findings.</li>
                <li><strong>Run audits</strong> to start and stop audits.</li>
                <li><strong>Manage websites</strong> to allow typo words and ignore broken links. Only administrators can grant it.</li>
              </ul>
            </li>

            <li>
              <h3>Add the server to your client</h3>
              <div>
                <div
                  class="tabs"
                  role="tablist"
                  aria-label="MCP clients"
                >
                  <button
                    v-for="(entry, index) in clients"
                    :id="`client-tab-${entry.id}`"
                    :key="entry.id"
                    type="button"
                    role="tab"
                    class="tab"
                    :aria-selected="activeClient === entry.id"
                    :aria-controls="`client-panel-${entry.id}`"
                    :tabindex="activeClient === entry.id ? 0 : -1"
                    @click="selectClient(entry.id)"
                    @keydown="onClientTabKeydown($event, index)"
                  >
                    {{ entry.label }}
                  </button>
                </div>
                <div
                  :id="`client-panel-${client.id}`"
                  :key="client.id"
                  role="tabpanel"
                  :aria-labelledby="`client-tab-${client.id}`"
                  class="tab-panel stack-sm"
                >
                  <p v-if="client.id === 'claude-code'">
                    Run this in a terminal with your token in the <code>{{ tokenVariable }}</code> environment variable.
                    <code>--scope user</code> adds the server to all your projects; leave it out to add it to the current
                    project only.
                  </p>
                  <p v-else-if="client.id === 'claude-desktop'">
                    Claude Desktop reaches remote servers through the <code>mcp-remote</code> bridge, which needs Node.js.
                    Add this to <code>claude_desktop_config.json</code>, replace <code>wa_…</code> with your token, then
                    restart Claude Desktop.
                  </p>
                  <p v-else-if="client.id === 'cursor'">
                    Add this to <code>~/.cursor/mcp.json</code> for all projects or <code>.cursor/mcp.json</code> for one.
                    Cursor reads the token from the <code>{{ tokenVariable }}</code> environment variable.
                  </p>
                  <p v-else-if="client.id === 'vscode'">
                    Add this to <code>.vscode/mcp.json</code> in a workspace, or run <strong>MCP: Open User
                      Configuration</strong> to use it everywhere. VS Code asks for the token the first time the server
                    starts.
                  </p>
                  <p v-else-if="client.id === 'codex'">
                    Add this to <code>~/.codex/config.toml</code>. Codex reads the token from the
                    <code>{{ tokenVariable }}</code> environment variable.
                  </p>
                  <p v-else>
                    Point any client that supports the Streamable HTTP transport at this URL and send the token as a
                    bearer token. Clients that can only sign in with OAuth, such as claude.ai connectors, can't connect yet.
                  </p>
                  <CodeSnippet
                    :code="client.code"
                    :label="client.snippetLabel"
                  />
                </div>
              </div>
            </li>

            <li>
              <h3>Check it's connected</h3>
              <p>
                Ask your assistant to “list my websites in Website Auditor”. In Claude Code, <code>/mcp</code> shows
                whether the server is connected.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section
        class="panel"
        aria-labelledby="mcp-tools-heading"
      >
        <div class="panel-header">
          <h2 id="mcp-tools-heading">
            Tools
          </h2>
          <span class="text-sm text-muted">Clients only see the tools their token's scopes allow.</span>
        </div>
        <div class="table-wrap">
          <table class="data-table responsive-table">
            <thead>
              <tr>
                <th scope="col">
                  Tool
                </th>
                <th scope="col">
                  What it does
                </th>
                <th scope="col">
                  Scope
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="tool in mcpTools"
                :key="tool.name"
              >
                <td class="cell-lead">
                  <code>{{ tool.name }}</code>
                </td>
                <td data-label="What it does">
                  {{ tool.summary }}
                </td>
                <td data-label="Scope">
                  {{ apiTokenScopeLabel(tool.scope) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>
