import { findUserByUsername } from "@website-auditor/db";

import { loginSchema } from "@website-auditor/shared";
import { createError, defineEventHandler } from "h3";

import { startSession } from "../../utils/auth.js";
import { verifyPassword } from "../../utils/security.js";
import { readValidatedBody } from "../../utils/validation.js";

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, loginSchema);
  const user = await findUserByUsername(body.username);

  if (!user || !user.isActive || !(await verifyPassword(body.password, user.passwordHash))) {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid credentials.",
    });
  }

  await startSession(event, user.id);

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
});
