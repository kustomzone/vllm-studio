// CRITICAL
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "../config/env";
import type {
  RuntimeBackendInfo,
  RuntimeCudaInfo,
  RuntimePlatformInfo,
  RuntimePlatformKind,
  RuntimeRocmInfo,
  RuntimeRocmSmiTool,
  RuntimeTorchBuildInfo,
  SystemRuntimeInfo,
} from "../types/models";
import { getGpuInfo } from "./gpu";
import { getVllmRuntimeInfo } from "./vllm-runtime";
import { resolveBinary, runCommand } from "./command/command-utilities";

const extractCudaVersion = (output: string): string | null => {
  const match = output.match(/CUDA Version\s*:\s*([0-9.]+)/i);
  if (match) {
    return match[1] ?? null;
  }
  return null;
};

const extractNvccVersion = (output: string): string | null => {
  const match = output.match(/release\s+([0-9.]+)/i);
  if (match) {
    return match[1] ?? null;
  }
  return null;
};

export const getCudaInfo = (): RuntimeCudaInfo => {
  const nvidiaSmi = process.env["NVIDIA_SMI_PATH"] || "nvidia-smi";
  let driverVersion: string | null = null;
  let cudaVersion: string | null = null;

  const driverResult = runCommand(nvidiaSmi, ["--query-gpu=driver_version", "--format=csv,noheader,nounits"]);
  if (driverResult.status === 0 && driverResult.stdout) {
    driverVersion = driverResult.stdout.split("\n")[0]?.trim() || null;
  }

  const smiResult = runCommand(nvidiaSmi, []);
  if (smiResult.status === 0) {
    cudaVersion = extractCudaVersion(smiResult.stdout) ?? extractCudaVersion(smiResult.stderr);
  }

  if (!cudaVersion) {
    const nvccResult = runCommand("nvcc", ["--version"]);
    if (nvccResult.status === 0) {
      cudaVersion = extractNvccVersion(nvccResult.stdout) ?? extractNvccVersion(nvccResult.stderr);
    }
  }

  return {
    driver_version: driverVersion,
    cuda_version: cudaVersion,
  };
};

const parseHipccVersion = (output: string): string | null => {
  const match = output.match(/HIP version\s*:\s*([0-9.]+)/i);
  if (match) return match[1] ?? null;
  return null;
};

const getTorchBuildInfo = (python: string): RuntimeTorchBuildInfo => {
  const result = runCommand(python, [
    "-c",
    "import json\ntry:\n import torch\n print(json.dumps({'torch_version': getattr(torch, '__version__', None), 'torch_cuda': getattr(getattr(torch, 'version', None), 'cuda', None), 'torch_hip': getattr(getattr(torch, 'version', None), 'hip', None)}))\nexcept Exception:\n print(json.dumps({'torch_version': None, 'torch_cuda': None, 'torch_hip': None}))",
  ]);

  if (result.status !== 0) {
    return { torch_version: null, torch_cuda: null, torch_hip: null };
  }

  try {
    const parsed = JSON.parse(result.stdout) as Partial<RuntimeTorchBuildInfo> | null;
    return {
      torch_version: parsed?.torch_version ?? null,
      torch_cuda: parsed?.torch_cuda ?? null,
      torch_hip: parsed?.torch_hip ?? null,
    };
  } catch {
    return { torch_version: null, torch_cuda: null, torch_hip: null };
  }
};

const resolveRocmSmiTool = (): RuntimeRocmSmiTool | null => {
  const forced = process.env["VLLM_STUDIO_GPU_SMI_TOOL"]?.trim();
  if (forced === "amd-smi" || forced === "rocm-smi") return forced;

  const amdSmi = resolveBinary(process.env["AMD_SMI_PATH"] || "amd-smi");
  if (amdSmi) return "amd-smi";
  const rocmSmi = resolveBinary(process.env["ROCM_SMI_PATH"] || "rocm-smi");
  if (rocmSmi) return "rocm-smi";
  return null;
};

const getRocmInfo = (smiTool: RuntimeRocmSmiTool | null): RuntimeRocmInfo => {
  let rocmVersion: string | null = null;
  const rocmVersionFile = "/opt/rocm/.info/version";
  if (existsSync(rocmVersionFile)) {
    try {
      rocmVersion = readFileSync(rocmVersionFile, "utf-8").trim() || null;
    } catch {
      rocmVersion = null;
    }
  }

  let hipVersion: string | null = null;
  const hipccResult = runCommand("hipcc", ["--version"]);
  if (hipccResult.status === 0) {
    hipVersion =
      parseHipccVersion(hipccResult.stdout) ?? parseHipccVersion(hipccResult.stderr) ?? null;
  }

  const gpuArch = new Set<string>();
  const rocminfoResult = runCommand("rocminfo", []);
  if (rocminfoResult.status === 0 && rocminfoResult.stdout) {
    const matches = rocminfoResult.stdout.match(/gfx[0-9a-f]+/gi) ?? [];
    for (const value of matches) {
      gpuArch.add(value.toLowerCase());
    }
  }

  return {
    rocm_version: rocmVersion,
    hip_version: hipVersion,
    smi_tool: smiTool,
    gpu_arch: Array.from(gpuArch),
  };
};

