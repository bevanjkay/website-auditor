import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const apiDir = fileURLToPath(new URL("../apps/web/server/api", import.meta.url));
const routes = readdirSync(apiDir, { recursive: true, encoding: "utf8" })
  .filter(file => file.endsWith(".ts") && !file.startsWith("auth/"))
  .map((file) => {
    const source = readFileSync(path.join(apiDir, file), "utf8");
    return {
      file,
      method: file.match(/\.(\w+)\.ts$/)?.[1],
      scope: source.match(/requireUser\(event, "([^"]+)"\)/)?.[1] ?? null,
      sessionOnly: /require(?:SessionUser|Admin)\(event\)/.test(source),
    };
  });

describe("aPI route access", () => {
  it.each(routes)("$file requires a token scope or a browser session", (route) => {
    expect(route.scope !== null || route.sessionOnly).toBe(true);
    if (route.scope) {
      expect(route.scope === "read").toBe(route.method === "get");
    }
  });

  it("keeps user and token management session-only", () => {
    const management = routes.filter(route => /^(?:users|tokens)\//.test(route.file));

    expect(management.length).toBeGreaterThan(0);
    expect(management.every(route => route.sessionOnly && route.scope === null)).toBe(true);
  });
});
