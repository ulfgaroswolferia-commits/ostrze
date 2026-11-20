import attributesJson from '../../../origin/data/attributes.json';
import classesJson from '../../../origin/data/classes.json';
import skillsJson from '../../../origin/data/skills.json';
import perksJson from '../../../origin/data/perks.json';
import effectsJson from '../../../origin/data/effects.json';
import phenomenaJson from '../../../origin/data/phenomena.json';
import itemsJson from '../../../origin/data/items.json';
import enemiesJson from '../../../origin/data/enemies.json';
import questsJson from '../../../origin/data/quests.json';
import shopsJson from '../../../origin/data/shops.json';
import storyJson from '../../../origin/data/story.json';
import travelJson from '../../../origin/data/travel.json';
import rulesJson from '../../../origin/data/rules.json';

import dlgKurier from '../../../origin/data/dialogues/kurier.json';
import dlgDelegacja from '../../../origin/data/dialogues/delegacja.json';
import dlgKwatermistrz from '../../../origin/data/dialogues/kwatermistrz.json';
import dlgTowarzysze from '../../../origin/data/dialogues/towarzysze.json';
import dlgOgnisko from '../../../origin/data/dialogues/ognisko.json';
import dlgIstota from '../../../origin/data/dialogues/istota.json';
import dlgPobojowisko from '../../../origin/data/dialogues/pobojowisko.json';
import dlgRozdroze from '../../../origin/data/dialogues/rozdroze.json';

import dlgKomendant from '../../../origin/data/dialogues/komendant.json';
import dlgKomendantNamysl from '../../../origin/data/dialogues/komendant_namysl.json';
import dlgKomendantRaport from '../../../origin/data/dialogues/komendant_raport.json';
import dlgKomendantOdburk from '../../../origin/data/dialogues/komendant_odburk.json';
import dlgKomendantPo from '../../../origin/data/dialogues/komendant_po.json';
import dlgWrzosek from '../../../origin/data/dialogues/wrzosek.json';
import dlgSzkarad from '../../../origin/data/dialogues/szkarad.json';
import dlgOstromir from '../../../origin/data/dialogues/ostromir.json';
import dlgOstromirBrama from '../../../origin/data/dialogues/ostromir_brama.json';
import dlgOstromirPowrot from '../../../origin/data/dialogues/ostromir_powrot.json';
import dlgOstromirPozegnanie from '../../../origin/data/dialogues/ostromir_pozegnanie.json';
import dlgOstromirTrakt from '../../../origin/data/dialogues/ostromir_trakt.json';
import dlgKowal from '../../../origin/data/dialogues/kowal.json';
import dlgZonaBorka from '../../../origin/data/dialogues/zona_borka.json';
import dlgCorka from '../../../origin/data/dialogues/corka.json';
import dlgOstap from '../../../origin/data/dialogues/ostap.json';
import dlgLesniczy from '../../../origin/data/dialogues/lesniczy.json';
import dlgZwiadowcy from '../../../origin/data/dialogues/zwiadowcy.json';
import dlgPoZwiadowcach from '../../../origin/data/dialogues/po_zwiadowcach.json';
import dlgBorekRuiny from '../../../origin/data/dialogues/borek_ruiny.json';
import dlgGlodnyWedrowiec from '../../../origin/data/dialogues/glodny_wedrowiec.json';
import dlgZnalZwlokiKupca from '../../../origin/data/dialogues/znal_zwloki_kupca.json';
import dlgZnalPorzuconyWozek from '../../../origin/data/dialogues/znal_porzucony_wozek.json';
import dlgZnalKapliczkaOfiary from '../../../origin/data/dialogues/znal_kapliczka_ofiary.json';
import dlgMoralGlodnaWdowa from '../../../origin/data/dialogues/moral_glodna_wdowa.json';

import {
  PROLOGUE_COMPANION_DIALOGUES,
  PROLOGUE_COMPANION_ITEMS
} from './prologueCompanionsData';
import type {
  AttributeDef,
  ClassDef,
  DialogueFileDef,
  EffectDef,
  EnemyDef,
  ItemDef,
  OriginGameData,
  OriginTravelEventDef,
  PerkDef,
  PhenomenonDef,
  QuestDef,
  RulesDef,
  ShopDef,
  SkillDef,
  StoryDataDef
} from './originTypes';

/**
 * Direct adapter over origin/data/*.json.
 * Keeps all source narrative, rules, items, and Prologue + Chapter 1 dialogues in one place
 * without duplicating JSON content.
 */
