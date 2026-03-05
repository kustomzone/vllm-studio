import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import type { Config } from "../../../config/env";
import { getSessionFsApi, isAgentFsEnabled } from "./store";

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

describe("agent files store", () => {
  it("requires daytona mode for session filesystem access", async () => {
    const context = {
      config: createConfig({
        daytona_agent_mode: false,
      }),
    };

    await expect(getSessionFsApi(context as never, "session-1")).rejects.toThrow(
      "Daytona agent mode is required"
    );
  });

  it("reports agent fs enabled when local fallback is enabled", () => {
    expect(
      isAgentFsEnabled(
        createConfig({
          daytona_agent_mode: false,
          agent_fs_local_fallback: true,
        })
      )
    ).toBe(true);
  });

  it("uses local agent fs when fallback is enabled and daytona is disabled", async () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "vllm-studio-agentfs-"));
    const context = {
      config: createConfig({
        data_dir: dataDirectory,
        daytona_agent_mode: false,
        agent_fs_local_fallback: true,
      }),
    };

    const { fs } = await getSessionFsApi(context as never, "session-local");
    await fs.mkdir("/notes");
    await fs.writeFile("/notes/todo.txt", "finish fallback");
    const content = await fs.readFile("/notes/todo.txt", "utf8");

    expect(content).toBe("finish fallback");
  });
});
