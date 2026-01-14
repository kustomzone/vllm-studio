import { Page, RouteFromFetchOptions } from '@playwright/test';

/**
 * Mock API responses for E2E tests
 * Provides deterministic fixtures for all backend endpoints
 */

// Import fixture data
const fixtures = {
  health: require('../fixtures/health.json'),
  status: require('../fixtures/status.json'),
  gpus: require('../fixtures/gpus.json'),
  metrics: require('../fixtures/metrics.json'),
  recipes: require('../fixtures/recipes.json'),
  v1Models: require('../fixtures/v1-models.json'),
  chats: require('../fixtures/chats.json'),
  logs: require('../fixtures/logs.json'),
  usage: require('../fixtures/usage.json'),
  peakMetrics: require('../fixtures/peak-metrics.json'),
};

/**
 * Setup API mocking for the given page
 * Intercepts all /api/proxy/* and /api/* requests and returns fixture data
 */
export async function mockApi(page: Page): Promise<void> {
  // Health endpoint
  await page.route('**/api/proxy/health', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtures.health),
    });
  });

  // Status endpoint
  await page.route('**/api/proxy/status', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtures.status),
    });
  });

  // GPUs endpoint
  await page.route('**/api/proxy/gpus', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtures.gpus),
    });
  });

  // Metrics endpoint
  await page.route('**/api/proxy/metrics', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtures.metrics),
    });
  });

  // Recipes list endpoint
  await page.route('**/api/proxy/recipes', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtures.recipes),
    });
  });

  // Individual recipe endpoint
  await page.route('**/api/proxy/recipes/*', (route) => {
    const recipeId = route.request().url().split('/').pop();
    const recipe = fixtures.recipes.find((r: any) => r.id === recipeId);
    if (recipe) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(recipe),
      });
    } else {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Recipe not found' }),
      });
    }
  });

  // OpenAI v1/models endpoint
  await page.route('**/api/proxy/v1/models', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtures.v1Models),
    });
  });

  // Chats endpoint
  await page.route('**/api/proxy/chats', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtures.chats),
    });
  });

  // Individual chat endpoint
  await page.route('**/api/proxy/chats/*', (route) => {
    const chatId = route.request().url().split('/').pop();
    const chat = fixtures.chats.find((c: any) => c.id === chatId);
    if (chat) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(chat),
      });
    } else {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Chat not found' }),
      });
    }
  });

  // Logs endpoint
  await page.route('**/api/proxy/logs', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtures.logs),
    });
  });

  // Usage endpoint
  await page.route('**/api/proxy/usage', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtures.usage),
    });
  });

  // Peak metrics endpoint
  await page.route('**/api/proxy/peak-metrics', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtures.peakMetrics),
    });
  });
}

/**
 * Mock a specific API endpoint with custom response
 */
export async function mockEndpoint(
  page: Page,
  pattern: string | RegExp,
  response: object | { status: number; body: object }
): Promise<void> {
  await page.route(pattern, (route) => {
    if ('status' in response) {
      route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(response.body),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    }
  });
}

/**
 * Create a delayed mock response to simulate network latency
 */
export async function mockEndpointWithDelay(
  page: Page,
  pattern: string | RegExp,
  response: object,
  delayMs: number = 500
): Promise<void> {
  await page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock an error response
 */
export async function mockError(
  page: Page,
  pattern: string | RegExp,
  errorMessage: string,
  status: number = 500
): Promise<void> {
  await page.route(pattern, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: errorMessage }),
    });
  });
}

/**
 * Reset all mocks (close routes)
 * Note: Playwright doesn't have a built-in reset, so you'd need to
 * create a new page context or track routes manually
 */
export async function resetMocks(page: Page): Promise<void> {
  // In Playwright, routes are tied to the page context
  // To reset, you'd typically create a new context or use the page.reset()
  // For now, this is a placeholder for any cleanup logic needed
}
