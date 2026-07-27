export type SharedResultV1 = {
  schemaVersion: 1;
  appVersion: string;
  modelVersion: string;
  dspVersion: string;
  createdAt?: string;
  summary?: { masculinity: number; femininity: number; brightness: number; stability: number };
  acoustic: {
    f0Median?: number;
    f0P05?: number;
    f0P95?: number;
    f1Median?: number;
    f2Median?: number;
    f3Median?: number;
    hnr?: number;
    cpp?: number;
    voicedRatio: number;
  };
  quality: { score: number; snr?: number; clippingRatio: number };
};

const MAX_FRAGMENT_LENGTH = 8_192;
const number = (value: number) => Math.round(value * 10) / 10;

function base64url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64url(value: string) {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function normalize(input: SharedResultV1): SharedResultV1 {
  return {
    schemaVersion: 1,
    appVersion: input.appVersion,
    modelVersion: input.modelVersion,
    dspVersion: input.dspVersion,
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    ...(input.summary
      ? {
          summary: Object.fromEntries(
            Object.entries(input.summary).map(([key, value]) => [key, Math.round(value)]),
          ) as NonNullable<SharedResultV1["summary"]>,
        }
      : {}),
    acoustic: Object.fromEntries(
      Object.entries(input.acoustic)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, number(value as number)]),
    ) as SharedResultV1["acoustic"],
    quality: Object.fromEntries(
      Object.entries(input.quality)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, number(value as number)]),
    ) as SharedResultV1["quality"],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function validate(value: unknown): value is SharedResultV1 {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.appVersion !== "string" ||
    typeof value.modelVersion !== "string" ||
    typeof value.dspVersion !== "string"
  )
    return false;
  if (!isRecord(value.acoustic) || !isRecord(value.quality)) return false;
  if (value.summary !== undefined && !isRecord(value.summary)) return false;
  return (
    [value.acoustic.voicedRatio, value.quality.score, value.quality.clippingRatio].every(validNumber) &&
    (value.summary === undefined ||
      [value.summary.masculinity, value.summary.femininity, value.summary.brightness, value.summary.stability].every(
        validNumber,
      ))
  );
}

export async function encodeSharedResult(input: SharedResultV1) {
  const json = new TextEncoder().encode(JSON.stringify(normalize(input)));
  const stream = new CompressionStream("deflate");
  const compressed = await new Response(new Blob([json]).stream().pipeThrough(stream)).arrayBuffer();
  const payload = base64url(new Uint8Array(compressed));
  if (payload.length > MAX_FRAGMENT_LENGTH) throw new Error("공유 결과가 링크 길이 제한을 초과했습니다.");
  return payload;
}

export async function decodeSharedResult(payload: string): Promise<SharedResultV1> {
  if (!payload || payload.length > MAX_FRAGMENT_LENGTH || !/^[A-Za-z0-9_-]+$/.test(payload))
    throw new Error("공유 링크 형식이 올바르지 않습니다.");
  try {
    const compressed = fromBase64url(payload);
    const stream = new DecompressionStream("deflate");
    const json = await new Response(new Blob([compressed]).stream().pipeThrough(stream)).text();
    const parsed: unknown = JSON.parse(json);
    if (!validate(parsed)) throw new Error("공유 결과의 버전 또는 필수 값이 올바르지 않습니다.");
    return normalize(parsed);
  } catch (error) {
    if (error instanceof Error && error.message.includes("필수 값")) throw error;
    throw new Error("공유 링크를 읽을 수 없습니다.");
  }
}
