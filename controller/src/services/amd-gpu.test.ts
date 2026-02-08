// CRITICAL
import { afterAll, describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getGpuInfo } from "./gpu";
import { parseAmdSmiMetricJson, parseAmdSmiStaticJson, parseRocmSmiText } from "./amd-gpu";

describe("AMD/ROCm GPU telemetry parsing", () => {
  const metricJson = JSON.stringify({
    gpu_data: [
      {
        gpu: 0,
        mem_usage: {
          total_vram: { value: 196288, unit: "MB" },
          used_vram: { value: 285, unit: "MB" },
          free_vram: { value: 196003, unit: "MB" },
        },
        usage: { gfx_activity: { value: 12, unit: "%" } },
        temperature: { hotspot: { value: 34, unit: "C" } },
        power: { socket_power: { value: 153, unit: "W" } },
      },
    ],
  });

  const staticJson = JSON.stringify({
    gpu_data: [
      {
        gpu: 0,
        asic: {
          market_name: "AMD Instinct MI300X VF",
          target_graphics_version: "gfx942",
        },
      },
    ],
  });

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "vllm-studio-amd-gpu-"));
  afterAll(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it("parses amd-smi metric/static JSON shapes", () => {
    const metrics = parseAmdSmiMetricJson(metricJson);
    const statics = parseAmdSmiStaticJson(staticJson);
    expect(metrics).toHaveLength(1);
    expect(statics).toHaveLength(1);
    expect(metrics[0]?.gpu).toBe(0);
    expect(statics[0]?.asic?.market_name).toContain("MI300X");
  });

  it("uses amd-smi when forced via env and maps into GpuInfo", () => {
    const bin = join(temporaryDirectory, "amd-smi");
    const script = `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "metric" ]]; then
  cat <<'JSON'
${metricJson}
JSON
  exit 0
fi
if [[ "$1" == "static" ]]; then
  cat <<'JSON'
${staticJson}
JSON
  exit 0
fi
echo "unsupported" 1>&2
exit 1
`;
    writeFileSync(bin, script, "utf-8");
    chmodSync(bin, 0o755);

    const originalPath = process.env["PATH"] ?? "";
    process.env["PATH"] = `${temporaryDirectory}:${originalPath}`;
    process.env["VLLM_STUDIO_GPU_SMI_TOOL"] = "amd-smi";
    process.env["AMD_SMI_PATH"] = "amd-smi";

    const gpus = getGpuInfo();
    expect(gpus).toHaveLength(1);
    expect(gpus[0]?.index).toBe(0);
    expect(gpus[0]?.name).toContain("MI300X");
    expect(gpus[0]?.memory_total_mb).toBe(196288);
    expect(gpus[0]?.memory_used_mb).toBe(285);
    expect(gpus[0]?.utilization_pct).toBe(12);
    expect(gpus[0]?.temp_c).toBe(34);
    expect(gpus[0]?.power_draw).toBe(153);

    process.env["PATH"] = originalPath;
    delete process.env["VLLM_STUDIO_GPU_SMI_TOOL"];
    delete process.env["AMD_SMI_PATH"];
  });

  it("parses rocm-smi text output", () => {
    const sample = [
      "GPU[0] : Card model: AMD Instinct MI300X",
      "GPU[0] : Total VRAM Memory (B): 34359738368",
      "GPU[0] : Used VRAM Memory (B): 1073741824",
      "GPU[0] : GPU use (%): 12",
      "GPU[0] : Temperature (Sensor edge) (C): 45.0",
      "GPU[0] : Average Graphics Package Power (W): 120.5",
      "GPU[0] : Power Cap (W): 600.0",
    ].join("\n");

    const parsed = parseRocmSmiText(sample);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.index).toBe(0);
    expect(parsed[0]?.name).toContain("MI300X");
    expect(parsed[0]?.memory_total_bytes).toBe(34359738368);
    expect(parsed[0]?.memory_used_bytes).toBe(1073741824);
    expect(parsed[0]?.utilization_pct).toBe(12);
  });

  it("selects rocm-smi when forced via env", () => {
    const directory = mkdtempSync(join(tmpdir(), "vllm-studio-rocm-smi-"));
    const scriptPath = join(directory, "rocm-smi");
    const sample = "GPU[0] : Card model: AMD Instinct MI300X\nGPU[0] : Total VRAM Memory (B): 34359738368\n";
    writeFileSync(scriptPath, `#!/usr/bin/env bash\nset -euo pipefail\necho '${sample.replace(/'/g, "'\\''")}'\n`);
    chmodSync(scriptPath, 0o755);

    const originalPath = process.env["PATH"] ?? "";
    process.env["PATH"] = `${directory}:${originalPath}`;
    process.env["VLLM_STUDIO_GPU_SMI_TOOL"] = "rocm-smi";
    process.env["ROCM_SMI_PATH"] = "rocm-smi";

    const gpus = getGpuInfo();
    expect(gpus.length).toBe(1);
    expect(gpus[0]?.name).toContain("MI300X");
    expect(gpus[0]?.memory_total).toBe(34359738368);

    process.env["PATH"] = originalPath;
    delete process.env["VLLM_STUDIO_GPU_SMI_TOOL"];
    delete process.env["ROCM_SMI_PATH"];
    rmSync(directory, { recursive: true, force: true });
  });
});

