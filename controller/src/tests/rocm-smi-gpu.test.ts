// CRITICAL
import { describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getGpuInfo, parseRocmSmiText } from "../services/gpu";

const SAMPLE = [
  "GPU[0] : Card model: AMD Instinct MI300X",
  "GPU[0] : Total VRAM Memory (B): 34359738368",
  "GPU[0] : Used VRAM Memory (B): 1073741824",
  "GPU[0] : GPU use (%): 12",
  "GPU[0] : Temperature (Sensor edge) (C): 45.0",
  "GPU[0] : Average Graphics Package Power (W): 120.5",
  "GPU[0] : Power Cap (W): 600.0",
].join("\n");

describe("ROCm SMI parsing", () => {
  it("parses rocm-smi text output into GPU fields", () => {
    const parsed = parseRocmSmiText(SAMPLE);
    expect(parsed.length).toBe(1);
    expect(parsed[0]?.index).toBe(0);
    expect(parsed[0]?.name).toContain("MI300X");
    expect(parsed[0]?.memory_total_bytes).toBe(34359738368);
    expect(parsed[0]?.memory_used_bytes).toBe(1073741824);
    expect(parsed[0]?.utilization_pct).toBe(12);
  });

  it("selects rocm-smi when forced via env", () => {
    const dir = mkdtempSync(join(tmpdir(), "vllm-studio-rocm-smi-"));
    const script = join(dir, "rocm-smi");
    writeFileSync(script, `#!/usr/bin/env bash\nset -euo pipefail\necho '${SAMPLE.replace(/'/g, "'\\''")}'\n`);
    chmodSync(script, 0o755);

    const originalPath = process.env["PATH"] ?? "";
    process.env["PATH"] = `${dir}:${originalPath}`;
    process.env["VLLM_STUDIO_GPU_SMI_TOOL"] = "rocm-smi";

    const gpus = getGpuInfo();
    expect(gpus.length).toBe(1);
    expect(gpus[0]?.name).toContain("MI300X");
    expect(gpus[0]?.memory_total).toBe(34359738368);

    process.env["PATH"] = originalPath;
    delete process.env["VLLM_STUDIO_GPU_SMI_TOOL"];
    rmSync(dir, { recursive: true, force: true });
  });
});
