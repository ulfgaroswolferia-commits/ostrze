import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_LOCATIONS = new Set([
  'brzezina_dziedziniec',
  'wilczy_brod',
  'gluszec',
  'bor_klusownikow',
  'stary_trakt',
  'bagna_szarej_wody'
]);

test('DEV selector visits all 21 Prologue, Act I, and Act II maps with zero errors and no auto-save', async ({
  page
}, testInfo) => {
  test.setTimeout(180_000);
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
  await page.goto('/?dev=1');
  const canvas = page.locator('#viewport-container canvas');
  await expect(canvas).toBeVisible();

  await page.locator('[data-action="toggle-dev-selector"]').click();
  const selector = page.locator('[data-action="dev-scene-select"]');
  await expect(selector.locator('option')).toHaveCount(21);

  const locations = await selector.locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value)
  );

  const extraDir = process.env.OSTRZE_SCREENSHOT_DIR;
  if (extraDir) {
    fs.mkdirSync(extraDir, { recursive: true });
  }

  let previousLocationId: string | null = null;
  for (const locationId of locations) {
    if (!(await selector.isVisible())) {
      await page.locator('[data-action="toggle-dev-selector"]').click();
    }
    const activeSelector = page.locator('[data-action="dev-scene-select"]');
    if (previousLocationId) await expect(activeSelector).toHaveValue(previousLocationId);
    await activeSelector.selectOption(locationId);
    await expect(page.locator('.ostrze-toast').filter({ hasText: 'DEV: teleport' }).last()).toBeVisible();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(200);
    expect(box?.height ?? 0).toBeGreaterThan(200);
    await expect(page.locator('.ostrze-overlay')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ostrze_25d_save_v1'))).toBeNull();

    if (SCREENSHOT_LOCATIONS.has(locationId)) {
      await page.waitForTimeout(350);
      const outPath = extraDir
        ? path.join(extraDir, `${locationId}.png`)
        : testInfo.outputPath(`${locationId}.png`);
      await page.screenshot({ path: outPath });
    }
    previousLocationId = locationId;
  }

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
