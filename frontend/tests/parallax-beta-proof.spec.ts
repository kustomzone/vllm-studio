// CRITICAL
import { test, expect } from "@playwright/test";

test("beta: parallax module (create share link + open installer page)", async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  await page.addInitScript(() => {
    window.localStorage.setItem("vllm-studio.feature.parallax", "1");
  });

  await page.goto("/beta");
  await expect(page.getByText("Parallax (Model Sharing)")).toBeVisible();

  await page.getByRole("link", { name: "Open" }).click();
  await expect(page.getByText("Parallax (Beta)")).toBeVisible();

  await page.getByRole("button", { name: "Create Share Link" }).click();
  await expect(page.getByText(/Share link created/i)).toBeVisible();

  const shareUrlInput = page.locator('div:has-text("Share URL")').locator('input[readonly]').first();
  const shareUrl = await shareUrlInput.inputValue();
  expect(shareUrl).toContain("/beta/parallax/share?p=");

  await page.goto(shareUrl);
  await expect(page.getByText("Install From Share Link")).toBeVisible();
  await expect(page.getByText(/^Model:/)).toBeVisible();

  const shotPath = testInfo.outputPath("proof-parallax-beta.png");
  await page.screenshot({ path: shotPath, fullPage: true });
});
