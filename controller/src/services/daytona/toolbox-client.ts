// CRITICAL
import type { Config } from "../../config/env";

const DEFAULT_DAYTONA_API_BASE_URL = "https://app.daytona.io/api";
const SESSION_ROOT_PREFIX = "workspace/vllm-studio";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

const RETRYABLE_STATUS_CODES = new Set([403, 404, 409, 423, 429, 500, 502, 503, 504]);

interface ToolboxError {
  status: number;
  method: HttpMethod;
  path: string;
  bodySnippet: string;
  sandboxId?: string;
}

export interface DaytonaFileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
}

export interface DaytonaCommandResult {
  result: string;
  exitCode: number | null;
  raw: Record<string, unknown>;
}

const trimOptional = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const sanitizeSessionId = (sessionId: string): string => {
  const cleaned = sessionId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned.length > 0 ? cleaned : "session";
};

const parseBooleanLike = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  if (typeof value === "number") return value > 0;
  return false;
};

const parseStringLike = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

const parseNumberLike = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const resolveDaytonaProxyBaseUrl = (
  apiBaseUrl: string,
  explicitProxyBaseUrl?: string
): string => {
  const explicit = trimOptional(explicitProxyBaseUrl);
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const apiUrl = new URL(apiBaseUrl);
  const host = apiUrl.hostname;
  if (host.startsWith("proxy.")) {
    apiUrl.pathname = "";
    apiUrl.search = "";
    apiUrl.hash = "";
    return apiUrl.toString().replace(/\/+$/, "");
  }

  apiUrl.hostname = host.startsWith("app.") ? `proxy.${host}` : `proxy.${host}`;
  apiUrl.pathname = "";
  apiUrl.search = "";
  apiUrl.hash = "";
  return apiUrl.toString().replace(/\/+$/, "");
};

const resolveDaytonaRuntime = (config: Config) => {
  const apiKey =
    trimOptional(config.daytona_api_key) ??
    trimOptional(process.env["VLLM_STUDIO_DAYTONA_API_KEY"]);
  const apiBaseUrl =
    trimOptional(config.daytona_api_url) ??
    trimOptional(process.env["VLLM_STUDIO_DAYTONA_API_URL"]) ??
    DEFAULT_DAYTONA_API_BASE_URL;
  const proxyBaseUrl = resolveDaytonaProxyBaseUrl(
    apiBaseUrl,
    trimOptional(config.daytona_proxy_url) ??
      trimOptional(process.env["VLLM_STUDIO_DAYTONA_PROXY_URL"])
  );
  const sandboxId =
    trimOptional(config.daytona_sandbox_id) ??
    trimOptional(process.env["VLLM_STUDIO_DAYTONA_SANDBOX_ID"]);

  return {
    apiKey,
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
    proxyBaseUrl,
    sandboxId,
    agentMode: config.daytona_agent_mode,
  };
};

export const isDaytonaAgentModeEnabled = (config: Config): boolean => {
  const runtime = resolveDaytonaRuntime(config);
  return Boolean(runtime.agentMode && runtime.apiKey);
};

export class DaytonaToolboxClient {
  private readonly apiBaseUrl: string;
  private readonly proxyBaseUrl: string;
  private readonly apiKey: string;
  private readonly configuredSandboxId: string | undefined;
  private readonly sandboxBySession = new Map<string, string>();
  private readonly ensuredRoots = new Set<string>();
  private readonly sandboxOrderBySession = new Map<string, string[]>();

  public constructor(config: Config) {
    const runtime = resolveDaytonaRuntime(config);
    if (!runtime.apiKey) {
      throw new Error("Daytona API key is required");
    }
    this.apiBaseUrl = runtime.apiBaseUrl;
    this.proxyBaseUrl = runtime.proxyBaseUrl;
    this.apiKey = runtime.apiKey;
    this.configuredSandboxId = runtime.sandboxId;
  }

  public async listFiles(sessionId: string, path: string): Promise<DaytonaFileEntry[]> {
    const sessionPath = this.resolveSessionPath(sessionId, path);

    let payload: unknown;
    await this.withToolboxRetry(
      sessionId,
      "list files",
      async () => {
        await this.ensureSessionRoot(sessionId);
        const query = this.buildQuery({ path: sessionPath.length > 0 ? sessionPath : undefined });
        payload = await this.requestToolboxJson(sessionId, "GET", `/files${query}`);
      }
    );

    const rows = Array.isArray(payload) ? payload : [];
    return rows
      .map((entry) => this.parseFileEntry(entry))
      .filter((entry): entry is DaytonaFileEntry => entry !== null);
  }

