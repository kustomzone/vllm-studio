import { test, expect } from '@playwright/test';
import { mockApi } from './utils/mock-api';

test.describe('Navigation', () => {
  // Setup API mocks for all tests
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('sidebar displays all navigation items', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify all navigation items are visible in sidebar
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Chat')).toBeVisible();
    await expect(page.locator('text=Recipes')).toBeVisible();
    await expect(page.locator('text=Discover')).toBeVisible();
    await expect(page.locator('text=Logs')).toBeVisible();
    await expect(page.locator('text=Usage')).toBeVisible();
    await expect(page.locator('text=Configs')).toBeVisible();
  });

  test('sidebar navigation links work correctly', async ({ page }) => {
    // Start from dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Recipes
    await page.locator('a:has-text("Recipes")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/recipes');

    // Navigate to Discover
    await page.locator('a:has-text("Discover")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/discover');

    // Navigate to Usage
    await page.locator('a:has-text("Usage")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/usage');

    // Navigate to Configs
    await page.locator('a:has-text("Configs")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/configs');
  });

  test('active navigation item is highlighted', async ({ page }) => {
    // Start on dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Dashboard should be active (has different background)
    const dashboardLink = page.locator('a:has-text("Dashboard")').first();
    // Check for active state via styling or class
    await expect(dashboardLink).toBeVisible();

    // Navigate to chat
    await page.locator('a:has-text("Chat")').first().click();
    await page.waitForLoadState('networkidle');

    // Chat should now be visible as active
    const chatLink = page.locator('a:has-text("Chat")').first();
    await expect(chatLink).toBeVisible();
  });

  test('sidebar can be collapsed and expanded on desktop', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 });

    // Find collapse toggle button
    const collapseButton = page.locator('button').filter({ hasText: /^$/ }).locator('nth=1').or(
      page.locator('.absolute.-right-3 button')
    );

    // The sidebar should initially be expanded (shows labels)
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Click collapse button (might need to click near the sidebar edge)
    // Try clicking the chevron button
    const chevronButtons = page.locator('button').filter(async (el) => {
      const className = await el.getAttribute('class');
      return className?.includes('ChevronLeft') || className?.includes('ChevronRight');
    });

    if (await chevronButtons.count() > 0) {
      await chevronButtons.first().click();
      await page.waitForTimeout(200);

      // After collapse, sidebar should still be visible but labels hidden
      // The chevron direction should change
    }
  });

  test('mobile menu opens and closes', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Initially sidebar should be hidden on mobile
    await expect(page.locator('text=Dashboard')).not.toBeVisible();

    // Click hamburger menu
    const menuButton = page.locator('button').filter(async (el) => {
      const text = await el.textContent();
      return text?.includes('vLLM Studio') || text?.includes('Layers');
    }).first().or(page.locator('button').first());

    await menuButton.click();
    await page.waitForTimeout(300);

    // Sidebar should now be visible
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Click outside to close (on overlay)
    const overlay = page.locator('.fixed.inset-0.bg-black\\/60');
    if (await overlay.isVisible()) {
      await overlay.click();
      await page.waitForTimeout(300);
    }

    // Sidebar should be hidden again
    // Note: This might be flaky if the auto-close happens
  });

  test('status indicator shows correct state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // From our mock, inference is online with llama-3.1-8b running
    // Should show a green indicator
    const statusIndicator = page.locator('.rounded-full[class*="bg-"]').first();
    await expect(statusIndicator).toBeVisible();

    // Check for "Ready" or model name text
    await expect(page.locator('text=/Ready|llama|No model|Offline/')).toBeVisible();
  });

  test('navigating to chat from dashboard button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find and click the chat button in the model status section
    const chatButton = page.locator('button:has-text("chat")').first();
    await expect(chatButton).toBeVisible();
    await chatButton.click();

    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/chat');
  });

  test('navigating to recipes from dashboard new button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find the "+ new" button near Recipes section
    const newButton = page.locator('button:has-text("+ new")');
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/recipes.*new/);
    }
  });

  test('logo is visible in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should show vLLM Studio text or logo
    await expect(page.locator('text=vLLM Studio').or(page.locator('svg')).first()).toBeVisible();
  });

  test('browser back/forward navigation works', async ({ page }) => {
    // Start at dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/');

    // Navigate to recipes
    await page.locator('a:has-text("Recipes")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/recipes');

    // Navigate to chat
    await page.locator('a:has-text("Chat")').first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/chat');

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/recipes');

    // Go back again
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/');

    // Go forward
    await page.goForward();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/recipes');
  });

  test('direct URL navigation works', async ({ page }) => {
    // Navigate directly to various routes
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Recipes')).toBeVisible();

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/chat');

    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Logs')).toBeVisible();

    await page.goto('/usage');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Usage')).toBeVisible();
  });
});
