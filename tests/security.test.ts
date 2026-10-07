import { describe, expect, it } from "vitest";

import { generateApiToken, hashApiToken, hashPassword, isApiTokenFormat, parseBearerToken, verifyPassword } from "../apps/web/server/utils/security";

describe("password hashing", () => {
  it("round-trips a password hash", async () => {
    const hash = await hashPassword("super-secret-password");

    await expect(verifyPassword("super-secret-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("returns false for malformed stored hashes", async () => {
    await expect(verifyPassword("super-secret-password", "bad-format")).resolves.toBe(false);
    await expect(verifyPassword("super-secret-password", "salt:not-hex")).resolves.toBe(false);
    await expect(verifyPassword("super-secret-password", "salt:1234")).resolves.toBe(false);
  });
});

describe("aPI tokens", () => {
  it("generates a prefixed token stored only as its hash", () => {
    const { token, prefix, tokenHash } = generateApiToken();

    expect(isApiTokenFormat(token)).toBe(true);
    expect(prefix).toBe(token.slice(0, 11));
    expect(tokenHash).toBe(hashApiToken(token));
    expect(tokenHash).not.toContain(token.slice(3));
    expect(generateApiToken().token).not.toBe(token);
  });

  it("recognises only well-formed tokens", () => {
    expect(isApiTokenFormat("wa_short")).toBe(false);
    expect(isApiTokenFormat(`xx_${"a".repeat(43)}`)).toBe(false);
    expect(isApiTokenFormat(`wa_${"a".repeat(43)}x`)).toBe(false);
  });

  it("reads only bearer credentials from the Authorization header", () => {
    expect(parseBearerToken("Bearer wa_abc")).toBe("wa_abc");
    expect(parseBearerToken("bearer   wa_abc ")).toBe("wa_abc");
    expect(parseBearerToken("Basic dXNlcjpwYXNzd29yZA==")).toBeNull();
    expect(parseBearerToken("Bearer")).toBeNull();
    expect(parseBearerToken(undefined)).toBeNull();
  });
});