  public async getFileInfo(
    sessionId: string,
    path: string
  ): Promise<{ isDirectory: boolean; size: number }> {
    const sessionPath = this.resolveSessionPath(sessionId, path);

    let payload: unknown;
    await this.withToolboxRetry(
      sessionId,
      "get file info",
      async () => {
        await this.ensureSessionRoot(sessionId);
        const query = this.buildQuery({ path: sessionPath });
        payload = await this.requestToolboxJson(sessionId, "GET", `/files/info${query}`);
      }
    );

    const record = (payload ?? {}) as Record<string, unknown>;
    const isDirectory =
      parseBooleanLike(record["isDir"]) ||
      parseBooleanLike(record["isDirectory"]) ||
      parseBooleanLike(record["IsDirectory"]) ||
      parseStringLike(record["type"]).toLowerCase() === "dir";
    const size = parseNumberLike(record["size"]) ?? parseNumberLike(record["Size"]) ?? 0;
    return { isDirectory, size };
  }

  public async readFile(sessionId: string, path: string): Promise<string> {
    const sessionPath = this.resolveSessionPath(sessionId, path);

    let content = "";
    await this.withToolboxRetry(
      sessionId,
      "read file",
      async () => {
        await this.ensureSessionRoot(sessionId);
        const query = this.buildQuery({ path: sessionPath });
        content = await this.requestToolboxText(sessionId, "GET", `/files/download${query}`);
      }
    );

    return content;
  }

  public async writeFile(sessionId: string, path: string, data: string | Buffer): Promise<void> {
    const sessionPath = this.resolveSessionPath(sessionId, path);
    const payload = typeof data === "string" ? data : new Uint8Array(data);

    await this.withToolboxRetry(
      sessionId,
      "write file",
      async () => {
        await this.ensureSessionRoot(sessionId);
        const query = this.buildQuery({ path: sessionPath });
        const form = new FormData();
        form.set("file", new Blob([payload]), "file");
        const { response, sandboxId } = await this.requestToolbox(
          sessionId,
          "POST",
          `/files/upload${query}`,
          {
            body: form,
          }
        );
        if (!response.ok) {
          const body = await response.text();
          throw this.createToolboxError("POST", `/files/upload${query}`, response.status, body, sandboxId);
        }
      }
    );
  }

  public async deletePath(
    sessionId: string,
    path: string,
    options: { recursive: boolean; force: boolean }
  ): Promise<void> {
    const sessionPath = this.resolveSessionPath(sessionId, path);

    await this.withToolboxRetry(
      sessionId,
      "delete path",
      async () => {
        await this.ensureSessionRoot(sessionId);
        const query = this.buildQuery({
          path: sessionPath,
          recursive: options.recursive ? "true" : undefined,
          force: options.force ? "true" : undefined,
        });
        const { response, sandboxId } = await this.requestToolbox(sessionId, "DELETE", `/files${query}`);
        if (!response.ok) {
          const body = await response.text();
          if (options.force && response.status === 404) {
            return;
          }
          throw this.createToolboxError("DELETE", `/files${query}`, response.status, body, sandboxId);
        }
      }
    );
  }

  public async createFolder(sessionId: string, path: string, mode = "755"): Promise<void> {
    const cleaned = path.replace(/^\/+/, "").trim();
    const sessionPath = this.resolveSessionPath(sessionId, path);

    await this.withToolboxRetry(
      sessionId,
      "create folder",
      async () => {
        if (cleaned.length > 0) {
          await this.ensureSessionRoot(sessionId);
        }
        const query = this.buildQuery({ path: sessionPath, mode });
        const { response, sandboxId } = await this.requestToolbox(
          sessionId,
          "POST",
          `/files/folder${query}`
        );
        if (!response.ok && response.status !== 409) {
          const body = await response.text();
          throw this.createToolboxError("POST", `/files/folder${query}`, response.status, body, sandboxId);
        }
      }
    );
  }

  public async movePath(
    sessionId: string,
    sourcePath: string,
    destinationPath: string
  ): Promise<void> {
    const source = this.resolveSessionPath(sessionId, sourcePath);
    const destination = this.resolveSessionPath(sessionId, destinationPath);

    await this.withToolboxRetry(
      sessionId,
      "move path",
      async () => {
        await this.ensureSessionRoot(sessionId);
        const query = this.buildQuery({ source, destination });
        await this.requestToolboxJson(sessionId, "POST", `/files/move${query}`);
      }
    );
  }

