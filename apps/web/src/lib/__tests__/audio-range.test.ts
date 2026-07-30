import { describe, expect, it } from "vitest";
import { normalizeRange } from "../audio-range";

describe("normalizeRange", () => {
  it("keeps a user-selected long-file range within the local 30–60 second recording contract", () => {
    expect(normalizeRange(90, 80, 60)).toEqual({ start: 30, length: 60 });
    expect(normalizeRange(90, -5, 3)).toEqual({ start: 0, length: 30 });
  });
});
