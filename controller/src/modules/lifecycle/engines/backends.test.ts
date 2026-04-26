// CRITICAL
import { describe, expect, it } from "bun:test";
import type { Recipe } from "../types";
import { buildSglangCommand } from "./backends";

const config = {} as Parameters<typeof buildSglangCommand>[1];

const makeRecipe = (extra: Partial<Recipe> = {}): Recipe => ({
  id: "sglang-test" as Recipe["id"],
  name: "SGLang Test",
  model_path: "/models/example",
  backend: "sglang",
  env_vars: null,
  tensor_parallel_size: 1,
  pipeline_parallel_size: 1,
  max_model_len: 4096,
  gpu_memory_utilization: 0.9,
  kv_cache_dtype: "auto",
  max_num_seqs: 32,
  trust_remote_code: false,
  tool_call_parser: null,
  reasoning_parser: null,
  enable_auto_tool_choice: false,
  quantization: null,
  dtype: null,
  host: "0.0.0.0",
  port: 8000,
  served_model_name: null,
  python_path: null,
  extra_args: {},
  max_thinking_tokens: null,
  thinking_mode: "auto",
  ...extra,
});

describe("SGLang command builder", () => {
  it("enables Prometheus metrics by default", () => {
    const command = buildSglangCommand(makeRecipe(), config);

    expect(command).toContain("--enable-metrics");
  });

  it("does not duplicate an explicit metrics flag", () => {
    const command = buildSglangCommand(
      makeRecipe({
        extra_args: { "enable-metrics": true },
      }),
      config
    );

    expect(command.filter((argument) => argument === "--enable-metrics")).toHaveLength(1);
  });
});
