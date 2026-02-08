// CRITICAL
import type {
  CompatibilityCheck,
  CompatibilityReport,
  CompatibilitySeverity,
  RuntimeRocmSmiTool,
  SystemRuntimeInfo,
} from "../types/models";
import { resolveBinary, runCommand } from "./command/command-utilities";

const toEvidence = (lines: Array<string | null | undefined>): string | null => {
  const filtered = lines.filter((line): line is string => Boolean(line && line.trim()));
  return filtered.length ? filtered.join("\n") : null;
};

const addCheck = (
  checks: CompatibilityCheck[],
  check: Omit<CompatibilityCheck, "severity"> & { severity: CompatibilitySeverity },
): void => {
  checks.push({
    id: check.id,
    severity: check.severity,
    message: check.message,
    evidence: check.evidence ?? null,
    suggested_fix: check.suggested_fix ?? null,
  });
};

export const probeGpuMonitoring = (
  kind: SystemRuntimeInfo["platform"]["kind"],
  rocmTool: RuntimeRocmSmiTool | null,
): { available: boolean; tool: "nvidia-smi" | RuntimeRocmSmiTool | null } => {
  if (kind === "cuda") {
    const binary = resolveBinary(process.env["NVIDIA_SMI_PATH"] || "nvidia-smi");
    if (!binary) return { available: false, tool: "nvidia-smi" };
    const result = runCommand(binary, ["--query-gpu=name", "--format=csv,noheader,nounits"], 2_000);
    return { available: result.status === 0, tool: "nvidia-smi" };
  }

  if (kind === "rocm") {
    const preferred = rocmTool ?? (resolveBinary(process.env["AMD_SMI_PATH"] || "amd-smi") ? "amd-smi" : null);
    if (preferred === "amd-smi") {
      const binary = resolveBinary(process.env["AMD_SMI_PATH"] || "amd-smi");
      if (!binary) return { available: false, tool: "amd-smi" };
      const result = runCommand(binary, ["version"], 2_000);
      return { available: result.status === 0, tool: "amd-smi" };
    }
    if (preferred === "rocm-smi") {
      const binary = resolveBinary(process.env["ROCM_SMI_PATH"] || "rocm-smi");
      if (!binary) return { available: false, tool: "rocm-smi" };
      const result = runCommand(binary, ["--showproductname"], 2_000);
      return { available: result.status === 0, tool: "rocm-smi" };
    }

    // No tool detected; try both.
    const amd = resolveBinary(process.env["AMD_SMI_PATH"] || "amd-smi");
    if (amd) {
      const result = runCommand(amd, ["version"], 2_000);
      if (result.status === 0) return { available: true, tool: "amd-smi" };
    }
    const rocm = resolveBinary(process.env["ROCM_SMI_PATH"] || "rocm-smi");
    if (rocm) {
      const result = runCommand(rocm, ["--showproductname"], 2_000);
      if (result.status === 0) return { available: true, tool: "rocm-smi" };
    }

    return { available: false, tool: null };
  }

  return { available: false, tool: null };
};

