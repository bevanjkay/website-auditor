import { getAppSetting, setAppSetting } from "@website-auditor/db";

const mcpEnabledSetting = "mcp_enabled";

export function isMcpDisabledByEnv(): boolean {
  return process.env.MCP_DISABLED?.toLowerCase() === "true";
}

export async function getMcpStatus() {
  const setting = await getAppSetting(mcpEnabledSetting);
  const disabledByEnv = isMcpDisabledByEnv();
  return {
    enabled: !disabledByEnv && setting?.valueJson === true,
    disabledByEnv,
    updatedAt: setting?.updatedAt ?? null,
    updatedBy: setting?.updatedByUsername ?? null,
  };
}

export async function setMcpEnabled(enabled: boolean, userId: string) {
  await setAppSetting(mcpEnabledSetting, enabled, userId);
  return getMcpStatus();
}
