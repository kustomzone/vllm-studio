import { afterEach, describe, expect, it } from "bun:test";
import { getSystemRuntimeInfo } from "../services/runtime-info";
import type { Config } from "../config/env";

const baseConfig: Config = {
  host: "127.0.0.1",
  port: 8080,
  inference_port: 8000,
  temporal_address: "localhost:7233",
  data_dir: "/tmp",
  db_path: "/tmp/controller.db",
  models_dir: "/models",
};

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
});

describe("getSystemRuntimeInfo platform model", () => {
  it("reports ROCm platform when forced via smi tool env", async () => {
    process.env["VLLM_STUDIO_GPU_SMI_TOOL"] = "amd-smi";
    const info = await getSystemRuntimeInfo(baseConfig);
    expect(info.platform.kind).toBe("rocm");
    expect(info.platform.vendor).toBe("amd");
    expect(info.platform.rocm?.smi_tool).toBe("amd-smi");
    expect(info.cuda.driver_version).toBeNull();
    expect(info.cuda.cuda_version).toBeNull();
  });

  it("reports CUDA platform when forced via smi tool env", async () => {
    process.env["VLLM_STUDIO_GPU_SMI_TOOL"] = "nvidia-smi";
    const info = await getSystemRuntimeInfo(baseConfig);
    expect(info.platform.kind).toBe("cuda");
    expect(info.platform.vendor).toBe("nvidia");
    expect(info.platform.rocm).toBeNull();
  });
});
