/**
 * Kernel test harness — ports of the idealized reference model tests.
 *
 * Tests the ControllerKernel with in-memory adapters to validate
 * core control-plane semantics independently of HTTP transport,
 * SQLite persistence, or process management.
 */
import { describe, expect, test, beforeEach } from "bun:test";
import type { RecipeId } from "../types/brand";
import type { Recipe } from "../modules/lifecycle/types";
import { ControllerKernel } from "./kernel";
import { EVENT_TYPE, RUN_STATUS } from "./contracts";
import { createTestKernelParts, type TestKernelParts } from "./testing";

function makeRecipe(overrides: {
  id: string;
  name: string;
  served_model_name: string;
  model_path: string;
  backend: Recipe["backend"];
  port?: number;
}): Recipe {
  return {
    id: overrides.id as RecipeId,
    name: overrides.name,
    served_model_name: overrides.served_model_name,
    model_path: overrides.model_path,
    backend: overrides.backend,
    port: overrides.port ?? 8000,
    host: "0.0.0.0",
    env_vars: null,
    tensor_parallel_size: 1,
    pipeline_parallel_size: 1,
    max_model_len: 4096,
    gpu_memory_utilization: 0.9,
    kv_cache_dtype: "auto",
    max_num_seqs: 16,
    trust_remote_code: false,
    tool_call_parser: null,
    reasoning_parser: null,
    enable_auto_tool_choice: false,
    quantization: null,
    dtype: null,
    python_path: null,
    extra_args: {},
    max_thinking_tokens: null,
    thinking_mode: "off",
  };
}

// ---------------------------------------------------------------------------
// Unit tests (from idealized unit.test.mjs)
// ---------------------------------------------------------------------------

describe("kernel unit tests", () => {
  let parts: TestKernelParts;

  beforeEach(() => {
    parts = createTestKernelParts();
  });

  test("provider router resolves managed models by id or served model name", () => {
    const recipe = makeRecipe({ id: "phi4", name: "Phi-4", served_model_name: "phi-4", model_path: "/models/phi-4", backend: "vllm" });
    parts.recipes.upsert(recipe);

    const byId = parts.providers.resolve("phi4");
    expect(byId.kind).toBe("managed");
    if (byId.kind === "managed") {
      expect(String(byId.recipe.id)).toBe("phi4");
      expect(byId.resolvedModel).toBe("phi-4");
    }

    const byServed = parts.providers.resolve("phi-4");
    expect(byServed.kind).toBe("managed");
    if (byServed.kind === "managed") {
      expect(String(byServed.recipe.id)).toBe("phi4");
      expect(byServed.resolvedModel).toBe("phi-4");
    }
  });

  test("provider router resolves explicit external provider/model references", () => {
    const resolved = parts.providers.resolve("anthropic/claude-3-7-sonnet");
    expect(resolved.kind).toBe("external");
    if (resolved.kind === "external") {
      expect(resolved.provider).toBe("anthropic");
      expect(resolved.resolvedModel).toBe("claude-3-7-sonnet");
      expect(resolved.baseUrl).toContain("anthropic");
    }
  });

  test("node registry rejects overlapping layer allocations for the same model key", () => {
    parts.cluster.register("node-a", "10.0.0.1");
    parts.cluster.register("node-b", "10.0.0.2");

    const first = parts.cluster.setAllocation("node-a", "mixtral", 0, 15);
    expect(first.startLayer).toBe(0);
    expect(first.endLayer).toBe(15);

    expect(() => parts.cluster.setAllocation("node-b", "mixtral", 10, 20)).toThrow(/overlaps existing/);

    const nonOverlapping = parts.cluster.setAllocation("node-b", "mixtral", 16, 31);
    expect(nonOverlapping.startLayer).toBe(16);
    expect(nonOverlapping.endLayer).toBe(31);
  });
});

// ---------------------------------------------------------------------------
// Integration tests (from idealized integration.test.mjs)
// ---------------------------------------------------------------------------

