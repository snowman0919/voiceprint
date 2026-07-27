import { describe, expect, it, vi } from "vitest";
import {
  createSessionWithFallback,
  normalizeTendencyOutput,
  normalizeTisIntentOutput,
  resampleModelWindow,
} from "../inference";

describe("createSessionWithFallback", () => {
  it("uses local WASM only when WebGPU session creation fails", async () => {
    const create = vi.fn(async (backend: "webgpu" | "wasm") => {
      if (backend === "webgpu") throw new Error("GPU unavailable");
      return "wasm-session";
    });

    await expect(createSessionWithFallback(create)).resolves.toEqual({ backend: "wasm", session: "wasm-session" });
    expect(create).toHaveBeenNthCalledWith(1, "webgpu");
    expect(create).toHaveBeenNthCalledWith(2, "wasm");
  });
});

describe("TIS inference contract", () => {
  it("keeps an input window's endpoints when converting its sample rate", () => {
    expect(Array.from(resampleModelWindow(new Float32Array([0, 1, 2, 3]), 4, 2, 2, 0))).toEqual([0, 2, 0, 0]);
  });

  it("rejects a non-probability TIS model score", () => {
    expect(() => normalizeTisIntentOutput([1.01])).toThrow("출력 범위");
    expect(normalizeTisIntentOutput([0.496])).toEqual({ score: 50 });
  });
});

describe("normalizeTendencyOutput", () => {
  it("rejects outputs outside the model's sigmoid tendency contract", () => {
    expect(() => normalizeTendencyOutput([0.2, 1.1, 0.5, 0.6])).toThrow("출력 범위");
    expect(normalizeTendencyOutput([0.2, 0.4, 0.6, 0.8])).toEqual({
      impression: 20,
      brightness: 40,
      softness: 60,
      stability: 80,
    });
  });
});
