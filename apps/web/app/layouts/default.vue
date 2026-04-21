<script setup lang="ts">
const { user, logout } = useSessionState();
</script>

<template>
  <div class="shell">
    <AppHeader
      v-if="user"
      :user="user"
      @logout="logout"
    />
    <main class="app-main" :class="{ 'with-sidebar': !!user }">
      <div v-if="user" class="app-frame">
        <slot />
      </div>
      <slot v-else />
    </main>
  </div>
</template>
