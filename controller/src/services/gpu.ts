// CRITICAL
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { GpuInfo } from "../types/models";
import { resolveBinary, runCommand } from "./command/command-utilities";

const resolveNvidiaSmiBinary = (): string | null => {
  const configured = process.env["NVIDIA_SMI_PATH"] || "nvidia-smi";
  const resolved = resolveBinary(configured);
  if (resolved) return resolved;
  if (configured.includes("/")) {
    const abs = resolve(configured);
    return existsSync(abs) ? abs : null;
  }
  return null;
};

const resolveAmdSmiBinary = (): string | null => {
  const configured = process.env["AMD_SMI_PATH"] || "amd-smi";
  const resolved = resolveBinary(configured);
  if (resolved) return resolved;
  if (configured.includes("/")) {
    const abs = resolve(configured);
    return existsSync(abs) ? abs : null;
  }
  return null;
};

const resolveRocmSmiBinary = (): string | null => {
  const configured = process.env["ROCM_SMI_PATH"] || "rocm-smi";
  const resolved = resolveBinary(configured);
  if (resolved) return resolved;
  if (configured.includes("/")) {
    const abs = resolve(configured);
    return existsSync(abs) ? abs : null;
  }
  return null;
};

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
  if (forcedTool === "rocm-smi") {
    return getGpuInfoFromRocmSmi();
  }

  // Auto-detect: try NVIDIA first, then AMD (ROCm).
  const nvidia = getGpuInfoFromNvidiaSmi();
  if (nvidia.length > 0) {
    return nvidia;
  }
  const amd = getGpuInfoFromAmdSmi();
  if (amd.length > 0) {
    return amd;
  }
  return getGpuInfoFromRocmSmi();
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
    const nvidiaSmi = resolveNvidiaSmiBinary();
    if (!nvidiaSmi) return [];

    const result = runCommand(
      nvidiaSmi,
      [`--query-gpu=${query}`, "--format=csv,noheader,nounits"],
      5_000,
    );
    if (result.status !== 0 || !result.stdout) return [];

    const output = result.stdout.trim();

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

type RocmSmiParsed = {
  index: number;
  name: string;
  memory_total_bytes: number | null;
  memory_used_bytes: number | null;
  utilization_pct: number | null;
  temp_c: number | null;
  power_draw_w: number | null;
  power_limit_w: number | null;
};

const parseRocmSmiValue = (raw: string): { value: number; unit: string } | null => {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z%]+)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return { value, unit: (match[2] ?? "").trim() };
};

const rocmSmiToBytes = (parsed: { value: number; unit: string } | null): number | null => {
  if (!parsed) return null;
  const unit = parsed.unit.toLowerCase();
  if (!unit || unit === "b") return Math.round(parsed.value);
  if (unit === "kb" || unit === "kib") return Math.round(parsed.value * 1024);
  if (unit === "mb" || unit === "mib") return Math.round(parsed.value * 1024 ** 2);
  if (unit === "gb" || unit === "gib") return Math.round(parsed.value * 1024 ** 3);
  if (unit === "tb" || unit === "tib") return Math.round(parsed.value * 1024 ** 4);
  return null;
};

