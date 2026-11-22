import type { OriginGameData, OstrzeGameState } from './originTypes';
import { getOstrzeLocationMeta } from '../rules/travel';

export type WorldMapRegionId = 'pogorze' | 'glusz';

export type WorldMapNodeKind = 'hub' | 'village' | 'wilds' | 'ruins' | 'pass';

export interface WorldMapNode {
  id: string;
  region: WorldMapRegionId;
  x: number;
  y: number;
  icon: string;
  kind: WorldMapNodeKind;
}

export interface WorldMapRoad {
  region: WorldMapRegionId;
  from: string;
  to: string;
  dashed?: boolean;
}

export interface WorldMapRegionMeta {
  id: WorldMapRegionId;
  label: string;
  subtitle: string;
  riverPath: string;
  forestZones: Array<{ cx: number; cy: number; rx: number; ry: number }>;
  mountainPeaks: Array<{ x: number; y: number; scale?: number }>;
}

export const WORLD_MAP_REGIONS: Record<WorldMapRegionId, WorldMapRegionMeta> = {
  pogorze: {
    id: 'pogorze',
    label: '⛰️ Pogórze',
    subtitle: 'Prolog i Akt I — Brzezina, Strażnica Wilczy Bród i okoliczne rubieże',
    riverPath: 'M 40 250 C 145 235, 220 265, 315 225 C 395 190, 470 210, 565 160',
    forestZones: [
      { cx: 145, cy: 145, rx: 72, ry: 42 },
      { cx: 315, cy: 96, rx: 95, ry: 44 },
      { cx: 195, cy: 332, rx: 76, ry: 34 }
    ],
    mountainPeaks: [
      { x: 528, y: 112, scale: 1.1 },
      { x: 562, y: 128, scale: 1.3 },
      { x: 588, y: 245, scale: 1.15 },
      { x: 552, y: 274, scale: 0.95 },
      { x: 465, y: 82, scale: 0.9 }
    ]
  },
  glusz: {
    id: 'glusz',
    label: '🌲 Głusz',
    subtitle: 'Akt II — Osada Głuszec, Bór Kłusowników, Bagna Szarej Wody i sztolnie',
    riverPath: 'M 380 390 C 425 320, 465 265, 495 215 C 525 165, 565 135, 610 110',
    forestZones: [
      { cx: 175, cy: 118, rx: 92, ry: 48 },
      { cx: 125, cy: 275, rx: 72, ry: 42 },
      { cx: 488, cy: 268, rx: 88, ry: 46 }
    ],
    mountainPeaks: [
      { x: 345, y: 74, scale: 1.15 },
      { x: 445, y: 68, scale: 1.25 },
      { x: 520, y: 88, scale: 1.3 },
      { x: 572, y: 168, scale: 1.05 }
    ]
  }
};

export const WORLD_MAP_NODES: readonly WorldMapNode[] = [
  // Pogórze (12 locations: 4 Prologue + 8 Act I)
  { id: 'brzezina_dziedziniec', region: 'pogorze', x: 82, y: 334, icon: '🏡', kind: 'village' },
  { id: 'trakt_zasadzka', region: 'pogorze', x: 162, y: 288, icon: '🌲', kind: 'wilds' },
  { id: 'uroczysko_noc', region: 'pogorze', x: 118, y: 214, icon: '🌙', kind: 'wilds' },
  { id: 'pobojowisko_swit', region: 'pogorze', x: 222, y: 244, icon: '⚔️', kind: 'ruins' },
  { id: 'wilczy_brod', region: 'pogorze', x: 318, y: 218, icon: '🏰', kind: 'hub' },
  { id: 'stary_mlyn', region: 'pogorze', x: 256, y: 162, icon: '⚙️', kind: 'village' },
  { id: 'wilczy_las', region: 'pogorze', x: 182, y: 124, icon: '🐺', kind: 'wilds' },
  { id: 'lesniczowka', region: 'pogorze', x: 312, y: 102, icon: '🪓', kind: 'village' },
  { id: 'wilcza_nora', region: 'pogorze', x: 416, y: 112, icon: '🦴', kind: 'wilds' },
  { id: 'ruiny_straznicy', region: 'pogorze', x: 438, y: 212, icon: '🏚️', kind: 'ruins' },
  { id: 'trakt_kupiecki', region: 'pogorze', x: 392, y: 312, icon: '🛞', kind: 'wilds' },
  { id: 'kamienna_przelecz', region: 'pogorze', x: 548, y: 216, icon: '⛰️', kind: 'pass' },

  // Głusz (9 locations: Act II)
  { id: 'gluszec', region: 'glusz', x: 248, y: 214, icon: '🏘️', kind: 'hub' },
  { id: 'bor_klusownikow', region: 'glusz', x: 168, y: 122, icon: '🏹', kind: 'wilds' },
  { id: 'stary_trakt', region: 'glusz', x: 112, y: 268, icon: '🛞', kind: 'wilds' },
  { id: 'kapliczka_rozstaje', region: 'glusz', x: 246, y: 326, icon: '🕯️', kind: 'village' },
  { id: 'kamieniolom', region: 'glusz', x: 344, y: 118, icon: '⛏️', kind: 'ruins' },
  { id: 'stara_kopalnia', region: 'glusz', x: 486, y: 104, icon: '💎', kind: 'ruins' },
  { id: 'spalona_osada', region: 'glusz', x: 374, y: 318, icon: '🔥', kind: 'ruins' },
  { id: 'bagna_szarej_wody', region: 'glusz', x: 492, y: 268, icon: '🌿', kind: 'wilds' },
  { id: 'wzgorze_wartownicze', region: 'glusz', x: 558, y: 184, icon: '🚩', kind: 'pass' }
];

