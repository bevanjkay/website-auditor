import type { ZodSchema } from "zod";
import { createError, readBody } from "h3";

export async function readValidatedBody<T>(event: Parameters<typeof readBody>[0], schema: ZodSchema<T>): Promise<T> {
  const body = await readBody(event);
  const result = schema.safeParse(body);

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed.",
      data: result.error.flatten(),
    });
  }

  return result.data;
}
