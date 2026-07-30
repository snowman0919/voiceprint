import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const maxBodyBytes = 24 * 1024;
const retentionDays = Number(process.env.RESULT_RETENTION_DAYS ?? 365);
const opaqueId = () => randomBytes(24).toString("base64url");
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const opaqueValue = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(value);
const onlyKeys = (value, allowed) => Object.keys(value).every((key) => allowed.includes(key));
const metricProvenance = new Set([
  "direct_acoustic_measurement",
  "deterministic_derived_metric",
  "human_rated_model",
  "pseudo_labeled_model",
  "unsupported",
]);

function validResult(value) {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  if (
    !onlyKeys(value, [
      "schemaVersion",
      "appVersion",
      "modelVersion",
      "dspVersion",
      "createdAt",
      "summary",
      "acoustic",
      "quality",
      "details",
      "provenance",
    ])
  )
    return false;
  if (![value.appVersion, value.modelVersion, value.dspVersion].every((item) => typeof item === "string")) return false;
  if (
    !isRecord(value.acoustic) ||
    !onlyKeys(value.acoustic, [
      "f0Median",
      "f0P05",
      "f0P95",
      "f1Median",
      "f2Median",
      "f3Median",
      "hnr",
      "cpp",
      "voicedRatio",
    ])
  )
    return false;
  if (!isRecord(value.quality) || !onlyKeys(value.quality, ["score", "snr", "clippingRatio"])) return false;
  if (![value.acoustic.voicedRatio, value.quality.score, value.quality.clippingRatio].every(isFiniteNumber))
    return false;
  if (value.summary !== undefined) {
    if (!isRecord(value.summary)) return false;
    if (
      ![value.summary.masculinity, value.summary.femininity, value.summary.brightness, value.summary.stability].every(
        isFiniteNumber,
      )
    )
      return false;
  }
  if (
    value.provenance !== undefined &&
    (!isRecord(value.provenance) ||
      !onlyKeys(value.provenance, ["summary", "acoustic", "quality", "details"]) ||
      Object.keys(value.provenance).length !== 4 ||
      !Object.values(value.provenance).every((item) => metricProvenance.has(item)))
  )
    return false;
  if (
    value.details !== undefined &&
    (!isRecord(value.details) ||
      !onlyKeys(value.details, [
        "sampleRate",
        "durationSeconds",
        "effectiveVoiceSeconds",
        "f0Mean",
        "f0Stability",
        "f0SemitoneRange",
        "spectralCentroid",
        "spectralBandwidth",
        "spectralRolloff85",
        "spectralFlatness",
        "spectralSlope",
        "spectralFlux",
        "lowBandEnergyRatio",
        "midBandEnergyRatio",
        "highBandEnergyRatio",
        "pauseRatio",
        "volumeVariation",
        "zeroCrossingRate",
        "estimatedSnr",
        "formantSpacing",
        "estimatedVocalTractLength",
        "formantFrameSuccessRatio",
      ]) ||
      !Object.values(value.details).every((item) => item === undefined || isFiniteNumber(item)))
  )
    return false;
  return !JSON.stringify(value).includes("[");
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new Error("payload-too-large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid-json"));
      }
    });
    request.on("error", reject);
  });
}

function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function initialize(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_results (
      id TEXT PRIMARY KEY,
      recovery_id TEXT NOT NULL,
      share_token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      result_json TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS results_by_recovery ON analysis_results(recovery_id, created_at DESC);
  `);
}

function rowToResponse(row) {
  return { id: row.id, createdAt: row.created_at, result: JSON.parse(row.result_json) };
}

export function createResultsServer({ dbPath }) {
  const db = new DatabaseSync(dbPath);
  initialize(db);
  const insert = db.prepare(
    "INSERT INTO analysis_results (id, recovery_id, share_token, created_at, expires_at, result_json) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const purgeExpired = db.prepare("DELETE FROM analysis_results WHERE expires_at <= ?");
  const latestForRecovery = db.prepare(
    "SELECT id, created_at, result_json FROM analysis_results WHERE recovery_id = ? ORDER BY created_at DESC LIMIT 1",
  );
  const resultForRecovery = db.prepare(
    "SELECT id, created_at, result_json FROM analysis_results WHERE recovery_id = ? AND id = ? LIMIT 1",
  );
  const resultForShare = db.prepare(
    "SELECT id, created_at, result_json FROM analysis_results WHERE share_token = ? LIMIT 1",
  );
  const listForRecovery = db.prepare(
    "SELECT id, created_at, result_json FROM analysis_results WHERE recovery_id = ? ORDER BY created_at DESC LIMIT 20",
  );
  const deleteForRecovery = db.prepare("DELETE FROM analysis_results WHERE recovery_id = ? AND id = ?");

  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") return send(response, 200, { status: "ok" });
    if (request.method !== "POST") return send(response, 404, { error: "not-found" });
    try {
      purgeExpired.run(new Date().toISOString());
      const body = await readJson(request);
      if (!isRecord(body)) return send(response, 400, { error: "invalid-request" });
      if (request.url === "/results") {
        if (!opaqueValue(body.recoveryId) || !validResult(body.result))
          return send(response, 400, { error: "invalid-result" });
        const id = opaqueId();
        const shareToken = opaqueId();
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + retentionDays * 86_400_000).toISOString();
        insert.run(id, body.recoveryId, shareToken, createdAt, expiresAt, JSON.stringify(body.result));
        return send(response, 201, { id, shareToken, createdAt, expiresAt });
      }
      if (request.url === "/results/lookup") {
        if (!opaqueValue(body.recoveryId)) return send(response, 400, { error: "invalid-recovery-id" });
        const row =
          typeof body.resultId === "string"
            ? resultForRecovery.get(body.recoveryId, body.resultId)
            : latestForRecovery.get(body.recoveryId);
        return row ? send(response, 200, rowToResponse(row)) : send(response, 404, { error: "not-found" });
      }
      if (request.url === "/results/list") {
        if (!opaqueValue(body.recoveryId)) return send(response, 400, { error: "invalid-recovery-id" });
        return send(response, 200, { results: listForRecovery.all(body.recoveryId).map(rowToResponse) });
      }
      if (request.url === "/results/share") {
        if (!opaqueValue(body.shareToken)) return send(response, 400, { error: "invalid-share-token" });
        const row = resultForShare.get(body.shareToken);
        return row ? send(response, 200, rowToResponse(row)) : send(response, 404, { error: "not-found" });
      }
      if (request.url === "/results/delete") {
        if (!opaqueValue(body.recoveryId) || typeof body.resultId !== "string")
          return send(response, 400, { error: "invalid-request" });
        return send(response, deleteForRecovery.run(body.recoveryId, body.resultId).changes ? 204 : 404, {});
      }
      return send(response, 404, { error: "not-found" });
    } catch (error) {
      return send(response, error instanceof Error && error.message === "payload-too-large" ? 413 : 400, {
        error: "invalid-request",
      });
    }
  });
  return { close: () => db.close(), server };
}

if (import.meta.main) {
  const { server } = createResultsServer({ dbPath: process.env.RESULTS_DB_PATH ?? "/data/results.sqlite" });
  server.listen(Number(process.env.PORT ?? 8081), "0.0.0.0");
}
