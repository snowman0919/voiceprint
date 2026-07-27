import { describe, expect, it } from "vitest";
import { validateManifest } from "../model-cache";

describe("model manifest validation", () => {
  it("rejects an artifact without a SHA-256 digest before any model download", () => {
    expect(validateManifest({ schemaVersion: 1, activeModel: "v1", models: [{ id: "v1", version: "1", url: "/models/v1.onnx", size: 1, sha256: "not-a-hash" }] })).toBe(false);
  });
});
