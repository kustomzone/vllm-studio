// CRITICAL
const LOCAL_BACKEND_FALLBACK = "http://localhost:8080";
const CLIENT_PROXY_FALLBACK = "/api/proxy";

const pickFirstNonEmpty = (...values: Array<string | undefined>): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

/**
 * Backend URL from process env only (no localhost fallback).
 * Lets `BACKEND_URL` / `NEXT_PUBLIC_*` override a stale `api-settings.json` (common cause of “offline” in dev).
 */
export function resolveExplicitEnvBackendUrl(): string | undefined {
  const v = pickFirstNonEmpty(
    process.env.BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_BACKEND_URL,
    process.env.VLLM_STUDIO_BACKEND_URL,
  );
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
}

/**
 * Server-side API client base URL.
 * Mirrors historical precedence in `src/lib/api.ts`.
 */
export const resolveApiServerBaseUrl = (): string =>
  pickFirstNonEmpty(
    process.env.BACKEND_URL,
    process.env.NEXT_PUBLIC_BACKEND_URL,
    process.env.VLLM_STUDIO_BACKEND_URL,
  ) ?? LOCAL_BACKEND_FALLBACK;

/**
 * Default backend URL shown in settings/config UIs.
 * Mirrors historical precedence in `src/lib/api-settings.ts` and `use-configs.ts`.
 */
export const resolveSettingsDefaultBackendUrl = (): string =>
  pickFirstNonEmpty(
    process.env.BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_BACKEND_URL,
  ) ?? LOCAL_BACKEND_FALLBACK;

/**
 * Client-side controller event stream base URL.
 * Mirrors historical precedence in `use-controller-events.ts`.
 */
export const resolveControllerEventsBaseUrl = (): string =>
  pickFirstNonEmpty(
    process.env.NEXT_PUBLIC_BACKEND_URL,
    process.env.VLLM_STUDIO_BACKEND_URL,
    process.env.BACKEND_URL,
  ) ?? CLIENT_PROXY_FALLBACK;

