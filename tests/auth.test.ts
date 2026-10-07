import type { ApiTokenScope, SessionUser } from "@website-auditor/shared";

import { getApiTokenUser, getSessionUser } from "@website-auditor/db";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin, requireSessionUser, requireUser } from "../apps/web/server/utils/auth";

vi.mock("@website-auditor/db", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getApiTokenUser: vi.fn(),
  getSessionUser: vi.fn(),
}));

const member: SessionUser = { id: "user-1", username: "sam", role: "user" };
const admin: SessionUser = { id: "user-2", username: "alex", role: "admin" };
const validToken = `wa_${"a".repeat(43)}`;

// The auth helpers only read request headers, so a bare event is enough.
function requestWith(headers: Record<string, string>) {
  return { node: { req: { headers } } } as unknown as Parameters<typeof requireUser>[0];
}

function tokenFor(user: SessionUser, scopes: ApiTokenScope[]) {
  vi.mocked(getApiTokenUser).mockResolvedValue({ user, scopes });
  return requestWith({ authorization: `Bearer ${validToken}` });
}

beforeEach(() => {
  vi.mocked(getApiTokenUser).mockReset().mockResolvedValue(null);
  vi.mocked(getSessionUser).mockReset().mockResolvedValue(member);
});

describe("requireUser", () => {
  it("lets a browser session use every scope", async () => {
    await expect(requireUser(requestWith({ cookie: "wa_session=abc" }), "websites:write")).resolves.toEqual(member);
  });

  it("rejects an unknown bearer token without falling back to the session cookie", async () => {
    const event = requestWith({ authorization: `Bearer ${validToken}`, cookie: "wa_session=abc" });

    await expect(requireUser(event, "read")).rejects.toMatchObject({ statusCode: 401 });
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("skips the lookup for values that are not API tokens", async () => {
    await expect(requireUser(requestWith({ authorization: "Bearer nope" }), "read")).rejects.toMatchObject({ statusCode: 401 });
    expect(getApiTokenUser).not.toHaveBeenCalled();
  });

  it("ignores Basic credentials forwarded by a proxy", async () => {
    const event = requestWith({ authorization: "Basic dXNlcjpwYXNzd29yZA==", cookie: "wa_session=abc" });
    await expect(requireUser(event, "read")).resolves.toEqual(member);
  });

  it("limits a token to its scopes", async () => {
    await expect(requireUser(tokenFor(member, ["read"]), "read")).resolves.toEqual(member);
    await expect(requireUser(tokenFor(member, ["read"]), "audit:run")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("drops scopes the owner's role no longer allows", async () => {
    await expect(requireUser(tokenFor(admin, ["websites:write"]), "websites:write")).resolves.toEqual(admin);
    await expect(requireUser(tokenFor(member, ["websites:write"]), "websites:write")).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("session-only endpoints", () => {
  it("refuse API tokens, even an admin's", async () => {
    await expect(requireSessionUser(tokenFor(member, ["read"]))).rejects.toMatchObject({ statusCode: 403 });
    await expect(requireAdmin(tokenFor(admin, ["read", "audit:run", "websites:write"]))).rejects.toMatchObject({ statusCode: 403 });
  });

  it("still accept a browser session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(admin);
    await expect(requireAdmin(requestWith({ cookie: "wa_session=abc" }))).resolves.toEqual(admin);
  });
});
