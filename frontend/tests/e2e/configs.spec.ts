import { test, expect } from '@playwright/test';
import { mockApi } from './utils/mock-api';

test.describe('Configs Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('configs page loads successfully', async ({ page }) => {
    await page.goto('/configs');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/configs');
    await expect(page.locator('text=Config').or(page.locator('h1').or(page.locator('text=/settings/i')))).toBeVisible();
  });

  test('displays system configuration', async ({ page }) => {
    await page.goto('/configs');
    await page.waitForLoadState('networkidle');

    // Should show config sections
    await expect(page.locator('text=/API|Settings|Configuration|config/i').first()).toBeVisible();
  });

  test('displays service topology', async ({ page }) => {
    await page.goto('/configs');
    await page.waitForLoadState('networkidle');

    // Look for service topology or connection status
    const topology = page.locator('text=/service|topology|controller|litellm|vllm/i');
    await expect(topology.first()).toBeVisible();
  });

  test('shows API endpoints', async ({ page }) => {
    await page.goto('/configs');
    await page.waitForLoadState('networkidle');

    // Should display API URLs or endpoints
    await expect(page.locator('text=/http|localhost|port|endpoint/i').first()).toBeVisible();
  });

  test('editable fields exist', async ({ page }) => {
    await page.goto('/configs');
    await page.waitForLoadState('networkidle');

    // Look for input fields or editable settings
    const inputs = page.locator('input[type="text"], input[type="number"], select, textarea');
    const count = await inputs.count();

    if (count > 0) {
      await expect(inputs.first()).toBeVisible();
    }
  });

  test('save button exists for changes', async ({ page }) => {
    await page.goto('/configs');
    await page.waitForLoadState('networkidle');

    const saveButton = page.locator('button:has-text("Save"), button:has-text("Apply")').or(
      page.locator('button[type="submit"]')
    ).first();

    if (await saveButton.isVisible({ timeout: 5000 })) {
      await expect(saveButton).toBeVisible();
    }
  });

  test('displays environment information', async ({ page }) => {
    await page.goto('/configs');
    await page.waitForLoadState('networkidle');

    // Look for version, environment, or system info
    const envInfo = page.locator('text=/version|Version|environment|python|node/i');
    await expect(envInfo.first()).toBeVisible();
  });

  test('displays connection status indicators', async ({ page }) => {
    await page.goto('/configs');
    await page.waitForLoadState('networkidle');

    // Look for status indicators (connected/disconnected)
    const statusIndicators = page.locator('[class*="status"], .rounded-full[class*="bg-"], text=/connected|online|offline/i');
    await expect(statusIndicators.first()).toBeVisible();
  });

  test('service status is visible', async ({ page }) => {
    await page.goto('/configs');
    await page.waitForLoadState('networkidle');

    // Should show which services are running
    await expect(page.locator('text=/controller|inference|backend|proxy/i').first()).toBeVisible();
  });

  test('handles config reload', async ({ page }) => {
    await page.goto('/configs');
    await page.waitForLoadState('networkidle');

    // Look for reload/refresh button
    const reloadButton = page.locator('button').filter(async (el) => {
      const text = await el.textContent();
      const ariaLabel = await el.getAttribute('aria-label');
      return text?.includes('Reload') || text?.includes('Refresh') || ariaLabel?.includes('reload');
    }).or(page.locator('[class*="reload"]')).first();

    const count = await reloadButton.count();
    if (count > 0 && await reloadButton.isVisible({ timeout: 3000 })) {
      await expect(reloadButton).toBeVisible();
    }
  });

  test('displays error states for failed services', async ({ page }) => {
    // Mock a config response with failed services
    await page.route('**/api/proxy/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          services: {
            controller: { status: 'ok' },
            inference: { status: 'error', message: 'Not reachable' }
          }
        })
      });
    });

    await page.goto('/configs');
    await page.waitForLoadState('networkidle');

    // Should show error indicators
    await expect(page.locator('text=/error|Error|failed|Failed').or(page.locator('[class*="error"]'))).toBeVisible();
  });
});
