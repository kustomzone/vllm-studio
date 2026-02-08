import { describe, expect, it } from "vitest";
import type { Attachment } from "@/app/chat/types";
import { buildOpenAIChatMessages } from "./openai-multimodal";

describe("buildOpenAIChatMessages", () => {
  it("includes image_url parts for base64 image attachments", () => {
    const file = new File(["x"], "image.png", { type: "image/png" });
    const attachments: Attachment[] = [
      {
        id: "a1",
        type: "image",
        name: "image.png",
        size: 1,
        file,
        base64: "AAA",
      },
    ];

    const messages = buildOpenAIChatMessages({
      system: "system",
      history: [],
      userText: "hello",
      attachments,
    });

    const last = messages[messages.length - 1];
    expect(last?.role).toBe("user");
    expect(Array.isArray(last?.content)).toBe(true);
    const content = last?.content as Array<Record<string, unknown>>;
    expect(content.some((part) => part["type"] === "image_url")).toBe(true);
    const image = content.find((part) => part["type"] === "image_url") as Record<string, unknown> | undefined;
    const imageUrl = (image?.["image_url"] as Record<string, unknown> | undefined)?.["url"];
    expect(typeof imageUrl).toBe("string");
    expect(String(imageUrl)).toContain("data:image/png;base64,AAA");
  });
});

