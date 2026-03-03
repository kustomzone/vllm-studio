import type { AgentFsApi } from "./types";

const DAYTONA_FALLBACK_STATUS_CODES = new Set([403, 423, 429, 500, 502, 503, 504]);
const DAYTONA_FALLBACK_MESSAGE_HINTS = [
  "quota",
  "limit",
  "storage",
  "capacity",
  "insufficient",
  "disk",
  "sandbox",
  "toolbox request failed",
];

const extractDaytonaStatus = (message: string): number | null => {
  const match = /\((\d{3})\)/.exec(message);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

export const shouldFallbackFromDaytona = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  if (!message.includes("[daytona]")) {
    return false;
  }

  const status = extractDaytonaStatus(message);
  if (status !== null && DAYTONA_FALLBACK_STATUS_CODES.has(status)) {
    return true;
  }

  return DAYTONA_FALLBACK_MESSAGE_HINTS.some((hint) => message.includes(hint));
};

/**
 * Agent filesystem adapter that starts with Daytona and permanently switches to local
 * storage once Daytona becomes unavailable.
 */
export class FallbackAgentFsApi implements AgentFsApi {
  private fallbackApi: AgentFsApi | null = null;
  private fallbackEnabled = false;

  /**
   * Build a Daytona-first filesystem adapter with lazy local fallback.
   * @param primaryApi Primary Daytona filesystem implementation.
   * @param fallbackFactory Local filesystem factory used on fallback.
   * @param onFallback Optional callback invoked once fallback is activated.
   */
  public constructor(
    private readonly primaryApi: AgentFsApi,
    private readonly fallbackFactory: () => Promise<AgentFsApi>,
    private readonly onFallback?: (error: unknown) => void
  ) {}

  /**
   * List files for a directory.
   * @param path Filesystem path.
   * @returns Directory entries.
   */
  public async readdirPlus(path: string): ReturnType<AgentFsApi["readdirPlus"]> {
    return this.executeWithFallback((api) => api.readdirPlus(path));
  }

  /**
   * Create a directory.
   * @param path Filesystem path.
   */
  public async mkdir(path: string): Promise<void> {
    await this.executeWithFallback((api) => api.mkdir(path));
  }

  /**
   * Move/rename a path.
   * @param from Source path.
   * @param to Destination path.
   */
  public async rename(from: string, to: string): Promise<void> {
    await this.executeWithFallback((api) => api.rename(from, to));
  }

  /**
   * Read stat information for a path.
   * @param path Filesystem path.
   * @returns Lightweight stat object.
   */
  public async stat(path: string): Promise<{ isDirectory: () => boolean }> {
    return this.executeWithFallback((api) => api.stat(path));
  }

  /**
   * Read file contents.
   * @param path Filesystem path.
   * @param encoding Expected encoding.
   * @returns File content.
   */
  public async readFile(path: string, encoding: string): Promise<string> {
    return this.executeWithFallback((api) => api.readFile(path, encoding));
  }

  /**
   * Write file content.
   * @param path Filesystem path.
   * @param data Content payload.
   */
  public async writeFile(path: string, data: string | Buffer): Promise<void> {
    await this.executeWithFallback((api) => api.writeFile(path, data));
  }

  /**
   * Remove path (file or directory).
   * @param path Filesystem path.
   * @param options Removal options.
   * @param options.recursive Whether to remove directories recursively.
   * @param options.force Whether to ignore missing targets.
   */
  public async rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void> {
    await this.executeWithFallback((api) => api.rm(path, options));
  }

  /**
   * Resolve and memoize the local fallback API.
   * @returns Local fallback API instance.
   */
  private async getFallbackApi(): Promise<AgentFsApi> {
    if (this.fallbackApi) {
      return this.fallbackApi;
    }
    const fallback = await this.fallbackFactory();
    this.fallbackApi = fallback;
    return fallback;
  }

  /**
   * Execute an operation against Daytona first, then permanently switch to local fallback
   * if Daytona returns a fallback-eligible failure.
   * @param operation Filesystem operation callback.
   * @returns Operation result.
   */
  private async executeWithFallback<T>(operation: (api: AgentFsApi) => Promise<T>): Promise<T> {
    if (this.fallbackEnabled) {
      const fallbackApi = await this.getFallbackApi();
      return operation(fallbackApi);
    }

    try {
      return await operation(this.primaryApi);
    } catch (error) {
      if (!shouldFallbackFromDaytona(error)) {
        throw error;
      }
      this.fallbackEnabled = true;
      this.onFallback?.(error);
      const fallbackApi = await this.getFallbackApi();
      return operation(fallbackApi);
    }
  }
}
