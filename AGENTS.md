# Agent Notes

## Audit engine
- Never declare named functions (incl. `const fn = () =>`) inside a `page.evaluate(() => …)` callback. The worker runs audit-engine *source* via `tsx` (tsconfig `paths` map to `src`), and esbuild's `keepNames` wraps named functions with a `__name` helper that is undefined in the browser, causing `ReferenceError: __name is not defined` at runtime. Use inline expressions or anonymous arrows passed directly to `.map`/`.filter`. This path is not covered by CI (no browsers installed), so verify browser-side changes manually.
