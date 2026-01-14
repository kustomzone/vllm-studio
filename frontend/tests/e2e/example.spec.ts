import { test, expect } from '@playwright/test';

test('example placeholder test', async ({ page }) => {
  // This is a placeholder test to verify Playwright setup is working
  // It will be removed or replaced in task-01 when writing actual E2E tests

  await page.goto('/');

  // Expect the page to be accessible
  await expect(page).toHaveTitle(/vLLM Studio/);
});
