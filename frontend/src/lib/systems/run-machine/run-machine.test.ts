import { describe, expect, it } from "vitest";
import { createRunMachine, createInitialRunMachineState } from "./run-machine";
import type { RunMachineContext } from "./types";

function makeContext(overrides?: Partial<RunMachineContext>): RunMachineContext {
  return {
    currentSessionId: "session-1",
    currentSessionTitle: "New Chat",
    lastUserInput: "hello",
    lastAssistantContent: "",
    ...overrides,
  };
}

describe("run-machine", () => {
  it("starts run on run_start event", () => {
    const state = createInitialRunMachineState();
    const machine = createRunMachine(state);
    const next = machine.dispatch(
      {
        event: { event: "run_start", data: { run_id: "run-1", session_id: "session-1" } },
        now: 100,
        mapAgentMessageToChatMessage: () => null,
      },
      makeContext(),
    );

    expect(next.state.phase).toBe("active");
    expect(next.state.activeRunId).toBe("run-1");
    expect(next.effects.some((effect) => effect.type === "stream/clear-error")).toBe(true);
  });

  it("maps tool execution start/end to tool effects", () => {
    const state = {
      ...createInitialRunMachineState(),
      phase: "active" as const,
      activeRunId: "run-1",
    };

    const machine = createRunMachine(state);
    const started = machine.dispatch(
      {
        event: {
          event: "tool_execution_start",
          data: {
            run_id: "run-1",
            session_id: "session-1",
            toolCallId: "tc-1",
            toolName: "read",
            args: { path: "a.ts" },
          },
        },
        now: 101,
        mapAgentMessageToChatMessage: () => null,
      },
      makeContext(),
    );

    expect(started.effects).toContainEqual({
      type: "tools/start",
      toolCallId: "tc-1",
      toolName: "read",
      input: { path: "a.ts" },
    });

    const ended = machine.dispatch(
      {
        event: {
          event: "tool_execution_end",
          data: {
            run_id: "run-1",
            session_id: "session-1",
            toolCallId: "tc-1",
            result: { text: "ok" },
            isError: false,
          },
        },
        now: 102,
        mapAgentMessageToChatMessage: () => null,
      },
      makeContext(),
    );

    expect(ended.effects.some((effect) => effect.type === "tools/end")).toBe(true);
  });

  it("emits abort-after-tool-error when tool_execution_end has isError", () => {
    const state = {
      ...createInitialRunMachineState(),
      phase: "active" as const,
      activeRunId: "run-1",
    };

    const machine = createRunMachine(state);
    const next = machine.dispatch(
      {
        event: {
          event: "tool_execution_end",
          data: {
            run_id: "run-1",
            session_id: "session-1",
            toolCallId: "tc-err",
            toolName: "read_file",
            result: { text: "ENOENT" },
            isError: true,
          },
        },
        now: 105,
        mapAgentMessageToChatMessage: () => null,
      },
      makeContext(),
    );

    expect(next.effects).toContainEqual({
      type: "run/abort-after-tool-error",
      toolName: "read_file",
      resultText: "ENOENT",
    });
  });

  it("refreshes agent files after command tools complete", () => {
    const state = {
      ...createInitialRunMachineState(),
      phase: "active" as const,
      activeRunId: "run-1",
    };

    const machine = createRunMachine(state);

    const ended = machine.dispatch(
      {
        event: {
          event: "tool_execution_end",
          data: {
            run_id: "run-1",
            session_id: "session-1",
            toolCallId: "tc-cmd",
            toolName: "execute_command",
            result: { text: "ok" },
            isError: false,
          },
        },
        now: 103,
        mapAgentMessageToChatMessage: () => null,
      },
      makeContext(),
    );

    expect(ended.effects).toContainEqual({ type: "agent-files/list", sessionId: "session-1" });
  });

  it("emits title generation on turn_end when assistant text is available", () => {
    const state = {
      ...createInitialRunMachineState(),
      phase: "active" as const,
      activeRunId: "run-1",
    };

    const assistantMessage = {
      id: "a1",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "Here is how to fix the layout issue." }],
    };

    const machine = createRunMachine(state);
    const next = machine.dispatch(
      {
        event: {
          event: "turn_end",
          data: {
            run_id: "run-1",
            session_id: "session-1",
            message: { role: "assistant", parts: assistantMessage.parts },
            message_id: "a1",
          },
        },
        now: 150,
        mapAgentMessageToChatMessage: () => assistantMessage,
      },
      makeContext({ lastUserInput: "Help with my layout" }),
    );

    const titleFx = next.effects.find((effect) => effect.type === "title/maybe-generate");
    expect(titleFx).toBeDefined();
    if (titleFx && titleFx.type === "title/maybe-generate") {
      expect(titleFx.lastAssistantContent.length).toBeGreaterThan(0);
    }
  });

  it("completes run on run_end without a duplicate title effect", () => {
    const state = {
      ...createInitialRunMachineState(),
      phase: "active" as const,
      activeRunId: "run-1",
    };

    const machine = createRunMachine(state);
    const next = machine.dispatch(
      {
        event: {
          event: "run_end",
          data: { run_id: "run-1", session_id: "session-1", status: "completed" },
        },
        now: 200,
        mapAgentMessageToChatMessage: () => null,
      },
      makeContext(),
    );

    expect(next.state.phase).toBe("completed");
    expect(next.state.activeRunId).toBeNull();
    expect(next.effects.some((effect) => effect.type === "title/maybe-generate")).toBe(false);
  });
});
