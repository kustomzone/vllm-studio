/**
 * Run registry state machine tests.
 */
import { describe, expect, it } from "bun:test";
import { createRunRegistry } from "./run-registry";

describe("run registry state machine", () => {
  it("tracks create/start/abort/finish/remove lifecycle", () => {
    const registry = createRunRegistry();

    expect(registry.size()).toBe(0);

    const abort = new AbortController();
    const agent = { abort: () => undefined } as never;

    const run = registry.createRun("run-1", agent as never, abort, "test-model", "openai");
    expect(run.phase).toBe("starting");
    expect(registry.size()).toBe(1);
    expect(registry.getRun("run-1")?.phase).toBe("starting");

    registry.markRunning("run-1");
    expect(registry.getRun("run-1")?.phase).toBe("running");

    registry.markAbortRequested("run-1");
    expect(registry.getRun("run-1")?.phase).toBe("aborting");

    registry.markFinished("run-1");
    expect(registry.getRun("run-1")?.phase).toBe("finished");

    expect(registry.deleteRun("run-1")).toBe(true);
    expect(registry.getRun("run-1")).toBeNull();
    expect(registry.size()).toBe(0);
  });
});
