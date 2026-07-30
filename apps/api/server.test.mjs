import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createResultsServer } from "./server.mjs";

const recoveryId = "Q".repeat(32);
const result = {
  schemaVersion: 1,
  appVersion: "test",
  modelVersion: "not-deployed",
  dspVersion: "test",
  acoustic: { f0Median: 180, voicedRatio: 0.7 },
  quality: { score: 90, clippingRatio: 0.001 },
  provenance: {
    summary: "deterministic_derived_metric",
    acoustic: "direct_acoustic_measurement",
    quality: "deterministic_derived_metric",
    details: "direct_acoustic_measurement",
  },
};

test("stores scalar results without accepting recordings and gates retrieval by recovery or share secret", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "voiceprint-results-"));
  const { server, close } = createResultsServer({ dbPath: path.join(directory, "results.sqlite") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const created = await fetch(`${origin}/results`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recoveryId, result }),
    });
    assert.equal(created.status, 201);
    const saved = await created.json();
    assert.match(saved.id, /^[A-Za-z0-9_-]{32}$/);
    assert.match(saved.shareToken, /^[A-Za-z0-9_-]{32}$/);

    const own = await fetch(`${origin}/results/lookup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recoveryId, resultId: saved.id }),
    });
    assert.deepEqual((await own.json()).result, result);

    const shared = await fetch(`${origin}/results/share`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shareToken: saved.shareToken }),
    });
    assert.deepEqual((await shared.json()).result, result);

    const listed = await fetch(`${origin}/results/list`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recoveryId }),
    });
    const listedBody = await listed.json();
    assert.equal(listedBody.results.length, 1);
    assert.equal(listedBody.results[0].id, saved.id);

    const blocked = await fetch(`${origin}/results`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recoveryId, result: { ...result, recording: "audio-bytes" } }),
    });
    assert.equal(blocked.status, 400);

    const invalidProvenance = await fetch(`${origin}/results`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recoveryId, result: { ...result, provenance: { summary: "not-a-provenance" } } }),
    });
    assert.equal(invalidProvenance.status, 400);

    const deleted = await fetch(`${origin}/results/delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recoveryId, resultId: saved.id }),
    });
    assert.equal(deleted.status, 204);
    const missing = await fetch(`${origin}/results/lookup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recoveryId, resultId: saved.id }),
    });
    assert.equal(missing.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    close();
    await rm(directory, { force: true, recursive: true });
  }
});