export const WORLD_MAP_ROADS: readonly WorldMapRoad[] = [
  // Pogórze
  { region: 'pogorze', from: 'brzezina_dziedziniec', to: 'trakt_zasadzka' },
  { region: 'pogorze', from: 'trakt_zasadzka', to: 'uroczysko_noc', dashed: true },
  { region: 'pogorze', from: 'trakt_zasadzka', to: 'pobojowisko_swit' },
  { region: 'pogorze', from: 'uroczysko_noc', to: 'pobojowisko_swit', dashed: true },
  { region: 'pogorze', from: 'pobojowisko_swit', to: 'wilczy_brod' },
  { region: 'pogorze', from: 'wilczy_brod', to: 'stary_mlyn' },
  { region: 'pogorze', from: 'stary_mlyn', to: 'wilczy_las' },
  { region: 'pogorze', from: 'wilczy_las', to: 'lesniczowka', dashed: true },
  { region: 'pogorze', from: 'wilczy_brod', to: 'lesniczowka' },
  { region: 'pogorze', from: 'lesniczowka', to: 'wilcza_nora', dashed: true },
  { region: 'pogorze', from: 'wilczy_brod', to: 'ruiny_straznicy' },
  { region: 'pogorze', from: 'wilczy_brod', to: 'trakt_kupiecki' },
  { region: 'pogorze', from: 'trakt_kupiecki', to: 'kamienna_przelecz' },
  { region: 'pogorze', from: 'ruiny_straznicy', to: 'kamienna_przelecz', dashed: true },

  // Głusz
  { region: 'glusz', from: 'gluszec', to: 'bor_klusownikow' },
  { region: 'glusz', from: 'gluszec', to: 'stary_trakt' },
  { region: 'glusz', from: 'gluszec', to: 'kapliczka_rozstaje' },
  { region: 'glusz', from: 'gluszec', to: 'kamieniolom' },
  { region: 'glusz', from: 'kamieniolom', to: 'stara_kopalnia', dashed: true },
  { region: 'glusz', from: 'kapliczka_rozstaje', to: 'spalona_osada' },
  { region: 'glusz', from: 'spalona_osada', to: 'bagna_szarej_wody', dashed: true },
  { region: 'glusz', from: 'gluszec', to: 'bagna_szarej_wody' },
  { region: 'glusz', from: 'bagna_szarej_wody', to: 'wzgorze_wartownicze' },
  { region: 'glusz', from: 'stara_kopalnia', to: 'wzgorze_wartownicze', dashed: true }
];

export function resolveExpeditionNodeId(destId: string): string {
  if (destId === 'expedition:wilcza_nora') return 'wilcza_nora';
  if (destId === 'expedition:eskorta_ostromira') return 'kamienna_przelecz';
  if (destId === 'expedition:finish_ch1') return 'kamienna_przelecz';
  if (destId === 'brzezina') return 'brzezina_dziedziniec';
  return destId;
}

