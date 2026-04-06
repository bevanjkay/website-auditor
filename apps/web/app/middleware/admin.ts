export default defineNuxtRouteMiddleware(() => {
  const { user } = useSessionState();

  if (!user.value || user.value.role !== "admin") {
    return navigateTo("/");
  }
});