const travelScenes: Record<string, { id: string; title?: string; text?: string; type?: string }> = {};
for (const ev of (travelJson as { events?: Array<{ scenes?: Array<{ id: string; title?: string; text?: string; type?: string }> }> }).events ?? []) {
  for (const sc of ev.scenes ?? []) {
    if (sc && typeof sc.id === 'string') {
      travelScenes[sc.id] = sc;
    }
  }
}

export const ORIGIN_DATA: OriginGameData = {
  attributes: attributesJson as unknown as AttributeDef[],
  classes: classesJson as unknown as ClassDef[],
  skills: skillsJson as unknown as SkillDef[],
  perks: perksJson as unknown as PerkDef[],
  effects: effectsJson as unknown as EffectDef[],
  phenomena: phenomenaJson as unknown as PhenomenonDef[],
  items: [...(itemsJson as unknown as ItemDef[]), ...PROLOGUE_COMPANION_ITEMS],
  enemies: enemiesJson as unknown as EnemyDef[],
  shops: shopsJson as unknown as ShopDef[],
  quests: questsJson as unknown as QuestDef[],
  story: storyJson as unknown as StoryDataDef,
  travelScenes,
  travelEvents: ((travelJson as { events?: OriginTravelEventDef[] }).events ?? []) as OriginTravelEventDef[],
  rules: rulesJson as unknown as RulesDef,
  prologueDialogues: {
    kurier: dlgKurier as unknown as DialogueFileDef,
    delegacja: dlgDelegacja as unknown as DialogueFileDef,
    kwatermistrz: dlgKwatermistrz as unknown as DialogueFileDef,
    towarzysze: dlgTowarzysze as unknown as DialogueFileDef,
    ognisko: dlgOgnisko as unknown as DialogueFileDef,
    istota: dlgIstota as unknown as DialogueFileDef,
    pobojowisko: dlgPobojowisko as unknown as DialogueFileDef,
    rozdroze: dlgRozdroze as unknown as DialogueFileDef,
    komendant: dlgKomendant as unknown as DialogueFileDef,
    komendant_namysl: dlgKomendantNamysl as unknown as DialogueFileDef,
    komendant_raport: dlgKomendantRaport as unknown as DialogueFileDef,
    komendant_odburk: dlgKomendantOdburk as unknown as DialogueFileDef,
    komendant_po: dlgKomendantPo as unknown as DialogueFileDef,
    wrzosek: dlgWrzosek as unknown as DialogueFileDef,
    szkarad: dlgSzkarad as unknown as DialogueFileDef,
    ostromir: dlgOstromir as unknown as DialogueFileDef,
    ostromir_brama: dlgOstromirBrama as unknown as DialogueFileDef,
    ostromir_powrot: dlgOstromirPowrot as unknown as DialogueFileDef,
    ostromir_pozegnanie: dlgOstromirPozegnanie as unknown as DialogueFileDef,
    ostromir_trakt: dlgOstromirTrakt as unknown as DialogueFileDef,
    glodny_wedrowiec: dlgGlodnyWedrowiec as unknown as DialogueFileDef,
    znal_zwloki_kupca: dlgZnalZwlokiKupca as unknown as DialogueFileDef,
    znal_porzucony_wozek: dlgZnalPorzuconyWozek as unknown as DialogueFileDef,
    znal_kapliczka_ofiary: dlgZnalKapliczkaOfiary as unknown as DialogueFileDef,
    moral_glodna_wdowa: dlgMoralGlodnaWdowa as unknown as DialogueFileDef,
    kowal: dlgKowal as unknown as DialogueFileDef,
    zona_borka: dlgZonaBorka as unknown as DialogueFileDef,
    corka: dlgCorka as unknown as DialogueFileDef,
    ostap: dlgOstap as unknown as DialogueFileDef,
    lesniczy: dlgLesniczy as unknown as DialogueFileDef,
    zwiadowcy: dlgZwiadowcy as unknown as DialogueFileDef,
    po_zwiadowcach: dlgPoZwiadowcach as unknown as DialogueFileDef,
    borek_ruiny: dlgBorekRuiny as unknown as DialogueFileDef,
    ...PROLOGUE_COMPANION_DIALOGUES
  }
};

export function findOriginItem(id: string, data: OriginGameData = ORIGIN_DATA): ItemDef | undefined {
  return data.items.find((item) => item.id === id);
}

export function findOriginEnemy(id: string, data: OriginGameData = ORIGIN_DATA): EnemyDef | undefined {
  return data.enemies.find((enemy) => enemy.id === id);
}

export function findOriginClass(id: string, data: OriginGameData = ORIGIN_DATA): ClassDef | undefined {
  return data.classes.find((cls) => cls.id === id);
}
