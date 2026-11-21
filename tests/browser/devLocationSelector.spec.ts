import { expect, test } from '@playwright/test';

test('DEV selector visits Prologue and Act I maps without triggering entry events or saving', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/?dev=1');
  await expect(page.locator('#viewport-container canvas')).toBeVisible();

  await page.locator('[data-action="toggle-dev-selector"]').click();
  const selector = page.locator('[data-action="dev-scene-select"]');
  await expect(selector.locator('option')).toHaveCount(12);

  const locations = await selector.locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value)
  );
  let previousLocationId: string | null = null;
  for (const locationId of locations) {
    if (!(await selector.isVisible())) {
      await page.locator('[data-action="toggle-dev-selector"]').click();
    }
    const activeSelector = page.locator('[data-action="dev-scene-select"]');
    if (previousLocationId) await expect(activeSelector).toHaveValue(previousLocationId);
    await activeSelector.selectOption(locationId);
    await expect(page.locator('.ostrze-toast').filter({ hasText: 'DEV: teleport' }).last()).toBeVisible();
    await expect(page.locator('#viewport-container canvas')).toBeVisible();
    await expect(page.locator('.ostrze-overlay')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ostrze_25d_save_v1'))).toBeNull();
    previousLocationId = locationId;
  }
  expect(pageErrors).toEqual([]);
});
