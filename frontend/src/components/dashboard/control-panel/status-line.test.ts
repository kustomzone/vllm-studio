import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusLine } from "./status-line";

describe("StatusLine", () => {
  it("renders platform label when provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusLine, {
        currentProcess: null,
        currentRecipe: null,
        isConnected: true,
        metrics: null,
        gpus: [],
        services: [],
        platformKind: "rocm",
        inferencePort: 8000,
        onNavigateChat: () => {},
        onNavigateLogs: () => {},
        onBenchmark: () => {},
        benchmarking: false,
        onStop: () => {},
      }),
    );

    expect(html).toContain("platform: rocm");
  });
});
