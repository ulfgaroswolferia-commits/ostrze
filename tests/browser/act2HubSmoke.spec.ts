import { expect, test } from '@playwright/test';

test('opens the Act II hub (Osada Gluszec) lazily with zero errors on desktop and mobile', async ({
  page
}, testInfo) => {
  test.setTimeout(60_000);
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

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?chapter=2');

  const introButton = page.locator('[data-action="narrative-next"]');
  await expect(introButton).toBeVisible();
  await introButton.click();

  const canvas = page.locator('#viewport-container canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(200);
  expect(box?.height ?? 0).toBeGreaterThan(200);

  await expect(page.locator('.ostrze-hub-bar')).toHaveCSS('left', '16px');
  await expect(page.locator('.ostrze-hub-title')).toContainText('Głuszec');
  await expect(page.locator('.ostrze-hub-meta')).toContainText('Poz.');
  await page.screenshot({ path: testInfo.outputPath('act2-hub.png'), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(canvas).toBeVisible();
  const mobileTracker = await page.locator('.ostrze-hub-bar').boundingBox();
  expect(mobileTracker?.width).toBeLessThanOrEqual(343);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.screenshot({ path: testInfo.outputPath('act2-hub-mobile.png'), fullPage: true });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
