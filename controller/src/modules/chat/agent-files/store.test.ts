import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import type { Config } from "../../../config/env";
import { getSessionFsApi } from "./store";

const createConfig = (overrides: Partial<Config> = {}): Config => ({
  host: "0.0.0.0",
  port: 8080,
  inference_port: 8000,
  data_dir: "/tmp/vllm-studio",
  db_path: "/tmp/vllm-studio/controller.db",
  models_dir: "/models",
  strict_openai_models: false,
  providers: [],
  ...overrides,
});

describe("agent files store", () => {
  it("uses local agent fs for session filesystem access", async () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "vllm-studio-agentfs-"));
    const context = {
      config: createConfig({
        data_dir: dataDirectory,
      }),
    };

    const { fs } = await getSessionFsApi(context as never, "session-local");
    await fs.mkdir("/notes");
    await fs.writeFile("/notes/todo.txt", "finish locally");
    const content = await fs.readFile("/notes/todo.txt", "utf8");

    expect(content).toBe("finish locally");
  });
});
