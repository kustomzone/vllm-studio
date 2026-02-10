// CRITICAL
import { NextRequest, NextResponse } from "next/server";
import { getApiSettings } from "@/lib/api-settings";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return handleRequest(request, "GET", path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return handleRequest(request, "POST", path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return handleRequest(request, "PUT", path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return handleRequest(request, "DELETE", path);
}

function getClientInfo(request: NextRequest) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP") ||
    "unknown";
  const country = request.headers.get("CF-IPCountry") || "-";
  const ua = request.headers.get("User-Agent")?.slice(0, 80) || "unknown";
  return { ip, country, ua };
}

function normalizeBackendUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function resolveTargetBackendUrl(args: {
  path: string[];
  settingsBackendUrl: string;
  settingsMediaUrl: string;
  settingsVoiceUrl: string;
}): string {
  const { path, settingsBackendUrl, settingsMediaUrl, settingsVoiceUrl } = args;
  const normalizedBackend = normalizeBackendUrl(settingsBackendUrl) ?? "";
  const normalizedMedia = normalizeBackendUrl(settingsMediaUrl) ?? "";
  const normalizedVoice = normalizeBackendUrl(settingsVoiceUrl) ?? "";

  // Default: controller backend url.
  let target = normalizedBackend || settingsBackendUrl;

  // Optional split routing: send "services" and "jobs" to the voice backend.
  // This keeps the dashboard usable when the LLM backend is a minimal controller that does not
  // implement the full vLLM Studio service surface.
  if (normalizedVoice && (path[0] === "services" || path[0] === "jobs")) {
    target = normalizedVoice;
  }

  // Optional split routing: send media generation to the media backend.
  // This is the "pipeline parallelism" primitive: keep LLM traffic on one controller and
  // run image/video generation on another controller to avoid GPU lease contention.
  if (normalizedMedia && path[0] === "v1") {
    const kind = path[1] || "";
    if (kind === "images" || kind === "videos" || kind === "video") {
      target = normalizedMedia;
    }
  }

  return target;
}

async function handleRequest(request: NextRequest, method: string, path: string[]) {
  const startTime = Date.now();
  const client = getClientInfo(request);

  try {
    // Get dynamic settings
    const settings = await getApiSettings();
    const hasExplicitBackendUrl = Boolean(process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL);
    // If BACKEND_URL is explicitly configured (common in dev bring-up), ignore per-browser overrides to
    // avoid "sticky" cookies sending traffic to an unexpected controller.
    const overrideHeaderUrl = hasExplicitBackendUrl ? null : normalizeBackendUrl(request.headers.get("x-backend-url"));
    const overrideCookieUrl = hasExplicitBackendUrl
      ? null
      : normalizeBackendUrl(request.cookies.get("vllmstudio_backend_url")?.value ?? null);
    const overrideUrl = overrideHeaderUrl ?? overrideCookieUrl;
    const BACKEND_URL = overrideUrl ?? settings.backendUrl;
    const API_KEY = settings.apiKey;
    const TARGET_BACKEND_URL = resolveTargetBackendUrl({
      path,
      settingsBackendUrl: BACKEND_URL,
      settingsMediaUrl: settings.mediaUrl,
      settingsVoiceUrl: settings.voiceUrl,
    });

    const url = new URL(request.url);
    const forwardedParams = new URLSearchParams(url.searchParams);
    const apiKeyQuery = forwardedParams.get("api_key");
    // Never forward credentials to the controller as query params.
    if (apiKeyQuery) forwardedParams.delete("api_key");
    const searchParams = forwardedParams.toString();
    const targetUrl = `${TARGET_BACKEND_URL}/${path.join("/")}${searchParams ? `?${searchParams}` : ""}`;
    const hasAuth = Boolean(request.headers.get("authorization"));

    console.log(
      `[PROXY] ip=${client.ip} | country=${client.country} | method=${method} | path=/${path.join("/")} | backend=${TARGET_BACKEND_URL} | override=${overrideUrl ? "yes" : "no"} | auth=${hasAuth ? "present" : "none"}`,
    );

    const headers: HeadersInit = {
      ...(request.headers.get("accept") ? { Accept: request.headers.get("accept") as string } : {}),
    };

    const incomingContentType = request.headers.get("content-type");
    if (incomingContentType) headers["Content-Type"] = incomingContentType;

    // Prefer per-user Authorization header passed from the browser; fallback to configured API key.
    const incomingAuth = request.headers.get("authorization");
    if (incomingAuth) {
      headers["Authorization"] = incomingAuth;
    } else if (apiKeyQuery) {
      headers["Authorization"] = `Bearer ${apiKeyQuery}`;
    } else if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }

    const body = method !== "GET" && method !== "DELETE" ? await request.text() : undefined;

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    const contentType = response.headers.get("content-type") || "application/json";

    if (contentType.includes("text/event-stream") && response.body) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": response.headers.get("cache-control") || "no-cache",
        },
      });
    }

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[PROXY ERROR] ip=${client.ip} | country=${client.country} | method=${method} | path=/${path.join("/")} | duration=${duration}ms | error=${String(error)}`,
    );
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
