// CRITICAL
import type { ChatMessage } from "@/lib/types";
import type { Attachment } from "@/app/chat/types";

type OpenAITextPart = { type: "text"; text: string };
type OpenAIImagePart = { type: "image_url"; image_url: { url: string } };
export type OpenAIMessageContent = string | Array<OpenAITextPart | OpenAIImagePart>;

export type OpenAIChatMessage = {
  role: "system" | "user" | "assistant";
  content: OpenAIMessageContent;
};

const guessImageMime = (attachment: Attachment): string => {
  const fileType = attachment.file?.type?.trim();
  if (fileType) return fileType;
  const name = (attachment.name || "").toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return "image/png";
};

const messageToPlainText = (message: ChatMessage): string => {
  const texts = message.parts
    .filter((part) => part.type === "text" || part.type === "reasoning")
    .map((part) => (part.type === "text" || part.type === "reasoning" ? part.text : ""))
    .join("");
  return texts.trim();
};

export const buildOpenAIChatMessages = (args: {
  system?: string;
  history: ChatMessage[];
  userText: string;
  attachments: Attachment[];
}): OpenAIChatMessage[] => {
  const messages: OpenAIChatMessage[] = [];
  const system = args.system?.trim();
  if (system) {
    messages.push({ role: "system", content: system });
  }

  for (const message of args.history) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const content = messageToPlainText(message);
    if (!content) continue;
    messages.push({ role: message.role, content });
  }

  const contentParts: Array<OpenAITextPart | OpenAIImagePart> = [];
  if (args.userText.trim()) {
    contentParts.push({ type: "text", text: args.userText });
  }

  for (const attachment of args.attachments) {
    if (attachment.type !== "image") continue;
    if (!attachment.base64) continue;
    const mime = guessImageMime(attachment);
    contentParts.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${attachment.base64}` },
    });
  }

  const content: OpenAIMessageContent =
    contentParts.length === 1 && contentParts[0]?.type === "text"
      ? contentParts[0].text
      : contentParts;
  messages.push({ role: "user", content });
  return messages;
};
