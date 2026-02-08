import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ConfigData } from "@/lib/types";
import { ConfigCards } from "./config-cards";

describe("ConfigCards", () => {
  it("renders ROCm fields and does not render CUDA fields in ROCm mode", () => {
    const data: ConfigData = {
      config: {
        host: "127.0.0.1",
        port: 8080,
        inference_port: 8000,
        api_key_configured: false,
        models_dir: "/models",
        data_dir: "/data",
        db_path: "/data/controller.db",
        sglang_python: null,
        tabby_api_dir: null,
        llama_bin: null,
      },
      services: [],
      environment: {
        controller_url: "http://127.0.0.1:8080",
        inference_url: "http://127.0.0.1:8000",
        litellm_url: "http://127.0.0.1:4100",
        frontend_url: "http://127.0.0.1:3000",
      },
      runtime: {
        platform: {
          kind: "rocm",
          vendor: "amd",
          rocm: {
            rocm_version: "7.1.1",
            hip_version: "7.1.1",
            smi_tool: "amd-smi",
            gpu_arch: ["gfx942"],
          },
          torch: {
            torch_version: "2.6.0",
            torch_cuda: null,
            torch_hip: "7.1.1",
          },
        },
        cuda: { driver_version: null, cuda_version: null },
        gpus: { count: 1, types: ["AMD Instinct MI300X"] },
        backends: {
          vllm: { installed: false, version: null },
          sglang: { installed: false, version: null },
          llamacpp: { installed: false, version: null },
        },
      },
    };

    const html = renderToStaticMarkup(React.createElement(ConfigCards, { data }));
    expect(html).toContain("ROCm Version");
    expect(html).toContain("HIP Version");
    expect(html).toContain("Torch HIP");
    expect(html).not.toContain("CUDA Driver");
    expect(html).not.toContain("CUDA Runtime");
  });
});

