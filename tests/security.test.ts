import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../apps/web/server/utils/security";

describe("password hashing", () => {
  it("round-trips a password hash", async () => {
    const hash = await hashPassword("super-secret-password");

    await expect(verifyPassword("super-secret-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
