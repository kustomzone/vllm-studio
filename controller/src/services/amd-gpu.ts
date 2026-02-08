// CRITICAL
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { GpuInfo } from "../types/models";
import { resolveBinary, runCommand } from "./command/command-utilities";

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

/**
 * Parse amd-smi metric output JSON.
 * @param jsonText - JSON string from `amd-smi metric --json`.
 * @returns Parsed metric entries.
 */
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

/**
 * Parse amd-smi static output JSON.
 * @param jsonText - JSON string from `amd-smi static --json`.
 * @returns Parsed static entries.
 */
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

/**
 * Parse roc-smi output text into a normalized structure.
 * @param text - Combined stdout/stderr from `rocm-smi`.
 * @returns Parsed GPU records.
 */
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

/**
 * Query GPU info from amd-smi JSON output.
 * @returns GPU info list.
 */
export const getGpuInfoFromAmdSmi = (): GpuInfo[] => {
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
      .map((metric) => {
        const index = typeof metric.gpu === "number" ? metric.gpu : null;
        if (index === null) return null;
        const staticEntry = staticByGpu.get(index) ?? null;

        const name = staticEntry?.asic?.market_name ?? "AMD GPU";

        const totalMb = readAmdSmiValueMb(metric.mem_usage?.total_vram) ?? 0;
        const usedMb = readAmdSmiValueMb(metric.mem_usage?.used_vram) ?? 0;
        const freeMb =
          readAmdSmiValueMb(metric.mem_usage?.free_vram) ?? Math.max(0, totalMb - usedMb);

        const toBytes = (mb: number): number => Math.max(0, Math.round(mb * 1024 * 1024));

        const utilization = Math.max(0, Math.round(readAmdSmiValueNumber(metric.usage?.gfx_activity) ?? 0));
        const temperature =
          Math.max(
            0,
            Math.round(
              readAmdSmiValueNumber(metric.temperature?.hotspot) ??
                readAmdSmiValueNumber(metric.temperature?.edge) ??
                0,
            ),
          );
        const powerDraw = Math.max(0, Number(readAmdSmiValueNumber(metric.power?.socket_power) ?? 0));

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
          temperature,
          temp_c: temperature,
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
 * Query GPU info from rocm-smi output text.
 * @returns GPU info list.
 */
export const getGpuInfoFromRocmSmi = (): GpuInfo[] => {
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
      const temperatureC = Math.max(0, Math.round(gpu.temp_c ?? 0));
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
        temperature: temperatureC,
        temp_c: temperatureC,
        power_draw: powerDraw,
        power_limit: powerLimit,
      } satisfies GpuInfo;
    });
  } catch {
    return [];
  }
};

