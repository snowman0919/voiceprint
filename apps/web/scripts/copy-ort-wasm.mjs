// ponytail: copies onnxruntime-web WASM assets to public/ort/ so the static
// export can serve them at /ort/. 36MB — gitignored, regenerated on install.
// Upgrade path: Next.js bundler plugin for ORT if one becomes available.
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const dist = resolve(webRoot, "node_modules/onnxruntime-web/dist");
const dest = resolve(webRoot, "public/ort");

const files = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
];

await mkdir(dest, { recursive: true });
for (const file of files) {
  await copyFile(resolve(dist, file), resolve(dest, file));
  console.log(`ort: copied ${file}`);
}
