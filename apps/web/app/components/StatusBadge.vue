<script setup lang="ts">
import type { Tone } from "../composables/useStatus";

defineProps<{
  label: string;
  tone?: Tone;
  spinning?: boolean;
}>();
</script>

<template>
  <span
    class="badge"
    :data-tone="tone ?? 'neutral'"
  >
    <AppIcon
      v-if="spinning"
      name="loader"
      :size="12"
      class="spin"
    />
    <span
      v-else
      class="badge-dot"
      aria-hidden="true"
    />
    {{ label }}
  </span>
</template>
