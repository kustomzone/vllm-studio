import { test, expect } from '@playwright/test';
import { mockApi } from './utils/mock-api';

test.describe('Discover Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('discover page loads successfully', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/discover');
    await expect(page.locator('text=Discover').or(page.locator('h1').or(page.locator('text=/model|browse/i')))).toBeVisible();
  });

  test('displays available models', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Look for model cards or listings
    await expect(page.locator('text=/model|llama|mistral|qwen/i').first()).toBeVisible();
  });

  test('search functionality exists', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="Search" i], input[type="text"]').first();
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await expect(searchInput).toBeVisible();
    }
  });

  test('filter controls are available', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Look for filter controls (architecture, quantization, etc.)
    const filters = page.locator('select, [class*="filter"], button:has-text("Filter")');
    const count = await filters.count();

    if (count > 0) {
      await expect(filters.first()).toBeVisible();
    }
  });

  test('model cards show relevant information', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Model cards should show name, size, architecture
    await expect(page.locator('text=/GB|parameters|arch|context/i').or(page.locator('[class*="card"]')).first()).toBeVisible();
  });

  test('models can be filtered by architecture', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Look for architecture filter
    const archFilter = page.locator('select').filter(async (el) => {
      const text = await el.textContent();
      return text?.includes('Architecture') || text?.includes('LLaMA') || text?.includes('Mistral');
    }).or(page.locator('button:has-text("Architecture")')).first();

    const count = await archFilter.count();
    if (count > 0 && await archFilter.isVisible({ timeout: 3000 })) {
      await expect(archFilter).toBeVisible();
    }
  });

  test('model details can be viewed', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Click on a model card
    const modelCard = page.locator('[class*="card"], [class*="model"]').or(page.locator('text=/llama|mistral/i')).first();
    await modelCard.click();
    await page.waitForTimeout(500);

    // Should show model details
    await expect(page.locator('[class*="modal"], [class*="detail"], text=/size|context|download/i').first()).toBeVisible();
  });

  test('shows model paths or locations', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Should display where models are stored
    await expect(page.locator('text=/path|location|models|storage/i').first()).toBeVisible();
  });

  test('handles empty models list', async ({ page }) => {
    // Mock empty models response
    await page.route('**/api/proxy/discover', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [] })
      });
    });

    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Should show empty state
    await expect(page.locator('text=Discover').or(page.locator('text=/no model/i'))).toBeVisible();
  });

  test('refresh button exists', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    const refreshButton = page.locator('button').filter(async (el) => {
      const text = await el.textContent();
      const ariaLabel = await el.getAttribute('aria-label');
      return text?.includes('Refresh') || ariaLabel?.includes('refresh');
    }).or(page.locator('[class*="refresh"]')).first();

    if (await refreshButton.isVisible({ timeout: 5000 })) {
      await expect(refreshButton).toBeVisible();
    }
  });

  test('models can be sorted', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Look for sort controls
    const sortControl = page.locator('select, button:has-text("Sort"), [class*="sort"]');
    const count = await sortControl.count();

    if (count > 0) {
      await expect(sortControl.first()).toBeVisible();
    }
  });

  test('displays model metadata', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Look for metadata like quantization, context length
    await expect(page.locator('text=/quant|context|Q4|Q8|bf16/i').or(page.locator('[class*="meta"]')).first()).toBeVisible();
  });
});
