import { readdir, rm, stat, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

const output = new URL("../out/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("model-manifest.json", output), "utf8"));
const allowed = new Set(
  manifest.models.map((model) => {
    if (typeof model.url !== "string" || !model.url.startsWith("/models/"))
      throw new Error("model manifest contains an invalid model URL");
    return basename(model.url);
  }),
);
const models = new URL("models/", output);

for (const name of await readdir(models).catch(() => [])) {
  if (!allowed.has(name)) await rm(new URL(name, models));
}
for (const name of allowed) {
  if (!(await stat(new URL(name, models)).catch(() => undefined))?.isFile())
    throw new Error(`active model is missing from static export: ${name}`);
}
