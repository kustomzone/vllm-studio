// CRITICAL
import { execSync } from "node:child_process";
import type { GpuInfo } from "../types/models";

/**
 * Query GPU info from nvidia-smi.
 * @returns List of GPU info objects.
 */
export const getGpuInfo = (): GpuInfo[] => {
  const forcedTool = (process.env["VLLM_STUDIO_GPU_SMI_TOOL"] || "").trim().toLowerCase();
  if (forcedTool === "amd-smi") {
    return getGpuInfoFromAmdSmi();
  }
  if (forcedTool === "nvidia-smi") {
    return getGpuInfoFromNvidiaSmi();
  }

  // Auto-detect: try NVIDIA first, then AMD (ROCm).
  const nvidia = getGpuInfoFromNvidiaSmi();
  if (nvidia.length > 0) {
    return nvidia;
  }
  return getGpuInfoFromAmdSmi();
};

const getGpuInfoFromNvidiaSmi = (): GpuInfo[] => {
  const query = [
    "name",
    "memory.total",
    "memory.used",
    "memory.free",
    "utilization.gpu",
    "temperature.gpu",
    "power.draw",
    "power.limit",
  ].join(",");

  try {
    // Use full path to nvidia-smi with explicit env to ensure it can find CUDA libs
    const nvidiaSmi = process.env["NVIDIA_SMI_PATH"] || "/usr/bin/nvidia-smi";
    const output = execSync(
      `${nvidiaSmi} --query-gpu=${query} --format=csv,noheader,nounits`,
      {
        encoding: "utf-8",
        timeout: 5000,
        env: { ...process.env, PATH: `/usr/bin:/usr/local/bin:${process.env["PATH"] || ""}` },
      }
    ).trim();

    if (!output) {
      return [];
    }

    const lines = output.split("\n");
    return lines.map((line, index) => {
      const parts = line.split(",").map((value) => value.trim());
      const [
        name,
        memoryTotal,
        memoryUsed,
        memoryFree,
        utilization,
        temperature,
        powerDraw,
        powerLimit,
      ] = parts;
      const toBytes = (megabytes: string | undefined): number =>
        Math.max(0, Math.round(Number(megabytes ?? 0) * 1024 * 1024));
      const toMB = (mib: string | undefined): number =>
        Math.max(0, Math.round(Number(mib ?? 0)));
      return {
        index,
        name: name ?? "Unknown",
        memory_total: toBytes(memoryTotal),
        memory_total_mb: toMB(memoryTotal),
        memory_used: toBytes(memoryUsed),
        memory_used_mb: toMB(memoryUsed),
        memory_free: toBytes(memoryFree),
        memory_free_mb: toMB(memoryFree),
        utilization: Number(utilization ?? 0),
        utilization_pct: Number(utilization ?? 0),
        temperature: Number(temperature ?? 0),
        temp_c: Number(temperature ?? 0),
        power_draw: Number(powerDraw ?? 0),
        power_limit: Number(powerLimit ?? 0),
      };
    });
  } catch {
    return [];
  }
};

type AmdSmiValue = { value?: number; unit?: string } | "N/A" | null;

type AmdSmiMetricGpu = {
  gpu?: number;
  mem_usage?: {
    total_vram?: AmdSmiValue;
    used_vram?: AmdSmiValue;
    free_vram?: AmdSmiValue;
  };
  usage?: {
    gfx_activity?: AmdSmiValue;
  };
  temperature?: {
    hotspot?: AmdSmiValue;
    mem?: AmdSmiValue;
    edge?: AmdSmiValue;
  };
  power?: {
    socket_power?: AmdSmiValue;
  };
};

type AmdSmiStaticGpu = {
  gpu?: number;
  asic?: {
    market_name?: string;
    target_graphics_version?: string;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
};

const readAmdSmiValueMb = (value: AmdSmiValue | undefined): number | null => {
  if (!value || value === "N/A") {
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  const unit = typeof value["unit"] === "string" ? value["unit"] : "";
  const raw = coerceNumber(value["value"]);
  if (raw === null) {
    return null;
  }
  if (!unit || unit.toLowerCase() === "mb") {
    return raw;
  }
  if (unit.toLowerCase() === "gb") {
    return raw * 1024;
  }
  return raw;
};

const readAmdSmiValueNumber = (value: AmdSmiValue | undefined): number | null => {
  if (!value || value === "N/A") return null;
  if (!isRecord(value)) return null;
  return coerceNumber(value["value"]);
};

export const parseAmdSmiMetricJson = (jsonText: string): AmdSmiMetricGpu[] => {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!isRecord(parsed)) return [];
    const gpuData = parsed["gpu_data"];
    if (!Array.isArray(gpuData)) return [];
    return gpuData.filter((entry) => isRecord(entry)) as AmdSmiMetricGpu[];
  } catch {
    return [];
  }
};

export const parseAmdSmiStaticJson = (jsonText: string): AmdSmiStaticGpu[] => {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!isRecord(parsed)) return [];
    const gpuData = parsed["gpu_data"];
    if (!Array.isArray(gpuData)) return [];
    return gpuData.filter((entry) => isRecord(entry)) as AmdSmiStaticGpu[];
  } catch {
    return [];
  }
};

