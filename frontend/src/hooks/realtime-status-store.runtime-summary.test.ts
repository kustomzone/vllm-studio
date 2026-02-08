import React from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { stopRealtimeStatusStore, useRealtimeStatusStore } from "./realtime-status-store";

let originalFetch: typeof fetch | null = null;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers = { "Content-Type": "application/json" };

    if (url.endsWith("/status")) {
      return new Response(JSON.stringify({ running: false, process: null, inference_port: 8000 }), { status: 200, headers });
    }
    if (url.endsWith("/health")) {
      return new Response(
        JSON.stringify({
          status: "ok",
          version: "test",
          inference_ready: false,
          backend_reachable: false,
          running_model: null,
        }),
        { status: 200, headers },
      );
    }
    if (url.endsWith("/gpus")) {
      return new Response(JSON.stringify({ count: 0, gpus: [] }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "not mocked" }), { status: 404, headers });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
  stopRealtimeStatusStore();
});

describe("realtime status store", () => {
  it("updates runtimeSummary from runtime_summary events", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function Probe() {
      const snap = useRealtimeStatusStore();
      const kind = snap.runtimeSummary?.platform.kind ?? "none";
      return React.createElement("div", { id: "kind" }, kind);
    }

    root.render(React.createElement(Probe));
    await new Promise((r) => setTimeout(r, 0));

    window.dispatchEvent(
      new CustomEvent("vllm:controller-event", {
        detail: {
          type: "runtime_summary",
          data: {
            platform: { kind: "rocm" },
            gpu_monitoring: { available: true, tool: "amd-smi" },
            backends: {
              vllm: { installed: false, version: null },
              sglang: { installed: false, version: null },
              llamacpp: { installed: false, version: null },
            },
          },
        },
      }),
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toContain("rocm");

    root.unmount();
    container.remove();
  });
});
