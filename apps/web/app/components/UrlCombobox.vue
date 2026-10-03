<script setup lang="ts">
const props = defineProps<{
  inputId: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  describedBy?: string;
  canAddCustom?: (candidate: string) => boolean;
}>();

const emit = defineEmits<{
  select: [url: string];
}>();

const query = ref("");
const open = ref(false);
const activeIndex = ref(-1);
const listboxId = `${props.inputId}-listbox`;

const matches = computed(() => {
  const needle = query.value.trim().toLowerCase();
  const filtered = needle
    ? props.options.filter(option => option.toLowerCase().includes(needle))
    : props.options;
  return filtered.slice(0, 12);
});

const customCandidate = computed(() => {
  const candidate = query.value.trim();
  return candidate && props.canAddCustom?.(candidate) ? candidate : null;
});

const items = computed(() => [
  ...matches.value.map(url => ({ url, label: url })),
  ...(customCandidate.value ? [{ url: customCandidate.value, label: `Add “${customCandidate.value}”` }] : []),
]);

watch(items, () => {
  activeIndex.value = items.value.length ? Math.min(Math.max(activeIndex.value, 0), items.value.length - 1) : -1;
});

function optionId(index: number) {
  return `${props.inputId}-option-${index}`;
}

function choose(index: number) {
  const item = items.value[index];
  if (!item) {
    return;
  }
  emit("select", item.url);
  query.value = "";
  activeIndex.value = -1;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    open.value = true;
    activeIndex.value = items.value.length ? (activeIndex.value + 1) % items.value.length : -1;
  }
  else if (event.key === "ArrowUp") {
    event.preventDefault();
    open.value = true;
    activeIndex.value = items.value.length ? (activeIndex.value - 1 + items.value.length) % items.value.length : -1;
  }
  else if (event.key === "Enter") {
    if (open.value && activeIndex.value >= 0) {
      event.preventDefault();
      choose(activeIndex.value);
    }
  }
  else if (event.key === "Escape") {
    if (open.value) {
      event.preventDefault();
      open.value = false;
    }
    else {
      query.value = "";
    }
  }
}
</script>

<template>
  <div class="combobox">
    <div class="search-field">
      <AppIcon name="search" />
      <input
        :id="inputId"
        v-model="query"
        type="text"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="listboxId"
        :aria-activedescendant="open && activeIndex >= 0 ? optionId(activeIndex) : undefined"
        :aria-describedby="describedBy"
        :placeholder="placeholder"
        :disabled="disabled"
        @focus="open = true"
        @input="open = true"
        @blur="open = false"
        @keydown="onKeydown"
      >
    </div>
    <ul
      v-show="open"
      :id="listboxId"
      role="listbox"
      class="combobox-list"
      :aria-label="placeholder"
    >
      <li
        v-for="(item, index) in items"
        :id="optionId(index)"
        :key="item.url"
        role="option"
        class="combobox-option"
        :aria-selected="index === activeIndex"
        @mousedown.prevent
        @mousemove="activeIndex = index"
        @click="choose(index)"
      >
        {{ item.label }}
      </li>
      <li
        v-if="!items.length"
        class="combobox-empty"
        role="presentation"
      >
        {{ query.trim() ? 'No matching pages. Paste a full URL to add it.' : 'No more discovered pages to add.' }}
      </li>
    </ul>
  </div>
</template>
