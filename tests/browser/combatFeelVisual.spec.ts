import { expect, test } from '@playwright/test';

test('Live combat HUD redesign, Timed Strike [2]/[R], Space capture, Momentum & Execution audit', async ({
  page
}, testInfo) => {
  const shotPath = (name: string): string => testInfo.outputPath(name);
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
  await page.goto('/?devTeleport=1');
  await expect(page.locator('#viewport-container canvas')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as any).__ostrzeDev?.switchToDevLocation));

  // Teleport directly to Trakt Zasadzka (closes opening title modal, creates hero, keeps real player HUD!)
  await page.evaluate(() => {
    (window as any).__ostrzeDev.switchToDevLocation('trakt_zasadzka');
  });
  await page.waitForTimeout(900);

  // Position player adjacent to first bandit and start combat deterministically via dev hook
  const setupInfo = await page.evaluate(() => {
    const dev = (window as any).__ostrzeDev;
    const engine = dev.engine;
    const hostiles = engine.npcs.filter((n: any) => n.combat?.isHostile && n.combat.isAlive);
    const primary = hostiles[0];
    // Place primary right next to player for melee range
    primary.tileX = engine.player.tileX + 1;
    primary.tileY = engine.player.tileY;
    primary.x = primary.tileX + 0.5;
    primary.y = primary.tileY + 0.5;
    primary.combat.maxHp = 80;
    primary.combat.hp = 80;
    engine.startCombatWithEnemy(primary.id);
    engine.player.combat.ap = 10;
    engine.player.combat.maxAp = 10;
    dev.refreshUi();
    return {
      hostileCount: hostiles.length,
      primaryName: primary.recipe.name,
      playerTurn: engine.combatState.activeTurnActorId === engine.player.id
    };
  });

  expect(setupInfo.hostileCount).toBeGreaterThanOrEqual(2);
  expect(setupInfo.playerTurn).toBe(true);

  const targetCard = page.locator('.ostrze-combat-target-card');
  const topBanner = page.locator('.combat-top-banner');
  const tacticalBar = page.locator('.combat-tactical-bar');
  await expect(targetCard).toBeVisible();
  await expect(topBanner).toBeVisible();
  await expect(tacticalBar).toBeVisible();
  await expect(page.locator('[data-combat-momentum]')).toBeVisible();
  await expect(page.locator('[data-combat-maneuver]')).toBeVisible();

  // Screenshot 1: Clean Redesigned Combat HUD (Desktop 1440x900)
  await page.waitForTimeout(250);
  await page.screenshot({ path: shotPath('audit-combat-hud-desktop.png') });

  // Verify [2] launches Timed Strike bar and does NOT collide with tacticalBar
  const deckBox = await tacticalBar.boundingBox();
  expect(deckBox).not.toBeNull();

  await page.keyboard.press('2');
  const barMetrics = await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('[data-timed-strike-bar="true"]');
    const marker = document.querySelector<HTMLElement>('.ostrze-timed-sweet-marker');
    if (!bar || !marker) return null;
    const rect = bar.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, hasMarker: true };
  });
  expect(barMetrics).not.toBeNull();
  // Timed strike bar must sit cleanly ABOVE the tactical bar (zero overlap!)
  expect(barMetrics!.y + barMetrics!.height).toBeLessThanOrEqual(deckBox!.y + 2);

  // Screenshot 2: Timed Strike Bar mid-sweep
  await page.waitForTimeout(160);
  await page.screenshot({ path: shotPath('audit-combat-timed-strike.png') });

  // Wait for first strike to settle, then test [R] Maneuver + immediate Space lock-in (must NOT end turn!)
  await page.waitForTimeout(450);
  await page.keyboard.press('r');
  await page.waitForTimeout(220);
  await page.keyboard.press('Space');
  await page.waitForTimeout(220);

  const afterStrike = await page.evaluate(() => {
    const dev = (window as any).__ostrzeDev;
    const engine = dev.engine;
    return {
      active: engine.combatState.active,
      isPlayerTurn: engine.combatState.activeTurnActorId === engine.player.id,
      momentum: engine.getCombatMomentum(),
      playerAp: engine.player.combat.ap
    };
  });
  expect(afterStrike.active).toBe(true);
  expect(afterStrike.isPlayerTurn).toBe(true);

  // Trigger Execution state (<=30% HP) + Callout banner + Szał Ostrza visuals and verify no overlap with topBanner
  await page.evaluate(() => {
    const dev = (window as any).__ostrzeDev;
    const engine = dev.engine;
    const primary = engine.npcs.find((n: any) => n.id === engine.combatState.selectedTargetId);
    if (primary?.combat) {
      primary.combat.hp = Math.max(1, Math.floor(primary.combat.maxHp * 0.25));
    }
    dev.combatFeelOverlay.showCallout('💀 EGZEKUCJA! +2 AP', 'Bandyta pada — atakuj dalej!', 'gold');
    dev.combatFeelOverlay.triggerFlash('gold');
    dev.refreshUi();
  });

  await expect(page.locator('[data-combat-executable="true"]')).toBeVisible();
  const calloutBox = await page.locator('#ostrze-combat-callout').boundingBox();
  const bannerBox = await topBanner.boundingBox();
  expect(calloutBox).not.toBeNull();
  expect(bannerBox).not.toBeNull();
  // Callout banner must sit cleanly BELOW topBanner (zero overlap!)
  expect(calloutBox!.y).toBeGreaterThanOrEqual(bannerBox!.y + bannerBox!.height - 4);

  // Screenshot 3: Execution State + Callout Banner + Gold Flash
  await page.waitForTimeout(120);
  await page.screenshot({ path: shotPath('audit-combat-execution-callout.png') });

  // Check compact laptop viewport (1280x720) for zero clipping or overlap between topBanner and targetCard
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(250);
  const laptopBannerBox = await topBanner.boundingBox();
  const laptopCardBox = await targetCard.boundingBox();
  expect(laptopBannerBox).not.toBeNull();
  expect(laptopCardBox).not.toBeNull();
  expect(laptopBannerBox!.x + laptopBannerBox!.width).toBeLessThanOrEqual(laptopCardBox!.x - 8);
  await page.screenshot({ path: shotPath('audit-combat-hud-1280x720.png') });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
