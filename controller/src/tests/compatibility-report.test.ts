// CRITICAL
import { describe, expect, it } from "bun:test";
import { buildCompatibilityReport } from "../services/compatibility-report";
import type { SystemRuntimeInfo } from "../types/models";

const baseRuntime = (overrides: Partial<SystemRuntimeInfo>): SystemRuntimeInfo => ({
  platform: {
    kind: "unknown",
    vendor: null,
    rocm: null,
    torch: { torch_version: null, torch_cuda: null, torch_hip: null },
  },
  cuda: { driver_version: null, cuda_version: null },
  gpus: { count: 0, types: [] },
  backends: {
    vllm: { installed: false, version: null, python_path: null, binary_path: null },
    sglang: { installed: false, version: null, python_path: null, binary_path: null },
    llamacpp: { installed: false, version: null, python_path: null, binary_path: null },
  },
  ...overrides,
});

describe("compatibility report checks", () => {
  it("flags missing torch HIP on ROCm", () => {
    const report = buildCompatibilityReport({
      runtime: baseRuntime({
        platform: {
          kind: "rocm",
          vendor: "amd",
          rocm: { rocm_version: "7.1.1", hip_version: "7.1.1", smi_tool: "amd-smi", gpu_arch: ["gfx942"] },
          torch: { torch_version: "2.6.0", torch_cuda: null, torch_hip: null },
        },
        gpus: { count: 1, types: ["AMD Instinct MI300X"] },
      }),
      inference_port: 8000,
      inference_port_open: false,
      inference_process_known: false,
      gpu_monitoring: { available: true, tool: "amd-smi" },
    });

    expect(report.checks.some((c) => c.id === "torch.rocm-missing-hip" && c.severity === "error")).toBe(true);
  });

  it("flags inference port in use by unknown process", () => {
    const report = buildCompatibilityReport({
      runtime: baseRuntime({ platform: { ...baseRuntime({}).platform, kind: "cuda", vendor: "nvidia" } }),
      inference_port: 8000,
      inference_port_open: true,
      inference_process_known: false,
      gpu_monitoring: { available: true, tool: "nvidia-smi" },
    });
    expect(report.checks.some((c) => c.id === "inference.port-in-use" && c.severity === "error")).toBe(true);
  });

  it("flags vLLM installed but binary missing", () => {
    const report = buildCompatibilityReport({
      runtime: baseRuntime({
        backends: {
          ...baseRuntime({}).backends,
          vllm: { installed: true, version: "0.6.0", python_path: "/usr/bin/python3", binary_path: null },
        },
      }),
      inference_port: 8000,
      inference_port_open: false,
      inference_process_known: false,
      gpu_monitoring: { available: false, tool: null },
    });
    expect(report.checks.some((c) => c.id === "vllm.binary-missing" && c.severity === "warn")).toBe(true);
  });

  it("emits an info check when no backends are installed", () => {
    const report = buildCompatibilityReport({
      runtime: baseRuntime({}),
      inference_port: 8000,
      inference_port_open: false,
      inference_process_known: false,
      gpu_monitoring: { available: false, tool: null },
    });
    expect(report.checks.some((c) => c.id === "backends.none-installed" && c.severity === "info")).toBe(true);
  });
});

