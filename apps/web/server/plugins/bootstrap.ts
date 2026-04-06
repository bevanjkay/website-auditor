import { createUser, hasAdminUser } from "@website-auditor/db";

import { hashPassword } from "../utils/security.js";

export default defineNitroPlugin(async () => {
  const adminExists = await hasAdminUser();
  if (adminExists) {
    return;
  }

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required to bootstrap the first admin user.");
  }

  await createUser({
    username,
    passwordHash: await hashPassword(password),
    role: "admin",
  });
});
