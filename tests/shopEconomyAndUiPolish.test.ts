import { describe, expect, it } from 'vitest';
import { getPixArtMeta } from '../src/game/assets/pixArt';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import {
  canSellItemToShop,
  getShopBuyPrice,
  getShopMerchantPortraitId,
  getShopSellPrice,
  sellInventoryItemToShop
} from '../src/game/rules/shopEconomy';

function makeHeroState() {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 2026);
  createCharacter(
    state,
    {
      name: 'Mściwój',
      classId: 'miecz',
      attributes: {
        sila: 8,
        zrecznosc: 7,
        krzepa: 5,
        bystrosc: 5,
        rozum: 6,
        oglada: 5,
        fart: 5
      },
      tagged: ['sieczna', 'handel', 'wymowa']
    },
    ORIGIN_DATA
  );
  return state;
}

describe('Shop Economy (Buy/Sell, Price Modifiers, Protections) & Merchant .pix Portraits', () => {
  it('applies kwatermistrz_rabat modifiers to buy and sell prices and prevents arbitrage', () => {
    const state = makeHeroState();

    const buyNormal = getShopBuyPrice(40, 'kramarz_szkolny', state, ORIGIN_DATA);
    const sellNormal = getShopSellPrice(40, 'kramarz_szkolny', state, ORIGIN_DATA);
    expect(sellNormal).toBeLessThan(buyNormal);

    state.flags.kwatermistrz_rabat = true;
    const buyDiscount = getShopBuyPrice(40, 'kramarz_szkolny', state, ORIGIN_DATA);
    const sellBonus = getShopSellPrice(40, 'kramarz_szkolny', state, ORIGIN_DATA);

    expect(buyDiscount).toBeLessThan(buyNormal);
    expect(sellBonus).toBeGreaterThanOrEqual(sellNormal);
    expect(sellBonus).toBeLessThan(buyDiscount);
  });

  it('protects quest items, Brzezina keepsakes, and equipped single-copy gear from being sold', () => {
    const state = makeHeroState();
    state.inventory.items.push(
      { id: 'kosc_skarimira', qty: 1 },
      { id: 'miedziak_ragnoslawy', qty: 1 },
      { id: 'list_wojmira', qty: 1 },
      { id: 'sztylet', qty: 1 }
    );

    // Keepsakes / quest items are protected
    expect(canSellItemToShop('kosc_skarimira', 'kramarz_szkolny', state, ORIGIN_DATA).ok).toBe(false);
    expect(canSellItemToShop('miedziak_ragnoslawy', 'kramarz_szkolny', state, ORIGIN_DATA).ok).toBe(false);
    expect(canSellItemToShop('list_wojmira', 'kramarz_szkolny', state, ORIGIN_DATA).ok).toBe(false);

    // Equipped single-copy starting sword is protected
    const equippedWeapon = state.inventory.equipped.bron;
    expect(equippedWeapon).toBeTruthy();
    const eqCheck = canSellItemToShop(equippedWeapon!, 'kramarz_szkolny', state, ORIGIN_DATA);
    expect(eqCheck.ok).toBe(false);
    expect(eqCheck.reason).toBe('Założone');

    // Un-equipped dagger can be sold
    const daggerCheck = canSellItemToShop('sztylet', 'kramarz_szkolny', state, ORIGIN_DATA);
    expect(daggerCheck.ok).toBe(true);
    expect(daggerCheck.price).toBeGreaterThan(0);

    const moneyBefore = state.character!.money;
    const res = sellInventoryItemToShop('sztylet', 'kramarz_szkolny', state, ORIGIN_DATA);
    expect(res.sold).toBe(true);
    expect(state.character!.money).toBe(moneyBefore + res.price);
    expect(state.inventory.items.some((i) => i.id === 'sztylet')).toBe(false);
  });

  it('resolves valid .pix art assets for shop merchants and the Welcome screen banner', () => {
    for (const shopId of ['kramarz_szkolny', 'kramarz_brod', 'kupiec_drogi', 'rusznikarz_szkarad']) {
      const artId = getShopMerchantPortraitId(shopId);
      const meta = getPixArtMeta(artId);
      expect(meta, `Missing .pix art for shop ${shopId} -> ${artId}`).not.toBeNull();
      expect(meta!.dataUri.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    }

    const welcomeBanner = getPixArtMeta('wstep_gwiazdy');
    expect(welcomeBanner).not.toBeNull();
    expect(welcomeBanner!.width).toBe(96);
    expect(welcomeBanner!.height).toBe(48);
  });
});
