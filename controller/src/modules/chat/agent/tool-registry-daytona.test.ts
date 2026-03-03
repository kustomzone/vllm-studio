import { describe, expect, it } from "bun:test";
import type { Config } from "../../../config/env";
import { clearDaytonaToolboxClientCache } from "../../../services/daytona/toolbox-client";
import { buildDaytonaTools } from "./tool-registry-daytona";
import { AGENT_TOOL_NAMES } from "./contracts";

const createConfig = (overrides: Partial<Config> = {}): Config => ({
  host: "0.0.0.0",
  port: 8080,
  inference_port: 8000,
  data_dir: "/tmp/vllm-studio",
  db_path: "/tmp/vllm-studio/controller.db",
  models_dir: "/models",
  strict_openai_models: false,
  daytona_agent_mode: true,
  agent_fs_local_fallback: false,
  ...overrides,
});

describe("daytona execute_command tool", () => {
  it("accepts cmd/workdir/timeout_ms aliases and normalizes payload", async () => {
    clearDaytonaToolboxClientCache();
    const originalFetch = globalThis.fetch;
    let executePayload: Record<string, unknown> | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);

      if (url.endsWith("/api/sandbox") && method === "GET") {
        return new Response(
          JSON.stringify([{ id: "sandbox-tool", name: "vllm-studio-session_tools", state: "running" }]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.includes("/files/folder")) {
        return new Response("ok", { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.includes("/process/execute")) {
        const body =
          typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
        executePayload = body;
        return new Response(JSON.stringify({ result: "done", exitCode: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    try {
      const tools = buildDaytonaTools(
        { config: createConfig({ daytona_api_key: "token" }) } as never,
        { sessionId: "session-tools", agentMode: true }
      );
      const executeTool = tools.find((tool) => tool.name === AGENT_TOOL_NAMES.EXECUTE_COMMAND);
      expect(executeTool).toBeDefined();

      const result = await executeTool!.execute("call-1", {
        cmd: "echo hello",
        workdir: "research",
        timeout_ms: 1500,
      });

      const textPart = result.content.find(
        (item): item is { type: "text"; text: string } => item.type === "text"
      );
      expect(textPart?.text).toBe("done");
      expect(executePayload?.["command"] as string | undefined).toBe("echo hello");
      expect(executePayload?.["timeout"] as number | undefined).toBe(2);
      expect(String(executePayload?.["cwd"] ?? "")).toContain("workspace/vllm-studio/session-tools/research");
    } finally {
      globalThis.fetch = originalFetch;
      clearDaytonaToolboxClientCache();
    }
  });

  it("accepts raw string params as command input", async () => {
    clearDaytonaToolboxClientCache();
    const originalFetch = globalThis.fetch;
    let executePayload: Record<string, unknown> | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);

      if (url.endsWith("/api/sandbox") && method === "GET") {
        return new Response(
          JSON.stringify([{ id: "sandbox-tool-raw", name: "vllm-studio-session_raw", state: "running" }]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.includes("/files/folder")) {
        return new Response("ok", { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.includes("/process/execute")) {
        executePayload =
          typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
        return new Response(JSON.stringify({ result: "ok", exitCode: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    try {
      const tools = buildDaytonaTools(
        { config: createConfig({ daytona_api_key: "token" }) } as never,
        { sessionId: "session-raw", agentMode: true }
      );
      const executeTool = tools.find((tool) => tool.name === AGENT_TOOL_NAMES.EXECUTE_COMMAND);
      expect(executeTool).toBeDefined();

      const result = await executeTool!.execute("call-2", "pwd");
      const textPart = result.content.find(
        (item): item is { type: "text"; text: string } => item.type === "text"
      );
      expect(textPart?.text).toBe("ok");
      expect(executePayload?.["command"] as string | undefined).toBe("pwd");
    } finally {
      globalThis.fetch = originalFetch;
      clearDaytonaToolboxClientCache();
    }
  });

  it("exposes computer_use as an execute_command alias", async () => {
    clearDaytonaToolboxClientCache();
    const originalFetch = globalThis.fetch;
    let executePayload: Record<string, unknown> | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);

      if (url.endsWith("/api/sandbox") && method === "GET") {
        return new Response(
          JSON.stringify([{ id: "sandbox-tool-computer", name: "vllm-studio-session_computer", state: "running" }]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.includes("/files/folder")) {
        return new Response("ok", { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.includes("/process/execute")) {
        executePayload =
          typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
        return new Response(JSON.stringify({ result: "computer-ok", exitCode: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    try {
      const tools = buildDaytonaTools(
        { config: createConfig({ daytona_api_key: "token" }) } as never,
        { sessionId: "session-computer", agentMode: true }
      );
      const computerTool = tools.find((tool) => tool.name === AGENT_TOOL_NAMES.COMPUTER_USE);
      expect(computerTool).toBeDefined();

      const result = await computerTool!.execute("call-computer", { cmd: "pwd", timeout_ms: 2300 });
      const textPart = result.content.find(
        (item): item is { type: "text"; text: string } => item.type === "text"
      );
      expect(textPart?.text).toBe("computer-ok");
      expect(executePayload?.["command"] as string | undefined).toBe("pwd");
      expect(executePayload?.["timeout"] as number | undefined).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
      clearDaytonaToolboxClientCache();
    }
  });

  it("browser_open_url probes URLs from the backend machine", async () => {
    clearDaytonaToolboxClientCache();
    const originalFetch = globalThis.fetch;
    let executePayload: Record<string, unknown> | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);

      if (url.endsWith("/api/sandbox") && method === "GET") {
        return new Response(
          JSON.stringify([{ id: "sandbox-tool-browser", name: "vllm-studio-session_browser", state: "running" }]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.includes("/files/folder")) {
        return new Response("ok", { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url.includes("/process/execute")) {
        executePayload =
          typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
        return new Response(
          JSON.stringify({ result: "URL: https://example.com\nTitle: Example\nPreview: hello", exitCode: 0 }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        );
      }

      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    try {
      const tools = buildDaytonaTools(
        { config: createConfig({ daytona_api_key: "token" }) } as never,
        { sessionId: "session-browser", agentMode: true }
      );
      const browserTool = tools.find((tool) => tool.name === AGENT_TOOL_NAMES.BROWSER_OPEN_URL);
      expect(browserTool).toBeDefined();

      const result = await browserTool!.execute("call-browser", { url: "https://example.com" });
      const textPart = result.content.find(
        (item): item is { type: "text"; text: string } => item.type === "text"
      );
      expect(textPart?.text).toContain("Title: Example");
      expect(String(executePayload?.["command"] ?? "")).toContain("curl -L");
      expect(String(executePayload?.["command"] ?? "")).toContain("https://example.com");
    } finally {
      globalThis.fetch = originalFetch;
      clearDaytonaToolboxClientCache();
    }
  });
});
