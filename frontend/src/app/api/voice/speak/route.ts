// CRITICAL
import { NextRequest, NextResponse } from "next/server";
import { getApiSettings } from "@/lib/api-settings";
import { resolveVoiceTarget } from "../voice-target";

const buildSilentWav = (args: { sampleRate?: number; durationMs?: number }): Uint8Array => {
  const sampleRate = args.sampleRate ?? 16000;
  const durationMs = args.durationMs ?? 500;
  const numSamples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const bytesPerSample = 2;
  const dataByteLength = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataByteLength, true);
  // Data is already zeroed (silence).

  return new Uint8Array(buffer);
};

export async function POST(request: NextRequest) {
  try {
    if ((process.env.VLLM_STUDIO_MOCK_VOICE ?? "").trim() === "1") {
      const bytes = buildSilentWav({ durationMs: 650 });
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "no-store",
        },
      });
    }

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
