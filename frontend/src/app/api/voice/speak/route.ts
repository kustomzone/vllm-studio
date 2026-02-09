// CRITICAL
import { NextRequest, NextResponse } from "next/server";
import { getApiSettings } from "@/lib/api-settings";
import { resolveVoiceTarget } from "../voice-target";

export async function POST(request: NextRequest) {
  try {
    const settings = await getApiSettings();
    const { targetUrl } = resolveVoiceTarget(settings);
    if (!targetUrl) {
      return NextResponse.json(
        { error: "Voice URL not configured and backend URL is invalid" },
        { status: 400 },
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await request.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    const input = typeof payload["input"] === "string" ? payload["input"] : "";
    if (!input.trim()) {
      return NextResponse.json({ error: "Missing 'input' text" }, { status: 400 });
    }

    // Build headers with API key
    const headers: HeadersInit = { "Content-Type": "application/json" };
    const incomingAuth = request.headers.get("authorization");
    if (incomingAuth) {
      headers["Authorization"] = incomingAuth;
    } else if (settings.apiKey) {
      headers["Authorization"] = `Bearer ${settings.apiKey}`;
    }

    // Forward to controller (or an external voice service if configured)
    const response = await fetch(`${targetUrl}/v1/audio/speech`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Speech synthesis failed", details: errorText },
        { status: response.status },
      );
    }

    const bytes = await response.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") || "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[VOICE SPEAK PROXY ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}

