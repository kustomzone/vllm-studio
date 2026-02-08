import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GpuLeaseModal } from "./gpu-lease-modal";

describe("GpuLeaseModal", () => {
  it("renders conflict details", () => {
    const html = renderToStaticMarkup(
      React.createElement(GpuLeaseModal, {
        conflict: {
          code: "gpu_lease_conflict",
          requested_service: { id: "image" },
          holder_service: { id: "llm" },
        },
        onCancel: () => {},
        onReplace: () => {},
        onBestEffort: () => {},
      }),
    );

    expect(html).toContain("GPU Lease Conflict");
    expect(html).toContain("Requested:");
    expect(html).toContain("image");
    expect(html).toContain("Currently holding GPU:");
    expect(html).toContain("llm");
  });
});

