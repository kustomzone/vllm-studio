// CRITICAL
import { NextRequest, NextResponse } from "next/server";

/**
 * Generate a simple title from the first few words of the user's message
 */
function generateTitle(userMessage: string, assistantMessage: string): string {
  // Keep articles / pronouns out; keep verbs like "fix" and "build" — they carry meaning for dev chats.
  const stopwords = new Set([
    "a", "an", "the", "and", "or", "but", "for", "nor", "so", "yet",
    "on", "in", "at", "to", "from", "by", "with", "about", "as", "into",
    "like", "through", "after", "over", "between", "out", "against",
    "during", "without", "before", "under", "around", "among",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they",
    "this", "that", "these", "those", "is", "are", "was", "were", "be",
    "been", "being", "do", "does", "did", "done", "can", "could", "should",
    "would", "will", "just", "please", "very", "really", "quite", "some", "any",
  ]);

  const cleanText = (text: string) =>
    text
      .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, " ")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/<artifact[\s\S]*?<\/artifact>/g, " ")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\n/g, " ")
      .replace(/[^\w\s'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const pickWords = (text: string): string[] => {
    const cleaned = cleanText(text);
    if (!cleaned) return [];
    const words = cleaned.split(" ").filter(Boolean);
    const meaningful = words.filter((word) => {
      const lower = word.toLowerCase();
      return lower.length > 2 && !stopwords.has(lower);
    });
    const source = meaningful.length >= 2 ? meaningful : words.filter((w) => w.length > 1);
    return source.slice(0, 8);
  };

  const userWords = pickWords(userMessage);
  const assistantWords = pickWords(assistantMessage);
  const titleWords = userWords.length >= 2 ? userWords : assistantWords;

  if (titleWords.length === 0) {
    return "New Chat";
  }

  const title = titleWords
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return title.length > 56 ? title.slice(0, 53) + "..." : title;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const user = typeof body?.user === "string" ? body.user : "";
    const assistant = typeof body?.assistant === "string" ? body.assistant : "";

    const title = generateTitle(user, assistant);

    return NextResponse.json({ title });
  } catch (error) {
    console.error("Title generation error:", error);
    return NextResponse.json({ title: "New Chat" });
  }
}
