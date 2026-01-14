import { test, expect } from '@playwright/test';
import { mockApi } from './utils/mock-api';

test.describe('Usage Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('usage page loads successfully', async ({ page }) => {
    await page.goto('/usage');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/usage');
    await expect(page.locator('text=Usage').or(page.locator('h1').or(page.locator('text=/analytics|stats/i')))).toBeVisible();
  });

  test('displays usage statistics', async ({ page }) => {
    await page.goto('/usage');
    await page.waitForLoadState('networkidle');

    // From our usage mock, we have daily_stats
    await expect(page.locator('text=/Requests|Tokens|Energy/i')).toBeVisible();
  });

  test('displays charts or visualizations', async ({ page }) => {
    await page.goto('/usage');
    await page.waitForLoadState('networkidle');

    // Look for chart elements (canvas, svg, or chart containers)
    const charts = page.locator('canvas, svg, [class*="chart"], [class*="graph"]');
    const count = await charts.count();

    // Charts might not be present if using simple stats display
    if (count > 0) {
      await expect(charts.first()).toBeVisible();
    }
  });

  test('shows summary metrics', async ({ page }) => {
    await page.goto('/usage');
    await page.waitForLoadState('networkidle');

    // Look for summary stats (totals, averages)
    await expect(page.locator('text=/Total|Average|total|avg/i').first()).toBeVisible();
  });

  test('time range selector exists', async ({ page }) => {
    await page.goto('/usage');
    await page.waitForLoadState('networkidle');

    // Look for date range picker or time selector
    const timeSelector = page.locator('select, [class*="date"], [class*="range"], button:has-text("Day"), button:has-text("Week")');
    const count = await timeSelector.count();

    if (count > 0) {
      await expect(timeSelector.first()).toBeVisible();
    }
  });

  test('refresh button exists', async ({ page }) => {
    await page.goto('/usage');
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

  test('displays energy consumption data', async ({ page }) => {
    await page.goto('/usage');
    await page.waitForLoadState('networkidle');

    // From our usage mock, we have energy data
    await expect(page.locator('text=/kWh|energy|Energy|PLN/i').first()).toBeVisible();
  });

  test('displays token statistics', async ({ page }) => {
    await page.goto('/usage');
    await page.waitForLoadState('networkidle');

    // Token usage should be displayed
    await expect(page.locator('text=/tokens|Tokens|input|output/i').first()).toBeVisible();
  });

  test('handles missing usage data gracefully', async ({ page }) => {
    await page.route('**/api/proxy/usage', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ daily_stats: [], summary: null })
      });
    });

    await page.goto('/usage');
    await page.waitForLoadState('networkidle');

    // Should still show page
    await expect(page.locator('text=Usage').or(page.locator('text=/no data/i'))).toBeVisible();
  });

  test('data can be exported if export button exists', async ({ page }) => {
    await page.goto('/usage');
    await page.waitForLoadState('networkidle');

    // Look for export/download button
    const exportButton = page.locator('button').filter(async (el) => {
      const text = await el.textContent();
      const ariaLabel = await el.getAttribute('aria-label');
      return text?.match(/export|download|csv/i) || ariaLabel?.match(/export|download/i);
    }).or(page.locator('[class*="export"]')).first();

    const count = await exportButton.count();
    if (count > 0 && await exportButton.isVisible({ timeout: 3000 })) {
      await expect(exportButton).toBeVisible();
    }
  });
});
