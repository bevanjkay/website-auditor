<script setup lang="ts">
import type { SeverityCounts } from "../composables/useStatus";

const props = withDefaults(defineProps<{
  counts: SeverityCounts;
  previousCounts?: SeverityCounts | null;
  newCount?: number | null;
  fixedCount?: number | null;
  interactive?: boolean;
  activeSeverity?: string;
  newActive?: boolean;
  arriving?: boolean;
}>(), {
  previousCounts: null,
  newCount: null,
  fixedCount: null,
  interactive: false,
  activeSeverity: "all",
  newActive: false,
  arriving: false,
});

const emit = defineEmits<{
  severity: [severity: "error" | "warning" | "info"];
  showNew: [];
  showFixed: [];
}>();

const primary = [
  { key: "error", label: "Errors", noun: "error", dot: "dot-error", countClass: "count-error" },
  { key: "warning", label: "Warnings", noun: "warning", dot: "dot-warning", countClass: "count-warning" },
] as const;

function delta(key: keyof SeverityCounts) {
  return props.previousCounts ? props.counts[key] - props.previousCounts[key] : null;
}
</script>

<template>
  <div
    class="verdict"
    :class="{ 'is-arriving': arriving }"
  >
    <component
      :is="interactive ? 'button' : 'div'"
      v-for="(item, index) in primary"
      :key="item.key"
      class="verdict-primary"
      :type="interactive ? 'button' : undefined"
      :aria-pressed="interactive ? activeSeverity === item.key : undefined"
      @click="interactive && emit('severity', item.key)"
    >
      <span class="stat-label">
        <span
          class="badge-dot"
          :class="item.dot"
          aria-hidden="true"
        />
        {{ item.label }}
      </span>
      <span class="verdict-value">
        <TweenNumber
          :class="counts[item.key] ? item.countClass : undefined"
          :value="counts[item.key]"
          :duration="700"
          :delay="arriving ? index * 60 : 0"
        />
        <DeltaValue
          v-if="previousCounts"
          :value="delta(item.key)"
          :noun="item.noun"
        />
      </span>
    </component>

    <div class="verdict-secondary">
      <component
        :is="interactive ? 'button' : 'div'"
        class="verdict-line"
        :type="interactive ? 'button' : undefined"
        :aria-pressed="interactive ? activeSeverity === 'info' : undefined"
        @click="interactive && emit('severity', 'info')"
      >
        <span
          class="badge-dot dot-neutral"
          aria-hidden="true"
        />
        Info
        <strong>
          <TweenNumber
            :value="counts.info"
            :duration="700"
            :delay="arriving ? 120 : 0"
          />
        </strong>
        <DeltaValue
          v-if="previousCounts"
          :value="delta('info')"
          noun="info issue"
        />
      </component>

      <div
        v-if="newCount !== null && fixedCount !== null"
        class="verdict-line"
      >
        Since the last audit
        <button
          type="button"
          class="change-chip"
          :data-tone="newCount ? 'worse' : 'same'"
          :aria-pressed="newActive"
          @click="emit('showNew')"
        >
          +<TweenNumber
            :value="newCount"
            :duration="700"
            :delay="arriving ? 180 : 0"
          /> new
        </button>
        <button
          type="button"
          class="change-chip"
          :data-tone="fixedCount ? 'better' : 'same'"
          @click="emit('showFixed')"
        >
          <TweenNumber
            :value="fixedCount"
            :duration="700"
            :delay="arriving ? 240 : 0"
          /> fixed
        </button>
      </div>

      <slot />
    </div>
  </div>
</template>
