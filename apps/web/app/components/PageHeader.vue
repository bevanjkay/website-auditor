<script setup lang="ts">
defineProps<{
  title: string;
  breadcrumbs?: Array<{ label: string; to?: string }>;
}>();
</script>

<template>
  <header class="page-header">
    <nav
      v-if="breadcrumbs?.length"
      class="breadcrumbs"
      aria-label="Breadcrumb"
    >
      <ol>
        <li
          v-for="(crumb, index) in breadcrumbs"
          :key="`${crumb.label}-${index}`"
        >
          <NuxtLink
            v-if="crumb.to && index < breadcrumbs.length - 1"
            :to="crumb.to"
          >
            {{ crumb.label }}
          </NuxtLink>
          <span
            v-else
            aria-current="page"
          >{{ crumb.label }}</span>
        </li>
      </ol>
    </nav>
    <div class="page-header-main">
      <div class="page-title">
        <h1>
          {{ title }}
          <slot name="badge" />
        </h1>
        <div
          v-if="$slots.subtitle"
          class="page-subtitle"
        >
          <slot name="subtitle" />
        </div>
      </div>
      <div
        v-if="$slots.actions"
        class="page-actions"
      >
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </header>
</template>
