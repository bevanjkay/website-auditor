import antfu from "@antfu/eslint-config";

export default antfu(
  {
    gitignore: true,
    ignores: [
      "**/.nuxt/**",
      "**/.output/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
    ],
    stylistic: {
      semi: true,
      quotes: "double",
    },
    typescript: true,
    vue: true,
  },
  {
    rules: {
      "e18e/prefer-static-regex": "off",
      "no-console": "off",
      "node/prefer-global/buffer": "off",
      "node/prefer-global/process": "off",
      "ts/method-signature-style": "off",
    },
  },
  {
    files: ["**/*.vue"],
    rules: {
      "vue/max-attributes-per-line": "off",
      "vue/multi-word-component-names": "off",
      "vue/singleline-html-element-content-newline": "off",
    },
  },
);
