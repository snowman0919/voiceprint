import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

function pcmWav(seconds = 30, sampleRate = 16_000) {
  const samples = sampleRate * seconds;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1)
    wav.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * index) / sampleRate) * 8_000), 44 + index * 2);
  return wav;
}

test("analysis persists scalar measurements but never uploads the selected recording", async ({ page }) => {
  const writes: string[] = [];
  const storedBodies: unknown[] = [];
  const external: string[] = [];
  const allowedOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").origin;
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
    if (new URL(request.url()).origin !== allowedOrigin) external.push(request.url());
  });
  await page.route("**/api/results", async (route) => {
    const body = route.request().postDataJSON();
    storedBodies.push(body);
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      body: JSON.stringify({
        id: "A".repeat(32),
        shareToken: "B".repeat(32),
        createdAt: "2026-07-30T00:00:00.000Z",
        expiresAt: "2027-07-30T00:00:00.000Z",
      }),
    });
  });

  await page.goto("/");
  const manifest = await (await page.request.get("/model-manifest.json")).json();
  const hasBundledTisModel = manifest.activeModel === "tis-intent-v1";
  if (hasBundledTisModel) await expect(page.getByText("분석 모델 준비 완료")).toBeVisible();
  await page.getByRole("link", { name: "분석 시작하기" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    buffer: pcmWav(),
    mimeType: "audio/wav",
    name: "standard-reading.wav",
  });
  await page.getByText("입력 측정값 자세히 보기").click();
  await page.getByText("파형과 주파수 보기").click();
  await expect(page.getByRole("img", { name: "입력 파형" })).toBeVisible();
  await expect(page.getByRole("img", { name: "로그 파워 스펙트로그램" })).toBeVisible();
  await expect(page.getByText("F0 중앙값")).toBeVisible();
  await expect(page.getByRole("img", { name: "F0 궤적" })).toBeVisible();
  await page.getByRole("button", { name: "분석 시작" }).click();
  await expect(page.getByRole("heading", { name: "측정된 음향 특징" })).toBeVisible();
  await expect(page.getByText("음성 특징 기반의 오락용 인상 지표입니다.")).toBeVisible();
  if (hasBundledTisModel) await expect(page.getByRole("heading", { name: "녹음 조건 모델" })).not.toBeVisible();
  await page.getByRole("button", { name: "공유 링크 복사" }).click();
  await expect(page.getByRole("link", { name: "공유 결과 열기" })).toBeVisible();
  expect(writes).toEqual([`POST ${new URL(page.url()).origin}/api/results`]);
  expect(storedBodies).toHaveLength(1);
  expect(JSON.stringify(storedBodies[0])).not.toMatch(/audio|pcm|waveform|spectrogram|contour/i);
  expect(external).toEqual([]);
});
