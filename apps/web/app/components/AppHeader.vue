<script setup lang="ts">
import type { SessionUser } from "@website-auditor/shared";

defineProps<{
  user: SessionUser;
}>();

const emit = defineEmits<{
  logout: [];
}>();
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <h1>Website Auditor</h1>
      <p>Browser-rendered SEO, link, sitemap, and typo checks.</p>
    </div>

    <div class="nav-links">
      <NuxtLink to="/">
        Dashboard
      </NuxtLink>
      <NuxtLink to="/websites/new">
        Add Website
      </NuxtLink>
      <NuxtLink
        v-if="user.role === 'admin'"
        to="/admin/users"
      >
        Users
      </NuxtLink>
      <span class="muted">{{ user.username }}</span>
      <button @click="emit('logout')">
        Logout
      </button>
    </div>
  </header>
</template>
