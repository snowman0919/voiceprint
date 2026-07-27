import { expect, test } from "@playwright/test";
import path from "node:path";

test("local file analysis sends no audio or result data over the network", async ({ page }) => {
  const writes: string[] = [];
  const external: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
    if (new URL(request.url()).origin !== "http://localhost:3000") external.push(request.url());
  });

  await page.goto("/");
  const manifest = await (await page.request.get("/model-manifest.json")).json();
  const hasBundledTisModel = manifest.activeModel === "tis-intent-v1";
  if (hasBundledTisModel) await expect(page.getByText("분석 모델 준비 완료")).toBeVisible();
  await page.getByRole("link", { name: "분석 시작하기" }).click();
  await page.locator('input[type="file"]').setInputFiles(path.resolve("../../fixtures/audio/sine-220.wav"));
  await expect(page.getByRole("img", { name: "입력 파형" })).toBeVisible();
  await expect(page.getByRole("img", { name: "로그 파워 스펙트로그램" })).toBeVisible();
  await expect(page.getByText("F0 중앙값")).toBeVisible();
  await expect(page.getByRole("img", { name: "F0 궤적" })).toBeVisible();
  await page.getByRole("button", { name: "분석 시작" }).click();
  await expect(page.getByRole("heading", { name: "측정된 음향 특징" })).toBeVisible();
  await expect(page.getByText("음성 특징 기반의 오락용 인상 지표입니다.")).toBeVisible();
  if (hasBundledTisModel) await expect(page.getByRole("heading", { name: "녹음 조건 모델" })).toBeVisible();
  await page.getByRole("button", { name: "공유 링크 복사" }).click();
  await expect(page.getByRole("link", { name: "공유 결과 열기" })).toBeVisible();
  expect(writes).toEqual([]);
  expect(external).toEqual([]);
});
