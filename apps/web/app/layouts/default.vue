<script setup lang="ts">
const { user, logout } = useSessionState();
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'with-sidebar': !!user }"
  >
    <a
      class="skip-link"
      href="#main"
    >Skip to content</a>
    <AppSidebar
      v-if="user"
      :user="user"
      @logout="logout"
    />
    <main
      id="main"
      class="app-main"
      tabindex="-1"
    >
      <div
        v-if="user"
        class="app-content"
      >
        <slot />
      </div>
      <slot v-else />
    </main>
  </div>
</template>