export const parseRocmSmiText = (text: string): RocmSmiParsed[] => {
  const byIndex = new Map<number, Partial<RocmSmiParsed>>();
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/GPU\[(\d+)\]\s*:\s*([^:]+?)\s*:\s*(.*)$/i);
    if (!match) continue;
    const index = Number(match[1]);
    if (!Number.isFinite(index)) continue;
    const label = (match[2] ?? "").trim().toLowerCase();
    const valueText = (match[3] ?? "").trim();

    const existing = byIndex.get(index) ?? { index, name: "AMD GPU" };
    const entry = { ...existing, index, name: existing.name ?? "AMD GPU" };

    if (label.includes("card model")) {
      if (valueText) entry.name = valueText;
    } else if (label.includes("card series") && entry.name === "AMD GPU") {
      if (valueText) entry.name = valueText;
    } else if (label.includes("total vram")) {
      entry.memory_total_bytes = rocmSmiToBytes(parseRocmSmiValue(valueText));
    } else if (label.includes("used vram")) {
      entry.memory_used_bytes = rocmSmiToBytes(parseRocmSmiValue(valueText));
    } else if (label.includes("gpu use")) {
      const parsed = parseRocmSmiValue(valueText.replace("%", "").trim());
      entry.utilization_pct = parsed ? parsed.value : null;
    } else if (label.includes("temperature") && label.includes("(c)")) {
      const parsed = parseRocmSmiValue(valueText.replace(/c$/i, "").trim());
      entry.temp_c = parsed ? parsed.value : null;
    } else if (label.includes("average") && label.includes("power") && label.includes("(w)")) {
      const parsed = parseRocmSmiValue(valueText.replace(/w$/i, "").trim());
      entry.power_draw_w = parsed ? parsed.value : null;
    } else if ((label.includes("power cap") || label.includes("max")) && label.includes("(w)")) {
      const parsed = parseRocmSmiValue(valueText.replace(/w$/i, "").trim());
      entry.power_limit_w = parsed ? parsed.value : null;
    }

    byIndex.set(index, entry);
  }

  return Array.from(byIndex.values())
    .map((value) => {
      const base: RocmSmiParsed = {
        index: typeof value.index === "number" ? value.index : -1,
        name: value.name ?? "AMD GPU",
        memory_total_bytes: value.memory_total_bytes ?? null,
        memory_used_bytes: value.memory_used_bytes ?? null,
        utilization_pct: value.utilization_pct ?? null,
        temp_c: value.temp_c ?? null,
        power_draw_w: value.power_draw_w ?? null,
        power_limit_w: value.power_limit_w ?? null,
      };
      if (base.index < 0) return null;
      return base;
    })
    .filter((value): value is RocmSmiParsed => Boolean(value))
    .sort((a, b) => a.index - b.index);
};

const getGpuInfoFromAmdSmi = (): GpuInfo[] => {
  try {
    const amdSmi = resolveAmdSmiBinary();
    if (!amdSmi) return [];

    const metricResult = runCommand(amdSmi, ["metric", "--json", "-g", "all"], 5_000);
    if (metricResult.status !== 0 || !metricResult.stdout) return [];

    const staticResult = runCommand(amdSmi, ["static", "--json", "-g", "all"], 5_000);
    if (staticResult.status !== 0 || !staticResult.stdout) return [];

    const metrics = parseAmdSmiMetricJson(metricResult.stdout);
    const statics = parseAmdSmiStaticJson(staticResult.stdout);
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

const getGpuInfoFromRocmSmi = (): GpuInfo[] => {
  try {
    const rocmSmi = resolveRocmSmiBinary();
    if (!rocmSmi) return [];

    // Prefer explicit flags for stable output; fall back to default output if flags are unsupported.
    const args = ["--showproductname", "--showmeminfo", "vram", "--showuse", "--showtemp", "--showpower"];
    let result = runCommand(rocmSmi, args, 5_000);
    if (result.status !== 0) {
      result = runCommand(rocmSmi, [], 5_000);
    }

    const combined = [result.stdout, result.stderr].filter(Boolean).join("\n");
    if (!combined.trim()) return [];

    const parsed = parseRocmSmiText(combined);
    if (parsed.length === 0) return [];

    const toMb = (bytes: number): number => Math.max(0, Math.round(bytes / 1024 ** 2));
    return parsed.map((gpu) => {
      const totalBytes = gpu.memory_total_bytes ?? 0;
      const usedBytes = gpu.memory_used_bytes ?? 0;
      const freeBytes = Math.max(0, totalBytes - usedBytes);
      const utilization = Math.max(0, Math.round(gpu.utilization_pct ?? 0));
      const tempC = Math.max(0, Math.round(gpu.temp_c ?? 0));
      const powerDraw = Math.max(0, Number(gpu.power_draw_w ?? 0));
      const powerLimit = Math.max(0, Number(gpu.power_limit_w ?? 0));

      return {
        index: gpu.index,
        name: gpu.name || "AMD GPU",
        memory_total: totalBytes,
        memory_total_mb: toMb(totalBytes),
        memory_used: usedBytes,
        memory_used_mb: toMb(usedBytes),
        memory_free: freeBytes,
        memory_free_mb: toMb(freeBytes),
        utilization,
        utilization_pct: utilization,
        temperature: tempC,
        temp_c: tempC,
        power_draw: powerDraw,
        power_limit: powerLimit,
      } satisfies GpuInfo;
    });
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
