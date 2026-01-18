import { test, expect } from "@playwright/test";

test("app shell renders", async ({ page }) => {
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/vLLM Studio/i);
});
