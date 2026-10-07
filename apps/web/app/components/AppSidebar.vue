<script setup lang="ts">
import type { SessionUser } from "@website-auditor/shared";

defineProps<{
  user: SessionUser;
}>();

const emit = defineEmits<{
  logout: [];
}>();

const route = useRoute();

const isWebsitesSection = computed(() =>
  route.path === "/" || route.path.startsWith("/audits/") || (route.path.startsWith("/websites/") && route.path !== "/websites/new"));
</script>

<template>
  <aside class="sidebar">
    <NuxtLink
      to="/"
      class="sidebar-brand"
    >
      <span class="brand-mark">
        <AppIcon
          name="brand"
          :size="16"
        />
      </span>
      Website Auditor
    </NuxtLink>

    <nav
      class="sidebar-nav"
      aria-label="Main"
    >
      <NuxtLink
        class="sidebar-link"
        to="/"
        :aria-current="isWebsitesSection ? 'page' : undefined"
      >
        <AppIcon name="globe" />
        Websites
      </NuxtLink>
      <NuxtLink
        class="sidebar-link"
        to="/websites/new"
        :aria-current="route.path === '/websites/new' ? 'page' : undefined"
      >
        <AppIcon name="plus" />
        Add website
      </NuxtLink>
      <NuxtLink
        class="sidebar-link"
        to="/settings/tokens"
        :aria-current="route.path === '/settings/tokens' ? 'page' : undefined"
      >
        <AppIcon name="key" />
        API tokens
      </NuxtLink>
      <NuxtLink
        class="sidebar-link"
        to="/settings/mcp"
        :aria-current="route.path === '/settings/mcp' ? 'page' : undefined"
      >
        <AppIcon name="plug" />
        MCP server
      </NuxtLink>
      <NuxtLink
        v-if="user.role === 'admin'"
        class="sidebar-link"
        to="/admin/users"
        :aria-current="route.path.startsWith('/admin/users') ? 'page' : undefined"
      >
        <AppIcon name="users" />
        Users
      </NuxtLink>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user">
        <strong>{{ user.username }}</strong>
        <span>{{ user.role === 'admin' ? 'Administrator' : 'Member' }}</span>
      </div>
      <button
        type="button"
        class="sidebar-link"
        @click="emit('logout')"
      >
        <AppIcon name="log-out" />
        Sign out
      </button>
    </div>
  </aside>
</template>
