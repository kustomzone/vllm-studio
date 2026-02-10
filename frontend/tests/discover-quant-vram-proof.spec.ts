// CRITICAL
import { test, expect } from "@playwright/test";

test("discover: shows VRAM-aware recommendations and quantization hide controls", async ({ page }, testInfo) => {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const origin = new URL(baseUrl).origin;
  const backendUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:8080";
  await page.context().addCookies([{
    name: "vllmstudio_backend_url",
    value: backendUrl,
    url: origin,
  }]);
  await page.addInitScript((url) => {
    window.localStorage.setItem("vllmstudio_backend_url", String(url));
  }, backendUrl);

  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "Discover Models" })).toBeVisible();

  await page.getByRole("button", { name: /filters/i }).click();
  await expect(page.getByText("Hide Quantization Tags")).toBeVisible();

  await page.getByRole("button", { name: "AWQ" }).click();
  await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();

  await expect(page.getByText("VRAM-aware Recommendations")).toBeVisible();

  const shotPath = testInfo.outputPath("proof-discover-vram-quant.png");
  await page.screenshot({ path: shotPath, fullPage: true });
});
