import type { ApiTokenScope } from "@website-auditor/shared";

export const apiTokenScopeOptions: Array<{ scope: ApiTokenScope; label: string; hint: string }> = [
  { scope: "read", label: "Read", hint: "View websites, audits and their results." },
  { scope: "audit:run", label: "Run audits", hint: "Start and stop audits." },
  { scope: "websites:write", label: "Manage websites", hint: "Add and edit websites, allow typo words and ignore broken links." },
];

export function apiTokenScopeLabel(scope: ApiTokenScope): string {
  return apiTokenScopeOptions.find(option => option.scope === scope)?.label ?? scope;
}
