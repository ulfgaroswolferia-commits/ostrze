// Upgrade recipes: which base items get an _u1/_u2 version, and how each stage changes them.
// The generated items are plain items in data/items.json; a smith exchanges old item + money for the next.
import fs from "node:fs";
import { parseGlossary, compile } from "../i18n/glossary.mjs";

const ITEMS_PATH = new URL("../../data/items.json", import.meta.url);

const SUFFIX = /_u[12]$/;
const GLOSSARY_PATH = new URL("../../docs/i18n/slownik-en.md", import.meta.url);

// The glossary tables item names and upgrade suffixes live in; a name is looked up only there.
const ITEM_TABLES = ["Przedmioty", "Dopiski ulepszeń"];

let glossaryRows;
/** Rows of the item tables of docs/i18n/slownik-en.md (a row belongs to the last "## " heading above it). */
function itemRows() {
  if (glossaryRows) return glossaryRows;
  const md = fs.readFileSync(GLOSSARY_PATH, "utf8");
  const headings = md.split(/\r?\n/).map((l, i) => [i + 1, /^## (.+)$/.exec(l)?.[1]]).filter(([, h]) => h);
  const tableOf = (line) => headings.filter(([at]) => at < line).at(-1)?.[1];
  glossaryRows = parseGlossary(md).filter((r) => ITEM_TABLES.includes(tableOf(r.line)));
  return glossaryRows;
}

/**
 * The binding English name of a Polish item name or suffix, from the item tables of docs/i18n/slownik-en.md:
 * the row whose PL is exactly `pl`, else the one row whose whole-entry pattern (^…$) matches it
 * ("Włócznia" has the row "Włócznia (rzut)"). Throws when there is none, so a name missing from the glossary
 * stops the generator instead of slipping through.
 */
export function glossaryEn(pl) {
  const rows = itemRows();
  const row = rows.find((r) => r.pl === pl);
  if (row) return row.en;
  const hits = rows.filter((r) => r.pattern.startsWith("^") && compile(r.pattern).test(pl));
  if (hits.length === 1) return hits[0].en;
  throw new Error(`słownik: ${hits.length ? "kilka wierszy" : "brak wiersza"} dla „${pl}” w tabelach ${ITEM_TABLES.join(", ")} (docs/i18n/slownik-en.md)`);
}

/** English of a stage suffix: "uchwyt, ostrzony" → "grip, sharpened", word by word from the glossary rows "(uchwyt)"… */
export const labelEn = (label) => label.split(", ").map((w) => glossaryEn(`(${w})`)).join(", ");

// Sentences appended to the base description, per kind and stage, with the English beside the Polish.
// They never name who did the work: the upgraded item is the same whichever smith made it.
export const SENTENCES = {
  biala: [
    { pl: "Uchwyt wymieniony na nowy, leży w dłoni pewniej.", en: "New grip. Sits surer in the hand." },
    { pl: "Przeszlifowane i naostrzone, co się dało. Łatwiej wchodzi w pancerz.", en: "Ground and sharpened all over. Bites into armour more easily." },
  ],
  palna: [
    { pl: "Dorobiona nowa muszka, łatwiej wycelować.", en: "New sight. Easier to aim." },
    { pl: "Spust wyczyszczony i wyregulowany, kurek spada pewnie.", en: "Trigger cleaned. The hammer falls true." },
  ],
  kusza: [
    { pl: "Łoże wymienione na nowe, kusza strzela celniej.", en: "New stock. Shoots truer." },
    { pl: "Ramię wzmocnione, bełt mocniej przebija pancerz.", en: "Stronger limb. Bolts bite deeper into armour." },
  ],
  pancerz: [
    { pl: "Podszewka wymieniona na grubszą skórę.", en: "Relined with thicker leather." },
    { pl: "Dołożono płyty w miejscach, gdzie najczęściej tną.", en: "Plates added where the cuts land most." },
  ],
};

// Stage 2 of a blunt melee weapon (mace, club, knuckles, studded gloves): there is no edge to sharpen, so the striking part is
// shod again with harder iron; the effect is the same (+1 armour piercing).
export const BLUNT_STAGE2 = { pl: "Okute na nowo twardszym żelazem tam, gdzie uderza. Łatwiej przebija się przez pancerz.", en: "Reshod with harder iron where it strikes. Bites into armour more easily." };

/** True for a blunt melee weapon (mace, club, knuckles): its stage 2 is shod with harder iron, not sharpened. */
const isBlunt = (base) => upgradeKind(base) === "biala" && base.damageType === "obuchowe";

/** The name suffix of a stage (0 or 1) of `base`, in Polish: "uchwyt, ostrzony"; a blunt weapon's stage 2 is "uchwyt, okuty". */
export function stageLabel(base, stage) {
  if (stage === 1 && isBlunt(base)) return "uchwyt, okuty";
  return LABELS[upgradeKind(base)][stage];
}

/** The one stage of a step (0 or 1), what a smith's exchange row offers: "uchwyt", then "ostrzony" (the grip is on the item already). */
export function stageWord(base, stage) {
  return stageLabel(base, stage).split(", ").at(-1);
}

/** The sentence a stage (0 or 1) adds to the description of `base`: { pl, en }. */
export function stageSentence(base, stage) {
  const kind = upgradeKind(base);
  if (stage === 1 && isBlunt(base)) return BLUNT_STAGE2;
  return SENTENCES[kind][stage];
}

// The name suffix of each stage. Its English comes from the glossary table „Dopiski ulepszeń”.
export const LABELS = {
  biala: ["uchwyt", "uchwyt, ostrzony"],
  palna: ["muszka", "muszka, spust"],
  kusza: ["łoże", "łoże, ramię"],
  pancerz: ["skóra", "skóra, płyty"],
};

export function loadBaseItems() {
  return JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8")).filter((i) => !SUFFIX.test(i.id));
}

export function upgradeKind(item) {
  if (item.type === "weapon") {
    if (item.hidden || item.offhand || item.masteryType === "luk") return null;
    if (item.misfireChance !== undefined) return "palna";
    if (item.masteryType === "kusza") return "kusza";
    if (item.range === "melee") return "biala";
    return null;
  }
  if (item.type === "armor" && item.slot === "tulow") return "pancerz";
  return null;
}

const costs = (base) => [Math.ceil(base.value * 0.5), base.value];

function applyStage(kind, stage, prev) {
  const item = structuredClone(prev);
  const addSkill = () => {
    item.modifiers = { ...(item.modifiers ?? {}) };
    item.modifiers[item.skill] = (item.modifiers[item.skill] ?? 0) + 5;
  };
  const addPierce = () => { item.armorPierce = (item.armorPierce ?? 0) + 1; };
  const addReduction = () => {
    for (const t of Object.keys(item.reduction)) item.reduction[t] += 5;
  };
  if (kind === "pancerz") {
    if (stage === 1 || !(item.modifiers?.ap < 0)) addReduction();
    else {
      delete item.modifiers.ap;
      if (!Object.keys(item.modifiers).length) delete item.modifiers;
    }
  } else if (kind === "palna") {
    if (stage === 1) addSkill();
    else item.misfireChance = Math.max(1, item.misfireChance - 3);
  } else if (stage === 1) addSkill();
  else addPierce();
  return item;
}

export function buildChains(baseItems = loadBaseItems()) {
  const chains = [];
  for (const base of baseItems) {
    const kind = upgradeKind(base);
    if (!kind) continue;
    const [c1, c2] = costs(base);
    chains.push({ base: base.id, from: base.id, to: `${base.id}_u1`, stage: 1, cost: c1, kind, label: stageWord(base, 0), labelEn: labelEn(stageWord(base, 0)) });
    chains.push({ base: base.id, from: `${base.id}_u1`, to: `${base.id}_u2`, stage: 2, cost: c2, kind, label: stageWord(base, 1), labelEn: labelEn(stageWord(base, 1)) });
  }
  return [...chains, ...BOLT_CHAINS];
}

/**
 * The bolt exchange: packs of `qty`, done where crossbows are (stage 1) and, explosive ones, where crossbows get stage 2.
 * Cost is for the whole pack; the bolt stays in the bag, nothing to take off.
 */
export const BOLT_CHAINS = [
  { base: "belt", from: "belt", to: "belt_wzmocniony", stage: 1, cost: 20, qty: 10, kind: "kusza", label: "10 zwykłych na wzmocnione", labelEn: "10 plain for reinforced" },
  { base: "belt", from: "belt_wzmocniony", to: "belt_wybuchowy", stage: 2, cost: 100, qty: 10, kind: "kusza", label: "10 wzmocnionych na wybuchowe", labelEn: "10 reinforced for explosive" },
];

export const CHAINS = buildChains();

// Builds the _u1 and _u2 items for a base item (same weight, value grows by the paid costs).
export function buildUpgradedItems(base) {
  const kind = upgradeKind(base);
  const [c1, c2] = costs(base);
  const u1 = applyStage(kind, 1, base);
  u1.id = `${base.id}_u1`;
  u1.name = `${base.name} (${stageLabel(base, 0)})`;
  u1.value = base.value + c1;
  u1.description = `${base.description} ${stageSentence(base, 0).pl}`;
  const u2 = applyStage(kind, 2, u1);
  u2.id = `${base.id}_u2`;
  u2.name = `${base.name} (${stageLabel(base, 1)})`;
  // a list row (sale, inventory) names the highest stage only: "Półpancerz (płyty)"; the card keeps the full name
  u2.listName = `${base.name} (${stageWord(base, 1)})`;
  u2.value = base.value + c1 + c2;
  u2.description = `${base.description} ${stageSentence(base, 1).pl}`;
  return [u1, u2];
}
