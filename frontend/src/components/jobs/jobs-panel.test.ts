import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JobsPanel } from "./jobs-panel";

describe("JobsPanel", () => {
  it("renders a jobs list", () => {
    const html = renderToStaticMarkup(
      React.createElement(JobsPanel, {
        jobs: [
          {
            id: "job-1",
            type: "voice_assistant_turn",
            status: "running",
            progress: 0.5,
            started_at: "2026-02-08T00:00:00.000Z",
            updated_at: "2026-02-08T00:00:00.000Z",
            error: null,
            input: { text: "hello" },
            result: null,
            logs: ["stt: start", "llm: start"],
          },
        ],
      }),
    );

    expect(html).toContain("Jobs");
    expect(html).toContain("voice_assistant_turn");
    expect(html).toContain("running");
    expect(html).toContain("50%"); // progress
    expect(html).toContain("stt: start");
  });
});

