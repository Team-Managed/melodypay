import { describe, expect, it } from "vitest";
import { splitLegacyPayload } from "../src/core/broadcaster";

describe("legacy audio chunking", () => {
  it("keeps every framed payload within the ggwave limit", () => {
    const payload = "x".repeat(600);
    const chunks = splitLegacyPayload(payload);

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.length <= 140)).toBe(true);
    expect(chunks.map((chunk) => chunk.replace(/^TX\d+\/\d+\|/, "")).join("")).toBe(payload);
  });
});
