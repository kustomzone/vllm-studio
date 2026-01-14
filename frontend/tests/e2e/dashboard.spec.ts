import { test, expect } from '@playwright/test';
import { mockApi } from './utils/mock-api';

test.describe('Dashboard Page', () => {
  // Setup API mocks for all tests
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('loads dashboard and displays model status', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify page title
    await expect(page).toHaveTitle(/vLLM Studio/);

    // Verify model status is displayed
    // The page should show the running model from our mock
    const modelIndicator = page.locator('text=llama-3.1-8b').or(page.locator('text=Llama 3.1 8B'));
    await expect(modelIndicator).toBeVisible();

    // Verify PID is shown for running model
    await expect(page.locator('text=/pid \\d+/')).toBeVisible();
  });

  test('displays GPU information correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify GPU status section exists
    const gpuSection = page.getByText('GPU Status');
    await expect(gpuSection).toBeVisible();

    // Verify GPU data is displayed (from our mock)
    // Should show GPU 0 with RTX 4090 info
    await expect(page.locator('text=GPU 0')).toBeVisible();

    // Verify temperature is shown
    const temperature = page.locator('text=/°/').first();
    await expect(temperature).toBeVisible();

    // Verify power draw is shown
    const power = page.locator('text=/W/').first();
    await expect(power).toBeVisible();
  });

  test('displays metrics cards when model is running', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify metrics row is visible (only shown when process is running)
    const requestsMetric = page.locator('text=Requests').first();
    await expect(requestsMetric).toBeVisible();

    // Verify generation throughput
    const genMetric = page.locator('text=Gen').first();
    await expect(genMetric).toBeVisible();

    // Verify TTFT metric
    const ttftMetric = page.locator('text=TTFT').first();
    await expect(ttftMetric).toBeVisible();

    // Verify KV Cache metric
    const kvCacheMetric = page.locator('text=KV Cache').first();
    await expect(kvCacheMetric).toBeVisible();
  });

  test('displays session and lifetime statistics', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify Session section
    await expect(page.locator('text=Session')).toBeVisible();

    // Verify Lifetime section
    await expect(page.locator('text=Lifetime')).toBeVisible();

    // Verify some stats are displayed
    await expect(page.locator('text=Requests')).toBeVisible();
    await expect(page.locator('text=Input')).toBeVisible();
    await expect(page.locator('text=Output')).toBeVisible();
  });

  test('displays cost analytics section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify Cost Analytics section
    await expect(page.locator('text=Cost Analytics')).toBeVisible();

    // Verify total cost is displayed
    await expect(page.locator('text=Total Cost')).toBeVisible();

    // Verify energy metrics
    await expect(page.locator('text=kWh/M Input')).toBeVisible();
    await expect(page.locator('text=kWh/M Output')).toBeVisible();
  });

  test('displays recipes list with status indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify Recipes section
    await expect(page.locator('text=Recipes')).toBeVisible();

    // Verify at least one recipe is shown
    // From our mock, we have 3 recipes
    await expect(page.locator('text=Llama 3.1 8B Instruct')).toBeVisible();

    // Verify status indicators are present (green dot for running recipe)
    const statusDots = page.locator('.rounded-full[class*="bg-"]');
    await expect(statusDots.first()).toBeVisible();
  });

  test('search functionality filters recipes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on search input
    const searchInput = page.locator('input[placeholder="Search recipes..."]');
    await expect(searchInput).toBeVisible();
    await searchInput.click();

    // Type a search query
    await searchInput.fill('mistral');

    // Wait for search results
    await page.waitForTimeout(300);

    // Verify search results appear
    await expect(page.locator('text=Mistral 7B Instruct')).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // Verify all recipes are shown again
    await expect(page.locator('text=Llama 3.1 8B Instruct')).toBeVisible();
  });

  test('displays logs section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify Logs section
    await expect(page.locator('text=Logs')).toBeVisible();

    // Logs might be empty or contain entries - just verify section exists
    const logsContainer = page.locator('.overflow-auto').filter({ hasText: 'Logs' }).or(
      page.locator('text=No logs available')
    );
    await expect(logsContainer.first()).toBeVisible();
  });

  test('action buttons work correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify chat button exists and is clickable
    const chatButton = page.locator('button:has-text("chat")').first();
    await expect(chatButton).toBeVisible();

    // Click chat button
    await chatButton.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/chat');

    // Go back to dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify logs button exists
    const logsButton = page.locator('button:has-text("logs")').first();
    await expect(logsButton).toBeVisible();

    // Click logs button
    await logsButton.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/logs');
  });

  test('handles loading state', async ({ page }) => {
    // Use a slower mock to test loading state
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // The page might briefly show a loading state
    // Just verify the page eventually loads
    await page.waitForLoadState('networkidle');

    // Verify we're not on a loading state anymore
    await expect(page.locator('text=GPU Status')).toBeVisible();
  });
});
