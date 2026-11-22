import { expect, test } from '@playwright/test';

test('Interactive world map opens with [M], switches regions, selects pins, and travels in Act II', async ({
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
  await page.goto('/?chapter=2&phenomenon=mgla_ciszy');
  const introButton = page.locator('[data-action="narrative-next"]');
  await expect(introButton).toBeVisible();
  await introButton.click();
  await expect(page.locator('#viewport-container canvas')).toBeVisible();

  // Open interactive world map via [M]
  await page.keyboard.press('m');
  const modal = page.locator('[data-worldmap-modal="true"]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('[data-worldmap-atmo="true"]')).toContainText('Mgła Ciszy');

  // Switch to Pogórze tab and back to Głusz
  await modal.locator('[data-map-region="pogorze"]').click();
  await expect(modal.locator('[data-map-node="wilczy_brod"]')).toBeVisible();
  await modal.locator('[data-map-region="glusz"]').click();

  // Select Kapliczka na Rozstajach pin and click Wyrusz
  await modal.locator('[data-map-node="kapliczka_rozstaje"]').click();
  const detail = modal.locator('[data-worldmap-detail="kapliczka_rozstaje"]');
  await expect(detail).toBeVisible();
  await detail.locator('[data-travel-dest="kapliczka_rozstaje"]').click();

  // Modal closes and we arrive at Kapliczka na Rozstajach
  await expect(modal).toHaveCount(0);
  await expect(page.locator('.ostrze-hub-bar')).toContainText('Kapliczka');

  // Re-open with [M] on mobile viewport and verify no horizontal overflow
  await page.setViewportSize({ width: 375, height: 812 });
  await page.keyboard.press('m');
  await expect(modal).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // Close with [M] toggle
  await page.keyboard.press('m');
  await expect(modal).toHaveCount(0);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
