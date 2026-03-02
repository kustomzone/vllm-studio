import { describe, expect, it } from "bun:test";
import type { Config } from "../../config/env";
import {
  DaytonaToolboxClient,
  isDaytonaAgentModeEnabled,
  resolveDaytonaProxyBaseUrl,
} from "./toolbox-client";

const createConfig = (overrides: Partial<Config> = {}): Config => ({
  host: "0.0.0.0",
  port: 8080,
  inference_port: 8000,
  data_dir: "/tmp/vllm-studio",
  db_path: "/tmp/vllm-studio/controller.db",
  models_dir: "/models",
  strict_openai_models: false,
  daytona_agent_mode: true,
  ...overrides,
});

const createSandboxResponse = (id: string) =>
  new Response(JSON.stringify({ id, name: `vllm-studio-${id}`, state: "running" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const createFileListResponse = () =>
  new Response(JSON.stringify([]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("daytona toolbox config", () => {
  it("derives proxy URL from API base URL", () => {
    expect(resolveDaytonaProxyBaseUrl("https://app.daytona.io/api")).toBe(
      "https://proxy.app.daytona.io"
    );
  });

  it("respects explicit proxy URL override", () => {
    expect(
      resolveDaytonaProxyBaseUrl("https://app.daytona.io/api", "https://proxy.custom.daytona")
    ).toBe("https://proxy.custom.daytona");
  });

  it("enables daytona mode only when key is present", () => {
    expect(isDaytonaAgentModeEnabled(createConfig())).toBe(false);
    expect(isDaytonaAgentModeEnabled(createConfig({ daytona_api_key: "token" }))).toBe(true);
  });

  it("disables daytona mode when feature flag is off", () => {
    expect(
      isDaytonaAgentModeEnabled(
        createConfig({
          daytona_api_key: "token",
          daytona_agent_mode: false,
        })
      )
    ).toBe(false);
  });
});

describe("daytona toolbox retry behavior", () => {
  it("retries file list after first sandbox becomes unavailable", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ method: string; url: string }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      calls.push({ method, url });

      if (url.endsWith("/api/sandbox") && method === "GET") {
        return new Response(
          JSON.stringify([
            { id: "sandbox-old", name: "vllm-studio-session_1", state: "running" },
            { id: "sandbox-fallback", name: "vllm-studio-session_1", state: "running" },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.includes("/toolbox/sandbox-old/") && url.includes("/files/folder")) {
        return new Response("sandbox unavailable", { status: 403 });
      }

      if (url.includes("/toolbox/sandbox-fallback/") && url.includes("/files/folder")) {
        return new Response("ok", { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.includes("/toolbox/sandbox-fallback/") && url.includes("/files?")) {
        return createFileListResponse();
      }

      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    try {
      const client = new DaytonaToolboxClient(createConfig({ daytona_api_key: "token" }));
      const files = await client.listFiles("session-1", "");
      expect(files).toEqual([]);
      expect(calls.some((entry) => entry.url.includes("/toolbox/sandbox-old/"))).toBe(true);
      expect(calls.some((entry) => entry.url.includes("/toolbox/sandbox-fallback/"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("creates a new sandbox when no reusable sandbox remains", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ method: string; url: string }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      calls.push({ method, url });

      if (url.endsWith("/api/sandbox") && method === "GET") {
        return new Response(
          JSON.stringify([{ id: "sandbox-old", name: "vllm-studio-session_2", state: "running" }]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/api/sandbox") && method === "POST") {
        return createSandboxResponse("sandbox-new");
      }

      if (url.includes("/toolbox/sandbox-old/") && url.includes("/files/folder")) {
        return new Response("sandbox unavailable", { status: 403 });
      }

      if (url.includes("/toolbox/sandbox-new/") && url.includes("/files/folder")) {
        return new Response("ok", { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.includes("/toolbox/sandbox-new/") && url.includes("/files?") && method === "GET") {
        return createFileListResponse();
      }

      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    try {
      const client = new DaytonaToolboxClient(createConfig({ daytona_api_key: "token" }));
      const files = await client.listFiles("session-2", "");
      expect(files).toEqual([]);
      expect(calls.some((entry) => entry.method === "POST" && entry.url.endsWith("/api/sandbox"))).toBe(true);
      expect(calls.some((entry) => entry.url.includes("/toolbox/sandbox-new/"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reuses existing sandbox when create returns 409 conflict", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ method: string; url: string }> = [];
    let sandboxListCalls = 0;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      calls.push({ method, url });

      if (url.endsWith("/api/sandbox") && method === "GET") {
        sandboxListCalls += 1;
        // First lookup: nothing reusable, so client will attempt create.
        if (sandboxListCalls === 1) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        // After create returns 409, list should reveal the existing sandbox.
        return new Response(
          JSON.stringify([{ id: "sandbox-existing", name: "vllm-studio_session-3", state: "running" }]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.endsWith("/api/sandbox") && method === "POST") {
        return new Response("already exists", { status: 409 });
      }

      if (url.includes("/toolbox/sandbox-existing/") && url.includes("/files/folder")) {
        return new Response("ok", { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.includes("/toolbox/sandbox-existing/") && url.includes("/files?") && method === "GET") {
        return createFileListResponse();
      }

      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    try {
      const client = new DaytonaToolboxClient(createConfig({ daytona_api_key: "token" }));
      const files = await client.listFiles("session-3", "");
      expect(files).toEqual([]);
      expect(calls.some((entry) => entry.method === "POST" && entry.url.endsWith("/api/sandbox"))).toBe(true);
      expect(calls.some((entry) => entry.url.includes("/toolbox/sandbox-existing/"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to legacy toolbox route when modern route returns 404", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ method: string; url: string }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      calls.push({ method, url });

      if (url.endsWith("/api/sandbox") && method === "GET") {
        return new Response(
          JSON.stringify([{ id: "sandbox-legacy", name: "vllm-studio-session_legacy", state: "running" }]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.includes("/toolbox/sandbox-legacy/files/folder")) {
        return new Response("not found", { status: 404 });
      }
      if (url.includes("/toolbox/sandbox-legacy/toolbox/files/folder")) {
        return new Response("ok", { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.includes("/toolbox/sandbox-legacy/files?") && method === "GET") {
        return new Response("not found", { status: 404 });
      }
      if (url.includes("/toolbox/sandbox-legacy/toolbox/files?") && method === "GET") {
        return createFileListResponse();
      }

      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    try {
      const client = new DaytonaToolboxClient(createConfig({ daytona_api_key: "token" }));
      const files = await client.listFiles("session-legacy", "");
      expect(files).toEqual([]);
      expect(
        calls.some((entry) => entry.url.includes("/toolbox/sandbox-legacy/toolbox/files/folder"))
      ).toBe(true);
      expect(
        calls.some((entry) => entry.url.includes("/toolbox/sandbox-legacy/toolbox/files?"))
      ).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("retries sandbox creation after cleaning stopped sandboxes on quota-style errors", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ method: string; url: string }> = [];
    let createAttempts = 0;
    let listedForCleanup = false;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      calls.push({ method, url });

      if (url.endsWith("/api/sandbox") && method === "GET") {
        if (createAttempts === 0) {
          // Initial findSessionSandbox lookup before first create attempt.
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (!listedForCleanup) {
          listedForCleanup = true;
          return new Response(
            JSON.stringify([{ id: "sandbox-stopped", name: "old-sandbox", state: "stopped" }]),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.endsWith("/api/sandbox") && method === "POST") {
        createAttempts += 1;
        if (createAttempts === 1) {
          return new Response("quota exceeded", { status: 403 });
        }
        return createSandboxResponse("sandbox-new");
      }

      if (url.endsWith("/api/sandbox/sandbox-stopped") && method === "DELETE") {
        return new Response("", { status: 204 });
      }

      if (url.includes("/toolbox/sandbox-new/") && url.includes("/files/folder")) {
        return new Response("ok", { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.includes("/toolbox/sandbox-new/") && url.includes("/files?") && method === "GET") {
        return createFileListResponse();
      }

      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    try {
      const client = new DaytonaToolboxClient(createConfig({ daytona_api_key: "token" }));
      const files = await client.listFiles("session-cleanup", "");
      expect(files).toEqual([]);
      expect(createAttempts).toBe(2);
      expect(
        calls.some((entry) => entry.method === "DELETE" && entry.url.endsWith("/api/sandbox/sandbox-stopped"))
      ).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles explicit proxy URLs that already include /toolbox", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ method: string; url: string }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      calls.push({ method, url });

      if (url.endsWith("/api/sandbox") && method === "GET") {
        return new Response(
          JSON.stringify([{ id: "sandbox-explicit", name: "vllm-studio-session_explicit", state: "running" }]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/toolbox/sandbox-explicit/files/folder")) {
        return new Response("ok", { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/toolbox/sandbox-explicit/files?") && method === "GET") {
        return createFileListResponse();
      }
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    try {
      const client = new DaytonaToolboxClient(
        createConfig({
          daytona_api_key: "token",
          daytona_proxy_url: "https://proxy.custom.daytona/toolbox",
        })
      );
      const files = await client.listFiles("session-explicit", "");
      expect(files).toEqual([]);
      expect(
        calls.some((entry) => entry.url.includes("https://proxy.custom.daytona/toolbox/sandbox-explicit/files/folder"))
      ).toBe(true);
      expect(calls.some((entry) => entry.url.includes("/toolbox/toolbox/"))).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
