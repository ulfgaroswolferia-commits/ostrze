import { expect, test } from '@playwright/test';

test('Audit regressions: hotkeys [M]/[C] yield to modals, status vignette mounted, 1280x720 scrollable cards, Save/Load reload persistence', async ({
  page
}) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?devTeleport=1');
  await expect(page.locator('#viewport-container canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as any).__ostrzeDev?.switchToDevLocation));

  // 1. .ostrze-status-vignette must remain mounted inside #viewport-container after IsoSceneView.mount()
  await expect(page.locator('#viewport-container .ostrze-status-vignette')).toHaveCount(1);

  // 2. Welcome card must allow vertical scroll on 1280x720 (never overflow-y: hidden)
  const welcomeOverflowY = await page.evaluate(() => {
    const card = document.querySelector('.ostrze-welcome-card');
    return card ? getComputedStyle(card).overflowY : null;
  });
  expect(welcomeOverflowY).toBe('auto');

  // Switch to Brzezina courtyard
  await page.evaluate(() => {
    (window as any).__ostrzeDev.switchToDevLocation('brzezina_dziedziniec');
  });
  await expect(page.locator('.ostrze-welcome-card')).toHaveCount(0);

  // 3. [M] must NOT mute global audio when opening World Map
  const muteBtn = page.locator('.discrete-audio-btn').first();
  await expect(muteBtn).toBeVisible();
  const textBeforeM = (await muteBtn.textContent())?.trim();
  await page.keyboard.press('m');
  await expect(muteBtn).toHaveText(textBeforeM ?? '🔊');
  await page.keyboard.press('Escape');

  // 4. [C] must NOT toggle Stealth while Help modal [F1] is open
  await page.keyboard.press('F1');
  await expect(page.locator('.ostrze-help-card')).toBeVisible();
  const stealthBefore = await page.evaluate(() => Boolean((window as any).__ostrzeDev.engine.isStealthActive));
  await page.keyboard.press('c');
  const stealthAfter = await page.evaluate(() => Boolean((window as any).__ostrzeDev.engine.isStealthActive));
  expect(stealthAfter).toBe(stealthBefore);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ostrze-help-card')).toHaveCount(0);

  // 5. Save to localStorage via Ctrl+S, reload page, and verify Continue button appears
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => Boolean(localStorage.getItem('ostrze_25d_save_v1')));
  await page.reload();
  await expect(page.locator('.ostrze-welcome-card')).toBeVisible();
  await expect(page.locator('.ostrze-welcome-card button', { hasText: /Kontynuuj/i })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
