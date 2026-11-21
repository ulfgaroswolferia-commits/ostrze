import { expect, test } from '@playwright/test';

test('opens the Act I hub with character status and key NPCs', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?chapter=1');

  const introButton = page.locator('[data-action="narrative-next"]');
  await expect(introButton).toBeVisible();
  await introButton.click();
  await expect(page.locator('#viewport-container canvas')).toBeVisible();
  await expect(page.locator('.ostrze-hub-bar')).toHaveCSS('left', '16px');
  await expect(page.locator('.ostrze-hub-title')).toContainText('Wilczy Bród');
  await expect(page.locator('.ostrze-hub-meta')).toContainText('Poz.');
  await expect(page.locator('.ostrze-hub-quests')).toContainText('Tablicę Zleceń');
  await page.screenshot({ path: testInfo.outputPath('act1-hub.png'), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('#viewport-container canvas')).toBeVisible();
  await expect(page.locator('.ostrze-hub-bar')).toHaveCSS('left', '16px');
  const mobileTracker = await page.locator('.ostrze-hub-bar').boundingBox();
  expect(mobileTracker?.width).toBeLessThanOrEqual(343);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.screenshot({ path: testInfo.outputPath('act1-hub-mobile.png'), fullPage: true });
  expect(pageErrors).toEqual([]);
});
