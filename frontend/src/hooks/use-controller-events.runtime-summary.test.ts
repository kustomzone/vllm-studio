import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useControllerEvents } from "./use-controller-events";

class MockEventSource {
  static lastInstance: MockEventSource | null = null;
  url: string;
  listeners = new Map<string, Array<(event: unknown) => void>>();
  onmessage: ((event: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.lastInstance = this;
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close() {}
}

describe("useControllerEvents runtime_summary", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    container?.remove();
    container = null;
    MockEventSource.lastInstance = null;
    vi.restoreAllMocks();
  });

  it("subscribes to runtime_summary and dispatches a vllm:controller-event custom event", async () => {
    // @ts-expect-error - test shim
    globalThis.EventSource = MockEventSource;
    // @ts-expect-error - test shim
    window.EventSource = MockEventSource;

    const received: Array<{ type?: unknown; data?: unknown }> = [];
    window.addEventListener("vllm:controller-event", (event) => {
      received.push((event as CustomEvent).detail as { type?: unknown; data?: unknown });
    });

    function TestComponent() {
      useControllerEvents("/api/proxy");
      return null;
    }

    const waitFor = async (predicate: () => boolean, timeoutMs = 250) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(React.createElement(TestComponent));

    await waitFor(() => MockEventSource.lastInstance !== null);

    const es = MockEventSource.lastInstance;
    expect(es).not.toBeNull();
    expect(es?.listeners.has("runtime_summary")).toBe(true);

    const payload = {
      data: { platform: { kind: "rocm" }, gpu_monitoring: { available: true, tool: "amd-smi" }, backends: {} },
      timestamp: new Date().toISOString(),
    };

    for (const listener of es?.listeners.get("runtime_summary") ?? []) {
      listener({ type: "runtime_summary", data: JSON.stringify(payload) });
    }

    expect(received.some((e) => e.type === "runtime_summary")).toBe(true);
  });
});
