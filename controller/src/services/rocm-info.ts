// CRITICAL
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeRocmInfo, RuntimeRocmSmiTool } from "../types/models";
import { resolveBinary, runCommand } from "./command/command-utilities";

const parseHipccVersion = (output: string): string | null => {
  const match = output.match(/HIP version\s*:\s*([0-9.]+)/i);
  if (match) return match[1] ?? null;
  return null;
};

/**
 * Resolve which ROCm SMI tool is available (best effort).
 * @returns Tool id or null.
 */
export const resolveRocmSmiTool = (): RuntimeRocmSmiTool | null => {
  const forced = process.env["VLLM_STUDIO_GPU_SMI_TOOL"]?.trim();
  if (forced === "amd-smi" || forced === "rocm-smi") return forced;

  const amdSmi = resolveBinary(process.env["AMD_SMI_PATH"] || "amd-smi");
  if (amdSmi) return "amd-smi";
  const rocmSmi = resolveBinary(process.env["ROCM_SMI_PATH"] || "rocm-smi");
  if (rocmSmi) return "rocm-smi";
  return null;
};

const readRocmVersion = (): string | null => {
  const overridden = (process.env["VLLM_STUDIO_ROCM_VERSION_FILE"] ?? "").trim();
  if (overridden) {
    try {
      if (existsSync(overridden)) return readFileSync(overridden, "utf-8").trim() || null;
    } catch {
      // ignore
    }
  }

  const rocmInfoDirectory = "/opt/rocm/.info";
  const candidates: string[] = [];
  candidates.push(resolve(rocmInfoDirectory, "version"));
  // Best-effort: accept any `version*` file (ROCm installs vary).
  try {
    if (existsSync(rocmInfoDirectory)) {
      const entries = readdirSync(rocmInfoDirectory);
      for (const entry of entries) {
        if (entry.toLowerCase().startsWith("version")) {
          candidates.push(resolve(rocmInfoDirectory, entry));
        }
      }
    }
  } catch {
    // ignore
  }

  for (const path of candidates) {
    try {
      if (existsSync(path)) {
        const content = readFileSync(path, "utf-8").trim();
        if (content) return content;
      }
    } catch {
      // ignore
    }
  }
  return null;
};

/**
 * Get ROCm/HIP and GPU architecture info (best effort).
 * @param smiTool - Resolved ROCm SMI tool (or null).
 * @returns ROCm runtime info.
 */
export const getRocmInfo = (smiTool: RuntimeRocmSmiTool | null): RuntimeRocmInfo => {
  const rocmVersion = readRocmVersion();

  let hipVersion: string | null = null;
  const hipccResult = runCommand("hipcc", ["--version"]);
  if (hipccResult.status === 0) {
    hipVersion = parseHipccVersion(hipccResult.stdout) ?? parseHipccVersion(hipccResult.stderr) ?? null;
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
