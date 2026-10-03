<script setup lang="ts">
import type { Tone } from "../composables/useStatus";
import type { IconName } from "./AppIcon.vue";

const props = defineProps<{
  tone?: Tone;
  title?: string;
  dismissible?: boolean;
}>();

const emit = defineEmits<{
  dismiss: [];
}>();

const icon = computed<IconName>(() => {
  switch (props.tone) {
    case "error":
      return "alert-circle";
    case "warning":
      return "alert-triangle";
    case "success":
      return "check-circle";
    default:
      return "info";
  }
});
</script>

<template>
  <div
    class="alert"
    :class="{ 'alert-enter': dismissible }"
    :data-tone="tone ?? 'neutral'"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    <AppIcon :name="icon" />
    <div class="alert-body">
      <strong
        v-if="title"
        class="alert-title"
      >{{ title }}</strong>
      <p v-if="$slots.default">
        <slot />
      </p>
      <div
        v-if="$slots.actions"
        class="alert-actions"
      >
        <slot name="actions" />
      </div>
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="btn btn-ghost btn-sm btn-icon alert-dismiss"
      aria-label="Dismiss"
      @click="emit('dismiss')"
    >
      <AppIcon name="x" />
    </button>
  </div>
</template>
