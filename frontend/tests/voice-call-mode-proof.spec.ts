// CRITICAL
import { test, expect } from "@playwright/test";

test("chat: call mode (STT->LLM->TTS loop) + per-message listen button", async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  await page.setViewportSize({ width: 1280, height: 800 });

  // Make audio playback deterministic in headless: resolve play() and end quickly.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vllm-studio-e2e-fake-mic", "1");
    } catch {
      // ignore
    }

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

  // Turn on call mode (waveform icon).
  const callMode = page.getByRole("button", { name: /call mode/i }).first();
  await expect(callMode).toBeEnabled({ timeout: 60_000 });
  await callMode.click();

  // Call mode starts recording immediately (E2E uses a fake mic).
  const recording = page.locator('[data-testid="recording-indicator"]:visible');
  const recordingStop = page.locator('[data-testid="recording-stop"]:visible');
  await expect(recording).toBeVisible();

  // Stop recording (Recording indicator Stop button), which triggers STT + send.
  await recordingStop.click();

  // User message (E2E transcript) appears.
  const userTranscript = page.locator("div.hidden.md\\:flex.justify-end div", {
    hasText: "Hello from voice call mode.",
  });
  await expect(userTranscript.first()).toBeVisible({ timeout: 60_000 });

  // Per-response listen button exists (assistant message rendered).
  await expect(page.getByRole("button", { name: /listen/i }).first()).toBeVisible({
    timeout: 60_000,
  });

  // After TTS finishes, call mode re-opens the mic.
  await expect(recording).toBeVisible({ timeout: 60_000 });

  const shotPath = testInfo.outputPath("proof-voice-call-mode.png");
  await page.screenshot({ path: shotPath, fullPage: true });
});
