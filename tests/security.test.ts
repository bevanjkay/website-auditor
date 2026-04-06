import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../apps/web/server/utils/security";

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
