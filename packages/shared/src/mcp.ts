import type { ApiTokenScope } from "./index.js";

export interface McpToolSummary {
  name: string;
  scope: ApiTokenScope;
  summary: string;
}

export const mcpTools: McpToolSummary[] = [
  { name: "list_websites", scope: "read", summary: "Websites with their latest audit status and issue counts." },
  { name: "list_audits", scope: "read", summary: "A website's recent audits, newest first." },
  { name: "get_audit_status", scope: "read", summary: "Progress of one or more audits, then issue counts and what changed once they finish." },
  { name: "list_issues", scope: "read", summary: "An audit's issues, filtered by severity, category, page or new since the previous audit." },
  { name: "list_broken_links", scope: "read", summary: "Broken links in an audit and the pages that contain them." },
  { name: "get_audit_report", scope: "read", summary: "The full audit report as Markdown." },
  { name: "start_audits", scope: "audit:run", summary: "Start audits for one or more websites." },
  { name: "stop_audits", scope: "audit:run", summary: "Stop one or more queued or running audits." },
  { name: "allow_typo_words", scope: "websites:write", summary: "Add words to a website's typo allowlist and clear them from the audit." },
  { name: "ignore_broken_links", scope: "websites:write", summary: "Ignore broken links by URL or domain and clear them from the audit." },
];

export function mcpToolsForScopes(scopes: readonly ApiTokenScope[]): McpToolSummary[] {
  return mcpTools.filter(tool => scopes.includes(tool.scope));
}
