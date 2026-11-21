import { expect, test } from '@playwright/test';

test('starts a normal new game through intro and character creation', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.locator('#ostrze-welcome-form')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('welcome.png'), fullPage: true });
  await page.locator('#ostrze-welcome-name').fill('Testowy Adept');
  await page.locator('#ostrze-welcome-form button[type="submit"]').click();

  for (let card = 0; card < 3; card += 1) {
    await expect(page.locator('[data-action="narrative-next"]')).toBeVisible();
    await page.locator('[data-action="narrative-next"]').click();
  }

  await expect(page.locator('.ostrze-creator-card')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('character-creator.png'), fullPage: true });
  for (let point = 0; point < 5; point += 1) {
    await page.locator('[data-attr-inc="sila"]').click();
  }
  await expect(page.locator('#ostrze-creator-status')).toContainText('Postać gotowa');
  await page.locator('[data-action="creator-submit"]').click();

  await expect(page.locator('.ostrze-creator-card')).toHaveCount(0);
  await expect(page.locator('.ostrze-hub-title')).toContainText('Prolog');
  await expect(page.locator('.ostrze-hub-quests')).toContainText('Mistrza Gnieworada');
  await expect(page.locator('#viewport-container canvas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('prologue-playable.png'), fullPage: true });
  expect(pageErrors).toEqual([]);
});
