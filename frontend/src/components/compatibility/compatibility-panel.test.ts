import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CompatibilityReport } from "@/lib/types";
import { CompatibilityPanel } from "./compatibility-panel";

describe("CompatibilityPanel", () => {
  it("groups checks by severity", () => {
    const report: CompatibilityReport = {
      platform: { kind: "rocm" },
      gpu_monitoring: { available: false, tool: "amd-smi" },
      torch: { torch_version: "2.6.0", torch_cuda: null, torch_hip: null },
      backends: {
        vllm: { installed: false, version: null },
        sglang: { installed: false, version: null },
        llamacpp: { installed: false, version: null },
      },
      checks: [
        { id: "e1", severity: "error", message: "error msg", evidence: null, suggested_fix: "fix 1" },
        { id: "w1", severity: "warn", message: "warn msg", evidence: "evidence", suggested_fix: null },
        { id: "i1", severity: "info", message: "info msg", evidence: null, suggested_fix: null },
      ],
    };

    const html = renderToStaticMarkup(React.createElement(CompatibilityPanel, { report }));
    expect(html).toContain("Errors");
    expect(html).toContain("Warnings");
    expect(html).toContain("Info");
    expect(html).toContain("error msg");
    expect(html).toContain("warn msg");
    expect(html).toContain("info msg");
  });
});

