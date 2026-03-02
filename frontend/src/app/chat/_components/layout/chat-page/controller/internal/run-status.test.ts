import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import { buildRunStatusText, pickThinkingPhrase } from "./run-status";

const assistantToolMessage = (
  toolCallId: string,
  toolName: string,
  input: unknown,
): ChatMessage => ({
  id: `assistant-${toolCallId}`,
  role: "assistant",
  parts: [
    {
      type: "dynamic-tool",
      toolCallId,
      toolName,
      input,
      state: "input-available",
    },
  ],
});

describe("run-status", () => {
  it("returns empty text when run is not loading", () => {
    const value = buildRunStatusText({
      isLoading: false,
      streamStalled: false,
      elapsedSeconds: 0,
      executingTools: new Set(),
      toolResultsMap: new Map(),
      messages: [],
    });
    expect(value).toBe("");
  });

  it("cycles friendly thinking phrases while model is thinking", () => {
    const first = pickThinkingPhrase(0);
    const second = pickThinkingPhrase(2);
    expect(first).not.toEqual(second);
  });

  it("shows a stalled status with elapsed time", () => {
    const value = buildRunStatusText({
      isLoading: true,
      streamStalled: true,
      elapsedSeconds: 125,
      executingTools: new Set(),
      toolResultsMap: new Map(),
      messages: [],
    });
    expect(value).toContain("Still cooking...");
    expect(value).toContain("2:05");
  });

  it("formats website search tool calls in one line with target", () => {
    const value = buildRunStatusText({
      isLoading: true,
      streamStalled: false,
      elapsedSeconds: 3,
      executingTools: new Set(["tool-1"]),
      toolResultsMap: new Map(),
      messages: [assistantToolMessage("tool-1", "web_search", { query: "docs.vllm.ai" })],
    });
    expect(value).toBe("searched website: docs.vllm.ai");
  });

  it("formats file creation tool calls in one line with target", () => {
    const value = buildRunStatusText({
      isLoading: true,
      streamStalled: false,
      elapsedSeconds: 8,
      executingTools: new Set(["tool-2"]),
      toolResultsMap: new Map(),
      messages: [
        assistantToolMessage("tool-2", "create_file", {
          path: "notes/quantization-plan.md",
        }),
      ],
    });
    expect(value).toBe("created file: notes/quantization-plan.md");
  });

  it("formats daytona execute_command tool calls in one line with command target", () => {
    const value = buildRunStatusText({
      isLoading: true,
      streamStalled: false,
      elapsedSeconds: 4,
      executingTools: new Set(["tool-3"]),
      toolResultsMap: new Map(),
      messages: [assistantToolMessage("tool-3", "execute_command", { command: "ls -la" })],
    });
    expect(value).toBe("ran command: ls -la");
  });

  it("formats move_file tool calls with from/to target", () => {
    const value = buildRunStatusText({
      isLoading: true,
      streamStalled: false,
      elapsedSeconds: 4,
      executingTools: new Set(["tool-4"]),
      toolResultsMap: new Map(),
      messages: [
        assistantToolMessage("tool-4", "move_file", {
          from: "notes/draft.md",
          to: "notes/final.md",
        }),
      ],
    });
    expect(value).toBe("moved file: notes/draft.md -> notes/final.md");
  });

  it("uses execution metadata fallback when tool call part is not yet in assistant message", () => {
    const toolResultsMap = new Map([
      [
        "tool-5",
        {
          tool_call_id: "tool-5",
          content: "",
          name: "execute_command",
          input: { command: "pwd" },
          isError: false,
        },
      ],
    ]);

    const value = buildRunStatusText({
      isLoading: true,
      streamStalled: false,
      elapsedSeconds: 1,
      executingTools: new Set(["tool-5"]),
      toolResultsMap,
      messages: [],
    });
    expect(value).toBe("ran command: pwd");
  });
});
