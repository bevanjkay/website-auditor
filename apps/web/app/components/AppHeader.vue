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
  <aside class="app-sidebar">
    <div class="sidebar-brand">
      <h1>Website Auditor</h1>
      <p>SEO, link &amp; typo audits.</p>
    </div>

    <nav class="sidebar-nav">
      <NuxtLink class="sidebar-link" to="/">
        Dashboard
      </NuxtLink>
      <NuxtLink class="sidebar-link" to="/websites/new">
        Add Website
      </NuxtLink>
      <NuxtLink
        v-if="user.role === 'admin'"
        class="sidebar-link"
        to="/admin/users"
      >
        Users
      </NuxtLink>
    </nav>

    <div class="sidebar-footer">
      <span class="sidebar-user">{{ user.username }}</span>
      <button
        class="sidebar-link"
        @click="emit('logout')"
      >
        Logout
      </button>
    </div>
  </aside>
</template>