  public async executeCommand(
    sessionId: string,
    command: string,
    options: {
      cwd?: string;
      timeout?: number;
      env?: Record<string, string>;
    } = {}
  ): Promise<DaytonaCommandResult> {
    const cwd = this.resolveCommandCwd(sessionId, options.cwd);
    const payload: Record<string, unknown> = {
      command,
      ...(cwd ? { cwd } : {}),
      ...(typeof options.timeout === "number" && Number.isFinite(options.timeout)
        ? { timeout: options.timeout }
        : {}),
      ...(options.env ? { env: options.env } : {}),
    };

    let result: Record<string, unknown> = {};
    await this.withToolboxRetry(
      sessionId,
      "execute command",
      async () => {
        await this.ensureSessionRoot(sessionId);
        result = (await this.requestToolboxJson(
          sessionId,
          "POST",
          "/process/execute",
          payload
        )) as Record<string, unknown>;
      }
    );

    const output = parseStringLike(result["result"]) || parseStringLike(result["output"]);
    const exitCode = parseNumberLike(result["exitCode"]) ?? parseNumberLike(result["exit_code"]);

    return {
      result: output || JSON.stringify(result, null, 2),
      exitCode,
      raw: result,
    };
  }

  public async listSandboxes(): Promise<Array<{ id: string; name: string; state: string }>> {
    const payload = await this.requestApiJson("GET", "/sandbox");
    const items = Array.isArray(payload) ? payload : [];
    return items.map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        id: parseStringLike(record["id"]),
        name: parseStringLike(record["name"]),
        state: parseStringLike(record["state"] ?? record["status"]),
      };
    }).filter((s) => s.id.length > 0);
  }

  public async deleteSandbox(sandboxId: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/sandbox/${sandboxId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok && response.status !== 404) {
      const body = await response.text();
      throw new Error(`[Daytona] delete sandbox failed (${response.status}): ${body.slice(0, 300)}`);
    }
    for (const [sessionId, cached] of this.sandboxBySession) {
      if (cached === sandboxId) {
        this.sandboxBySession.delete(sessionId);
      }
      const existing = this.sandboxOrderBySession.get(sessionId);
      if (existing && existing.includes(sandboxId)) {
        const next = existing.filter((id) => id !== sandboxId);
        if (next.length > 0) {
          this.sandboxOrderBySession.set(sessionId, next);
        } else {
          this.sandboxOrderBySession.delete(sessionId);
        }
      }
    }
  }

  public async cleanupStoppedSandboxes(): Promise<{ deleted: number; errors: string[] }> {
    const sandboxes = await this.listSandboxes();
    const stopped = sandboxes.filter((s) => s.state === "stopped");
    let deleted = 0;
    const errors: string[] = [];
    for (const sandbox of stopped) {
      try {
        await this.deleteSandbox(sandbox.id);
        deleted++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return { deleted, errors };
  }

  private getSessionRoot(sessionId: string): string {
    return `${SESSION_ROOT_PREFIX}/${sanitizeSessionId(sessionId)}`;
  }

  private resolveSessionPath(sessionId: string, path: string): string {
    const cleaned = path.replace(/^\/+/, "").trim();
    const sessionRoot = this.getSessionRoot(sessionId);
    return cleaned ? `${sessionRoot}/${cleaned}` : sessionRoot;
  }

  private resolveCommandCwd(sessionId: string, cwd?: string): string {
    const raw = (cwd ?? "").trim();
    if (!raw) {
      return this.getSessionRoot(sessionId);
    }
    if (raw.startsWith("/")) {
      return raw;
    }
    return `${this.getSessionRoot(sessionId)}/${raw.replace(/^\/+/, "")}`;
  }

  private buildQuery(values: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "string" && value.length > 0) {
        params.set(key, value);
      }
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  private parseFileEntry(entry: unknown): DaytonaFileEntry | null {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const record = entry as Record<string, unknown>;
    const rawName =
      parseStringLike(record["name"]) ||
      parseStringLike(record["Name"]) ||
      parseStringLike(record["path"]) ||
      parseStringLike(record["Path"]);
    const name = rawName.split("/").filter(Boolean).at(-1) ?? rawName;
    if (!name) {
      return null;
    }
    const isDirectory =
      parseBooleanLike(record["isDir"]) ||
      parseBooleanLike(record["isDirectory"]) ||
      parseBooleanLike(record["IsDirectory"]) ||
      parseStringLike(record["type"]).toLowerCase() === "dir";
    const size = parseNumberLike(record["size"]) ?? parseNumberLike(record["Size"]) ?? 0;
    return { name, isDirectory, size };
  }

  private async resolveSandboxId(sessionId: string): Promise<string> {
    if (this.configuredSandboxId) {
      return this.configuredSandboxId;
    }

    const cached = this.sandboxBySession.get(sessionId);
    if (cached) {
      return cached;
    }

    const preferred = await this.findSessionSandbox(sessionId);
    if (preferred) {
      this.sandboxBySession.set(sessionId, preferred);
      return preferred;
    }

    return this.createAndCacheSessionSandbox(sessionId);
  }

  private extractSandboxId(payload: Record<string, unknown>): string {
    const direct =
      parseStringLike(payload["id"]) ||
      parseStringLike(payload["sandboxId"]) ||
      parseStringLike(payload["sandbox_id"]);
    if (direct) {
      return direct;
    }

    const nested = payload["sandbox"];
    if (nested && typeof nested === "object") {
      const nestedRecord = nested as Record<string, unknown>;
      const nestedId =
        parseStringLike(nestedRecord["id"]) ||
        parseStringLike(nestedRecord["sandboxId"]) ||
        parseStringLike(nestedRecord["sandbox_id"]);
      if (nestedId) {
        return nestedId;
      }
    }

    throw new Error(
      `[Daytona] Could not extract sandbox id from response: ${JSON.stringify(payload)}`
    );
  }

  private async ensureSessionRoot(sessionId: string): Promise<void> {
    const key = `${sessionId}`;
    if (this.ensuredRoots.has(key)) {
      return;
    }
    await this.createFolderInternal(sessionId, "", "755");
    this.ensuredRoots.add(key);
  }

  private async createFolderInternal(sessionId: string, path: string, mode = "755"): Promise<void> {
    const sessionPath = this.resolveSessionPath(sessionId, path);
    const query = this.buildQuery({ path: sessionPath, mode });
    const { response, sandboxId } = await this.requestToolbox(sessionId, "POST", `/files/folder${query}`);
    if (!response.ok && response.status !== 409) {
      const body = await response.text();
      throw this.createToolboxError("POST", `/files/folder${query}`, response.status, body, sandboxId);
    }
  }

  private async requestApiJson(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const url = `${this.apiBaseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const payload = await response.text();
      throw new Error(
        `[Daytona] API request failed (${response.status}): ${payload.slice(0, 600)}`
      );
    }
    return response.json();
  }

  private createToolboxError(
    method: HttpMethod,
    path: string,
    status: number,
    body: string,
    sandboxId?: string
  ): ToolboxError {
    return {
      status,
      method,
      path,
      ...(sandboxId ? { sandboxId } : {}),
      bodySnippet: body.slice(0, 600),
    };
  }

  private isToolboxError(value: unknown): value is ToolboxError {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return (
      typeof record["status"] === "number" &&
      typeof record["method"] === "string" &&
      typeof record["path"] === "string" &&
      typeof record["bodySnippet"] === "string"
    );
  }

  private formatToolboxError(operation: string, error: ToolboxError): Error {
    const sandbox = error.sandboxId ? ` sandbox=${error.sandboxId}` : "";
    return new Error(
      `[Daytona] ${operation} failed (${error.status})${sandbox}: ${error.method} ${error.path} - ${error.bodySnippet}`
    );
  }

  private isRetryableToolboxStatus(status: number): boolean {
    return RETRYABLE_STATUS_CODES.has(status);
  }

  private invalidateSessionState(sessionId: string): void {
    this.ensuredRoots.delete(sessionId);
    this.sandboxBySession.delete(sessionId);
  }

  private async withToolboxRetry(
    sessionId: string,
    operation: string,
    action: () => Promise<void>
  ): Promise<void> {
    const maxAttempts = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        await action();
        return;
      } catch (error) {
        lastError = error;
        if (!this.isToolboxError(error)) {
          throw error;
        }

        const shouldRetry = attempt < maxAttempts - 1 && this.isRetryableToolboxStatus(error.status);
        if (!shouldRetry) {
          throw this.formatToolboxError(operation, error);
        }

        const failedSandbox = error.sandboxId;
        this.invalidateSessionState(sessionId);

        let nextSandboxId: string | null = null;
        if (failedSandbox) {
          this.removeSessionSandboxId(sessionId, failedSandbox);
          nextSandboxId = this.sandboxOrderBySession.get(sessionId)?.[0] ?? null;
        }

        if (!nextSandboxId) {
          nextSandboxId = await this.findSessionSandbox(sessionId, failedSandbox);
        }

        if (!nextSandboxId) {
          nextSandboxId = await this.createAndCacheSessionSandbox(sessionId);
        }

        this.sandboxBySession.set(sessionId, nextSandboxId);
      }
    }

    if (this.isToolboxError(lastError)) {
      throw this.formatToolboxError(operation, lastError);
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async createSessionSandbox(sessionId: string): Promise<string> {
    const payload = (await this.requestApiJson("POST", "/sandbox", {
      name: `vllm-studio-${sanitizeSessionId(sessionId)}`,
      labels: {
        source: "vllm-studio",
        session_id: sanitizeSessionId(sessionId),
      },
    })) as Record<string, unknown>;

    return this.extractSandboxId(payload);
  }

  private async createAndCacheSessionSandbox(sessionId: string): Promise<string> {
    const sandboxId = await this.createSessionSandbox(sessionId);
    this.sandboxBySession.set(sessionId, sandboxId);
    this.pushSessionSandboxId(sessionId, sandboxId);
    return sandboxId;
  }

  private async findSessionSandbox(
    sessionId: string,
    excludedSandboxId?: string
  ): Promise<string | null> {
    const existingOrder = this.sandboxOrderBySession.get(sessionId);
    if (existingOrder && existingOrder.length > 0) {
      const first = existingOrder.find((id) => id !== excludedSandboxId);
      if (first) return first;
    }

    const sessionKey = sanitizeSessionId(sessionId);
    const all = await this.listSandboxes();
    const preferred = all.find(
      (sandbox) =>
        sandbox.id !== excludedSandboxId &&
        sandbox.name === `vllm-studio-${sessionKey}` &&
        sandbox.state !== "stopped"
    );
    if (preferred) {
      this.pushSessionSandboxId(sessionId, preferred.id);
      return preferred.id;
    }

    const fallback = all.find(
      (sandbox) => sandbox.id !== excludedSandboxId && sandbox.state !== "stopped"
    );
    if (!fallback) return null;
    this.pushSessionSandboxId(sessionId, fallback.id);
    return fallback.id;
  }

  private pushSessionSandboxId(sessionId: string, sandboxId: string): void {
    const existing = this.sandboxOrderBySession.get(sessionId) ?? [];
    if (existing.includes(sandboxId)) {
      this.sandboxOrderBySession.set(
        sessionId,
        [sandboxId, ...existing.filter((id) => id !== sandboxId)]
      );
      return;
    }
    this.sandboxOrderBySession.set(sessionId, [sandboxId, ...existing]);
  }

  private removeSessionSandboxId(sessionId: string, sandboxId: string): void {
    const existing = this.sandboxOrderBySession.get(sessionId);
    if (!existing) return;
    const next = existing.filter((id) => id !== sandboxId);
    if (next.length > 0) {
      this.sandboxOrderBySession.set(sessionId, next);
    } else {
      this.sandboxOrderBySession.delete(sessionId);
    }
  }

  private async requestToolbox(
    sessionId: string,
    method: HttpMethod,
    path: string,
    init: {
      body?: BodyInit;
      headers?: Record<string, string>;
    } = {}
  ): Promise<{ response: Response; sandboxId: string }> {
    const sandboxId = await this.resolveSandboxId(sessionId);
    const url = `${this.proxyBaseUrl}/toolbox/${sandboxId}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers ?? {}),
      },
      ...(init.body ? { body: init.body } : {}),
    });
    return { response, sandboxId };
  }

  private async requestToolboxJson(
    sessionId: string,
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const { response, sandboxId } = await this.requestToolbox(sessionId, method, path, {
      ...(body
        ? {
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
          }
        : {}),
    });

    if (!response.ok) {
      const payload = await response.text();
      throw this.createToolboxError(method, path, response.status, payload, sandboxId);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    const text = await response.text();
    if (!text) {
      return {};
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { result: text };
    }
  }

  private async requestToolboxText(
    sessionId: string,
    method: HttpMethod,
    path: string
  ): Promise<string> {
    const { response, sandboxId } = await this.requestToolbox(sessionId, method, path);
    if (!response.ok) {
      const payload = await response.text();
      throw this.createToolboxError(method, path, response.status, payload, sandboxId);
    }
    return response.text();
  }
}

const daytonaClientCache = new Map<string, DaytonaToolboxClient>();

export const getDaytonaToolboxClient = (config: Config): DaytonaToolboxClient => {
  const runtime = resolveDaytonaRuntime(config);
  if (!runtime.apiKey) {
    throw new Error("Daytona agent mode is not configured: missing API key");
  }
  const cacheKey = `${runtime.apiBaseUrl}|${runtime.proxyBaseUrl}|${runtime.sandboxId ?? ""}|${runtime.apiKey}`;
  const cached = daytonaClientCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const client = new DaytonaToolboxClient(config);
  daytonaClientCache.set(cacheKey, client);
  return client;
};

export const clearDaytonaToolboxClientCache = (): void => {
  daytonaClientCache.clear();
};
