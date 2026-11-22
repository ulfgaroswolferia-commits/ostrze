import { expect, test } from '@playwright/test';

test('Atmospheric phenomenon overlay renders from ?phenomenon= and DEV switcher with zero errors', async ({
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
  await page.goto('/?dev=1&phenomenon=burza_iskier');

  const layer = page.locator('.ostrze-phenomenon-layer');
  const badge = page.locator('[data-phenomenon-badge="true"]');
  const devSelect = page.locator('[data-action="dev-phenomenon-select"]');

  await expect(layer).toBeVisible();
  await expect(layer).toHaveAttribute('data-phenomenon', 'burza_iskier');
  await expect(layer).toHaveCSS('pointer-events', 'none');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('Burza iskier');
  await expect(devSelect).toHaveValue('burza_iskier');

  // Switch phenomenon via DEV selector to Mgła Ciszy and Ulewa, then back to clear weather
  await devSelect.selectOption('mgla_ciszy');
  await expect(layer).toHaveAttribute('data-phenomenon', 'mgla_ciszy');
  await expect(badge).toContainText('Mgła Ciszy');

  await devSelect.selectOption('ulewa');
  await expect(layer).toHaveAttribute('data-phenomenon', 'ulewa');
  await expect(badge).toContainText('Ulewa');

  await devSelect.selectOption('');
  await expect(layer).toBeHidden();
  await expect(badge).toBeHidden();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
