import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RuntimesPanel } from "./runtimes-panel";

describe("RuntimesPanel", () => {
  it("renders multiple services and their statuses", () => {
    const html = renderToStaticMarkup(
      React.createElement(RuntimesPanel, {
        gpuLease: { holder_service_id: "llm", acquired_at: "2026-02-08T00:00:00.000Z", reason: null },
        services: [
          {
            id: "llm",
            kind: "openai-compatible",
            runtime: "vllm",
            port: 8000,
            pid: 123,
            status: "running",
            version: "0.1.0",
            last_error: null,
            started_at: "2026-02-08T00:00:00.000Z",
            updated_at: "2026-02-08T00:00:00.000Z",
          },
          {
            id: "stt",
            kind: "cli-integration",
            runtime: "whisper.cpp",
            port: null,
            pid: null,
            status: "ready",
            version: "1.0",
            last_error: null,
            started_at: "2026-02-08T00:00:00.000Z",
            updated_at: "2026-02-08T00:00:00.000Z",
          },
        ],
      }),
    );

    expect(html).toContain("Runtimes (Rock-Em)");
    expect(html).toContain("llm");
    expect(html).toContain("running");
    expect(html).toContain("stt");
    expect(html).toContain("ready");
  });
});
