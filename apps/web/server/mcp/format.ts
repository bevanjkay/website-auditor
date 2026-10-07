const maxStringLength = 300;
const maxArrayItems = 10;
const maxEvidenceDepth = 3;

export const severityRank: Record<string, number> = { error: 0, warning: 1, info: 2 };

export function truncate(value: string, maxLength = maxStringLength): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

// Evidence comes straight from crawled pages, so cap it before it reaches a model's context.
export function compactEvidence(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return truncate(value);
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, maxArrayItems).map(item => compactEvidence(item, depth + 1));
    return value.length > maxArrayItems ? [...items, `…and ${value.length - maxArrayItems} more`] : items;
  }
  if (value && typeof value === "object") {
    if (depth >= maxEvidenceDepth) {
      return "…";
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, compactEvidence(entry, depth + 1)]));
  }
  return value;
}

export function paginate<T>(items: T[], offset: number, limit: number) {
  const nextOffset = offset + limit;
  return {
    total: items.length,
    offset,
    nextOffset: nextOffset < items.length ? nextOffset : null,
    items: items.slice(offset, nextOffset),
  };
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]!);
    }
  }));
  return results;
}

interface ApiErrorShape {
  statusCode?: number;
  statusMessage?: string;
  message?: string;
  data?: { statusMessage?: string; message?: string; data?: Record<string, unknown> };
}

export function describeApiError(error: unknown): string {
  const shape = (error ?? {}) as ApiErrorShape;
  const message = shape.data?.statusMessage || shape.data?.message || shape.statusMessage || shape.message || "The request failed.";
  return shape.statusCode ? `${shape.statusCode}: ${message}` : message;
}

export function apiErrorData(error: unknown): Record<string, unknown> {
  return (error as ApiErrorShape | undefined)?.data?.data ?? {};
}
