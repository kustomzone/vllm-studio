// CRITICAL
import { test, expect } from "@playwright/test";

test("chat: call mode (STT->LLM->TTS loop) + per-message listen button", async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  // Make audio playback deterministic in headless: resolve play() and end quickly.
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto: any = (window as any).HTMLMediaElement?.prototype;
    if (!proto) return;
    proto.play = function () {
      window.setTimeout(() => {
        try {
          this.dispatchEvent(new Event("ended"));
        } catch {
          // ignore
        }
      }, 50);
      return Promise.resolve();
    };
  });

  await page.goto("/chat?new=1");

  // If setup wizard is shown, skip it.
  const skip = page.getByRole("button", { name: /skip for now/i });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.goto("/chat?new=1");
  }

  // Ensure a model is selected (composer may be disabled until then).
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

  // Turn on call mode (waveform icon).
  await page.getByTitle(/call mode/i).first().click();

  // Call mode starts recording immediately (E2E uses a fake mic).
  await expect(page.getByText("Recording").first()).toBeVisible();

  // Stop recording, which triggers STT + send.
  await page.getByRole("button", { name: "Stop" }).first().click();

  // Per-response listen button exists (assistant message rendered).
  await expect(page.getByRole("button", { name: /listen/i }).first()).toBeVisible({
    timeout: 60_000,
  });

  // After TTS finishes, call mode re-opens the mic.
  await expect(page.locator('button[title="Stop recording"]').first()).toHaveCount(1);

  const shotPath = testInfo.outputPath("proof-voice-call-mode.png");
  await page.screenshot({ path: shotPath, fullPage: true });
});
