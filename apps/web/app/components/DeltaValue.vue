<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: number | null;
  noun?: string;
}>(), {
  noun: "issue",
});

const tone = computed(() => {
  if (props.value === null || props.value === 0) {
    return "same";
  }
  return props.value > 0 ? "worse" : "better";
});

const text = computed(() => {
  if (props.value === null) {
    return "—";
  }
  if (props.value === 0) {
    return "No change";
  }
  return `${props.value > 0 ? "+" : "−"}${Math.abs(props.value).toLocaleString()}`;
});

const description = computed(() => {
  if (props.value === null) {
    return "No previous audit to compare";
  }
  if (props.value === 0) {
    return "No change since the previous audit";
  }
  const count = Math.abs(props.value);
  return `${count.toLocaleString()} ${count === 1 ? props.noun : `${props.noun}s`} ${props.value > 0 ? "more" : "fewer"} than the previous audit`;
});
</script>

<template>
  <span
    class="delta"
    :data-tone="tone"
    :title="description"
  >
    <AppIcon
      v-if="tone === 'worse'"
      name="arrow-up"
      :size="12"
    />
    <AppIcon
      v-else-if="tone === 'better'"
      name="arrow-down"
      :size="12"
    />
    <span aria-hidden="true">{{ text }}</span>
    <span class="visually-hidden">{{ description }}</span>
  </span>
</template>
