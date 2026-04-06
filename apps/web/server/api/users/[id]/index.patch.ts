import { updateUser } from "@website-auditor/db";

import { updateUserSchema } from "@website-auditor/shared";
import { createError, defineEventHandler, getRouterParam } from "h3";

import { requireAdmin } from "../../../utils/auth.js";
import { readValidatedBody } from "../../../utils/validation.js";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const id = getRouterParam(event, "id");
  const body = await readValidatedBody(event, updateUserSchema);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "User id is required." });
  }

  const user = await updateUser(id, body);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found." });
  }

  return { user };
});
