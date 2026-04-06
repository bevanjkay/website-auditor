<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  detail?: string | null;
}>();
</script>

<template>
  <article class="metric-card">
    <small>{{ label }}</small>
    <strong>{{ value }}</strong>
    <p
      v-if="detail"
      class="muted"
    >
      {{ detail }}
    </p>
  </article>
</template>
