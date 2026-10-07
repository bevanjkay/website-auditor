<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: IconName;
  size?: number;
  label?: string;
}>(), {
  size: 16,
  label: undefined,
});

// Stroke paths adapted from Lucide (ISC licence). Shapes: "c:cx cy r" is a circle, "r:x y w h rx" a rect.
const icons = {
  "alert-circle": ["c:12 12 10", "M12 8v4", "M12 16h.01"],
  "alert-triangle": ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"],
  "archive": ["r:2 3 20 5 1", "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8", "M10 12h4"],
  "arrow-down": ["M12 5v14", "m19 12-7 7-7-7"],
  "arrow-up": ["m5 12 7-7 7 7", "M12 19V5"],
  "ban": ["c:12 12 10", "m4.9 4.9 14.2 14.2"],
  "brand": ["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", "c:12 12 3", "m16 16-1.9-1.9"],
  "check": ["M20 6 9 17l-5-5"],
  "check-circle": ["c:12 12 10", "m9 12 2 2 4-4"],
  "chevron-down": ["m6 9 6 6 6-6"],
  "chevron-right": ["m9 18 6-6-6-6"],
  "copy": ["r:8 8 14 14 2", "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"],
  "download": ["M12 15V3", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5"],
  "chevrons-up-down": ["m7 15 5 5 5-5", "m7 9 5-5 5 5"],
  "external-link": ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  "file-text": ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M10 9H8", "M16 13H8", "M16 17H8"],
  "globe": ["c:12 12 10", "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", "M2 12h20"],
  "info": ["c:12 12 10", "M12 16v-4", "M12 8h.01"],
  "key": ["m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4", "m21 2-9.6 9.6", "c:7.5 15.5 5.5"],
  "list": ["M3 12h.01", "M3 18h.01", "M3 6h.01", "M8 12h13", "M8 18h13", "M8 6h13"],
  "loader": ["M21 12a9 9 0 1 1-6.219-8.56"],
  "log-out": ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  "play": ["m6 3 14 9-14 9z"],
  "plug": ["M12 22v-5", "M9 8V2", "M15 8V2", "M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"],
  "plus": ["M5 12h14", "M12 5v14"],
  "refresh": ["M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5"],
  "restore": ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
  "search": ["c:11 11 8", "m21 21-4.3-4.3"],
  "settings": ["M20 7h-9", "M14 17H5", "c:17 17 3", "c:7 7 3"],
  "square": ["r:6 6 12 12 1"],
  "unlink": ["M9 17H7A5 5 0 0 1 7 7", "M15 7h2a5 5 0 0 1 4 8", "M8 12h4", "m2 2 20 20"],
  "users": ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "c:9 7 4", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  "x": ["M18 6 6 18", "m6 6 12 12"],
} as const;

export type IconName = keyof typeof icons;

const shapes = computed(() => icons[props.name].map((shape) => {
  if (shape.startsWith("c:")) {
    const [cx, cy, r] = shape.slice(2).split(" ");
    return { tag: "circle", attrs: { cx, cy, r } };
  }
  if (shape.startsWith("r:")) {
    const [x, y, width, height, rx] = shape.slice(2).split(" ");
    return { tag: "rect", attrs: { x, y, width, height, rx } };
  }
  return { tag: "path", attrs: { d: shape } };
}));
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
  >
    <component
      :is="shape.tag"
      v-for="(shape, index) in shapes"
      :key="index"
      v-bind="shape.attrs"
    />
  </svg>
</template>
