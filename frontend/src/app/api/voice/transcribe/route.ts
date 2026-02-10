import { NextRequest, NextResponse } from "next/server";
import { getApiSettings } from "@/lib/api-settings";
import { resolveVoiceTarget, shouldInjectSttModelForTarget } from "../voice-target";

export async function POST(request: NextRequest) {
  try {
    if ((process.env.VLLM_STUDIO_MOCK_VOICE ?? "").trim() === "1") {
      return NextResponse.json({ text: "hello from mock stt" });
    }

    // Get the form data from the request
    const formData = await request.formData();
    const settings = await getApiSettings();
    const { targetUrl, isExternalVoiceUrl } = resolveVoiceTarget(settings);

    if (!targetUrl) {
      return NextResponse.json(
        { error: "Voice URL not configured and backend URL is invalid" },
        { status: 400 },
      );
    }

    if (
      shouldInjectSttModelForTarget({
        isExternalVoiceUrl,
        voiceModel: settings.voiceModel,
      })
    ) {
      formData.set("model", settings.voiceModel);
    }

    // Build headers with API key
    const headers: HeadersInit = {};

    // Use incoming auth or fallback to server API key
    const incomingAuth = request.headers.get("authorization");
    if (incomingAuth) {
      headers["Authorization"] = incomingAuth;
    } else if (settings.apiKey) {
      headers["Authorization"] = `Bearer ${settings.apiKey}`;
    }

    // Forward to voice transcription service
    const response = await fetch(`${targetUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Transcription failed", details: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[VOICE PROXY ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
