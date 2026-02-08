// CRITICAL
import { describe, expect, it, afterAll } from "bun:test";
import { mkdtempSync, chmodSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

const temporaryDirectory = mkdtempSync(join(tmpdir(), "vllm-studio-amd-smi-"));
const fakeAmdSmiPath = join(temporaryDirectory, "amd-smi");

writeFileSync(
  fakeAmdSmiPath,
  `#!/usr/bin/env bash
set -euo pipefail
cmd="$1"
shift || true

if [[ "$cmd" == "metric" ]]; then
  cat <<'JSON'
${metricJson}
JSON
  exit 0
fi

if [[ "$cmd" == "static" ]]; then
  cat <<'JSON'
${staticJson}
JSON
  exit 0
fi

echo "unsupported" 1>&2
exit 1
`,
  "utf-8",
);
chmodSync(fakeAmdSmiPath, 0o755);

afterAll(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("AMD SMI GPU parsing", () => {
  it("maps amd-smi static+metric JSON into GpuInfo", async () => {
    process.env["VLLM_STUDIO_GPU_SMI_TOOL"] = "amd-smi";
    process.env["AMD_SMI_PATH"] = "amd-smi";
    process.env["PATH"] = `${temporaryDirectory}:${process.env["PATH"] || ""}`;

    const { getGpuInfo } = await import("../services/gpu");
    const gpus = getGpuInfo();

    expect(gpus).toHaveLength(1);
    expect(gpus[0]?.index).toBe(0);
    expect(gpus[0]?.name).toBe("AMD Instinct MI300X VF");
    expect(gpus[0]?.memory_total_mb).toBe(196288);
    expect(gpus[0]?.memory_used_mb).toBe(285);
    expect(gpus[0]?.utilization_pct).toBe(12);
    expect(gpus[0]?.temp_c).toBe(34);
    expect(gpus[0]?.power_draw).toBe(153);
  });
});
