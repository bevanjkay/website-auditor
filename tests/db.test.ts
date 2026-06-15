import { chunkRowsForInsert } from "@website-auditor/db";

import { describe, expect, it } from "vitest";

describe("chunkRowsForInsert", () => {
  it("returns no chunks for an empty input", () => {
    expect(chunkRowsForInsert([], 9)).toEqual([]);
  });

  it("keeps a small set in a single chunk", () => {
    const rows = Array.from({ length: 100 }, (_, index) => index);
    expect(chunkRowsForInsert(rows, 9)).toEqual([rows]);
  });

  it("splits so each chunk stays under the 65535 bind-parameter limit", () => {
    const columnsPerRow = 9;
    const rows = Array.from({ length: 20000 }, (_, index) => index);
    const chunks = chunkRowsForInsert(rows, columnsPerRow);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toEqual(rows);
    for (const chunk of chunks) {
      expect(chunk.length * columnsPerRow).toBeLessThanOrEqual(65535);
    }
  });

  it("never produces an empty chunk even with absurd column counts", () => {
    expect(chunkRowsForInsert([1, 2, 3], 1_000_000)).toEqual([[1], [2], [3]]);
  });
});
