// CRITICAL
import { NextRequest, NextResponse } from "next/server";
import { getApiSettings, saveApiSettings, maskApiKey, ApiSettings } from "@/lib/api-settings";

export async function GET() {
  try {
    const settings = await getApiSettings();
    // Return settings with masked API key for display
    return NextResponse.json({
      backendUrl: settings.backendUrl,
      apiKey: maskApiKey(settings.apiKey),
      hasApiKey: Boolean(settings.apiKey),
      voiceUrl: settings.voiceUrl,
      voiceModel: settings.voiceModel,
      mediaUrl: settings.mediaUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load settings", details: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { backendUrl, apiKey, voiceUrl, voiceModel, mediaUrl } = body as Partial<ApiSettings>;

    // Validate URL
    if (backendUrl && !isValidUrl(backendUrl)) {
      return NextResponse.json({ error: "Invalid backend URL format" }, { status: 400 });
    }

    if (voiceUrl && !isValidUrl(voiceUrl)) {
      return NextResponse.json({ error: "Invalid voice URL format" }, { status: 400 });
    }

    if (mediaUrl && !isValidUrl(mediaUrl)) {
      return NextResponse.json({ error: "Invalid media URL format" }, { status: 400 });
    }

    // Get current settings to preserve unchanged values
    const current = await getApiSettings();

    const newSettings: ApiSettings = {
      backendUrl: backendUrl || current.backendUrl,
      // Only update API key if explicitly provided (not masked value)
      apiKey: apiKey && !apiKey.includes("••••") ? apiKey : current.apiKey,
      voiceUrl: voiceUrl || current.voiceUrl,
      voiceModel: voiceModel || current.voiceModel,
      mediaUrl: mediaUrl || current.mediaUrl,
    };

    await saveApiSettings(newSettings);

    return NextResponse.json({
      success: true,
      backendUrl: newSettings.backendUrl,
      apiKey: maskApiKey(newSettings.apiKey),
      hasApiKey: Boolean(newSettings.apiKey),
      voiceUrl: newSettings.voiceUrl,
      voiceModel: newSettings.voiceModel,
      mediaUrl: newSettings.mediaUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save settings", details: String(error) },
      { status: 500 },
    );
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
