import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ImagesPage from "./page";

vi.mock("@/hooks/use-realtime-status", () => ({
  useRealtimeStatus: () => ({
    services: [
      {
        id: "image",
        kind: "cli-integration",
        runtime: "stable-diffusion.cpp",
        port: null,
        pid: null,
        status: "ready",
        version: "0.0.0",
        last_error: null,
        started_at: "2026-02-08T00:00:00.000Z",
        updated_at: "2026-02-08T00:00:00.000Z",
      },
    ],
    gpuLease: { holder_service_id: "llm", acquired_at: "2026-02-08T00:00:00.000Z", reason: null },
  }),
}));

describe("ImagesPage", () => {
  it("renders image generation entry point and shows image service status", () => {
    const html = renderToStaticMarkup(React.createElement(ImagesPage));
    expect(html).toContain("Image Generation");
    expect(html).toContain("service: image");
    expect(html).toContain("status: ready");
    expect(html).toContain("gpu lease: llm");
  });
});

