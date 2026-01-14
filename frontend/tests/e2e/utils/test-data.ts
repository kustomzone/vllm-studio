/**
 * Test data helpers for E2E tests
 * Provides consistent test data and generators
 */

export const mockRecipe = {
  id: 'test-recipe-001',
  name: 'Test Model Recipe',
  model_path: 'test-org/test-model',
  backend: 'vllm' as const,
  port: 8000,
  served_model_name: 'test-model',
  dtype: 'bfloat16',
  gpu_memory_utilization: 0.9,
  max_model_len: 32768,
};

export const mockChat = {
  id: 'chat-test-001',
  title: 'Test Chat Session',
  model: 'test-model',
  created_at: '2025-01-14T10:00:00Z',
  updated_at: '2025-01-14T10:05:00Z',
};

export const mockMessage = {
  role: 'user' as const,
  content: 'Hello, this is a test message',
};

export const mockToolCall = {
  id: 'call_test_001',
  type: 'function' as const,
  function: {
    name: 'test_function',
    arguments: '{"param": "value"}',
  },
};

/**
 * Generate a list of mock recipes
 */
export function generateMockRecipes(count: number = 5) {
  return Array.from({ length: count }, (_, i) => ({
    id: `recipe-${i + 1}`,
    name: `Test Recipe ${i + 1}`,
    model_path: `test-org/model-${i + 1}`,
    backend: 'vllm' as const,
    port: 8000 + i,
    served_model_name: `model-${i + 1}`,
    status: i === 0 ? 'running' : 'stopped',
  }));
}

/**
 * Generate mock chat sessions
 */
export function generateMockChats(count: number = 3) {
  return Array.from({ length: count }, (_, i) => ({
    id: `chat-test-${i + 1}`,
    title: `Test Chat ${i + 1}`,
    model: 'test-model',
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
    updated_at: new Date(Date.now() - i * 86400000).toISOString(),
  }));
}

/**
 * Generate mock messages
 */
export function generateMockMessages(count: number = 5) {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `This is test message ${i + 1}`,
    });
  }
  return messages;
}

/**
 * Standard test strings for input validation
 */
export const testStrings = {
  empty: '',
  whitespace: '   ',
  specialChars: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/',
  unicode: 'Hello 世界 🌍 🚀',
  longString: 'a'.repeat(1000),
  url: 'https://example.com/path?query=value',
  email: 'test@example.com',
  number: '12345',
};

/**
 * Common selectors for test elements
 */
export const testSelectors = {
  // Navigation
  dashboardLink: '[data-testid="nav-dashboard"]',
  chatLink: '[data-testid="nav-chat"]',
  recipesLink: '[data-testid="nav-recipes"]',
  logsLink: '[data-testid="nav-logs"]',
  usageLink: '[data-testid="nav-usage"]',
  configsLink: '[data-testid="nav-configs"]',
  discoverLink: '[data-testid="nav-discover"]',

  // Dashboard
  modelStatus: '[data-testid="model-status"]',
  gpuInfo: '[data-testid="gpu-info"]',
  metricsCard: '[data-testid="metrics-card"]',

  // Chat
  chatInput: '[data-testid="chat-input"]',
  sendButton: '[data-testid="send-button"]',
  messageList: '[data-testid="message-list"]',

  // Recipes
  recipeCard: '[data-testid="recipe-card"]',
  launchButton: '[data-testid="launch-button"]',
  stopButton: '[data-testid="stop-button"]',

  // Common
  loadingSpinner: '[data-testid="loading-spinner"]',
  errorAlert: '[data-testid="error-alert"]',
  successAlert: '[data-testid="success-alert"]',
};

/**
 * Wait for conditions helper
 */
export const waitConditions = {
  // Network idle for X ms
  networkIdle: (ms: number = 500) => async ({ page }: any) => {
    await page.waitForLoadState('networkidle', { timeout: ms });
  },

  // Element to be visible
  elementVisible: (selector: string) => async ({ page }: any) => {
    await page.waitForSelector(selector, { state: 'visible' });
  },

  // Element to be hidden
  elementHidden: (selector: string) => async ({ page }: any) => {
    await page.waitForSelector(selector, { state: 'hidden' });
  },
};

/**
 * Navigation helpers
 */
export const navHelpers = {
  async gotoDashboard({ page }: any) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  },

  async gotoChat({ page }: any) {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
  },

  async gotoRecipes({ page }: any) {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');
  },

  async gotoLogs({ page }: any) {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
  },

  async gotoUsage({ page }: any) {
    await page.goto('/usage');
    await page.waitForLoadState('networkidle');
  },

  async gotoConfigs({ page }: any) {
    await page.goto('/configs');
    await page.waitForLoadState('networkidle');
  },

  async gotoDiscover({ page }: any) {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
  },
};
