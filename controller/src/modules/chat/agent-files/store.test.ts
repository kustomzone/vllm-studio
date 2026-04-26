import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import type { Config } from "../../../config/env";
import { ChatStore } from "../store";
import { createAgentDirectory, listAgentFiles, readAgentFile, writeAgentFile } from "./service";

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
  it("uses the chat database for session filesystem access", async () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), "vllm-studio-agent-files-"));
    const dbPath = join(dataDirectory, "controller.db");
    const chatStore = new ChatStore(dbPath);
    const context = {
      config: createConfig({
        data_dir: dataDirectory,
        db_path: dbPath,
      }),
      stores: { chatStore },
    };

    await createAgentDirectory(context as never, "session-local", "notes");
    await writeAgentFile(context as never, "session-local", "notes/todo.txt", "finish locally");
    const { content } = await readAgentFile(context as never, "session-local", "notes/todo.txt");
    const files = await listAgentFiles(context as never, "session-local", "", true);

    expect(content).toBe("finish locally");
    expect(files).toEqual([
      {
        name: "notes",
        type: "dir",
        children: [{ name: "todo.txt", type: "file", size: 14 }],
      },
    ]);
  });
});
