<script setup lang="ts">
defineProps<{
  website: { id: string; name: string; baseUrl: string; isActive: boolean } | null | undefined;
  current: "overview" | "settings";
}>();
</script>

<template>
  <PageHeader
    :title="website?.name ?? 'Website'"
    :breadcrumbs="current === 'overview'
      ? [{ label: 'Websites', to: '/' }, { label: website?.name ?? 'Website' }]
      : [{ label: 'Websites', to: '/' }, { label: website?.name ?? 'Website', to: `/websites/${website?.id}` }, { label: 'Crawl settings' }]"
  >
    <template
      v-if="website && !website.isActive"
      #badge
    >
      <StatusBadge
        label="Archived"
        tone="neutral"
      />
    </template>
    <template
      v-if="website"
      #subtitle
    >
      <a
        :href="website.baseUrl"
        target="_blank"
        rel="noreferrer noopener"
        class="url row"
      >
        {{ website.baseUrl }}
        <AppIcon
          name="external-link"
          :size="12"
        />
        <span class="visually-hidden">(opens in a new tab)</span>
      </a>
    </template>
    <template
      v-if="$slots.actions"
      #actions
    >
      <slot name="actions" />
    </template>
    <nav
      v-if="website"
      class="tabs"
      aria-label="Website sections"
    >
      <NuxtLink
        class="tab"
        :to="`/websites/${website.id}`"
        :aria-current="current === 'overview' ? 'page' : undefined"
      >
        Overview
      </NuxtLink>
      <NuxtLink
        class="tab"
        :to="`/websites/${website.id}/settings`"
        :aria-current="current === 'settings' ? 'page' : undefined"
      >
        Crawl settings
      </NuxtLink>
    </nav>
  </PageHeader>
</template>