describe("kernel integration tests", () => {
  let parts: TestKernelParts;
  let kernel: ControllerKernel;

  beforeEach(() => {
    parts = createTestKernelParts();
    kernel = new ControllerKernel(parts);
  });

  test("activating a new model aborts in-flight runs for the previous active local model", async () => {
    const phi4 = makeRecipe({ id: "phi4", name: "Phi-4", served_model_name: "phi-4", model_path: "/models/phi-4", backend: "vllm" });
    const qwen3 = makeRecipe({ id: "qwen3", name: "Qwen-3", served_model_name: "qwen-3", model_path: "/models/qwen-3", backend: "sglang" });
    kernel.registerRecipe(phi4);
    kernel.registerRecipe(qwen3);

    const session = kernel.createSession("switch test");
    await kernel.activateModel("phi4");

    const run = parts.chats.startRun({
      sessionId: session.id,
      requestedModel: "phi4",
      resolvedModel: "phi-4",
      provider: "local",
      status: RUN_STATUS.RUNNING,
    });

    await kernel.activateModel("qwen3");

    const updatedRun = parts.chats.getRun(run.id);
    expect(updatedRun?.status).toBe(RUN_STATUS.ABORTED);

    const eventTypes = parts.events.list().map((e) => e.type);
    expect(eventTypes).toContain(EVENT_TYPE.MODEL_SWITCHED);
    expect(eventTypes).toContain(EVENT_TYPE.CHAT_RUN_ABORTED);
  });

  test("proxy completion with switch_on_request activates the requested managed model", async () => {
    const phi4 = makeRecipe({ id: "phi4", name: "Phi-4", served_model_name: "phi-4", model_path: "/models/phi-4", backend: "vllm" });
    kernel.registerRecipe(phi4);

    const session = kernel.createSession("chat test");
    const result = await kernel.proxyCompletion({
      sessionId: session.id,
      model: "phi4",
      activationPolicy: "switch_on_request",
      messages: [{ role: "user", content: "Explain KV cache eviction simply." }],
    });

    expect(result.resolution.kind).toBe("managed");
    expect(result.completion.model).toBe("phi-4");
    expect(kernel.getActiveRuntime()?.recipeId).toBe("phi4");
    expect(result.run?.status).toBe(RUN_STATUS.COMPLETED);

    const messages = parts.chats.listMessages(session.id);
    expect(messages.length).toBe(1); // user message appended by kernel

    const snapshot = parts.metrics.snapshot();
    expect(snapshot.requestsTotal).toBe(1);
  });

  test("load_if_idle keeps the current active model when a different managed model is requested", async () => {
    const phi4 = makeRecipe({ id: "phi4", name: "Phi-4", served_model_name: "phi-4", model_path: "/models/phi-4", backend: "vllm" });
    const qwen3 = makeRecipe({ id: "qwen3", name: "Qwen-3", served_model_name: "qwen-3", model_path: "/models/qwen-3", backend: "sglang" });
    kernel.registerRecipe(phi4);
    kernel.registerRecipe(qwen3);

    await kernel.activateModel("phi4");

    const result = await kernel.proxyCompletion({
      model: "qwen3",
      activationPolicy: "load_if_idle",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.resolution.kind).toBe("managed");
    expect(result.resolution.resolvedModel).toBe("phi-4");
    expect(kernel.getActiveRuntime()?.recipeId).toBe("phi4");
  });
});

// ---------------------------------------------------------------------------
// End-to-end test (from idealized e2e.test.mjs)
// ---------------------------------------------------------------------------

describe("kernel e2e test", () => {
  test("full control-plane scenario: recipes, proxy, metrics, jobs, downloads, distributed", async () => {
    const parts = createTestKernelParts();
    const kernel = new ControllerKernel(parts);

    const phi4 = makeRecipe({ id: "phi4", name: "Phi-4", served_model_name: "phi-4", model_path: "/models/phi-4", backend: "vllm", port: 8000 });
    const llama3 = makeRecipe({ id: "llama3", name: "Llama-3.3", served_model_name: "llama-3.3", model_path: "/models/llama-3.3", backend: "llamacpp", port: 8081 });
    kernel.registerRecipe(phi4);
    kernel.registerRecipe(llama3);

    const session = kernel.createSession("e2e session");

    const download = await kernel.startDownload("phi4", "/data/models/phi4");
    expect(download.status).toBe("downloading"); // kernel starts download, doesn't auto-complete

    const job = await kernel.createJob("voice_assistant_turn", { transcript: "What is active right now?" });
    expect(job.status).toBe("running"); // kernel starts job

    const nodeA = kernel.registerNode("node-a", "10.1.0.10", { gpu: "L40S" });
    const nodeB = kernel.registerNode("node-b", "10.1.0.11", { gpu: "L40S" });
    kernel.heartbeatNode(nodeA.nodeId);
    kernel.heartbeatNode(nodeB.nodeId);
    const allocation = kernel.setAllocation("node-a", "phi4", 0, 31);
    expect(allocation.nodeId).toBe("node-a");

    const completionResult = await kernel.proxyCompletion({
      sessionId: session.id,
      model: "phi4",
      activationPolicy: "switch_on_request",
      messages: [
        { role: "system", content: "Answer tersely." },
        { role: "user", content: "Which model is serving me?" },
      ],
    });

    expect(completionResult.completion.model).toBe("phi-4");
    expect(kernel.getActiveRuntime()?.recipeId).toBe("phi4");

    const externalResult = await kernel.proxyCompletion({
      sessionId: session.id,
      model: "anthropic/claude-3-7-sonnet",
      messages: [{ role: "user", content: "Say hello." }],
    });
    expect(externalResult.resolution.kind).toBe("external");
    expect(externalResult.completion.provider).toBe("anthropic");

    const snapshot = kernel.snapshot();
    expect(snapshot.activeRuntime?.recipeId).toBe("phi4");
    expect(snapshot.metrics.requestsTotal).toBe(2);
    expect(snapshot.jobs.length).toBe(1);
    expect(snapshot.downloads.length).toBe(1);
    expect(snapshot.nodes.length).toBe(2);
    expect(snapshot.allocations.length).toBe(1);

    const eventTypes = new Set(snapshot.events.map((e) => e.type));
    expect(eventTypes.has(EVENT_TYPE.RECIPE_UPSERTED)).toBe(true);
    expect(eventTypes.has(EVENT_TYPE.DOWNLOAD_UPDATED)).toBe(true);
    expect(eventTypes.has(EVENT_TYPE.JOB_UPDATED)).toBe(true);
    expect(eventTypes.has(EVENT_TYPE.NODE_UPDATED)).toBe(true);
    expect(eventTypes.has(EVENT_TYPE.TOPOLOGY_UPDATED)).toBe(true);
    expect(eventTypes.has(EVENT_TYPE.PROXY_COMPLETED)).toBe(true);

    const evicted = await kernel.evictActiveModel();
    expect(evicted?.recipeId).toBe("phi4");
    expect(kernel.getActiveRuntime()).toBeUndefined();
  });
});
