// Regenerates the _u1/_u2 items in data/items.json and the smiths' exchange dialogues (data/dialogues/ulepszenia_*.json),
// with their English overlay: data/lang/en/dialogues/ulepszenia_*.json and the _u entries of data/lang/en/items.json.
// Safe to run repeatedly.
//
// English names come from the glossary docs/i18n/slownik-en.md (item names and the stage suffixes), so a renamed
// item there means a rerun here. An upgrade's English description is the base item's English description from
// data/lang/en/items.json plus the stage sentence; until the base is translated (and its translation is fresh),
// the upgrade's description stays untranslated.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { loadBaseItems, upgradeKind, buildUpgradedItems, CHAINS, stageSentence, stageLabel, stageWord, glossaryEn, labelEn } from "./recipes.mjs";
import { WORKSHOPS, REPLIES } from "./workshops.mjs";
import { textEntries, hashText } from "../../src/i18n/overlay.js";
import { formatOverlay } from "../i18n/apply.mjs";
import { isGenerated } from "../i18n/extract.mjs";

const ROOT = new URL("../../", import.meta.url);
const ITEMS_OVERLAY = "data/lang/en/items.json";
// The text fields an upgraded item has; a new one must get its English here before the generator lets it through.
const ITEM_TEXT_KEYS = ["name", "listName", "description", "throwName"];

const json = (v) => JSON.stringify(v, null, 2) + "\n";

/**
 * Overlay entries for every text path of `pl`, the translation read from the same path of `en` (built in parallel,
 * so paths cannot drift). A path `en` lacks is an error unless `optional(path)`; then it is left out.
 */
function overlayOf(file, pl, en, optional = () => false) {
  const want = textEntries(file, pl);
  const have = textEntries(file, en);
  const out = {};
  for (const [p, text] of want) {
    if (!have.has(p)) {
      if (optional(p)) continue;
      throw new Error(`${file} › ${p}: brak angielskiego tekstu`);
    }
    out[p] = { t: have.get(p), h: hashText(text) };
  }
  return out;
}

/**
 * The two options of one exchange: the paid one, and the refusal shown while the money falls short.
 * A weapon is handed over with "zrobione", armour with "zrobione_pancerz" (taken in hand vs put on).
 */
function exchangeOptions(chain, lang, nameOf) {
  if (chain.qty) return boltOptions(chain, lang);
  const text = lang === "en"
    ? `${glossaryEn(nameOf[chain.base])}: ${chain.labelEn} (${chain.cost} gr)`
    : `${nameOf[chain.base]}: ${chain.label} (${chain.cost} gr)`;
  return [
    {
      id: `u_${chain.to}`,
      text,
      requires: { item: chain.from, money: chain.cost },
      actions: [{ unequipItem: chain.from }, { takeItem: chain.from }, { takeMoney: chain.cost }, { giveItem: chain.to }],
      goto: chain.kind === "pancerz" ? "zrobione_pancerz" : "zrobione",
    },
    { id: `b_${chain.to}`, text, requires: { item: chain.from, moneyBelow: chain.cost }, goto: "bez_groszy" },
  ];
}

/**
 * A pack of bolts for a pack of better ones. The new pack is handed over first: when it does not fit
 * (an explosive bolt weighs more), the actions stop there, the hero keeps his bolts and money, and the smith says the bag is full.
 */
function boltOptions(chain, lang) {
  const text = lang === "en"
    ? `${glossaryEn("Bełty")}: ${chain.labelEn} (${chain.cost} gr)`
    : `Bełty: ${chain.label} (${chain.cost} gr)`;
  const from = { id: chain.from, qty: chain.qty };
  return [
    {
      id: `u_${chain.to}`,
      text,
      requires: { item: from, money: chain.cost },
      actions: [{ giveItem: { id: chain.to, qty: chain.qty } }, { takeItem: from }, { takeMoney: chain.cost }],
      goto: "zrobione_belty",
      tooHeavy: "za_ciezko",
    },
    { id: `b_${chain.to}`, text, requires: { item: from, moneyBelow: chain.cost }, goto: "bez_groszy" },
  ];
}

