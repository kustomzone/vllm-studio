// CRITICAL
import { test, expect } from "@playwright/test";

test("configs: shows ROCm runtime fields + Rock-Em runtimes panel", async ({ page }) => {
  await page.route("**/api/proxy/events**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  });

  await page.route("**/api/proxy/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        config: {
          host: "0.0.0.0",
          port: 8080,
          inference_port: 8000,
          api_key_configured: false,
          models_dir: "/models",
          data_dir: "/data",
          db_path: "/data/controller.db",
          sglang_python: null,
          tabby_api_dir: null,
          llama_bin: null,
        },
        services: [],
        environment: {
          controller_url: "http://localhost:8080",
          inference_url: "http://localhost:8000",
          litellm_url: "http://localhost:4100",
          frontend_url: "http://localhost:3000",
        },
        runtime: {
          platform: {
            kind: "rocm",
            vendor: "amd",
            rocm: {
              rocm_version: "7.1.1",
              hip_version: "7.1.1",
              smi_tool: "amd-smi",
              gpu_arch: ["gfx942"],
            },
            torch: {
              torch_version: "2.x",
              torch_cuda: null,
              torch_hip: "7.1.1",
            },
          },
          cuda: { driver_version: null, cuda_version: null },
          gpus: { count: 1, types: ["AMD Instinct MI300X"] },
          backends: {
            vllm: { installed: true, version: "0.x" },
            sglang: { installed: false, version: null },
            llamacpp: { installed: false, version: null },
          },
        },
      }),
    });
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
        checks: [
          {
            id: "torch_missing",
            severity: "error",
            message: "PyTorch not installed",
            evidence: "python -c 'import torch' failed",
            suggested_fix: "Install a ROCm-enabled PyTorch build.",
          },
          {
            id: "rocm_version_mismatch",
            severity: "warn",
            message: "ROCm runtime and torch HIP version mismatch",
            evidence: "rocm: 7.1.1 torch_hip: 7.0.0",
            suggested_fix: "Align ROCm and torch builds (e.g. reinstall torch or upgrade ROCm).",
          },
          {
            id: "gpu_monitoring",
            severity: "info",
            message: "GPU monitoring available",
            evidence: "amd-smi",
            suggested_fix: null,
          },
        ],
      }),
    });
  });

  await page.route("**/api/proxy/services", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        gpu_lease: { holder_service_id: "llm", acquired_at: "2026-02-08T00:00:00.000Z", reason: "llm running" },
        services: [
          {
            id: "llm",
            kind: "openai-compatible",
            runtime: "vllm",
            port: 8000,
            pid: 123,
            status: "running",
            version: "0.x",
            last_error: null,
            started_at: "2026-02-08T00:00:00.000Z",
            updated_at: "2026-02-08T00:00:00.000Z",
          },
          {
            id: "stt",
            kind: "cli-integration",
            runtime: "whisper.cpp",
            port: null,
            pid: null,
            status: "stopped",
            version: null,
            last_error: null,
            started_at: null,
            updated_at: "2026-02-08T00:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.goto("/configs");

  await expect(page.getByText("ROCm Version")).toBeVisible();
  await expect(page.getByText("7.1.1").first()).toBeVisible();
  await expect(page.getByText("Runtimes (Rock-Em)")).toBeVisible();
  await expect(page.getByText(/gpu lease: llm/i)).toBeVisible();

  // Compatibility panel must render errors/warnings deterministically from /compat.
  await expect(page.getByText("Compatibility")).toBeVisible();
  await expect(page.getByText("Errors")).toBeVisible();
  await expect(page.getByText("PyTorch not installed")).toBeVisible();
  await expect(page.getByText("Warnings")).toBeVisible();
  await expect(page.getByText("ROCm runtime and torch HIP version mismatch")).toBeVisible();
});
