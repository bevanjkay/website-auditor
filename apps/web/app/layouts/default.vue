<script setup lang="ts">
const { user, logout } = useSessionState();
</script>

<template>
  <div class="shell">
    <div class="app-frame stack">
      <AppHeader
        v-if="user"
        :user="user"
        @logout="logout"
      />
      <slot />
    </div>
  </div>
</template>