const getGpuInfoFromAmdSmi = (): GpuInfo[] => {
  try {
    const amdSmi = process.env["AMD_SMI_PATH"] || "/usr/bin/amd-smi";
    const metricText = execSync(`${amdSmi} metric --json -g all`, {
      encoding: "utf-8",
      timeout: 5000,
      env: { ...process.env, PATH: `/usr/bin:/usr/local/bin:${process.env["PATH"] || ""}` },
      stdio: "pipe",
    });
    const staticText = execSync(`${amdSmi} static --json -g all`, {
      encoding: "utf-8",
      timeout: 5000,
      env: { ...process.env, PATH: `/usr/bin:/usr/local/bin:${process.env["PATH"] || ""}` },
      stdio: "pipe",
    });

    const metrics = parseAmdSmiMetricJson(metricText);
    const statics = parseAmdSmiStaticJson(staticText);
    const staticByGpu = new Map<number, AmdSmiStaticGpu>();
    for (const entry of statics) {
      const gpuIndex = typeof entry.gpu === "number" ? entry.gpu : null;
      if (gpuIndex === null) continue;
      staticByGpu.set(gpuIndex, entry);
    }

    return metrics
      .map((entry) => {
        const index = typeof entry.gpu === "number" ? entry.gpu : null;
        if (index === null) return null;

        const name = staticByGpu.get(index)?.asic?.market_name || "AMD GPU";

        const totalMb = readAmdSmiValueMb(entry.mem_usage?.total_vram) ?? 0;
        const usedMb = readAmdSmiValueMb(entry.mem_usage?.used_vram) ?? 0;
        const freeMb = readAmdSmiValueMb(entry.mem_usage?.free_vram) ?? Math.max(0, totalMb - usedMb);

        const utilization = readAmdSmiValueNumber(entry.usage?.gfx_activity) ?? 0;

        const tempHotspot = readAmdSmiValueNumber(entry.temperature?.hotspot);
        const tempMem = readAmdSmiValueNumber(entry.temperature?.mem);
        const tempEdge = readAmdSmiValueNumber(entry.temperature?.edge);
        const tempC = tempHotspot ?? tempMem ?? tempEdge ?? 0;

        const powerDraw = readAmdSmiValueNumber(entry.power?.socket_power) ?? 0;

        const toBytes = (megabytes: number): number => Math.max(0, Math.round(megabytes * 1024 * 1024));

        return {
          index,
          name,
          memory_total: toBytes(totalMb),
          memory_total_mb: Math.max(0, Math.round(totalMb)),
          memory_used: toBytes(usedMb),
          memory_used_mb: Math.max(0, Math.round(usedMb)),
          memory_free: toBytes(freeMb),
          memory_free_mb: Math.max(0, Math.round(freeMb)),
          utilization,
          utilization_pct: utilization,
          temperature: tempC,
          temp_c: tempC,
          power_draw: powerDraw,
          power_limit: 0,
        } satisfies GpuInfo;
      })
      .filter((entry): entry is GpuInfo => Boolean(entry));
  } catch {
    return [];
  }
};

/**
 * Estimate VRAM needed for a model in GB.
 * @param modelSizeGb - Base model size in GB.
 * @param quantization - Quantization method.
 * @param dtype - Data type.
 * @param tensorParallel - Number of GPUs for tensor parallelism.
 * @returns Estimated VRAM needed per GPU in GB.
 */
export const estimateModelMemory = (
  modelSizeGb: number,
  quantization?: string,
  dtype?: string,
  tensorParallel = 1,
): number => {
  let memoryGb = modelSizeGb;

  if (quantization) {
    const quantLower = quantization.toLowerCase();
    if (quantLower.includes("int4") || quantLower.includes("4bit")) {
      memoryGb *= 0.25;
    } else if (quantLower.includes("int8") || quantLower.includes("8bit") || quantLower === "awq" || quantLower === "gptq") {
      memoryGb *= 0.5;
    } else if (quantLower.includes("fp8")) {
      memoryGb *= 0.5;
    }
  }

  if (dtype) {
    const dtypeLower = dtype.toLowerCase();
    if (dtypeLower.includes("float32") || dtypeLower.includes("fp32")) {
      memoryGb *= 2.0;
    } else if (dtypeLower.includes("int8")) {
      memoryGb *= 0.5;
    }
  }

  if (tensorParallel > 1) {
    memoryGb /= tensorParallel;
  }

  memoryGb *= 1.3;
  return memoryGb;
};

/**
 * Check if a model can fit on available GPUs.
 * @param modelSizeGb - Base model size in GB.
 * @param quantization - Quantization method.
 * @param dtype - Data type.
 * @param tensorParallel - Number of GPUs.
 * @returns True if the model can fit on GPUs.
 */
export const canFitModel = (
  modelSizeGb: number,
  quantization?: string,
  dtype?: string,
  tensorParallel = 1,
): boolean => {
  const gpus = getGpuInfo();
  if (gpus.length === 0) {
    return true;
  }
  const requiredGb = estimateModelMemory(modelSizeGb, quantization, dtype, tensorParallel);
  const requiredBytes = requiredGb * 1024 ** 3;
  if (gpus.length < tensorParallel) {
    return false;
  }
  for (let index = 0; index < tensorParallel; index += 1) {
    const gpu = gpus[index];
    if (!gpu || gpu.memory_free < requiredBytes) {
      return false;
    }
  }
  return true;
};