export function getRegionForLocation(locationId: string | null | undefined): WorldMapRegionId {
  if (!locationId) return 'pogorze';
  const resolved = resolveExpeditionNodeId(locationId);
  const node = WORLD_MAP_NODES.find((n) => n.id === resolved);
  if (node) return node.region;
  const meta = getOstrzeLocationMeta(resolved);
  return meta?.chapter === 'chapter2' ? 'glusz' : 'pogorze';
}

const QUEST_HINT_KEYWORDS: ReadonlyArray<{ nodeId: string; keywords: string[] }> = [
  { nodeId: 'wilcza_nora', keywords: ['wilcza_nora', 'wilcz', 'nora'] },
  { nodeId: 'stary_mlyn', keywords: ['stary_mlyn', 'młyn', 'mlyn', 'ostap'] },
  { nodeId: 'wilczy_las', keywords: ['wilczy_las', 'las rubieży', 'gajowy'] },
  { nodeId: 'trakt_kupiecki', keywords: ['trakt_kupiecki', 'kupiec'] },
  { nodeId: 'lesniczowka', keywords: ['lesniczowka', 'leśnicz'] },
  { nodeId: 'ruiny_straznicy', keywords: ['ruiny_straznicy', 'ruiny'] },
  { nodeId: 'kamienna_przelecz', keywords: ['kamienna_przelecz', 'przełęcz', 'ostromir'] },
  { nodeId: 'wilczy_brod', keywords: ['wilczy_brod', 'wilczy bród', 'komendant', 'wszebor', 'wrzosek'] },
  { nodeId: 'bor_klusownikow', keywords: ['bor_klusownikow', 'kłusown', 'stach'] },
  { nodeId: 'stary_trakt', keywords: ['stary_trakt', 'karawan', 'sieciech'] },
  { nodeId: 'kapliczka_rozstaje', keywords: ['kapliczka', 'halin', 'pustelnik'] },
  { nodeId: 'kamieniolom', keywords: ['kamieniolom', 'kamieniołom', 'sztolni'] },
  { nodeId: 'bagna_szarej_wody', keywords: ['bagna', 'topiel', 'utopiec', 'szarej wody'] },
  { nodeId: 'wzgorze_wartownicze', keywords: ['wzgorze_wartownicze', 'wzgórze', 'obław'] },
  { nodeId: 'spalona_osada', keywords: ['spalona_osada', 'spalon', 'zgliszcz'] },
  { nodeId: 'stara_kopalnia', keywords: ['stara_kopalnia', 'kopalni', 'gwiezdn'] },
  { nodeId: 'gluszec', keywords: ['gluszec', 'głuszec', 'sołtys', 'bogdan', 'kogut'] }
];

/**
 * Maps active quests to world-map node IDs so pins with active objectives display `❗`.
 */
export function getActiveQuestPins(
  state: OstrzeGameState,
  data: OriginGameData
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const addPin = (nodeId: string, questTitle: string): void => {
    const existing = map.get(nodeId) ?? [];
    if (!existing.includes(questTitle)) {
      existing.push(questTitle);
      map.set(nodeId, existing);
    }
  };

  for (const [questId, status] of Object.entries(state.quests)) {
    if (status !== 'active') continue;
    const def = data.quests.find((q) => q.id === questId);
    const title = def?.name ?? questId;
    const haystack = [
      questId,
      def?.name ?? '',
      def?.description ?? '',
      def?.location ?? '',
      ...(def?.objectives?.map((o) => `${o.at ?? ''} ${o.text}`) ?? [])
    ]
      .join(' ')
      .toLowerCase();

    if (def?.location) {
      const resolved = resolveExpeditionNodeId(def.location);
      if (WORLD_MAP_NODES.some((n) => n.id === resolved)) {
        addPin(resolved, title);
      }
    }

    for (const obj of def?.objectives ?? []) {
      if (obj.at) {
        const resolved = resolveExpeditionNodeId(obj.at);
        if (WORLD_MAP_NODES.some((n) => n.id === resolved)) {
          addPin(resolved, title);
        }
      }
    }

    for (const rule of QUEST_HINT_KEYWORDS) {
      if (rule.keywords.some((kw) => haystack.includes(kw))) {
        addPin(rule.nodeId, title);
      }
    }
  }

  return map;
}
