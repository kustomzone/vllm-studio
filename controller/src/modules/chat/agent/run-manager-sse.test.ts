// CRITICAL
import { describe, expect, it } from "bun:test";
import { AsyncQueue } from "../../../core/async";
import { encodeSseEvent, createSseStream } from "./run-manager-sse";

describe("createSseStream", () => {
  it("ends the stream after run_end without waiting for abort", async () => {
    const queue = new AsyncQueue<string>(8);
    const abort = new AbortController();
    const runPromise = Promise.resolve();

    queue.push(encodeSseEvent("run_start", { run_id: "r1" }));
    queue.push(encodeSseEvent("run_end", { run_id: "r1", status: "completed", error: null }));

    const chunks: string[] = [];
    for await (const chunk of createSseStream(queue, abort, runPromise)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain("event: run_start");
    expect(chunks[1]).toContain("event: run_end");
    expect(abort.signal.aborted).toBe(true);
  });
});
