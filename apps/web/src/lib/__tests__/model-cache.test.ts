import { describe, expect, it } from "vitest";
import { allowsAutoDownload, validateManifest } from "../model-cache";

describe("model manifest validation", () => {
  it("rejects an artifact without a SHA-256 digest before any model download", () => {
    expect(
      validateManifest({
        schemaVersion: 1,
        activeModel: "v1",
        models: [{ id: "v1", version: "1", url: "/models/v1.onnx", size: 1, sha256: "not-a-hash" }],
      }),
    ).toBe(false);
  });

  it("rejects an active model without fixed local inference input metadata", () => {
    const model = { id: "v1", version: "1", url: "/models/v1.onnx", size: 1, sha256: "a".repeat(64) };
    expect(validateManifest({ schemaVersion: 1, activeModel: "v1", models: [model] })).toBe(false);
  });

  it("rejects a research baseline as the active user-report model", () => {
    const model = {
      id: "tis-intent-v1",
      version: "1",
      url: "/models/tis-intent-v1.onnx",
      size: 1,
      sha256: "a".repeat(64),
      inputSampleRate: 16000,
      inputSeconds: 4,
      opset: 18,
      quantization: "none",
      minimumAppVersion: "0.1.0",
      reportEligible: false,
    };
    expect(validateManifest({ schemaVersion: 1, activeModel: model.id, models: [model] })).toBe(false);
  });

  it("rejects an active report model without a release-evidence digest", () => {
    const model = {
      id: "v1",
      version: "1",
      url: "/models/v1.onnx",
      size: 1,
      sha256: "a".repeat(64),
      inputSampleRate: 16000,
      inputSeconds: 4,
      opset: 18,
      quantization: "none",
      minimumAppVersion: "0.1.0",
      reportEligible: true,
    };
    expect(validateManifest({ schemaVersion: 1, activeModel: model.id, models: [model] })).toBe(false);
  });
});

describe("model download policy", () => {
  it("does not spend a data-saver connection on a model download", () => {
    expect(allowsAutoDownload(true)).toBe(false);
    expect(allowsAutoDownload(false)).toBe(true);
  });
});
