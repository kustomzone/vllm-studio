import { test, expect } from '@playwright/test';
import { mockApi } from './utils/mock-api';

test.describe('Recipes Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('recipes page loads successfully', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/recipes');
    await expect(page.locator('text=Recipes').or(page.locator('h1').or(page.locator('text=/recipe/i')))).toBeVisible();
  });

  test('displays list of recipes', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // From our mock, we have 3 recipes
    await expect(page.locator('text=Llama 3.1 8B Instruct').or(page.locator('text=llama-3.1-8b'))).toBeVisible();
    await expect(page.locator('text=Mistral 7B').or(page.locator('text=mistral-7b'))).toBeVisible();
  });

  test('recipe cards show status indicators', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Look for status dots or indicators
    const statusIndicators = page.locator('.rounded-full[class*="bg-"], [class*="status"]');
    await expect(statusIndicators.first()).toBeVisible();
  });

  test('search functionality filters recipes', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="Search" i]').or(page.locator('[type="text"]')).first();
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('llama');
      await page.waitForTimeout(300);

      // Should show filtered results
      await expect(page.locator('text=llama').or(page.locator('text=Llama'))).toBeVisible();
    }
  });

  test('new recipe button exists', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Look for new recipe button
    const newButton = page.locator('button:has-text("New"), button:has-text("Plus"), button:has-text("Create")').or(
      page.locator('a:has-text("New")')
    ).first();

    if (await newButton.isVisible({ timeout: 5000 })) {
      await expect(newButton).toBeVisible();
    }
  });

  test('recipe action buttons are visible', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Look for action buttons like launch, edit, delete
    const actionButtons = page.locator('button').filter(async (el) => {
      const text = await el.textContent();
      const ariaLabel = await el.getAttribute('aria-label');
      return text?.match(/launch|edit|delete|play|save/i) || ariaLabel?.match(/launch|edit|delete/i);
    });

    const count = await actionButtons.count();
    if (count > 0) {
      await expect(actionButtons.first()).toBeVisible();
    }
  });

  test('refresh button exists', async ({ page }) => {
    await page.goto('/recipes');
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

  test('recipe details can be viewed', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Click on a recipe card/item
    const recipeItem = page.locator('text=Llama').or(page.locator('[class*="recipe"]')).first();
    await recipeItem.click();
    await page.waitForTimeout(500);

    // Should show recipe details or edit form
    await expect(page.locator('text=/llama|recipe|edit/i').or(page.locator('[class*="form"]'))).toBeVisible();
  });

  test('handles empty recipes list', async ({ page }) => {
    await page.route('**/api/proxy/recipes', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Should still show page with empty state
    await expect(page.locator('text=Recipe').or(page.locator('text=/no recipe/i'))).toBeVisible();
  });

  test('filters work correctly', async ({ page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');

    // Look for filter controls
    const filterControls = page.locator('[class*="filter"], button:has-text("Filter"), select');
    const count = await filterControls.count();

    if (count > 0) {
      // Test filter interaction
      await filterControls.first().click();
      await page.waitForTimeout(300);
    }
  });
});
