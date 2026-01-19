import { loadConfig, getPublicConfig } from "./config";
import { buildPreflightResponse, proxyRequest } from "./proxy";

const cfg = loadConfig();

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("X-VLLM-Studio-Canary", "controller-new");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function pickV1Upstream(pathname: string) {
  // Path is always absolute here.
  // We route by endpoint family. Everything must be able to be remote.
  if (pathname === "/v1/chat/completions" || pathname.startsWith("/v1/chat/")) {
    return cfg.v1.chat;
  }
  if (pathname === "/v1/responses" || pathname.startsWith("/v1/responses/")) {
    return cfg.v1.responses;
  }
  if (pathname === "/v1/embeddings" || pathname.startsWith("/v1/embeddings/")) {
    return cfg.v1.embeddings;
  }
  if (pathname.startsWith("/v1/images")) {
    return cfg.v1.images;
  }
  if (pathname.startsWith("/v1/audio")) {
    return cfg.v1.audio;
  }
  return cfg.v1.default;
}

Bun.serve({
  port: cfg.port,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return buildPreflightResponse();
    }

    if (url.pathname === "/__config") {
      return json(getPublicConfig(cfg));
    }

    // Universal v1 proxy.
    if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
      const upstream = pickV1Upstream(url.pathname);
      return proxyRequest(req, upstream);
    }

    // Everything else is control-plane (recipes, launch, logs, mcp, sse, etc.).
    return proxyRequest(req, cfg.controlPlane);
  },
});

// eslint-disable-next-line no-console
console.log(
  `[controller-new] listening on http://localhost:${cfg.port} (control-plane=${cfg.controlPlane.baseUrl})`,
);
