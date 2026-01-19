import type { UpstreamConfig } from "./config";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function withCors(headers: Headers): Headers {
  // Minimal permissive CORS for browser-based UIs.
  // (OpenAI SDK clients won't care either way.)
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  return headers;
}

export function buildPreflightResponse(): Response {
  const headers = withCors(new Headers());
  headers.set("X-VLLM-Studio-Canary", "controller-new");
  return new Response(null, { status: 204, headers });
}

function stripTrailingSlashes(pathname: string): string {
  const stripped = pathname.replace(/\/+$/g, "");
  return stripped.length === 0 ? "/" : stripped;
}

function joinPaths(basePathname: string, requestPathname: string): string {
  const base = stripTrailingSlashes(basePathname || "/");
  const req = requestPathname.replace(/^\/+/, "");
  if (base === "/") return `/${req}`.replace(/\/\/+/, "/");
  if (!req) return base;
  return `${base}/${req}`;
}

export function buildTargetUrl(upstreamBaseUrl: string, requestUrl: URL): URL {
  const base = new URL(upstreamBaseUrl);
  const basePathNoTrailing = stripTrailingSlashes(base.pathname);

  let reqPath = requestUrl.pathname;

  // Avoid double /v1 if users set BASE_URL ending with /v1.
  if (basePathNoTrailing.endsWith("/v1")) {
    if (reqPath === "/v1") {
      reqPath = "/";
    } else if (reqPath.startsWith("/v1/")) {
      reqPath = reqPath.slice(3);
    }
  }

  const target = new URL(base.origin);
  target.pathname = joinPaths(base.pathname, reqPath);
  target.search = requestUrl.search;
  return target;
}

function buildUpstreamHeaders(req: Request, upstream: UpstreamConfig): Headers {
  const headers = new Headers();

  for (const [key, value] of req.headers.entries()) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (lower === "content-length") continue;
    headers.set(key, value);
  }

  if (!headers.has("authorization") && upstream.apiKey) {
    headers.set("Authorization", `Bearer ${upstream.apiKey}`);
  }

  headers.set("X-VLLM-Studio-Canary", "controller-new");
  return headers;
}

function buildDownstreamHeaders(upstreamResponse: Response): Headers {
  const headers = new Headers(upstreamResponse.headers);

  for (const key of Array.from(headers.keys())) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.delete(key);
    }
  }

  headers.set("X-VLLM-Studio-Canary", "controller-new");
  return withCors(headers);
}

function requestHasBody(method: string): boolean {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

export async function proxyRequest(req: Request, upstream: UpstreamConfig): Promise<Response> {
  const requestUrl = new URL(req.url);
  const targetUrl = buildTargetUrl(upstream.baseUrl, requestUrl);

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  req.signal.addEventListener("abort", onAbort, { once: true });

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers: buildUpstreamHeaders(req, upstream),
      body: requestHasBody(req.method) ? req.body : undefined,
      redirect: "manual",
      signal: controller.signal,
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: buildDownstreamHeaders(upstreamResponse),
    });
  } catch (error) {
    const headers = withCors(new Headers({ "Content-Type": "application/json" }));
    headers.set("X-VLLM-Studio-Canary", "controller-new");
    return new Response(
      JSON.stringify({
        error: "Upstream request failed",
        detail: error instanceof Error ? error.message : String(error),
        upstreamBaseUrl: upstream.baseUrl,
      }),
      { status: 502, headers },
    );
  } finally {
    req.signal.removeEventListener("abort", onAbort);
  }
}