/** The exchange dialogue of one workshop, in Polish or (same structure) in English. */
function workshopDialogue(name, w, lang, nameOf) {
  const chains = CHAINS.filter((c) => c.stage <= (w.stages[c.kind] ?? 0));
  const lines = lang === "en" ? w.en : w;
  const reply = (key) => REPLIES[key][lang];
  const node = (text, options) => ({ speaker: lines.speaker, text, options });
  return {
    id: `ulepszenia_${name}`,
    ...(w.portrait ? { portrait: w.portrait } : {}),
    wideList: true, // the exchange rows name an item and a price, like a shop's
    start: "warsztat",
    nodes: {
      warsztat: node(lines.warsztat, [...chains.flatMap((c) => exchangeOptions(c, lang, nameOf)), { id: "wyjscie", text: lines.wyjscie, goto: "end" }]),
      zrobione: node(lines.zrobione, [{ id: "dalej", text: reply("dobra"), goto: "warsztat" }]),
      ...(chains.some((c) => c.kind === "pancerz") ? {
        zrobione_pancerz: node(lines.zrobionePancerz, [{ id: "dalej", text: reply("dobra"), goto: "warsztat" }]),
      } : {}),
      bez_groszy: node(lines.bezGroszy, [{ id: "dalej", text: reply("wroce"), goto: "warsztat" }]),
      ...(chains.some((c) => c.qty) ? {
        zrobione_belty: node(lines.zrobioneBelty, [{ id: "dalej", text: reply("dobra"), goto: "warsztat" }]),
        za_ciezko: node(lines.zaCiezko, [{ id: "dalej", text: reply("miejsce"), goto: "warsztat" }]),
      } : {}),
    },
  };
}

/** English of the upgraded items of `base` ([u1, u2]); a field copied from the base takes the base's fresh translation. */
function upgradedItemsEn(base, upgraded, baseOverlay) {
  const fresh = (field) => {
    const e = baseOverlay[`[${base.id}].${field}`];
    return e && typeof e.t === "string" && e.h === hashText(base[field]) ? e.t : undefined;
  };
  return upgraded.map((u, stage) => {
    const unknown = [...textEntries("items.json", [u]).keys()].filter((p) => !ITEM_TEXT_KEYS.includes(p.slice(`[${u.id}].`.length)));
    if (unknown.length > 0) throw new Error(`${u.id}: pole tekstowe bez przekładu w generatorze: ${unknown.join(", ")}`);
    const en = structuredClone(u);
    en.name = `${glossaryEn(base.name)} (${labelEn(stageLabel(base, stage))})`;
    if (u.listName !== undefined) en.listName = `${glossaryEn(base.name)} (${labelEn(stageWord(base, stage))})`;
    const description = fresh("description");
    if (description === undefined) delete en.description;
    else en.description = `${description} ${stageSentence(base, stage).en}`;
    if (u.throwName !== undefined) en.throwName = fresh("throwName") ?? glossaryEn(base.throwName);
    return en;
  });
}

function readItemsOverlay() {
  try {
    return JSON.parse(fs.readFileSync(new URL(ITEMS_OVERLAY, ROOT), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw new Error(`${ITEMS_OVERLAY}: ${e.message}`);
  }
}

/**
 * Every generated file as Map(path from the repo root → content). Writes nothing.
 * `itemsOverlay` replaces the current data/lang/en/items.json (for tests); its entries other than _u ones are kept.
 */
export function buildOutputs({ itemsOverlay = readItemsOverlay() } = {}) {
  const out = new Map();
  const base = loadBaseItems();
  const nameOf = Object.fromEntries(base.map((i) => [i.id, i.name]));

  const pairs = base.filter((i) => upgradeKind(i)).map((b) => [b, buildUpgradedItems(b)]);
  const upgrades = pairs.flatMap(([, u]) => u);
  out.set("data/items.json", json([...base, ...upgrades]));
  const upgradesEn = pairs.flatMap(([b, u]) => upgradedItemsEn(b, u, itemsOverlay));
  const itemsEn = Object.fromEntries(Object.entries(itemsOverlay).filter(([p]) => !isGenerated("items.json", p)));
  Object.assign(itemsEn, overlayOf("items.json", upgrades, upgradesEn, (p) => p.endsWith(".description")));
  out.set(ITEMS_OVERLAY, formatOverlay(itemsEn));

  for (const [name, w] of Object.entries(WORKSHOPS)) {
    const file = `dialogues/ulepszenia_${name}.json`;
    const pl = workshopDialogue(name, w, "pl", nameOf);
    out.set(`data/${file}`, json(pl));
    out.set(`data/lang/en/${file}`, formatOverlay(overlayOf(file, pl, workshopDialogue(name, w, "en", nameOf))));
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputs = buildOutputs();
  for (const [rel, content] of outputs) {
    const url = new URL(rel, ROOT);
    fs.mkdirSync(new URL(".", url), { recursive: true });
    fs.writeFileSync(url, content);
  }
  const items = JSON.parse(outputs.get("data/items.json"));
  console.log(`Wygenerowano ${items.filter((i) => /_u[12]$/.test(i.id)).length} przedmiotów ulepszonych.`);
  for (const name of Object.keys(WORKSHOPS)) {
    const options = JSON.parse(outputs.get(`data/dialogues/ulepszenia_${name}.json`)).nodes.warsztat.options;
    console.log(`ulepszenia_${name}: ${options.filter((o) => o.id.startsWith("u_")).length} wymian.`);
  }
}
