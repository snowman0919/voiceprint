import { afterEach, describe, expect, it, vi } from "vitest";
import { blockedResearchModel } from "../__fixtures__/blocked-report-manifest";
import { allowsAutoDownload, cachedModel, downloadAndVerify, validateManifest } from "../model-cache";

afterEach(() => vi.unstubAllGlobals());

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

  it("keeps a synthetic unlicensed descriptor out of browser report inference", () => {
    expect(
      validateManifest({ schemaVersion: 1, activeModel: blockedResearchModel.id, models: [blockedResearchModel] }),
    ).toBe(false);
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

  it("fails clearly when Cache Storage is unavailable instead of referencing caches", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(cachedModel(blockedResearchModel)).rejects.toThrow("Cache Storage");
  });

  it("fails before download when Web Crypto is unavailable instead of reading subtle.digest", async () => {
    vi.stubGlobal("caches", { open: vi.fn(), delete: vi.fn() });
    vi.stubGlobal("crypto", undefined);
    await expect(downloadAndVerify(blockedResearchModel, vi.fn())).rejects.toThrow("Web Crypto");
  });
});
