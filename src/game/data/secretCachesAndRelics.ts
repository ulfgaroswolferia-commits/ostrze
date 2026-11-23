import type { ItemDef, OriginGameData, OstrzeGameState } from './originTypes';
import { grantXp } from '../rules/character';
import { getStats } from '../rules/stats';

export const RELIKTY_ITEMS: readonly ItemDef[] = [
  {
    id: 'relikt_plaszcz_wilczy',
    name: 'Płaszcz z Wilczej Skóry',
    type: 'armor',
    slot: 'plaszcz',
    value: 55,
    weight: 2,
    armor: 1,
    modifiers: { skradanie: 8, hpMax: 5 },
    description: 'Gruby, ciemnoszary płaszcz z futra basiora. Tłumi szelest kroków i chroni przed chłodem.'
  },
  {
    id: 'relikt_talizman_mlyna',
    name: 'Talizman Młyńskiego Koła',
    type: 'trinket',
    slot: 'talizman',
    value: 50,
    weight: 0.5,
    modifiers: { resist_strach: 15, defense: 2 },
    description: 'Stary mosiężny krążek z wyrytym znakiem wody i ziarna. Uspokaja serce w obliczu nocnych zjaw.'
  },
  {
    id: 'relikt_rekawice_strazy',
    name: 'Rękawice Dawnej Straży',
    type: 'armor',
    slot: 'rece',
    value: 60,
    weight: 1.5,
    armor: 1,
    modifiers: { sieczna: 6, drzewcowa: 6 },
    description: 'Skórzane karwasze nabijane żelaznymi nitami z czasów dawnego garnizonu na Pogórzu.'
  },
  {
    id: 'relikt_pas_klusownika',
    name: 'Pas Mistrza Kłusowników',
    type: 'armor',
    slot: 'pas',
    value: 65,
    weight: 1,
    modifiers: { strzelecka: 8, miotanie: 8, initiative: 2 },
    description: 'Szeroki pas z kieszeniami na cięciwy, noże i mieszki. Pozwala błyskawicznie sięgnąć po broń.'
  },
  {
    id: 'relikt_amulet_szarej_wody',
    name: 'Amulet Szarej Wody',
    type: 'trinket',
    slot: 'talizman',
    value: 70,
    weight: 0.5,
    modifiers: { resist_ogluszenie: 20, hpMax: 8 },
    description: 'Bursztyn opleciony korzeniem szarej trzciny. Chroni głowę przed zamroczeniem i jadem moczarów.'
  },
  {
    id: 'relikt_kolczuga_gwardii',
    name: 'Kuta Kolczuga Gwardii',
    type: 'armor',
    slot: 'tulow',
    value: 110,
    weight: 6,
    armor: 5,
    modifiers: { hpMax: 10 },
    description: 'Znakomicie zachowana kolczuga z hartowanych pierścieni, ukryta niegdyś w suchej niszy starej kopalni.'
  }
];

export interface SecretCacheDef {
  propId: string;
  sceneId: string;
  name: string;
  flagId: string;
  relicId: string;
  moneyReward: number;
  xpReward: number;
  requirementLabel: string;
  checkRequirement: (state: OstrzeGameState, data: OriginGameData) => boolean;
}

