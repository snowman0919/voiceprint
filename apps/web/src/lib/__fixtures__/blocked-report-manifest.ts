/** Synthetic browser fixture: no real audio, annotation, score, or checkpoint. */
export const blockedResearchModel = {
  id: "synthetic-unlicensed-descriptor",
  version: "0",
  url: "/models/synthetic-unlicensed-descriptor.onnx",
  size: 1,
  sha256: "a".repeat(64),
  inputSampleRate: 16000,
  inputSeconds: 4,
  opset: 18,
  quantization: "none",
  minimumAppVersion: "0.1.0",
  reportEligible: false,
};
