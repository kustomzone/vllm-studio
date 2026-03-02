import { describe, expect, it } from "bun:test";
import { buildAgentModePrompt } from "./system-prompt-builder";

describe("agent system prompt", () => {
  it("includes strict tool naming guidance and execute_command contract", () => {
    const prompt = buildAgentModePrompt({}) ?? "";
    expect(prompt).toContain("Use exact snake_case tool names and exact argument keys.");
    expect(prompt).toContain("Never invent tool names");
    expect(prompt).toContain("- execute_command({ command, cwd?, timeout? })");
    expect(prompt).toContain("execute_command also accepts { cmd } as a command alias.");
  });

  it("renders current plan progress when agent state has plan steps", () => {
    const prompt = buildAgentModePrompt({
      agent_state: {
        plan: {
          steps: [
            { title: "step one", status: "done" },
            { title: "step two", status: "running" },
          ],
        },
      },
    }) as string;

    expect(prompt).toContain("<current_plan>");
    expect(prompt).toContain("Progress: 1/2");
    expect(prompt).toContain("Current step: 1 — step two");
  });
});
