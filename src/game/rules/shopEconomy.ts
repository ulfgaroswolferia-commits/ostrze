import type { OriginGameData, OstrzeGameState } from '../data/originTypes';
import { evaluateCondition } from './conditions';
import { getStats } from './stats';

interface ShopRulesConfig {
  buyBase?: number;
  sellBase?: number;
  handelBuyDivisor?: number;
  handelSellDivisor?: number;
}

export interface SellCheckResult {
  ok: boolean;
  price: number;
  reason?: string;
}

export interface SellExecutionResult {
  sold: boolean;
  price: number;
  itemName: string;
}

/**
 * Computes the buy price of an item in a specific shop,
 * honoring Handel skill and declarative shop priceModifiers.
 */
export function getShopBuyPrice(
  baseValue: number,
  shopId: string,
  state: OstrzeGameState,
  data: OriginGameData
): number {
  const shop = data.shops.find((s) => s.id === shopId);
  const handel = state.character ? getStats(state, data).skills.handel : 0;
  const shopRules = (data.rules as { shop?: ShopRulesConfig }).shop;
  const buyBase = shopRules?.buyBase ?? 1.5;
  const handelDiv = shopRules?.handelBuyDivisor ?? 200;
  let mult = Math.max(0.5, buyBase - handel / handelDiv);

  const mods = shop?.priceModifiers as
    | Array<{ if?: Record<string, unknown>; buyPercent?: number; sellPercent?: number }>
    | Record<string, number>
    | undefined;

  if (Array.isArray(mods)) {
    for (const m of mods) {
      if (typeof m.buyPercent === 'number' && evaluateCondition(m.if, state, data)) {
        mult *= 1 + m.buyPercent / 100;
      }
    }
  } else if (mods) {
    for (const [flagKey, modVal] of Object.entries(mods)) {
      if (state.flags[flagKey] && typeof modVal === 'number') {
        mult *= modVal;
      }
    }
  }

  return Math.max(1, Math.round(baseValue * mult));
}

/**
 * Computes the sell price of an item in a specific shop,
 * honoring Handel skill and priceModifiers.sellPercent, capped below buy price
 * to prevent infinite buy/sell arbitrage.
 */
export function getShopSellPrice(
  baseValue: number,
  shopId: string,
  state: OstrzeGameState,
  data: OriginGameData
): number {
  const shop = data.shops.find((s) => s.id === shopId);
  const handel = state.character ? getStats(state, data).skills.handel : 0;
  const shopRules = (data.rules as { shop?: ShopRulesConfig }).shop;
  const sellBase = shopRules?.sellBase ?? 0.45;
  const handelDiv = shopRules?.handelSellDivisor ?? 250;
  let mult = Math.min(0.85, sellBase + handel / handelDiv);

  const mods = shop?.priceModifiers as
    | Array<{ if?: Record<string, unknown>; buyPercent?: number; sellPercent?: number }>
    | undefined;

  if (Array.isArray(mods)) {
    for (const m of mods) {
      if (typeof m.sellPercent === 'number' && evaluateCondition(m.if, state, data)) {
        mult *= 1 + m.sellPercent / 100;
      }
    }
  }

  const rawSell = Math.max(1, Math.round(baseValue * mult));
  const buyPrice = getShopBuyPrice(baseValue, shopId, state, data);
  if (buyPrice <= 1) return 1;
  return Math.max(1, Math.min(buyPrice - 1, rawSell));
}

/**
 * Checks whether an inventory item can be sold to the given shop.
 * Protects quest items and currently equipped single-copy gear.
 */
export function canSellItemToShop(
  itemId: string,
  shopId: string,
  state: OstrzeGameState,
  data: OriginGameData
): SellCheckResult {
  const item = data.items.find((i) => i.id === itemId);
  const shop = data.shops.find((s) => s.id === shopId);
  const invEntry = state.inventory.items.find((i) => i.id === itemId);

  if (!item || !invEntry || invEntry.qty <= 0) {
    return { ok: false, price: 0, reason: 'Brak w plecaku' };
  }
  if (item.type === 'quest' || (item.value ?? 0) <= 0) {
    return { ok: false, price: 0, reason: 'Przedmiot fabularny' };
  }

  const isEquipped = Object.values(state.inventory.equipped).includes(itemId);
  if (isEquipped && invEntry.qty <= 1) {
    return { ok: false, price: 0, reason: 'Założone' };
  }

  if (shop?.buys && shop.buys.length > 0 && !shop.buys.includes(item.type)) {
    return { ok: false, price: 0, reason: 'Kupiec nie skupuje' };
  }

  const price = getShopSellPrice(item.value ?? 1, shopId, state, data);
  return { ok: true, price };
}

/**
 * Sells 1 unit of an item from the player's inventory to the shop.
 */
export function sellInventoryItemToShop(
  itemId: string,
  shopId: string,
  state: OstrzeGameState,
  data: OriginGameData
): SellExecutionResult {
  const item = data.items.find((i) => i.id === itemId);
  const check = canSellItemToShop(itemId, shopId, state, data);
  if (!check.ok || !state.character) {
    return { sold: false, price: 0, itemName: item?.name ?? itemId };
  }

  const invEntry = state.inventory.items.find((i) => i.id === itemId);
  if (!invEntry) {
    return { sold: false, price: 0, itemName: item?.name ?? itemId };
  }

  invEntry.qty -= 1;
  if (invEntry.qty <= 0) {
    state.inventory.items = state.inventory.items.filter((i) => i.id !== itemId);
  }
  state.character.money += check.price;

  return {
    sold: true,
    price: check.price,
    itemName: item?.name ?? itemId
  };
}

/**
 * Returns the best `.pix` art ID for a given shop's merchant header.
 */
export function getShopMerchantPortraitId(shopId: string): string {
  const id = shopId.toLowerCase();
  if (id.includes('szkolny') || id.includes('kwatermistrz')) return 'portret_kwatermistrz';
  if (id.includes('szkarad') || id.includes('rusznikarz')) return 'portret_szkarad';
  if (id.includes('ostromir') || id.includes('drogi')) return 'portret_ostromir';
  if (id.includes('kowal') || id.includes('zbych')) return 'portret_kowal';
  return 'kram';
}
