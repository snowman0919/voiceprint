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
  await page.locator('input[type="file"]').setInputFiles(path.resolve("../../fixtures/audio/sine-220.wav"));
  await expect(page.getByRole("img", { name: "입력 파형" })).toBeVisible();
  await expect(page.getByText("F0 중앙값")).toBeVisible();
  await page.getByRole("button", { name: "분석 시작" }).click();
  await expect(page.getByRole("heading", { name: "측정된 음향 특징" })).toBeVisible();
  expect(writes).toEqual([]);
  expect(external).toEqual([]);
});
