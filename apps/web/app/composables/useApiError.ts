interface ApiErrorShape {
  data?: {
    statusMessage?: string;
    message?: string;
    data?: {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    };
  };
  statusMessage?: string;
  statusCode?: number;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const shape = (error ?? {}) as ApiErrorShape;
  const fieldErrors = Object.entries(shape.data?.data?.fieldErrors ?? {})
    .flatMap(([field, messages]) => (messages ?? []).map(message => `${field}: ${message}`));
  const formErrors = shape.data?.data?.formErrors ?? [];

  if (fieldErrors.length || formErrors.length) {
    return [...formErrors, ...fieldErrors].join(" ");
  }

  if (shape.statusCode === 401) {
    return "Your session has expired. Sign in again to continue.";
  }

  return shape.data?.statusMessage || shape.data?.message || shape.statusMessage || fallback;
}
