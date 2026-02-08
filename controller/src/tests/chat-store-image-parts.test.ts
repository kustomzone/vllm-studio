// CRITICAL
import { describe, expect, it } from "bun:test";
import { ChatStore } from "../stores/chat-store";

describe("ChatStore image parts", () => {
  it("stores and retrieves user messages with image parts", () => {
    const store = new ChatStore(":memory:");
    const sessionId = "session-1";
    store.createSession(sessionId, "Test Chat", "test-model");

    store.addMessage(
      sessionId,
      "msg-1",
      "user",
      "",
      "test-model",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [
        { type: "text", text: "look" },
        { type: "image", data: "AAA", mimeType: "image/png", name: "test.png" },
      ],
      { any: "meta" },
    );

    const session = store.getSession(sessionId);
    expect(session).toBeTruthy();
    const messages = (session?.["messages"] ?? []) as Array<Record<string, unknown>>;
    expect(messages.length).toBeGreaterThan(0);

    const message = messages.find((m) => m["id"] === "msg-1");
    expect(message).toBeTruthy();
    const parts = message?.["parts"] as unknown;
    expect(Array.isArray(parts)).toBe(true);

    const imagePart = (parts as Array<Record<string, unknown>>).find((p) => p["type"] === "image");
    expect(imagePart).toBeTruthy();
    expect(imagePart?.["mimeType"]).toBe("image/png");
    expect(imagePart?.["data"]).toBe("AAA");
  });
});

