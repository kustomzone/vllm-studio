import { describe, expect, it } from "bun:test";
import { FallbackAgentFsApi } from "./fallback-agentfs";
import type { AgentFsApi } from "./types";

const createStubFs = (overrides: Partial<AgentFsApi> = {}): AgentFsApi => {
  return {
    readdirPlus: async (): Promise<Awaited<ReturnType<AgentFsApi["readdirPlus"]>>> => [],
    mkdir: async (): Promise<void> => {},
    rename: async (): Promise<void> => {},
    stat: async () => ({ isDirectory: () => false }),
    readFile: async (): Promise<string> => "",
    writeFile: async (): Promise<void> => {},
    rm: async (): Promise<void> => {},
    ...overrides,
  };
};

describe("FallbackAgentFsApi", () => {
  it("falls back to local fs after a daytona failure", async () => {
    let primaryCalls = 0;
    let fallbackCalls = 0;

    const primary = createStubFs({
      writeFile: async () => {
        primaryCalls += 1;
        throw new Error(
          "[Daytona] write file failed (403): POST /files/upload - storage limit reached"
        );
      },
    });
    const fallback = createStubFs({
      writeFile: async () => {
        fallbackCalls += 1;
      },
    });

    const fs = new FallbackAgentFsApi(primary, async () => fallback);
    await fs.writeFile("/notes.txt", "hello");
    await fs.writeFile("/notes.txt", "hello-again");

    expect(primaryCalls).toBe(1);
    expect(fallbackCalls).toBe(2);
  });

  it("does not fall back for non-daytona errors", async () => {
    const primary = createStubFs({
      writeFile: async () => {
        throw new Error("Permission denied");
      },
    });
    let fallbackUsed = false;
    const fallback = createStubFs({
      writeFile: async () => {
        fallbackUsed = true;
      },
    });

    const fs = new FallbackAgentFsApi(primary, async () => fallback);
    await expect(fs.writeFile("/notes.txt", "hello")).rejects.toThrow("Permission denied");
    expect(fallbackUsed).toBe(false);
  });
});
