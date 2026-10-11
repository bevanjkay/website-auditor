<script setup lang="ts">
import type { LinkIgnoreScope } from "@website-auditor/shared";

defineProps<{
  targetUrl: string;
  host: string;
  showHost: boolean;
  disabled: boolean;
}>();

const emit = defineEmits<{
  ignore: [kind: "url" | "domain", value: string, scope: LinkIgnoreScope];
}>();

const rowId = useId();
</script>

<template>
  <div class="ignore-actions">
    <div
      class="row"
      role="group"
      :aria-labelledby="`${rowId}-audit`"
    >
      <span
        :id="`${rowId}-audit`"
        class="ignore-actions-label"
      >Dismiss in this audit</span>
      <button
        type="button"
        class="btn btn-sm"
        :disabled="disabled"
        @click="emit('ignore', 'url', targetUrl, 'audit')"
      >
        This URL
      </button>
      <button
        v-if="showHost"
        type="button"
        class="btn btn-sm"
        :disabled="disabled"
        @click="emit('ignore', 'domain', host, 'audit')"
      >
        Everything from {{ host }}
      </button>
    </div>
    <div
      class="row"
      role="group"
      :aria-labelledby="`${rowId}-always`"
    >
      <span
        :id="`${rowId}-always`"
        class="ignore-actions-label"
      >Always ignore</span>
      <button
        type="button"
        class="btn btn-sm btn-ghost"
        :disabled="disabled"
        @click="emit('ignore', 'url', targetUrl, 'website')"
      >
        <AppIcon
          name="ban"
          :size="14"
        />
        This URL
      </button>
      <button
        v-if="showHost"
        type="button"
        class="btn btn-sm btn-ghost"
        :disabled="disabled"
        @click="emit('ignore', 'domain', host, 'website')"
      >
        <AppIcon
          name="ban"
          :size="14"
        />
        Everything from {{ host }}
      </button>
    </div>
  </div>
</template>
