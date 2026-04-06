import { normalizeWebsiteUrl } from "@website-auditor/shared";

import { describe, expect, it } from "vitest";

describe("normalizeWebsiteUrl", () => {
  it("adds https when missing and strips fragments", () => {
    expect(normalizeWebsiteUrl("example.com/path/#section")).toEqual({
      baseUrl: "https://example.com/path",
      normalizedHost: "example.com",
    });
  });

  it("rejects non-http protocols", () => {
    expect(() => normalizeWebsiteUrl("ftp://example.com")).toThrow("Only http and https websites are supported.");
  });
});
