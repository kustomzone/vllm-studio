import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getMessageParsingService } from "@/lib/services/message-parsing";
import { getApiSettings } from "@/lib/api-settings";

function cleanTitle(raw: string): string {
  let title = String(raw || "");

  // First, try to extract content from thinking tags (model might wrap title in thinking)
  const thinkMatch = title.match(/<think[^>]*>([\s\S]*?)<\/think[^>]*>/i);
  if (thinkMatch) {
    const thinkContent = thinkMatch[1].trim();
    const afterThink = title.replace(/<think[^>]*>[\s\S]*?<\/think[^>]*>/gi, "").trim();
    // Prefer content after thinking tags, fall back to inside if nothing after
    title = afterThink || thinkContent;
  }

  // Remove any remaining incomplete thinking tags
  title = title.replace(/<\/?think[^>]*>/gi, "");

  // Remove any remaining XML-like tags
  title = title.replace(/<[^>]+>/g, "");

  // Remove code blocks
  title = title.replace(/```[\s\S]*?```/g, "");
  title = title.replace(/`[^`]+`/g, "");

  // Remove markdown formatting
  title = title.replace(/\*\*([^*]+)\*\*/g, "$1");
  title = title.replace(/\*([^*]+)\*/g, "$1");
  title = title.replace(/^#+\s*/gm, "");

  // Remove common prefixes
  title = title.replace(/^(Title|Chat Title|Suggested Title|Here'?s? ?(a |the )?title):\s*/gi, "");
  title = title.replace(/^(User|Assistant|User message|Assistant reply):\s*/gi, "");

  // Remove quotes
  title = title.replace(/^["'`]+|["'`]+$/g, "");

  // Remove numbered list prefixes
  title = title.replace(/^\d+\.\s*/gm, "");

  // Get first non-empty line
  const lines = title
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  title = lines[0] || title;

  // Final trim and length limit
  title = title.trim().slice(0, 60);

  // If still looks like garbage, return empty
  if (title.startsWith("<") || title.startsWith("`") || title.length < 2) {
    return "";
  }

  return title;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const model = typeof body?.model === "string" ? body.model : "default";
    const user = typeof body?.user === "string" ? body.user : "";
    const assistant = typeof body?.assistant === "string" ? body.assistant : "";

    if (!user.trim()) {
      return NextResponse.json({ error: "User text required" }, { status: 400 });
    }

    // Clean input text using service
    const parsingService = getMessageParsingService();
    const userThinking = parsingService.parseThinking(user);
    const promptUser = userThinking.mainContent.slice(0, 500);

    const assistantThinking = parsingService.parseThinking(assistant);
    const promptAssistant = assistantThinking.mainContent.slice(0, 500);

    const { backendUrl, apiKey } = await getApiSettings();
    const incomingAuth = req.headers.get("authorization");
    const normalizedToken = incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, "").trim() : "";
    const effectiveKey = normalizedToken || apiKey || "sk-master";

    const openaiCompatible = createOpenAICompatible({
      name: "vllm-studio-title",
      baseURL: `${backendUrl}/v1`,
      apiKey: effectiveKey,
    });

    const prompt = `Generate a 3-5 word title for this conversation. Reply with ONLY the title words, no quotes, no punctuation, no explanation.

User said: ${promptUser}

Assistant replied: ${promptAssistant.slice(0, 200)}

Title:`;

    const result = await generateText({
      model: openaiCompatible(model),
      temperature: 0.3,
      maxOutputTokens: 20,
      prompt,
    });

    const rawContent = result.text || "";

    const title = cleanTitle(rawContent);

    console.log("Title generation:", { raw: rawContent.slice(0, 100), cleaned: title });

    return NextResponse.json({ title: title || "New Chat" });
  } catch (error) {
    console.error("Title generation error:", error);
    return NextResponse.json({ title: "New Chat" });
  }
}
