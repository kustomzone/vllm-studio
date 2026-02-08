// CRITICAL
import { test, expect } from "@playwright/test";

test("dashboard: shows platform rocm chip from runtime_summary SSE", async ({ page }) => {
  await page.route("**/api/proxy/events**", async (route) => {
    const payload = {
      data: {
        platform: { kind: "rocm" },
        gpu_monitoring: { available: true, tool: "amd-smi" },
        backends: {
          vllm: { installed: true, version: "0.x" },
          sglang: { installed: false, version: null },
          llamacpp: { installed: false, version: null },
        },
      },
      timestamp: "2026-02-08T00:00:00.000Z",
    };
    const body = `event: runtime_summary\ndata: ${JSON.stringify(payload)}\n\n`;
    await route.fulfill({ status: 200, contentType: "text/event-stream", body });
  });

  await page.route("**/api/proxy/compat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        platform: { kind: "rocm" },
        gpu_monitoring: { available: true, tool: "amd-smi" },
        torch: { torch_version: "2.x", torch_cuda: null, torch_hip: "7.1.1" },
        backends: {
          vllm: { installed: true, version: "0.x" },
          sglang: { installed: false, version: null },
          llamacpp: { installed: false, version: null },
        },
        checks: [],
      }),
    });
  });

  await page.route("**/api/proxy/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", version: "test", inference_ready: false, backend_reachable: false, running_model: null }),
    });
  });

  await page.route("**/api/proxy/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ running: false, process: null, inference_port: 8000 }),
    });
  });

  await page.route("**/api/proxy/gpus", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ gpus: [], count: 0 }) });
  });

  await page.route("**/api/proxy/services", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ services: [], gpu_lease: null }),
    });
  });

  await page.route("**/api/proxy/recipes", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await page.route("**/api/proxy/logs/sessions", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sessions: [] }) });
  });

  await page.goto("/");
  await expect(page.getByText("platform: rocm")).toBeVisible();
});
