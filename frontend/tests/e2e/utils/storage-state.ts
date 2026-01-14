import { Page } from '@playwright/test';

/**
 * LocalStorage helpers for E2E tests
 * Provides utilities to seed and manage localStorage state
 */

export const defaultStorageState = {
  theme: 'dark',
  sidebarCollapsed: false,
  pinnedRecipes: [],
  recentChats: [],
  userPreferences: {
    fontSize: 'medium',
    streamingEnabled: true,
    showThinking: true,
  },
};

/**
 * Seed localStorage with default test state
 */
export async function seedLocalStorage(page: Page, overrides: Record<string, any> = {}): Promise<void> {
  const state = { ...defaultStorageState, ...overrides };

  await page.evaluate((state) => {
    Object.entries(state).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
  }, state as any); // Type assertion needed for page.evaluate
}

/**
 * Clear all localStorage
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

/**
 * Get a localStorage item
 */
export async function getStorageItem(page: Page, key: string): Promise<any> {
  return await page.evaluate((k) => {
    const item = localStorage.getItem(k);
    return item ? JSON.parse(item) : null;
  }, key);
}

/**
 * Set a localStorage item
 */
export async function setStorageItem(page: Page, key: string, value: any): Promise<void> {
  await page.evaluate(({ k, v }) => {
    localStorage.setItem(k, JSON.stringify(v));
  }, { k: key, v: value });
}

/**
 * Mock authenticated user session
 */
export async function mockAuthSession(page: Page): Promise<void> {
  await setStorageItem(page, 'auth', {
    token: 'mock-test-token',
    user: {
      id: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
    },
    expiresAt: Date.now() + 3600000, // 1 hour from now
  });
}

/**
 * Mock theme preference
 */
export async function setTheme(page: Page, theme: 'light' | 'dark' = 'dark'): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
}

/**
 * Create a storage state file for reuse across tests
 * This can be used with `use.storageState(path)` in playwright.config.ts
 */
export async function createStorageStateFile(
  context: any,
  path: string,
  customState?: Record<string, any>
): Promise<void> {
  const page = await context.newPage();
  await seedLocalStorage(page, customState);
  await context.storageState({ path });
  await page.close();
}