export const SECRET_CACHES: Readonly<Record<string, SecretCacheDef>> = {
  skrytka_wilcza_nora: {
    propId: 'skrytka_wilcza_nora',
    sceneId: 'wilcza_nora',
    name: 'Ukryty schowek myśliwego pod nawisem',
    flagId: 'cache_opened_wilcza_nora',
    relicId: 'relikt_plaszcz_wilczy',
    moneyReward: 20,
    xpReward: 30,
    requirementLabel: 'Bystrość ≥ 6 lub Skradanie ≥ 35%',
    checkRequirement: (state, data) => {
      const st = getStats(state, data);
      return st.attributes.bystrosc >= 6 || st.skills.skradanie >= 35;
    }
  },
  skrytka_stary_mlyn: {
    propId: 'skrytka_stary_mlyn',
    sceneId: 'stary_mlyn',
    name: 'Skrytka pod kamieniem młyńskim',
    flagId: 'cache_opened_stary_mlyn',
    relicId: 'relikt_talizman_mlyna',
    moneyReward: 15,
    xpReward: 25,
    requirementLabel: 'Wiedza tajemna ≥ 20% lub Bystrość ≥ 6',
    checkRequirement: (state, data) => {
      const st = getStats(state, data);
      return st.skills.wiedza_tajemna >= 20 || st.attributes.bystrosc >= 6;
    }
  },
  skrytka_ruiny_straznicy: {
    propId: 'skrytka_ruiny_straznicy',
    sceneId: 'ruiny_straznicy',
    name: 'Zamurowana nisza zbrojowni',
    flagId: 'cache_opened_ruiny_straznicy',
    relicId: 'relikt_rekawice_strazy',
    moneyReward: 25,
    xpReward: 35,
    requirementLabel: 'Bystrość ≥ 6 lub Skradanie ≥ 35%',
    checkRequirement: (state, data) => {
      const st = getStats(state, data);
      return st.attributes.bystrosc >= 6 || st.skills.skradanie >= 35;
    }
  },
  skrytka_bor_klusownikow: {
    propId: 'skrytka_bor_klusownikow',
    sceneId: 'bor_klusownikow',
    name: 'Dziupla z łupem kłusowników',
    flagId: 'cache_opened_bor_klusownikow',
    relicId: 'relikt_pas_klusownika',
    moneyReward: 25,
    xpReward: 40,
    requirementLabel: 'Skradanie ≥ 35% lub Bystrość ≥ 6',
    checkRequirement: (state, data) => {
      const st = getStats(state, data);
      return st.skills.skradanie >= 35 || st.attributes.bystrosc >= 6;
    }
  },
  skrytka_bagna_szarej_wody: {
    propId: 'skrytka_bagna_szarej_wody',
    sceneId: 'bagna_szarej_wody',
    name: 'Zatopiona szkatuła w korzeniach',
    flagId: 'cache_opened_bagna_szarej_wody',
    relicId: 'relikt_amulet_szarej_wody',
    moneyReward: 20,
    xpReward: 40,
    requirementLabel: 'Wiedza tajemna ≥ 22% lub Bystrość ≥ 6',
    checkRequirement: (state, data) => {
      const st = getStats(state, data);
      return st.skills.wiedza_tajemna >= 22 || st.attributes.bystrosc >= 6;
    }
  },
  skrytka_stara_kopalnia: {
    propId: 'skrytka_stara_kopalnia',
    sceneId: 'stara_kopalnia',
    name: 'Kuta skrzynia dawnego sztygara',
    flagId: 'cache_opened_stara_kopalnia',
    relicId: 'relikt_kolczuga_gwardii',
    moneyReward: 35,
    xpReward: 50,
    requirementLabel: 'Bystrość ≥ 6 lub Wiedza tajemna ≥ 25%',
    checkRequirement: (state, data) => {
      const st = getStats(state, data);
      return st.attributes.bystrosc >= 6 || st.skills.wiedza_tajemna >= 25;
    }
  }
};

export interface SecretCacheOpenResult {
  handled: boolean;
  opened: boolean;
  alreadyOpened: boolean;
  message: string;
}

export function tryOpenSecretCache(
  propId: string,
  state: OstrzeGameState,
  data: OriginGameData
): SecretCacheOpenResult {
  const def = SECRET_CACHES[propId];
  if (!def || !state.character) {
    return { handled: false, opened: false, alreadyOpened: false, message: '' };
  }
  if (state.flags[def.flagId]) {
    return {
      handled: true,
      opened: false,
      alreadyOpened: true,
      message: `🔒 ${def.name} została już wcześniej opróżniona.`
    };
  }
  if (!def.checkRequirement(state, data)) {
    return {
      handled: true,
      opened: false,
      alreadyOpened: false,
      message: `🔍 Dostrzegasz ślady skrytki (${def.name}), ale nie potrafisz jej otworzyć (wymagane: ${def.requirementLabel}).`
    };
  }

  state.flags[def.flagId] = true;
  const existing = state.inventory.items.find((i) => i.id === def.relicId);
  if (existing) {
    existing.qty += 1;
  } else {
    state.inventory.items.push({ id: def.relicId, qty: 1 });
  }
  state.character.money += def.moneyReward;
  grantXp(state, def.xpReward, data);
  const relicName = data.items.find((i) => i.id === def.relicId)?.name ?? def.relicId;

  return {
    handled: true,
    opened: true,
    alreadyOpened: false,
    message: `🗝️ Odkryto skrytkę (${def.name})! Zdobyto: ${relicName}, +${def.moneyReward} gr, +${def.xpReward} XP.`
  };
}
