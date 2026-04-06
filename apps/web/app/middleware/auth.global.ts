export default defineNuxtRouteMiddleware(async (to) => {
  const { user, loaded, refreshSession } = useSessionState();
  const isPublic = Boolean(to.meta.public);

  if (!loaded.value) {
    await refreshSession();
  }

  if (isPublic) {
    if (user.value && to.path === "/login") {
      return navigateTo("/");
    }

    return;
  }

  if (!user.value) {
    return navigateTo("/login");
  }
});
