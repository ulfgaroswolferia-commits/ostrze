import { expect, test } from '@playwright/test';

test('Brzezina + Trakt Vertical Slice loads painterly 2.5D props and toggles Fallout [A] attack mode', async ({
  page
}, testInfo) => {
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
  await expect(page.locator('#viewport-container canvas')).toBeVisible();
  // Give async painterly prop sprites time to finish decoding & Sobel normal baking
  await page.waitForTimeout(1200);
  await page.screenshot({ path: testInfo.outputPath('vertical-slice-brzezina.png') });

  // Teleport to Trakt (which has hostile bandits) and verify [A] attack mode toggle
  await page.locator('[data-action="toggle-dev-selector"]').click();
  await page.locator('[data-action="dev-scene-select"]').selectOption('trakt_zasadzka');
  await page.waitForTimeout(1000);

  const attackFab = page.locator('[data-action="toggle-attack-mode"]');
  await expect(attackFab).toBeVisible();
  await page.keyboard.press('a');
  await expect(attackFab).toHaveClass(/is-active/);
  await page.screenshot({ path: testInfo.outputPath('vertical-slice-trakt.png') });
  await page.keyboard.press('a');
  await expect(attackFab).not.toHaveClass(/is-active/);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
