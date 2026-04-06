<script setup lang="ts">
defineProps<{
  value: string;
}>();
</script>

<template>
  <span
    class="pill"
    :class="value"
  >
    {{ value.replaceAll('_', ' ') }}
  </span>
</template>
