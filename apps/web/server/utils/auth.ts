import type { SessionUser } from "@website-auditor/shared";

import { createSession, deleteSession, getSessionUser } from "@website-auditor/db";
import { createError, deleteCookie, getCookie, getHeader, setCookie } from "h3";

const sessionCookieName = "wa_session";
const sessionDurationMs = 1000 * 60 * 60 * 24 * 30;

export async function getSessionUserFromEvent(event: Parameters<typeof getCookie>[0]): Promise<SessionUser | null> {
  const sessionId = getCookie(event, sessionCookieName);
  if (!sessionId) {
    return null;
  }

  return getSessionUser(sessionId);
}

export async function requireUser(event: Parameters<typeof getCookie>[0]): Promise<SessionUser> {
  const user = await getSessionUserFromEvent(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required.",
    });
  }

  return user;
}

export async function requireAdmin(event: Parameters<typeof getCookie>[0]): Promise<SessionUser> {
  const user = await requireUser(event);

  if (user.role !== "admin") {
    throw createError({
      statusCode: 403,
      statusMessage: "Admin access required.",
    });
  }

  return user;
}

export async function startSession(event: Parameters<typeof getCookie>[0], userId: string) {
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  const session = await createSession(userId, expiresAt);
  const secureSetting = process.env.SESSION_COOKIE_SECURE?.toLowerCase();
  const forwardedProto = getHeader(event, "x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const requestSocket = event.node.req.socket as { encrypted?: boolean };
  const secure = secureSetting === "true"
    ? true
    : secureSetting === "false"
      ? false
      : forwardedProto === "https" || requestSocket.encrypted === true;

  setCookie(event, sessionCookieName, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    expires: expiresAt,
    path: "/",
  });
  return session;
}

export async function endSession(event: Parameters<typeof getCookie>[0]) {
  const sessionId = getCookie(event, sessionCookieName);
  if (sessionId) {
    await deleteSession(sessionId);
  }
  deleteCookie(event, sessionCookieName, { path: "/" });
}
