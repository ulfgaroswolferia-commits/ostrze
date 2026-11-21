import { expect, test } from '@playwright/test';

test('DEV selector visits Prologue and Act I maps without triggering entry events or saving', async ({ page }) => {
  await page.goto('/?dev=1');
  await expect(page.locator('#viewport-container canvas')).toBeVisible();

  await page.locator('[data-action="toggle-dev-selector"]').click();
  const selector = page.locator('[data-action="dev-scene-select"]');
  await expect(selector.locator('option')).toHaveCount(12);

  await selector.selectOption('kamienna_przelecz');
  await expect(page.locator('.ostrze-toast').filter({ hasText: 'DEV: teleport' }).last()).toBeVisible();
  await expect(page.locator('.ostrze-overlay')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ostrze_25d_save_v1'))).toBeNull();

  await page.locator('[data-action="toggle-dev-selector"]').click();
  const reopenedSelector = page.locator('[data-action="dev-scene-select"]');
  await expect(reopenedSelector).toHaveValue('kamienna_przelecz');
  await reopenedSelector.selectOption('pobojowisko_swit');
  await expect(page.locator('.ostrze-toast').filter({ hasText: 'DEV: teleport' }).last()).toBeVisible();
  await expect(page.locator('.ostrze-overlay')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ostrze_25d_save_v1'))).toBeNull();
});
