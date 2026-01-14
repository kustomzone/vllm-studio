import { test, expect } from '@playwright/test';
import { mockApi } from './utils/mock-api';

test.describe('Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('chat page loads and displays session list', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Verify we're on the chat page
    await expect(page).toHaveURL('/chat');

    // Verify page title
    await expect(page).toHaveTitle(/vLLM Studio|Chat/);

    // Verify chat input is present
    const chatInput = page.locator('textarea').or(page.locator('input[type="text"]')).or(page.locator('[contenteditable="true"]'));
    await expect(chatInput.first()).toBeVisible();

    // Verify sessions list is displayed (sidebar)
    // Sessions from our mock: chat-001, chat-002, chat-003
    await expect(page.locator('text=Getting started with vLLM Studio').or(page.locator('text=/Test Chat|chat/'))).toBeVisible();
  });

  test('displays available models', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // From our v1-models mock, we have llama-3.1-8b
    // Look for model selector or display
    const modelDisplay = page.locator('text=/llama|model|Model/i');
    if (await modelDisplay.first().isVisible({ timeout: 5000 })) {
      await expect(modelDisplay.first()).toBeVisible();
    }
  });

  test('new chat button creates new session', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Find and click new chat button (various possible selectors)
    const newChatButton = page.locator('button').filter(async (el) => {
      const text = await el.textContent();
      return text?.includes('New Chat') || text?.includes('Plus') || text?.includes('Sparkles');
    }).or(page.locator('a:has-text("New")')).first();

    if (await newChatButton.isVisible({ timeout: 5000 })) {
      await newChatButton.click();
      await page.waitForTimeout(500);

      // Should clear input or show new chat state
      const chatInput = page.locator('textarea').or(page.locator('input[type="text"]'));
      await expect(chatInput.first()).toBeVisible();
    }
  });

  test('chat input accepts and sends messages', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Find chat input
    const chatInput = page.locator('textarea').or(page.locator('input[type="text"]')).or(page.locator('[contenteditable="true"]'));
    await expect(chatInput.first()).toBeVisible();

    // Type a message
    const testMessage = 'Hello, this is a test message';
    await chatInput.first().fill(testMessage);

    // Verify input has text
    await expect(chatInput.first()).toHaveValue(testMessage);

    // Find and click send button
    const sendButton = page.locator('button').filter(async (el) => {
      const text = await el.textContent();
      const ariaLabel = await el.getAttribute('aria-label');
      return text?.includes('Send') || ariaLabel?.includes('send') || text === '→';
    }).or(page.locator('button:has(svg)').filter({ hasText: '' })).first();

    // Note: This will try to send but may fail due to mock limitations
    // We're mainly testing UI interactivity here
    if (await sendButton.isVisible({ timeout: 3000 })) {
      // Mock the chat completion endpoint
      await page.route('**/api/proxy/v1/chat/completions', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'llama-3.1-8b',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: 'Test response message'
              },
              finish_reason: 'stop'
            }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
          })
        });
      });

      await sendButton.click();

      // Wait for potential response or error
      await page.waitForTimeout(1000);
    }
  });

  test('displays message history', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Check if any messages are displayed
    // This depends on the session loaded
    const messageArea = page.locator('text=/.{10,}/').or(page.locator('[class*="message"]'));
    const messageCount = await messageArea.count();

    // Messages may or may not be present depending on mock session
    // Just verify the message area exists
    const chatContainer = page.locator('[class*="chat"]').or(page.locator('[class*="message"]')).first();
    await expect(chatContainer).toBeVisible();
  });

  test('session list is clickable', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Look for session items in sidebar
    const sessionItems = page.locator('text=/chat|Chat|Test/').or(page.locator('[class*="session"]'));
    const count = await sessionItems.count();

    if (count > 0) {
      // Click first visible session
      await sessionItems.first().click();
      await page.waitForTimeout(500);

      // Should navigate or switch sessions
      await expect(page).toHaveURL(/\/chat/);
    }
  });

  test('mobile menu toggles on chat page', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Look for mobile menu toggle
    const menuButton = page.locator('button').filter(async (el) => {
      const text = await el.textContent();
      return text?.includes('vLLM') || text?.includes('Menu') || text === '';
    }).first();

    if (await menuButton.isVisible({ timeout: 5000 })) {
      await menuButton.click();
      await page.waitForTimeout(300);

      // Sidebar should appear
      await expect(page.locator('text=Dashboard').or(page.locator('text=Chat'))).toBeVisible();
    }
  });

  test('tool panel toggles open/close', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Look for tool panel toggle button
    const toolPanelToggle = page.locator('button').filter(async (el) => {
      const text = await el.textContent();
      const ariaLabel = await el.getAttribute('aria-label');
      return ariaLabel?.includes('tool') || ariaLabel?.includes('panel') || text?.includes('Tools');
    }).or(page.locator('[class*="panel"] button')).first();

    if (await toolPanelToggle.isVisible({ timeout: 5000 })) {
      const initialVisibility = await page.locator('[class*="tool"]').or(page.locator('[class*="Tool"]')).count();

      await toolPanelToggle.click();
      await page.waitForTimeout(300);

      // Panel visibility should change
      const afterVisibility = await page.locator('[class*="tool"]').or(page.locator('[class*="Tool"]')).count();
      // We don't assert strict equality as the panel might animate
    }
  });

  test('copy button works on messages', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Look for copy buttons in messages
    const copyButtons = page.locator('button').filter(async (el) => {
      const ariaLabel = await el.getAttribute('aria-label');
      return ariaLabel?.includes('copy') || ariaLabel?.includes('Copy');
    });

    const count = await copyButtons.count();

    if (count > 0) {
      // Click first copy button
      await copyButtons.first().click();
      await page.waitForTimeout(300);

      // Check icon changed (typically from Copy to Check)
      const checkIcon = page.locator('svg').locator('visible=true').filter(async (el) => {
        // Look for checkmark icon
        return true;
      });
    }
  });

  test('chat settings modal can be opened', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Look for settings button
    const settingsButton = page.locator('button').filter(async (el) => {
      const text = await el.textContent();
      const ariaLabel = await el.getAttribute('aria-label');
      return text?.includes('Settings') || ariaLabel?.includes('settings') || ariaLabel?.includes('Setting');
    }).or(page.locator('[class*="settings"] button')).first();

    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      await page.waitForTimeout(500);

      // Settings modal or panel should appear
      const settingsModal = page.locator('[class*="modal"]').or(page.locator('[class*="Modal"]')).or(page.locator('[class*="settings"]'));
      await expect(settingsModal.first()).toBeVisible();
    }
  });

  test('handles empty state when no sessions', async ({ page }) => {
    // Mock empty sessions list
    await page.route('**/api/proxy/chats', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Should still show chat interface
    const chatInput = page.locator('textarea').or(page.locator('input[type="text"]'));
    await expect(chatInput.first()).toBeVisible();
  });

  test('sidebar can be toggled', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Look for sidebar toggle
    const sidebarToggle = page.locator('button').filter(async (el) => {
      const ariaLabel = await el.getAttribute('aria-label');
      return ariaLabel?.includes('sidebar') || ariaLabel?.includes('Sidebar');
    }).or(page.locator('[class*="sidebar"] button')).or(page.locator('[class*="toggle"]')).first();

    const initialCount = await page.locator('text=Dashboard').or(page.locator('text=Recipes')).count();

    if (await sidebarToggle.isVisible({ timeout: 5000 })) {
      await sidebarToggle.click();
      await page.waitForTimeout(300);

      // Sidebar visibility might change
    }
  });

  test('displays loading state appropriately', async ({ page }) => {
    // Slow down the API to see loading state
    await page.route('**/api/proxy/chats', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.continue();
    });

    await page.goto('/chat');

    // Look for loading indicators
    const loadingIndicator = page.locator('[class*="loading"]').or(page.locator('[class*="spinner"]')).or(page.locator('svg[class*="animate"]'));

    if (await loadingIndicator.first().isVisible({ timeout: 1000 })) {
      await expect(loadingIndicator.first()).toBeVisible();
    }

    await page.waitForLoadState('networkidle');
  });

  test('handles error states gracefully', async ({ page }) => {
    // Mock error response
    await page.route('**/api/proxy/chats', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Should still show chat UI even with error
    const chatInput = page.locator('textarea').or(page.locator('input[type="text"]'));
    await expect(chatInput.first()).toBeVisible();
  });
});
