// CRITICAL
/**
 * Prefix for chat titles created by Playwright / E2E flows.
 * Controller purge script (`bun run script:chats:purge-test-sessions` in `controller/`) matches `e2e:` and Playwright-related titles.
 */
export const E2E_CHAT_TITLE_PREFIX = "E2E:";

export function e2eChatTitle(label: string): string {
  const trimmed = label.trim();
  return trimmed ? `${E2E_CHAT_TITLE_PREFIX} ${trimmed}` : `${E2E_CHAT_TITLE_PREFIX} chat`;
}
