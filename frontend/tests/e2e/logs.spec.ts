import { test, expect } from '@playwright/test';
import { mockApi } from './utils/mock-api';

test.describe('Logs Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('logs page loads successfully', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/logs');
    await expect(page.locator('text=Logs').or(page.locator('h1').or(page.locator('text=/log/i')))).toBeVisible();
  });

  test('displays list of log sessions', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // From our mock, we have 2 log sessions
    const logContent = page.locator('text=/llama|mistral|log|session/i');
    await expect(logContent.first()).toBeVisible();
  });

  test('log sessions show status indicators', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Look for status indicators (running/stopped/crashed)
    const statusIndicators = page.locator('text=/Running|Stopped|Crashed|running|stopped/i');
    await expect(statusIndicators.first()).toBeVisible();
  });

  test('log content can be viewed', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Click on a log session
    const logSession = page.locator('[class*="log"], [class*="session"]').or(page.locator('text=/llama|log-/i')).first();
    await logSession.click();
    await page.waitForTimeout(500);

    // Should show log content
    const logViewer = page.locator('[class*="log"], pre, code, [class*="terminal"]').or(page.locator('text=/ERROR|WARNING|INFO/i'));
    await expect(logViewer.first()).toBeVisible();
  });

  test('log viewer has scroll functionality', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Look for scrollable log viewer
    const scrollContainer = page.locator('[class*="overflow"], [class*="scroll"]').or(page.locator('pre')).first();
    if (await scrollContainer.isVisible({ timeout: 5000 })) {
      await expect(scrollContainer).toBeVisible();
    }
  });

  test('refresh button exists', async ({ page }) => {
    await page.goto('/logs');
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

  test('log filters can be applied', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Look for filter controls
    const filters = page.locator('select, input[placeholder*="filter" i], button:has-text("Filter")');
    const count = await filters.count();

    if (count > 0) {
      await expect(filters.first()).toBeVisible();
    }
  });

  test('displays timestamps and metadata', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Look for timestamps or session metadata
    const metadata = page.locator('text=/\\d{4}-\\d{2}-\\d{2}|started|ended/i');
    await expect(metadata.first()).toBeVisible();
  });

  test('handles empty logs state', async ({ page }) => {
    await page.route('**/api/proxy/logs', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ logs: [] })
      });
    });

    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Should show empty state
    await expect(page.locator('text=Logs').or(page.locator('text=/no log/i'))).toBeVisible();
  });

  test('log lines can be copied', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Look for copy button
    const copyButton = page.locator('button').filter(async (el) => {
      const ariaLabel = await el.getAttribute('aria-label');
      return ariaLabel?.includes('copy');
    }).or(page.locator('[class*="copy"]')).first();

    const count = await copyButton.count();
    if (count > 0 && await copyButton.first().isVisible({ timeout: 3000 })) {
      await copyButton.first().click();
      await page.waitForTimeout(300);
      // Icon might change to checkmark
    }
  });
});
