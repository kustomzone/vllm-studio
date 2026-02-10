// CRITICAL
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const COOKIE_ORIGIN = new URL(BASE_URL).origin;
const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:8080";

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

  // Point the UI at the live backend under test.
  await page.context().addCookies([{
    name: "vllmstudio_backend_url",
    value: BACKEND_URL,
    url: COOKIE_ORIGIN,
  }]);
  await page.addInitScript((url) => {
    window.localStorage.setItem("vllmstudio_backend_url", String(url));
  }, BACKEND_URL);

  await page.goto("/chat?new=1");

  // If setup wizard is shown, skip it.
  const skip = page.getByRole("button", { name: /skip for now/i });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.goto("/chat?new=1");
  }

  // Ensure a model is selected (call mode is disabled until then).
  const modelSelect = page.getByRole("combobox", { name: /select model/i }).first();
  await expect(modelSelect).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => {
    return await modelSelect.evaluate((el) => (el as HTMLSelectElement).options.length);
  }).toBeGreaterThan(0);
  // Prefer whatever model is currently active on the backend (avoids long recipe switches).
  let activeModelId = "";
  try {
    const res = await fetch(`${BACKEND_URL.replace(/\/+$/, "")}/v1/models`);
    const json = (await res.json()) as { data?: Array<{ id?: string; active?: boolean }> };
    activeModelId = String(json?.data?.find((m) => m && m.active)?.id ?? "");
  } catch {
    activeModelId = "";
  }

  const chosen = await modelSelect.evaluate((el, active) => {
    const select = el as HTMLSelectElement;
    const options = Array.from(select.options);
    const values = new Set(options.map((o) => o.value).filter(Boolean));
    const current = select.value || "";
    if (active && values.has(active)) return active;
    if (current && values.has(current)) return current;
    const candidate = options.find((o) => o.value && !o.disabled);
    return candidate?.value ?? "";
  }, activeModelId);

  if (chosen) await modelSelect.selectOption(chosen);
  await expect.poll(async () => await modelSelect.inputValue()).not.toBe("");

  // Turn on call mode (waveform icon).
  const callMode = page.getByRole("button", { name: /call mode/i }).first();
  await expect(callMode).toBeEnabled({ timeout: 60_000 });
  await callMode.click();

  // Call mode starts recording immediately (E2E uses a fake mic).
  const recording = page.locator('[data-testid="recording-indicator"]:visible');
  await expect(recording).toBeVisible();

  // Hands-free behavior: stop automatically (silence detector / E2E auto-stop),
  // which triggers STT + send without the user clicking "Stop".
  await expect(recording).toBeHidden({ timeout: 15_000 });

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