export const buildCompatibilityReport = (args: {
  runtime: SystemRuntimeInfo;
  inference_port: number;
  inference_port_open: boolean;
  inference_process_known: boolean;
  gpu_monitoring?: { available: boolean; tool: "nvidia-smi" | RuntimeRocmSmiTool | null };
}): CompatibilityReport => {
  const { runtime } = args;
  const checks: CompatibilityCheck[] = [];
  const gpuMonitoring =
    args.gpu_monitoring ??
    probeGpuMonitoring(runtime.platform.kind, runtime.platform.rocm?.smi_tool ?? null);

  if (runtime.gpus.count === 0) {
    addCheck(checks, {
      id: "gpu.none-detected",
      severity: "warn",
      message: "No GPUs detected by the controller.",
      evidence: toEvidence([`platform.kind=${runtime.platform.kind}`, `gpus.count=${runtime.gpus.count}`]),
      suggested_fix:
        runtime.platform.kind === "rocm"
          ? "Verify ROCm is installed and GPU tools are available (amd-smi/rocm-smi)."
          : runtime.platform.kind === "cuda"
            ? "Verify NVIDIA drivers are installed and nvidia-smi is accessible."
            : "Verify GPU drivers are installed and set VLLM_STUDIO_GPU_SMI_TOOL if needed.",
    });
  }

  if (runtime.platform.kind === "rocm" && !runtime.platform.torch.torch_hip) {
    addCheck(checks, {
      id: "torch.rocm-missing-hip",
      severity: "error",
      message: "ROCm platform detected, but PyTorch does not report HIP support (torch.version.hip is null).",
      evidence: toEvidence([
        `torch_version=${runtime.platform.torch.torch_version ?? "null"}`,
        `torch_hip=${runtime.platform.torch.torch_hip ?? "null"}`,
      ]),
      suggested_fix:
        "Install a ROCm-enabled PyTorch build that matches your ROCm version, and ensure the controller is using that Python environment.",
    });
  }

  if (runtime.platform.kind === "rocm" && !gpuMonitoring.available) {
    addCheck(checks, {
      id: "gpu-monitoring.rocm-unavailable",
      severity: "warn",
      message: "ROCm platform detected, but GPU monitoring tooling is not accessible.",
      evidence: toEvidence([`tool=${gpuMonitoring.tool ?? "null"}`]),
      suggested_fix:
        "Ensure `amd-smi` or `rocm-smi` is installed and on PATH, or set AMD_SMI_PATH/ROCM_SMI_PATH.",
    });
  }

  if (runtime.platform.kind === "cuda" && !gpuMonitoring.available) {
    addCheck(checks, {
      id: "gpu-monitoring.cuda-unavailable",
      severity: "warn",
      message: "CUDA platform detected, but nvidia-smi is not accessible (GPU telemetry may be unavailable).",
      evidence: toEvidence([`tool=${gpuMonitoring.tool ?? "nvidia-smi"}`]),
      suggested_fix:
        "Ensure NVIDIA drivers are installed and nvidia-smi is on PATH (snap-installed bun can block access).",
    });
  }

  if (runtime.backends.vllm.installed && !runtime.backends.vllm.binary_path) {
    addCheck(checks, {
      id: "vllm.binary-missing",
      severity: "warn",
      message: "vLLM is installed, but the `vllm` binary was not found on PATH.",
      evidence: toEvidence([
        `vllm_version=${runtime.backends.vllm.version ?? "null"}`,
        `python_path=${runtime.backends.vllm.python_path ?? "null"}`,
      ]),
      suggested_fix:
        "Activate the correct venv, or set `venv_path`/`python_path` in the recipe so the `vllm` entrypoint is resolvable.",
    });
  }

  if (args.inference_port_open && !args.inference_process_known) {
    addCheck(checks, {
      id: "inference.port-in-use",
      severity: "error",
      message: "Inference port is in use by an unknown process.",
      evidence: toEvidence([`inference_port=${args.inference_port}`]),
      suggested_fix:
        "Stop the process using the inference port, or change VLLM_STUDIO_INFERENCE_PORT to a free port.",
    });
  }

  if (!runtime.backends.vllm.installed && !runtime.backends.sglang.installed && !runtime.backends.llamacpp.installed) {
    addCheck(checks, {
      id: "backends.none-installed",
      severity: "info",
      message: "No inference runtime backends appear to be installed.",
      evidence: null,
      suggested_fix:
        "Install at least one backend runtime (vLLM, SGLang, or llama.cpp), then restart the controller.",
    });
  }

  return {
    platform: { kind: runtime.platform.kind },
    gpu_monitoring: gpuMonitoring,
    torch: runtime.platform.torch,
    backends: runtime.backends,
    checks,
  };
};
