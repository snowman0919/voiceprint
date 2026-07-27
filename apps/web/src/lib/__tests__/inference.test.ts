import { describe, expect, it, vi } from "vitest";
import { createSessionWithFallback } from "../inference";

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
