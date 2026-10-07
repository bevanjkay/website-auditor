import type { ApiTokenScope, SessionUser } from "@website-auditor/shared";

import { createSession, deleteSession, getApiTokenUser, getSessionUser } from "@website-auditor/db";
import { apiTokenScopesForRole } from "@website-auditor/shared";
import { createError, deleteCookie, getCookie, getHeader, setCookie } from "h3";

import { hashApiToken, isApiTokenFormat, parseBearerToken } from "./security.js";

const sessionCookieName = "wa_session";
const sessionDurationMs = 1000 * 60 * 60 * 24 * 30;

export async function getSessionUserFromEvent(event: Parameters<typeof getCookie>[0]): Promise<SessionUser | null> {
  const sessionId = getCookie(event, sessionCookieName);
  if (!sessionId) {
    return null;
  }

  return getSessionUser(sessionId);
}

type RequestAuth
  = | { kind: "session"; user: SessionUser }
    | { kind: "token"; user: SessionUser; scopes: ApiTokenScope[] };

// A bearer token never falls back to the session cookie, so a bad token fails rather than riding a browser
// session. Other schemes are ignored because a reverse proxy in front of the app may forward its own Basic auth.
async function authenticate(event: Parameters<typeof getCookie>[0]): Promise<RequestAuth> {
  const bearer = parseBearerToken(getHeader(event, "authorization"));
  if (bearer !== null) {
    const record = isApiTokenFormat(bearer) ? await getApiTokenUser(hashApiToken(bearer)) : null;
    if (!record) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid, expired or revoked API token.",
      });
    }

    const allowedScopes = apiTokenScopesForRole(record.user.role);
    return { kind: "token", user: record.user, scopes: record.scopes.filter(scope => allowedScopes.includes(scope)) };
  }

  const user = await getSessionUserFromEvent(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required.",
    });
  }

  return { kind: "session", user };
}

export async function requireUser(event: Parameters<typeof getCookie>[0], scope: ApiTokenScope): Promise<SessionUser> {
  const auth = await authenticate(event);

  if (auth.kind === "token" && !auth.scopes.includes(scope)) {
    throw createError({
      statusCode: 403,
      statusMessage: `This API token is missing the ${scope} scope.`,
    });
  }

  return auth.user;
}

export async function requireSessionUser(event: Parameters<typeof getCookie>[0]): Promise<SessionUser> {
  const auth = await authenticate(event);

  if (auth.kind === "token") {
    throw createError({
      statusCode: 403,
      statusMessage: "API tokens can't use this endpoint. Sign in to the web app instead.",
    });
  }

  return auth.user;
}

export async function requireAdmin(event: Parameters<typeof getCookie>[0]): Promise<SessionUser> {
  const user = await requireSessionUser(event);

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
