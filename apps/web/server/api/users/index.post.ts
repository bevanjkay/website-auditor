import { createUser, findUserByUsername } from "@website-auditor/db";

import { createUserSchema } from "@website-auditor/shared";
import { createError, defineEventHandler } from "h3";

import { requireAdmin } from "../../utils/auth.js";
import { hashPassword } from "../../utils/security.js";
import { readValidatedBody } from "../../utils/validation.js";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = await readValidatedBody(event, createUserSchema);
  const existing = await findUserByUsername(body.username);

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: "Username already exists.",
    });
  }

  const user = await createUser({
    username: body.username,
    passwordHash: await hashPassword(body.password),
    role: body.role,
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
});
