import type { SessionUser } from "@website-auditor/shared";

export function useSessionState() {
  const user = useState<SessionUser | null>("session-user", () => null);
  const loaded = useState<boolean>("session-loaded", () => false);

  async function refreshSession() {
    const response = await $fetch<{ user: SessionUser | null }>("/api/auth/session", {
      headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
      credentials: "include",
    });

    user.value = response.user;
    loaded.value = true;
    return response.user;
  }

  async function logout() {
    await $fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    user.value = null;
    loaded.value = true;
    await navigateTo("/login");
  }

  return {
    user,
    loaded,
    refreshSession,
    logout,
  };
}
