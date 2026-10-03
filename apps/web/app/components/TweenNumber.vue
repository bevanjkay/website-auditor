<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: number;
  duration?: number;
  delay?: number;
}>(), {
  duration: 500,
  delay: 0,
});

const display = ref(props.value);
let frame = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function stop() {
  cancelAnimationFrame(frame);
  clearTimeout(timer);
}

// Counts between values so live numbers read as progress rather than jumps.
watch(() => props.value, (target) => {
  stop();
  const start = display.value;
  if (start === target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    display.value = target;
    return;
  }

  timer = setTimeout(() => {
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / props.duration);
      display.value = Math.round(start + (target - start) * (1 - (1 - progress) ** 4));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
  }, props.delay);
});

onBeforeUnmount(stop);
</script>

<template>
  <span class="num">{{ display.toLocaleString() }}</span>
</template>
