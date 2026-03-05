import { describe, expect, it } from "bun:test";
import type { Config } from "../../../config/env";
import { AGENT_TOOL_NAMES } from "./contracts";
import { buildAgentTools } from "./tool-registry";

const createConfig = (overrides: Partial<Config> = {}): Config => ({
  host: "0.0.0.0",
  port: 8080,
  inference_port: 8000,
  data_dir: "/tmp/vllm-studio",
  db_path: "/tmp/vllm-studio/controller.db",
  models_dir: "/models",
  strict_openai_models: false,
  daytona_agent_mode: true,
  agent_fs_local_fallback: false,
  providers: [],
  ...overrides,
});

describe("agent tool registry", () => {
  it("keeps local command/browser tools enabled when daytona mode is disabled", async () => {
    const tools = await buildAgentTools(
      {
        config: createConfig({
          daytona_agent_mode: false,
          daytona_api_key: "token",
        }),
      } as never,
      {
        sessionId: "session-1",
        agentMode: true,
        agentFiles: true,
      }
    );

    const names = tools.map((tool) => tool.name);
    expect(names).not.toContain(AGENT_TOOL_NAMES.LIST_FILES);
    expect(names).not.toContain(AGENT_TOOL_NAMES.WRITE_FILE);
    expect(names).toContain(AGENT_TOOL_NAMES.EXECUTE_COMMAND);
    expect(names).toContain(AGENT_TOOL_NAMES.COMPUTER_USE);
    expect(names).toContain(AGENT_TOOL_NAMES.BROWSER_OPEN_URL);
    expect(names).toContain("create_plan");
    expect(names).toContain("update_plan");
  });

  it("prefers daytona command/browser tools when daytona mode is enabled", async () => {
    const tools = await buildAgentTools(
      {
        config: createConfig({
          daytona_agent_mode: true,
          daytona_api_key: "token",
        }),
      } as never,
      {
        sessionId: "session-1",
        agentMode: true,
        agentFiles: false,
      }
    );

    const names = tools.map((tool) => tool.name);
    expect(names).toContain(AGENT_TOOL_NAMES.EXECUTE_COMMAND);
    expect(names).toContain(AGENT_TOOL_NAMES.COMPUTER_USE);
    expect(names).toContain(AGENT_TOOL_NAMES.BROWSER_OPEN_URL);
  });

  it("exposes file tools when local agent fs fallback is enabled", async () => {
    const tools = await buildAgentTools(
      {
        config: createConfig({
          daytona_agent_mode: false,
          agent_fs_local_fallback: true,
        }),
      } as never,
      {
        sessionId: "session-1",
        agentMode: true,
        agentFiles: true,
      }
    );

    const names = tools.map((tool) => tool.name);
    expect(names).toContain(AGENT_TOOL_NAMES.LIST_FILES);
    expect(names).toContain(AGENT_TOOL_NAMES.WRITE_FILE);
    expect(names).toContain("create_plan");
    expect(names).toContain("update_plan");
  });
});
