// CRITICAL
import { test, expect } from "@playwright/test";

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X2F3cAAAAASUVORK5CYII=";

test("chat: image + video attachments flow (preview + send)", async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  await page.goto("/chat?new=1");

  // If setup wizard is shown, skip it.
  const skip = page.getByRole("button", { name: /skip for now/i });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.goto("/chat?new=1");
  }

  // Ensure a model is selected.
  const modelSelect = page.locator('select[title="Select model"]').first();
  if (await modelSelect.isVisible().catch(() => false)) {
    const chosen = await modelSelect.evaluate((el) => {
      const select = el as HTMLSelectElement;
      const options = Array.from(select.options);
      const candidate = options.find((o) => o.value && !o.disabled);
      return candidate?.value ?? null;
    });
    if (chosen) {
      await modelSelect.selectOption(chosen);
    }
  }

  // Attach an image (hidden input).
  const imageInput = page.locator('input[type="file"][accept="image/*"]').first();
  await imageInput.setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_1X1_BASE64, "base64"),
  });

  // Attach a video (hidden input).
  const videoInput = page.locator('input[type="file"][accept="video/*"]').first();
  await videoInput.setInputFiles({
    name: "clip.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from([0, 0, 0, 20, 102, 116, 121, 112]), // minimal stub; preview may not decode, but flow should work
  });

  await expect(page.getByText("pixel.png").first()).toBeVisible();
  await expect(page.getByText("clip.mp4").first()).toBeVisible();

  const composer = page.locator('textarea[placeholder="Message..."]:visible').first();
  await expect(composer).toBeVisible();
  await composer.fill("Please see attachments.");

  await page.locator('button[title="Send"]:visible').first().click();

  // Image should render inline for the user message (virtualization may mark it non-visible).
  const img = page.locator('img[alt="pixel.png"]').first();
  await expect(img).toHaveCount(1);
  await expect(img).toHaveAttribute("src", /data:image/);
  // Video is represented as placeholder text in the transcript.
  const videoCount = await page.getByText("[Video: clip.mp4]").count();
  expect(videoCount).toBeGreaterThan(0);

  const shotPath = testInfo.outputPath("proof-chat-attachments-image-video.png");
  await page.screenshot({ path: shotPath, fullPage: true });
});
