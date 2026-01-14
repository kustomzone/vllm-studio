import { test, expect } from '@playwright/test';
import { mockApi } from './utils/mock-api';

test.describe('API Mocking Smoke Test', () => {
  test('verifies API mocks are working', async ({ page }) => {
    // Setup API mocks
    await mockApi(page);

    // Navigate to dashboard
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify page title
    await expect(page).toHaveTitle(/vLLM Studio/);

    // Verify the page loaded (basic check)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('verifies health endpoint mock', async ({ page }) => {
    await mockApi(page);

    // Make a direct request to verify the mock
    const response = await page.request.get('/api/proxy/health');
    const data = await response.json();

    expect(data.status).toBe('ok');
    expect(data.backend_reachable).toBe(true);
    expect(data.running_model).toBe('llama-3.1-8b');
  });

  test('verifies status endpoint mock', async ({ page }) => {
    await mockApi(page);

    const response = await page.request.get('/api/proxy/status');
    const data = await response.json();

    expect(data.running).toBe(true);
    expect(data.process.pid).toBe(12345);
    expect(data.process.backend).toBe('vllm');
  });

  test('verifies GPUs endpoint mock', async ({ page }) => {
    await mockApi(page);

    const response = await page.request.get('/api/proxy/gpus');
    const data = await response.json();

    expect(data.count).toBe(1);
    expect(data.gpus).toHaveLength(1);
    expect(data.gpus[0].name).toBe('NVIDIA GeForce RTX 4090');
  });

  test('verifies recipes endpoint mock', async ({ page }) => {
    await mockApi(page);

    const response = await page.request.get('/api/proxy/recipes');
    const data = await response.json();

    expect(data).toHaveLength(3);
    expect(data[0].id).toBe('llama-3.1-8b');
    expect(data[0].status).toBe('running');
  });
});
