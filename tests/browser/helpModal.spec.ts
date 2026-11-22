import { expect, test } from '@playwright/test';

test('Help modal opens via [F1] and floating ? button, switches tabs, and stays overflow-free on mobile', async ({
  page
}) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.toLowerCase().includes('audiocontext')) {
        consoleErrors.push(txt);
      }
    }
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?dev=1');
  await expect(page.locator('#viewport-container canvas')).toBeVisible();

  const helpFab = page.locator('[data-action="open-help-modal"]');
  await expect(helpFab).toBeVisible();

  // Open via floating '?' button
  await helpFab.click();
  const modal = page.locator('[data-help-modal="true"]');
  await expect(modal).toBeVisible();
  await expect(helpFab).toBeHidden();
  await expect(modal).toContainText('Sterowanie i skróty');

  // Switch to Poradnik Ostrza tab
  await modal.locator('[data-help-tab="guide"]').click();
  await expect(modal).toContainText('Odporności i podatności wrogów');
  await expect(modal).toContainText('Mistrz finty');

  // Close via F1 toggle
  await page.keyboard.press('F1');
  await expect(modal).toHaveCount(0);
  await expect(helpFab).toBeVisible();

  // Re-open via F1 on mobile 375px and verify zero horizontal overflow
  await page.setViewportSize({ width: 375, height: 812 });
  await page.keyboard.press('F1');
  await expect(modal).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await modal.locator('#ostrze-help-close').click();
  await expect(modal).toHaveCount(0);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