const detectPlatformKind = (args: {
  forcedSmiTool: string | undefined;
  torch: RuntimeTorchBuildInfo;
  hasNvidiaSmi: boolean;
  hasRocmSmi: boolean;
}): RuntimePlatformKind => {
  const forced = args.forcedSmiTool?.trim();
  if (forced === "nvidia-smi") return "cuda";
  if (forced === "amd-smi" || forced === "rocm-smi") return "rocm";

  if (args.torch.torch_hip) return "rocm";
  if (args.torch.torch_cuda) return "cuda";

  if (args.hasNvidiaSmi) return "cuda";
  if (args.hasRocmSmi) return "rocm";
  return "unknown";
};

const getSglangRuntimeInfo = (config: Config): RuntimeBackendInfo => {
  const python = config.sglang_python || "python3";
  const result = runCommand(python, [
    "-c",
    "import json, sys\ntry:\n import sglang\n print(json.dumps({'version': getattr(sglang, '__version__', None), 'python': sys.executable}))\nexcept Exception:\n print(json.dumps({'version': None, 'python': sys.executable}))",
  ]);

  if (result.status !== 0) {
    return {
      installed: false,
      version: null,
      python_path: config.sglang_python ?? null,
    };
  }

  let parsed: { version?: string | null; python?: string | null } | null = null;
  try {
    parsed = JSON.parse(result.stdout) as { version?: string | null; python?: string | null };
  } catch {
    parsed = null;
  }

  return {
    installed: Boolean(parsed?.version),
    version: parsed?.version ?? null,
    python_path: parsed?.python ?? config.sglang_python ?? null,
  };
};

const parseLlamaVersion = (output: string): string | null => {
  if (!output) return null;
  const match = output.match(/version\s*[:=]\s*([^\s]+)/i);
  if (match) {
    return match[1] ?? null;
  }
  const fallback = output.split("\n")[0]?.trim();
  return fallback || null;
};

const getLlamacppRuntimeInfo = (config: Config): RuntimeBackendInfo => {
  const configured = config.llama_bin || "llama-server";
  const resolved = resolveBinary(configured) ?? (existsSync(configured) ? resolve(configured) : null);
  const binary = resolved ?? configured;

  const versionResult = runCommand(binary, ["--version"]);
  if (versionResult.status !== 0) {
    const helpResult = runCommand(binary, ["--help"]);
    if (helpResult.status !== 0) {
      return {
        installed: false,
        version: null,
        binary_path: resolved,
      };
    }
    const version = parseLlamaVersion(helpResult.stdout) ?? parseLlamaVersion(helpResult.stderr);
    return {
      installed: Boolean(version),
      version,
      binary_path: resolved,
    };
  }

  const version = parseLlamaVersion(versionResult.stdout) ?? parseLlamaVersion(versionResult.stderr);
  return {
    installed: Boolean(version),
    version,
    binary_path: resolved,
  };
};

export const getSystemRuntimeInfo = async (config: Config): Promise<SystemRuntimeInfo> => {
  const gpus = getGpuInfo();
  const types = Array.from(new Set(gpus.map((gpu) => gpu.name).filter((name) => name && name !== "Unknown")));

  const [vllmInfo, sglangInfo] = await Promise.all([
    getVllmRuntimeInfo(),
    Promise.resolve(getSglangRuntimeInfo(config)),
  ]);

  const llamaInfo = getLlamacppRuntimeInfo(config);

  const pythonForTorch = config.sglang_python || vllmInfo.python_path || "python3";
  const torch = getTorchBuildInfo(pythonForTorch);

  const forcedSmiTool = process.env["VLLM_STUDIO_GPU_SMI_TOOL"];
  const hasNvidiaSmi = Boolean(resolveBinary(process.env["NVIDIA_SMI_PATH"] || "nvidia-smi"));
  const rocmSmiTool = resolveRocmSmiTool();
  const hasRocmSmi = Boolean(rocmSmiTool);
  const kind = detectPlatformKind({ forcedSmiTool, torch, hasNvidiaSmi, hasRocmSmi });

  const platform: RuntimePlatformInfo = {
    kind,
    vendor: kind === "cuda" ? "nvidia" : kind === "rocm" ? "amd" : null,
    rocm: kind === "rocm" ? getRocmInfo(rocmSmiTool) : null,
    torch,
  };

  return {
    platform,
    cuda: kind === "cuda" ? getCudaInfo() : { driver_version: null, cuda_version: null },
    gpus: {
      count: gpus.length,
      types,
    },
    backends: {
      vllm: {
        installed: vllmInfo.installed,
        version: vllmInfo.version,
        python_path: vllmInfo.python_path,
        binary_path: vllmInfo.vllm_bin,
      },
      sglang: sglangInfo,
      llamacpp: llamaInfo,
    },
  };
};
