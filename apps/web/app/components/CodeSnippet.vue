<script setup lang="ts">
const props = defineProps<{
  code: string;
  label: string;
}>();

const copyState = ref<"idle" | "copied" | "blocked">("idle");
const block = ref<HTMLElement | null>(null);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code);
    copyState.value = "copied";
  }
  catch {
    if (block.value) {
      window.getSelection()?.selectAllChildren(block.value);
    }
    copyState.value = "blocked";
  }
}
</script>

<template>
  <div class="stack-sm">
    <div class="code-snippet">
      <div class="code-snippet-header">
        <span class="mono text-xs">{{ label }}</span>
        <span
          class="visually-hidden"
          aria-live="polite"
        >{{ copyState === 'copied' ? `Copied ${label}` : '' }}</span>
        <button
          type="button"
          class="btn btn-sm btn-ghost"
          :aria-label="`Copy ${label}`"
          @click="copy"
        >
          <AppIcon
            :name="copyState === 'copied' ? 'check' : 'copy'"
            :size="14"
          />
          {{ copyState === 'copied' ? 'Copied' : 'Copy' }}
        </button>
      </div>
      <pre ref="block"><code>{{ code }}</code></pre>
    </div>
    <p
      v-if="copyState === 'blocked'"
      class="field-hint"
      role="status"
    >
      Your browser blocked copying. The text is selected, so press Ctrl+C or ⌘C.
    </p>
  </div>
</template>
