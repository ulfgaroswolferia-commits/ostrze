import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { loadData, validateData, DataLoadError } from "../src/engine/data.js";
import { dataDir } from "../src/config.js";
import { tmpDir, minimalData } from "./helpers.js";
import { itemById, slotAccepts, SLOTS, MASTERY_TYPES } from "../src/systems/items.js";

test("minimalne dane przechodzą", () => assert.deepEqual(validateData(minimalData()), []));
test("prawdziwy katalog data/ przechodzi walidację", async () =>
  assert.deepEqual(validateData(await loadData()), []));
test("komunikaty błędów", () => {
  const d = minimalData({ scenes: [
    { id: "a", type: "narration", text: "x", goto: "nie_ma" },
    { id: "a", type: "ending", text: "y" },
    { id: "c", type: "walka" },
    { type: "flag", set: { f: true } },
    { id: "g", text: "bez typu" },
    { id: "e", type: "narration", text: "z", if: { flga: "f" }, goto: "e" },
  ], start: "zly_start" });
  const errs = validateData(d);
  for (const e of [
    'story.json › start: nieznana scena "zly_start"',
    'story.json › a › goto: nieznana scena "nie_ma"',
    "story.json › a: zduplikowane id",
    'story.json › c › type: nieznany typ sceny "walka"',
    "story.json › g › type: brak wymaganego pola",
    "story.json › #3 › id: brak wymaganego pola",
    "story.json › e › if.flga: nieznany warunek",
    "story.json › e › goto: scena wskazuje samą siebie",
  ]) assert.ok(errs.includes(e), `brak: ${e}\n${errs.join("\n")}`);
});
test("pusta lista scen i złe reguły", () => {
  const d = minimalData({ scenes: [] });
  d.rules = { startHour: 24 };
  const errs = validateData(d);
  assert.ok(errs.some((e) => e.startsWith("story.json › scenes")));
  assert.ok(errs.some((e) => e.startsWith("rules.json › startHour")));
});
test("loadData: brak pliku i zły JSON dają DataLoadError z nazwą pliku", async () => {
  const dir = await tmpDir();
  await assert.rejects(loadData(dir), (e) => e instanceof DataLoadError && /ui\.json/.test(e.message));
  await fs.cp(dataDir(), dir, { recursive: true });
  await fs.writeFile(path.join(dir, "story.json"), "{");
  await assert.rejects(loadData(dir), (e) => e instanceof DataLoadError && /story\.json/.test(e.message));
});
test("dane są zamrożone", async () => assert.ok(Object.isFrozen((await loadData()).story.scenes[0])));

test("prawdziwe data/ ma nowe pliki", async () => {
  const d = await loadData();
  assert.deepEqual(validateData(d), []);
  assert.deepEqual(d.attributes.map((a) => a.id), ["sila", "zrecznosc", "krzepa", "bystrosc", "rozum", "oglada", "fart"]);
  assert.equal(d.skills.length, 11);
  assert.equal(d.perks.length, 21);
  assert.deepEqual(d.classes.map((c) => [c.id, c.taggedSkill]), [["miecz", "sieczna"], ["wlocznia", "drzewcowa"]]);
  assert.equal(d.rules.leveling.xpStep, 150);
  assert.deepEqual(d.rules.creator.gifts, { rozum: 1 });
});
test("błędy odwołań w nowych plikach", () => {
  const d = structuredClone(minimalData());
  d.skills[0].primary = "sial";
  d.classes[0].taggedSkill = "brak";
  d.perks[0].requires = { attributes: { mocarz: 5 }, skills: { lucznictwo: 10 } };
  d.attributes.push({ ...d.attributes[0] });
  d.rules.vars = ["wola", "wola"];
  const errs = validateData(d);
  for (const e of [
    'skills.json › sieczna › primary: nieznany atrybut "sial"',
    'classes.json › miecz › taggedSkill: nieznana umiejętność "brak"',
    'perks.json › szkola_miecza › requires.attributes.mocarz: nieznany atrybut "mocarz"',
    'perks.json › szkola_miecza › requires.skills.lucznictwo: nieznana umiejętność "lucznictwo"',
    "attributes.json › sila: zduplikowane id",
    'rules.json › vars: zduplikowana zmienna "wola"',
  ]) assert.ok(errs.includes(e), `brak: ${e}\n${errs.join("\n")}`);
});
test("błędy kształtu nowych plików", () => {
  const d = structuredClone(minimalData());
  d.attributes[1].extra = 1;
  d.skills[1].secondary = 5;
  d.perks[0].requires.level = 1;
  d.perks[1].requires = {};
  delete d.perks[2].requires;
  d.rules.creator.zle = 1;
  d.rules.timeOfDay[0].bystroscSkillPenalty = 1.5;
  d.classes = {};
  const errs = validateData(d);
  for (const e of [
    "attributes.json › zrecznosc › extra: nieznane pole",
    "skills.json › drzewcowa › secondary: oczekiwano tekstu",
    "perks.json › szkola_miecza › requires.level: wartość mniejsza niż 2",
    "rules.json › creator.zle: nieznane pole",
    "rules.json › timeOfDay[0].bystroscSkillPenalty: oczekiwano liczby całkowitej",
    "classes.json: oczekiwano tablicy",
  ]) assert.ok(errs.includes(e), `brak: ${e}\n${errs.join("\n")}`);
});
test("brak pliku perks.json → DataLoadError z nazwą pliku", async () => {
  const dir = await tmpDir();
  await fs.cp(dataDir(), dir, { recursive: true });
  await fs.rm(path.join(dir, "perks.json"));
  await assert.rejects(loadData(dir), (e) => e instanceof DataLoadError && /perks\.json/.test(e.message));
});

test("walidacja modyfikatorów, unlocks i pokrycia pór doby", () => {
  const d = structuredClone(minimalData());
  d.classes[0].modifiers = { bystrsoc: 1 }; d.perks.find((p) => p.id === "finta").unlocks = ["fintaa"];
  d.rules.timeOfDay[0].from = 6; // swit 6–7: godzina 5 niepokryta
  const errs = validateData(d);
  for (const e of [`classes.json › ${d.classes[0].id} › modifiers.bystrsoc: nieznany modyfikator`,
    'perks.json › finta › unlocks[0]: nieznane odblokowanie "fintaa"', "rules.json › timeOfDay: godzina 5 nie jest pokryta"])
    assert.ok(errs.includes(e), `brak: ${e}\n${errs.join("\n")}`);
});

test("pory doby: wielokrotne pokrycie, from równe to, modyfikatory", () => {
  const d = structuredClone(minimalData());
  d.rules.timeOfDay[0].from = 4; // swit 4–7 nakłada się na noc (20–5) w godzinie 4
  d.rules.timeOfDay[1].modifiers = { x: 1 };
  assert.ok(validateData(d).includes("rules.json › timeOfDay: godzina 4 pokryta wielokrotnie"));
  assert.ok(validateData(d).includes("rules.json › timeOfDay[1].modifiers.x: nieznany modyfikator"));
  const e = structuredClone(minimalData());
  e.rules.timeOfDay[1].to = e.rules.timeOfDay[1].from;
  assert.ok(validateData(e).includes("rules.json › timeOfDay[1]: from i to nie mogą być równe"));
});

test("creator: nieznany atrybut daru i attributeMin > attributeMax", () => {
  const d = structuredClone(minimalData());
  d.rules.creator.gifts = { x: 1 };
  d.rules.creator.attributeMin = 11;
  const errs = validateData(d);
  assert.ok(errs.includes('rules.json › creator.gifts.x: nieznany atrybut "x"'), errs.join("\n"));
  assert.ok(errs.includes("rules.json › creator: attributeMin większe niż attributeMax"), errs.join("\n"));
});

test("walidacja nazw zmiennych w scenie var i warunku if", () => {
  const d = minimalData({ scenes: [
    { id: "a", type: "var", add: { zlosc: 1, wola: 1 }, goto: "b" },
    { id: "b", type: "narration", text: "x", if: { var: "zlosc", gte: 1 } },
  ] });
  assert.deepEqual(validateData(d), [
    'story.json › a › add.zlosc: nieznana zmienna "zlosc"',
    'story.json › b › if.var: nieznana zmienna "zlosc"',
  ]);
  assert.deepEqual(validateData(minimalData({ scenes: [{ id: "a", type: "var", add: { wola: 1.5 } }] })),
    ["story.json › a › add.wola: oczekiwano liczby całkowitej"]);
});

test("pory doby: from/to poza zakresem 0–23", () => {
  const d = structuredClone(minimalData());
  d.rules.timeOfDay[0].from = 24; d.rules.timeOfDay[1].to = 30;
  const errs = validateData(d);
  assert.ok(errs.includes("rules.json › timeOfDay[0].from: wartość poza zakresem 0–23"));
  assert.ok(errs.includes("rules.json › timeOfDay[1].to: wartość poza zakresem 0–23"));
  assert.ok(!errs.some((e) => /godzina \d+ (nie jest|pokryta)/.test(e)));
});

test("walidacja: reward przed kreatorem", () => {
  const d = minimalData({ start: "r", scenes: [{ id: "r", type: "reward", xp: 10 }, { id: "c", type: "character_creation" }, { id: "k", type: "ending", text: "x" }] });
  assert.ok(validateData(d).includes("story.json › r › type: scena wymaga postaci – brak wcześniejszej sceny character_creation"));
  const ok = minimalData({ start: "c", scenes: [{ id: "c", type: "character_creation" }, { id: "r", type: "reward", xp: 10 }, { id: "k", type: "ending", text: "x" }] });
  assert.deepEqual(validateData(ok), []);
});

// --- items.json (cykl B2) ---
const withItem = (patch, base = "miecz_krotki") => {
  const d = structuredClone(minimalData());
  d.items.push({ ...structuredClone(d.items.find((i) => i.id === base)), id: "x", ...patch });
  return validateData(d);
};
const expectErr = (errs, msg) => assert.ok(errs.some((e) => e.includes(msg)), `brak: ${msg}\n${errs.join("\n")}`);

test("items: prawdziwe dane przechodzą, jest piesci", async () => {
  const d = await loadData();
  assert.deepEqual(validateData(d), []);
  assert.ok(d.items.some((i) => i.id === "piesci" && i.hidden));
  assert.equal(d.rules.inventory.hardLimitPercent, 150);
});
test("items: błędy typu, pól i odwołań", () => {
  expectErr(withItem({ type: "magia" }), 'items.json › x › type: nieznany typ przedmiotu "magia"');
  const noDmg = structuredClone(minimalData());
  noDmg.items.push({ ...noDmg.items.find((i) => i.id === "miecz_krotki"), id: "x" });
  delete noDmg.items.at(-1).damage;
  expectErr(validateData(noDmg), "items.json › x › damage: brak wymaganego pola");
  expectErr(withItem({ damage: [8, 4] }), "items.json › x › damage: oczekiwano [min, max] liczb całkowitych, min ≤ max");
  expectErr(withItem({ skill: "latanie" }), 'items.json › x › skill: nieznana umiejętność "latanie"');
  expectErr(withItem({ reload: { apCost: 1, ammo: "miecz_krotki", capacity: 1 } }, "luk_mysliwski"),
    "items.json › x › reload.ammo: oczekiwano przedmiotu typu ammo");
  expectErr(withItem({ slot: "bron" }, "kaftan_przeszywany"), 'items.json › x › slot: niedozwolony slot "bron"');
  expectErr(withItem({ reduction: { sieczne: 80 } }, "kaftan_przeszywany"), "items.json › x › reduction.sieczne: wartość poza zakresem 0–75");
  expectErr(withItem({ foo: true }), "items.json › x › foo: nieznane pole");
  expectErr(withItem({ modifiers: { latanie: 1 } }), "items.json › x › modifiers.latanie: nieznany modyfikator");
  expectErr(withItem({ weight: -1 }), "items.json › x › weight: wartość mniejsza niż 0");
  expectErr(withItem({ chance: 1 }, "puszka_szerszeni"), "items.json › x › chance: nieznane pole");
  expectErr(withItem({ effects: [{ id: "a", chance: 101 }] }, "puszka_szerszeni"), "items.json › x › effects[0].chance: wartość poza zakresem 1–100");
  expectErr(withItem({ healSkill: "latanie" }, "opatrunek"), 'items.json › x › healSkill: nieznana umiejętność "latanie"');
  expectErr(withItem({ id: "miecz_krotki" }), "items.json › miecz_krotki: zduplikowane id");
});
test("items: quickSlots tylko dla pasa i obowiązkowo", () => {
  const d = structuredClone(minimalData());
  delete d.items.find((i) => i.id === "pas_zwykly").quickSlots;
  d.items.find((i) => i.id === "kaptur_mysliwego").quickSlots = 1;
  const errs = validateData(d);
  expectErr(errs, "items.json › pas_zwykly › quickSlots: wymagane dla slotu pas");
  expectErr(errs, "items.json › kaptur_mysliwego › quickSlots: dozwolone tylko dla slotu pas");
});
test("items: brak piesci", () => {
  const d = structuredClone(minimalData());
  d.items = d.items.filter((i) => i.id !== "piesci");
  expectErr(validateData(d), "items.json: brak przedmiotu piesci (weapon, hidden)");
});
test("rules: sekcje inventory i shop", () => {
  const d = structuredClone(minimalData());
  delete d.rules.inventory;
  d.rules.shop.buyBase = 0;
  const errs = validateData(d);
  expectErr(errs, "rules.json › inventory: brak wymaganego pola");
  expectErr(errs, "rules.json › shop.buyBase: wartość musi być większa niż 0");
});

// --- shops.json i zestawy startowe klas (cykl B2) ---
const withShop = (patch) => {
  const d = structuredClone(minimalData());
  d.shops.push({ id: "s", name: "S", stock: [{ id: "opatrunek", qty: 1 }], buys: ["weapon"], ...patch });
  return validateData(d);
};
const withClass = (patch, remove = []) => {
  const d = structuredClone(minimalData());
  Object.assign(d.classes.find((c) => c.id === "miecz"), patch);
  for (const key of remove) delete d.classes.find((c) => c.id === "miecz")[key];
  return validateData(d);
};

test("shops: prawdziwe dane przechodzą", async () => {
  const d = await loadData();
  assert.deepEqual(validateData(d), []);
  assert.deepEqual(d.shops.map((s) => s.id), ["kramarz_szkolny", "kupiec_drogi", "kramarz_brod", "handlarz_gluszec", "handlarz_wedrowny", "zapasy_obserwatorium", "kowal_brod", "szkarad_ruszniczar", "kowal_gluszec_sklep", "warsztat_brygidy", "wedrowny_pogorze", "wedrowny_glusz", "wedrowny_gwiazdy", "kantyna_frontowa", "kuznia_polowa", "wedrowny_front", "sklep_hurtownika", "szklarz", "kantor_portowy", "sklep_stoczni"]);
  assert.deepEqual(validateData(minimalData()), []);
});
test("shops: błędy odwołań i kształtu", () => {
  expectErr(withShop({ stock: [{ id: "x", qty: 1 }] }), 'shops.json › s › stock[0].id: nieznany przedmiot "x"');
  expectErr(withShop({ stock: [{ id: "piesci", qty: 1 }] }), "shops.json › s › stock[0].id: przedmiot ukryty");
  expectErr(withShop({ stock: [{ id: "opatrunek", qty: 0 }] }), "shops.json › s › stock[0].qty: wartość mniejsza niż 1");
  expectErr(withShop({ stock: [{ id: "opatrunek", qty: 1 }, { id: "opatrunek", qty: 2 }] }),
    'shops.json › s › stock[1].id: powtórzony przedmiot "opatrunek"');
  expectErr(withShop({ buys: ["magia"] }), 'shops.json › s › buys[0]: nieznany typ przedmiotu "magia"');
  const dup = structuredClone(minimalData());
  dup.shops.push({ id: "s", name: "S", stock: [], buys: [] }, { id: "s", name: "T", stock: [], buys: [] });
  expectErr(validateData(dup), "shops.json › s: zduplikowane id");
});
test("classes: zestaw startowy", () => {
  expectErr(withClass({ startItems: [{ id: "x", qty: 1 }] }), 'classes.json › miecz › startItems[0].id: nieznany przedmiot "x"');
  expectErr(withClass({ startItems: [{ id: "opatrunek", qty: 0 }], startEquipped: {} }),
    "classes.json › miecz › startItems[0].qty: wartość mniejsza niż 1");
  expectErr(withClass({ startEquipped: { tulow: "miecz_krotki" } }), "classes.json › miecz › startEquipped.tulow: przedmiot nie pasuje do slotu");
  expectErr(withClass({ startEquipped: { bron: "luk_mysliwski" } }), "classes.json › miecz › startEquipped.bron: przedmiot spoza startItems");
  expectErr(withClass({ startEquipped: { reka: "miecz_krotki" } }), 'classes.json › miecz › startEquipped.reka: nieznany slot');
  expectErr(withClass({}, ["startMoney"]), "classes.json › miecz › startMoney: brak wymaganego pola");
});
test("slotAccepts: broń, pancerz, reszta", () => {
  const d = minimalData();
  const item = (id) => itemById(d, id);
  assert.equal(slotAccepts(item("miecz_krotki"), "bron"), true);
  assert.equal(slotAccepts(item("miecz_krotki"), "bron_zapas"), true);
  assert.equal(slotAccepts(item("miecz_krotki"), "tulow"), false);
  assert.equal(slotAccepts(item("kaptur_mysliwego"), "glowa"), true);
  assert.equal(slotAccepts(item("kaptur_mysliwego"), "bron"), false);
  for (const slot of SLOTS) assert.equal(slotAccepts(item("opatrunek"), slot), false);
});

// --- reward: xp opcjonalne, money, items (Task 10) ---
const rewardErrs = (reward) => validateData(minimalData({
  start: "c",
  scenes: [{ id: "c", type: "character_creation" }, { id: "r", type: "reward", ...reward }, { id: "k", type: "ending", text: "x" }],
}));
test("walidacja: reward – xp opcjonalne, pusta nagroda, przedmioty", () => {
  assert.deepEqual(rewardErrs({ money: 5 }), []);
  assert.deepEqual(rewardErrs({ items: ["kolczuga", { id: "strzala", qty: 3 }] }), []);
  expectErr(rewardErrs({}), "story.json › r › reward: pusta nagroda");
  expectErr(rewardErrs({ xp: 0 }), "story.json › r › reward: pusta nagroda");
  expectErr(rewardErrs({ items: [] }), "story.json › r › reward: pusta nagroda");
  expectErr(rewardErrs({ items: ["x"] }), 'story.json › r › items[0]: nieznany przedmiot "x"');
  expectErr(rewardErrs({ items: ["kolczuga", { id: "y", qty: 1 }] }), 'story.json › r › items[1]: nieznany przedmiot "y"');
  expectErr(rewardErrs({ items: ["piesci"] }), "story.json › r › items[0]: przedmiot ukryty");
  expectErr(rewardErrs({ money: -1 }), "story.json › r › money: wartość mniejsza niż 0");
  expectErr(rewardErrs({ items: [{ id: "strzala", qty: 0 }] }), "story.json › r › items[0]: qty: wartość mniejsza niż 1");
  expectErr(rewardErrs({ items: [5] }), "story.json › r › items[0]: oczekiwano tekstu lub obiektu");
});

test("walidacja: sklep – nieznany sklep i wymóg kreatora", () => {
  const bad = minimalData({ start: "c", scenes: [{ id: "c", type: "character_creation" }, { id: "s", type: "shop", shop: "x" }, { id: "k", type: "ending", text: "x" }] });
  assert.ok(validateData(bad).includes('story.json › s › shop: nieznany sklep "x"'));
  const early = minimalData({ start: "s", scenes: [{ id: "s", type: "shop", shop: "kramarz_szkolny" }, { id: "c", type: "character_creation" }, { id: "k", type: "ending", text: "x" }] });
  assert.ok(validateData(early).includes("story.json › s › type: scena wymaga postaci – brak wcześniejszej sceny character_creation"));
  const ok = minimalData({ start: "c", scenes: [{ id: "c", type: "character_creation" }, { id: "s", type: "shop", shop: "kramarz_szkolny" }, { id: "k", type: "ending", text: "x" }] });
  assert.deepEqual(validateData(ok), []);
});

// --- effects.json, rules.effects, odwołania do efektów (C1 Task 1) ---
const withEffect = (patch) => {
  const d = structuredClone(minimalData());
  d.effects.push({ id: "x", name: "X", description: "opis", unit: "turn", duration: 2, ...patch });
  return validateData(d);
};
test("efekty: prawdziwe dane przechodzą, jest 21 efektów", () => {
  const d = minimalData();
  assert.equal(d.effects.length, 21);
  assert.deepEqual(validateData(d), []);
  assert.deepEqual(withEffect({}), []);
});
test("efekty: błędy pól", () => {
  expectErr(withEffect({ unit: "dzien" }), 'effects.json › x › unit: nieznana jednostka "dzien"');
  expectErr(withEffect({ stack: "mnoz" }), 'effects.json › x › stack: nieznany tryb "mnoz"');
  expectErr(withEffect({ stack: "refresh", maxStacks: 2 }), "effects.json › x › maxStacks: dozwolone tylko przy stack");
  expectErr(withEffect({ unit: "hour", scope: "battlefield" }), "effects.json › x › scope: dozwolone tylko dla unit turn");
  expectErr(withEffect({ sleepClears: 2 }), "effects.json › x › sleepClears: dozwolone tylko dla unit hour");
  expectErr(withEffect({ resist: "latanie" }), 'effects.json › x › resist: nieznany atrybut "latanie"');
  expectErr(withEffect({ tick: { damage: [5, 2] } }), "effects.json › x › tick.damage: oczekiwano [min, max] liczb całkowitych, min ≤ max");
  expectErr(withEffect({ modifiers: { latanie: 1 } }), "effects.json › x › modifiers.latanie: nieznany modyfikator");
  expectErr(withEffect({ foo: 1 }), "effects.json › x › foo: nieznane pole");
  expectErr(withEffect({ duration: 0 }), "effects.json › x › duration: wartość mniejsza niż 1");
  expectErr(withEffect({ tick: { damage: [1, 2], damageType: "magia" } }), "effects.json › x › tick.damageType");
});
test("efekty: powtórzone id", () => {
  const d = structuredClone(minimalData());
  d.effects.push({ ...d.effects[0] });
  expectErr(validateData(d), `effects.json › ${d.effects[0].id}: zduplikowane id`);
});
test("rules.effects: resistOutcome z listy", () => {
  const d = structuredClone(minimalData());
  d.rules.effects.resistOutcome = "zignoruj";
  expectErr(validateData(d), "rules.json › effects.resistOutcome");
});
test("items: odwołania do efektów", () => {
  const bad = (id, patch) => {
    const d = structuredClone(minimalData());
    Object.assign(d.items.find((i) => i.id === id), patch);
    return validateData(d);
  };
  expectErr(bad("garniec_wapno", { effects: [{ id: "brak", chance: 90 }] }), 'items.json › garniec_wapno › effects[0].id: nieznany efekt "brak"');
  expectErr(bad("opatrunek", { removes: ["brak"] }), 'items.json › opatrunek › removes[0]: nieznany efekt "brak"');
  expectErr(bad("bimber", { applies: ["krwawienie"] }), 'items.json › bimber › applies[0]: efekt "krwawienie" nie jest godzinowy');
  expectErr(bad("bimber", { applies: ["brak"] }), 'items.json › bimber › applies[0]: nieznany efekt "brak"');
  assert.equal(minimalData().items.find((i) => i.id === "bimber").applies[0], "podchmielenie");
});

test("warunek if sceny: nieznany przedmiot", () => {
  const d = minimalData({ scenes: [{ id: "a", type: "narration", text: "x", if: { item: "brak" } }] });
  assert.deepEqual(validateData(d), ['story.json › a › if.item: nieznany przedmiot "brak"']);
});

// --- dialogues/ (cykl C1) ---
const goodDialogue = () => ({
  id: "test", file: "test.json", start: "a",
  nodes: {
    a: { speaker: "X", text: "y", options: [
      { id: "t", text: "Test", check: { skill: "handel", difficulty: 35 }, success: "b", failure: "a" },
      { text: "Dalej", goto: "b" },
    ] },
    b: { speaker: "X", text: "z", options: [{ text: "Bywaj", goto: "end:zgoda" }] },
  },
});
const withDialogue = (mutate) => {
  const d = structuredClone(minimalData());
  const dlg = goodDialogue();
  mutate(dlg);
  d.dialogues = [...d.dialogues, dlg];
  return validateData(d);
};

test("dialogues: prawdziwe dane i poprawna rozmowa przechodzą", async () => {
  const d = await loadData();
  assert.deepEqual(validateData(d), []);
  assert.ok(d.dialogues.some((x) => x.id === "kwatermistrz"));
  assert.deepEqual(withDialogue(() => {}), []);
});
test("dialogues: start, goto, id, nazwa pliku", () => {
  expectErr(withDialogue((x) => { x.start = "brak"; }), 'dialogues/test.json › start: nieznany węzeł "brak"');
  expectErr(withDialogue((x) => { x.nodes.a.options[1].goto = "brak"; }), 'dialogues/test.json › nodes.a.options[1].goto: nieznany węzeł "brak"');
  expectErr(withDialogue((x) => { x.nodes.a.options[0].success = "brak"; }), 'dialogues/test.json › nodes.a.options[0].success: nieznany węzeł "brak"');
  expectErr(withDialogue((x) => { x.nodes.a.options[1].goto = "end:Zla Zgoda"; }), "dialogues/test.json › nodes.a.options[1].goto");
  expectErr(withDialogue((x) => { x.id = "inny"; }), "dialogues/test.json › id: niezgodne z nazwą pliku");
  const dup = structuredClone(minimalData());
  dup.dialogues = [goodDialogue(), goodDialogue()];
  expectErr(validateData(dup), "dialogues/test.json › id: zduplikowane id");
});
test("dialogues: opcje i testy", () => {
  expectErr(withDialogue((x) => { x.nodes.a.options[1].check = x.nodes.a.options[0].check; }), "dialogues/test.json › nodes.a.options[1]: dokładnie jedno z goto albo check");
  expectErr(withDialogue((x) => { delete x.nodes.a.options[0].id; }), "dialogues/test.json › nodes.a.options[0].id: wymagane przy check");
  expectErr(withDialogue((x) => { x.nodes.a.options[1].id = "t"; }), 'dialogues/test.json › nodes.a.options[1].id: powtórzone id "t"');
  expectErr(withDialogue((x) => { x.nodes.a.options[0].check.skill = "latanie"; }), 'dialogues/test.json › nodes.a.options[0].check.skill: nieznana umiejętność "latanie"');
  expectErr(withDialogue((x) => { x.nodes.a.options[0].check = { attribute: "latanie", difficulty: 5 }; }), 'dialogues/test.json › nodes.a.options[0].check.attribute: nieznany atrybut "latanie"');
  expectErr(withDialogue((x) => { x.nodes.a.options[0].check.difficulty = 200; }), "dialogues/test.json › nodes.a.options[0].check.difficulty");
  expectErr(withDialogue((x) => { x.nodes.a.options[0].requires = { zly: 1 }; }), "dialogues/test.json › nodes.a.options[0].requires");
});
test("dialogues: akcje", () => {
  expectErr(withDialogue((x) => { x.nodes.a.options[1].actions = [{ foo: 1 }]; }), "dialogues/test.json › nodes.a.options[1].actions[0].foo: nieznana akcja");
  expectErr(withDialogue((x) => { x.nodes.a.actions = [{ addEffect: "oslepienie" }]; }), "dialogues/test.json › nodes.a.actions[0].addEffect: dozwolone tylko efekty godzinowe");
});
test("dialogues: nieosiagalny wezel i brak opcji zawsze dostepnej", () => {
  expectErr(withDialogue((x) => { x.nodes.c = { speaker: "X", text: "y" }; }), "dialogues/test.json › nodes.c: węzeł nieosiągalny");
  expectErr(withDialogue((x) => { x.nodes.a.options = [x.nodes.a.options[0]]; }), "dialogues/test.json › nodes.a: brak opcji zawsze dostępnej");
  expectErr(withDialogue((x) => { x.nodes.a.options[1].requires = { money: 1 }; }), "dialogues/test.json › nodes.a: brak opcji zawsze dostępnej");
});
test("rules: sekcja dialogue", () => {
  const d = structuredClone(minimalData());
  d.rules.dialogue.chanceMin = 99;
  expectErr(validateData(d), "rules.json › dialogue: chanceMin większe niż chanceMax");
  delete d.rules.dialogue;
  expectErr(validateData(d), "rules.json › dialogue: brak wymaganego pola");
});

test("shops: priceModifiers – walidacja", () => {
  const ok = [{ if: { flag: "f" }, buyPercent: -10, sellPercent: 5 }];
  assert.deepEqual(withShop({ priceModifiers: ok }), []);
  expectErr(withShop({ priceModifiers: [{ if: { efekt: 1 }, buyPercent: -10 }] }), "shops.json › s › priceModifiers[0].if");
  expectErr(withShop({ priceModifiers: [{ if: { flag: "f" }, buyPercent: -95 }] }), "shops.json › s › priceModifiers[0].buyPercent: wartość poza zakresem −90…90");
  expectErr(withShop({ priceModifiers: [{ if: { flag: "f" }, sellPercent: 91 }] }), "shops.json › s › priceModifiers[0].sellPercent: wartość poza zakresem −90…90");
  expectErr(withShop({ priceModifiers: [{ if: { flag: "f" } }] }), "shops.json › s › priceModifiers[0]: wymagane buyPercent lub sellPercent");
});

// --- scena effect (C1 Task 9) ---
const effectErrs = (scene, withCreator = true) => validateData(minimalData({
  start: withCreator ? "c" : "e",
  scenes: [...(withCreator ? [{ id: "c", type: "character_creation" }] : []), { id: "e", type: "effect", ...scene }, { id: "k", type: "ending", text: "x" }],
}));
test("walidacja: scena effect – pusta, nieznany, nie-godzinowy, kreator", () => {
  assert.deepEqual(effectErrs({ add: ["zmeczenie"], remove: ["trucizna"], force: true }), []);
  assert.deepEqual(effectErrs({ remove: ["oslepienie"] }), []);
  expectErr(effectErrs({}), "story.json › e › effect: pusta scena efektu");
  expectErr(effectErrs({ add: [] }), "story.json › e › effect: pusta scena efektu");
  expectErr(effectErrs({ add: ["x"] }), 'story.json › e › add[0]: nieznany efekt "x"');
  expectErr(effectErrs({ remove: ["x"] }), 'story.json › e › remove[0]: nieznany efekt "x"');
  expectErr(effectErrs({ add: ["oslepienie"] }), 'story.json › e › add[0]: efekt "oslepienie" nie jest godzinowy');
  expectErr(effectErrs({ add: ["zmeczenie"] }, false), "story.json › e › type: scena wymaga postaci – brak wcześniejszej sceny character_creation");
});

// --- scena dialogue (C1 Task 10) ---
test("scena dialogue: nieznana rozmowa i brak kreatora", () => {
  const CC = { id: "k", type: "character_creation" };
  const ok = validateData(minimalData({ scenes: [{ id: "a", type: "narration", text: "x" }, CC, { id: "d", type: "dialogue", dialogue: "kwatermistrz" }] }));
  assert.deepEqual(ok, []);
  const bad = validateData(minimalData({ scenes: [{ id: "a", type: "narration", text: "x" }, CC, { id: "d", type: "dialogue", dialogue: "x" }] }));
  expectErr(bad, 'story.json › d › dialogue: nieznana rozmowa "x"');
  const noCreator = validateData(minimalData({ scenes: [{ id: "a", type: "narration", text: "x" }, { id: "d", type: "dialogue", dialogue: "kwatermistrz" }, CC] }));
  expectErr(noCreator, "story.json › d › type: scena wymaga postaci");
  const combat = validateData(minimalData({ scenes: [{ id: "a", type: "narration", text: "x" }, CC, { id: "d", type: "dialogue", dialogue: "kwatermistrz", onCombat: "zle" }] }));
  expectErr(combat, "story.json › d › onCombat");
});

// --- dane walki (C2a Task 1) ---
test("effects: skipTurn i dazed tylko przy unit turn", () => {
  assert.deepEqual(withEffect({ skipTurn: true }), []);
  assert.deepEqual(withEffect({ dazed: true }), []);
  expectErr(withEffect({ unit: "hour", skipTurn: true }), "effects.json › x › skipTurn: dozwolone tylko dla unit turn");
  expectErr(withEffect({ unit: "hour", dazed: true }), "effects.json › x › dazed: dozwolone tylko dla unit turn");
  expectErr(withEffect({ skipTurn: "tak" }), "effects.json › x › skipTurn: oczekiwano wartości logicznej");
});
test("effects: ogluszenie pomija turę, zamroczenie jest dazed", () => {
  const d = minimalData();
  const stun = d.effects.find((e) => e.id === "ogluszenie");
  assert.equal(stun.skipTurn, true);
  assert.equal(stun.modifiers, undefined);
  assert.equal(d.effects.find((e) => e.id === "zamroczenie").dazed, true);
});
test("items: weapon.effects – tylko istniejące efekty turowe", () => {
  assert.deepEqual(withItem({ effects: [{ id: "zamroczenie", chance: 10 }] }), []);
  expectErr(withItem({ effects: [{ id: "zmeczenie", chance: 10 }] }), 'items.json › x › effects[0].id: efekt "zmeczenie" nie jest turowy');
  expectErr(withItem({ effects: [{ id: "brak", chance: 10 }] }), 'items.json › x › effects[0].id: nieznany efekt "brak"');
  expectErr(withItem({ effects: [{ id: "zamroczenie", chance: 101 }] }), "items.json › x › effects[0].chance: wartość poza zakresem 1–100");
});
test("items: garnek_huku i kram", () => {
  const d = minimalData();
  const pot = d.items.find((i) => i.id === "garnek_huku");
  assert.equal(pot.target, "single_splash");
  assert.deepEqual(pot.effects, [{ id: "ogluszenie", chance: 70 }]);
  assert.deepEqual(d.shops[0].stock.find((s) => s.id === "garnek_huku"), { id: "garnek_huku", qty: 1 });
});
test("rules: sekcja combat wymagana i ścisła", () => {
  const d = minimalData();
  assert.equal(d.rules.combat.hitBase, 30);
  assert.equal(d.rules.combat.critMult, 1.5);
  delete d.rules.combat;
  expectErr(validateData(d), "rules.json › combat: brak wymaganego pola");
  const e = minimalData();
  e.rules.combat.logSize = 2.5;
  expectErr(validateData(e), "rules.json › combat.logSize: oczekiwano liczby całkowitej");
  const f = minimalData();
  f.rules.combat.extra = 1;
  expectErr(validateData(f), "rules.json › combat.extra: nieznane pole");
});
test("loadData: wrogowie i grafiki", async () => {
  const d = await loadData();
  assert.deepEqual(d.enemies.map((e) => e.id), ["instruktor", "bandyta", "upior_zwiadowca", "upior_nocy", "wilk", "zwiadowca_cesarski", "klusownik", "rabus", "rabus_lucznik", "maruder", "herszt_zbojcow", "zolnierz_pogranicza", "sierzant_pogranicza", "dzik", "zmija_lesna", "utopiec", "blednik", "skrzat_zlosnik", "jarnowski_strzelec", "jarnowski_kowal", "jarnowski_zwiadowca", "cesarski_pikinier", "cesarski_kusznik", "szabrownik", "kieszonkowiec", "rzezimieszek_z_portu", "cesarski_weszyciel", "patrol_miejski", "straznik_progu", "szeptacz", "kustosz_kabli", "niespiacy", "pelnomocnik", "straznik_wiru", "szabrownik_wrakow", "sluga_wiru", "straz_szklanna", "istota_szklanna", "cesarski_pikinier_weteran", "cesarski_kusznik_weteran", "cesarski_weszyciel_weteran", "jarnowski_strzelec_weteran", "jarnowski_kowal_weteran", "jarnowski_zwiadowca_weteran", "patrol_miejski_weteran", "straznik_progu_weteran", "szeptacz_weteran", "kustosz_kabli_weteran", "niespiacy_weteran", "pelnomocnik_weteran", "upior_schodow", "upior_schodow_weteran", "straznik_wiru_weteran", "sluga_wiru_weteran", "straz_szklanna_weteran", "istota_szklanna_weteran"]);
  for (const id of ["bandyta", "instruktor", "upior_zwiadowca", "wilk"]) assert.ok(d.art[id], id);
  assert.ok(d.art.bandyta.h <= 48 && d.art.bandyta.w <= 64);
  assert.equal(d.art.bandyta.rows.length, d.art.bandyta.h);
  assert.ok(d.art.bandyta.rows.every((l) => [...l].length === d.art.bandyta.w && !l.includes("\r")));
});

// --- scena combat (C2a Task 9) ---
const CC9 = { id: "k", type: "character_creation" };
const NARR9 = { id: "a", type: "narration", text: "x" };
const FIGHT9 = { id: "w", type: "combat", enemies: [{ id: "bandyta", count: 2 }], start: "far", canFlee: true, onFlee: "b", onDefeat: "b", minutes: 10 };
const combatErrs = (extra, { creator = true } = {}) => validateData(minimalData({ scenes: [
  NARR9, ...(creator ? [CC9] : []), { ...FIGHT9, ...extra }, { id: "b", type: "ending", text: "y" },
] }));

test("walidacja: scena combat – poprawna i pola", () => {
  assert.deepEqual(combatErrs({}), []);
  assert.deepEqual(combatErrs({ canFlee: false, nonLethal: true, training: true, title: "Sparing", start: "melee" }), []);
  expectErr(combatErrs({ enemies: [] }), "story.json › w › enemies: pusta lista wrogów");
  expectErr(combatErrs({ enemies: [{ id: "smok" }] }), 'story.json › w › enemies[0].id: nieznany wróg "smok"');
  expectErr(combatErrs({ enemies: [{ id: "bandyta", count: 0 }] }), "story.json › w › enemies[0].count: wartość mniejsza niż 1");
  expectErr(combatErrs({ start: "daleko" }), "story.json › w › start: dozwolone wartości: far, melee");
  expectErr(combatErrs({ onFlee: "nie_ma" }), 'story.json › w › onFlee: nieznana scena "nie_ma"');
  expectErr(combatErrs({ onDefeat: "nie_ma" }), 'story.json › w › onDefeat: nieznana scena "nie_ma"');
  expectErr(combatErrs({ extra: 1 }), "story.json › w › extra: nieznane pole");
});
test("walidacja: combat – training wymaga nonLethal i canFlee false; kreator wcześniej", () => {
  expectErr(combatErrs({ training: true, canFlee: false }), "story.json › w › training: wymaga nonLethal: true i canFlee: false");
  expectErr(combatErrs({ training: true, nonLethal: true }), "story.json › w › training: wymaga nonLethal: true i canFlee: false");
  expectErr(combatErrs({}, { creator: false }), "story.json › w › type: scena wymaga postaci");
});
test("walidacja: dialogue.onCombat – te same reguły", () => {
  const dlg = (onCombat) => validateData(minimalData({ scenes: [NARR9, CC9, { id: "d", type: "dialogue", dialogue: "kwatermistrz", onCombat }, { id: "b", type: "ending", text: "y" }] }));
  assert.deepEqual(dlg({ enemies: [{ id: "bandyta" }], onFlee: "b" }), []);
  expectErr(dlg({ enemies: [{ id: "smok" }] }), 'story.json › d › onCombat.enemies[0].id: nieznany wróg "smok"');
  expectErr(dlg({ enemies: [{ id: "bandyta" }], onFlee: "x" }), 'story.json › d › onCombat.onFlee: nieznana scena "x"');
  expectErr(dlg({ enemies: [{ id: "bandyta" }], training: true }), "story.json › d › onCombat.training: wymaga nonLethal: true i canFlee: false");
  expectErr(dlg({ enemies: [] }), "story.json › d › onCombat.enemies: pusta lista wrogów");
});

// --- C2b Task 1: cechy broni, upiór, spowolnienie, reguły ---
test("C2b: prawdziwe dane i nowe wpisy w loadData", async () => {
  const d = await loadData();
  assert.deepEqual(validateData(d), []);
  assert.deepEqual(MASTERY_TYPES, ["miecz", "wlocznie", "luk", "kusza", "palna", "rzucana"]);
  assert.deepEqual(itemById(d, "sztylet").offhand, true);
  assert.equal(itemById(d, "pistolet_skalkowy").masteryType, "palna");
  assert.equal(itemById(d, "kula_z_prochem").type, "ammo");
  assert.deepEqual(itemById(d, "para_wloczni").pair, true);
  assert.equal(itemById(d, "luk_mysliwski").masteryType, "luk");
  assert.equal(itemById(d, "kusza_lekka").masteryType, "kusza");
  assert.equal(d.enemies.find((e) => e.id === "upior_zwiadowca").leap, true);
  assert.ok(d.art.upior_zwiadowca.h <= 48 && d.art.upior_zwiadowca.w <= 64);
  const slow = d.effects.find((e) => e.id === "spowolnienie");
  assert.equal(slow.noMove, true);
  assert.deepEqual(d.classes.find((c) => c.id === "miecz").masteryStart, { miecz: 15 });
  assert.deepEqual(d.classes.find((c) => c.id === "wlocznia").masteryStart, { wlocznie: 15 });
  assert.deepEqual(d.shops[0].stock.find((s) => s.id === "sztylet"), { id: "sztylet", qty: 1 });
  assert.equal(d.rules.combat.aimed.ogluszenie.effect, "ogluszenie");
  assert.equal(d.rules.combat.mastery.classStart, 15);
  assert.equal(d.rules.combat.firearm.misfirePerProch, 10);
  assert.equal(d.ui["slot.bron_druga"], "Druga ręka");
  assert.equal(d.ui["mastery.wlocznie"], "Włócznie");
});
test("C2b: items – masteryType, pair, offhand, pola broni palnej", () => {
  expectErr(withItem({ masteryType: "magia" }), 'items.json › x › masteryType: nieznany rodzaj "magia"');
  const noMastery = structuredClone(minimalData());
  noMastery.items.push({ ...noMastery.items.find((i) => i.id === "miecz_krotki"), id: "x" });
  delete noMastery.items.at(-1).masteryType;
  expectErr(validateData(noMastery), "items.json › x › masteryType: brak wymaganego pola");
  assert.deepEqual(withItem({}), []);
  expectErr(withItem({ pair: true }, "luk_mysliwski"), "items.json › x › pair: dozwolone tylko dla broni melee");
  expectErr(withItem({ pair: true, offhand: true }), "items.json › x › pair: wyklucza się z offhand");
  assert.deepEqual(withItem({ offhand: true }), []);
  for (const f of ["misfireChance", "burstChance", "noise", "smoke"]) {
    expectErr(withItem({ [f]: 101 }, "pistolet_skalkowy"), `items.json › x › ${f}: wartość poza zakresem 0–100`);
  }
  expectErr(withItem({ burstDamage: [8, 4] }, "pistolet_skalkowy"), "items.json › x › burstDamage: oczekiwano [min, max]");
  assert.deepEqual(withItem({}, "pistolet_skalkowy"), []);
  expectErr(withItem({ fear: -1 }, "pistolet_skalkowy"), "items.json › x › fear: wartość mniejsza niż 0");
});
test("C2b: effects – noMove tylko dla unit turn", () => {
  assert.deepEqual(withEffect({ noMove: true }), []);
  expectErr(withEffect({ unit: "hour", noMove: true }), "effects.json › x › noMove: dozwolone tylko dla unit turn");
});
test("C2b: classes – masteryStart", () => {
  const d = structuredClone(minimalData());
  d.classes[0].masteryStart = { magia: 10 };
  expectErr(validateData(d), `classes.json › ${d.classes[0].id} › masteryStart.magia: nieznany rodzaj "magia"`);
  const e = structuredClone(minimalData());
  e.classes[0].masteryStart = { miecz: 101 };
  expectErr(validateData(e), `classes.json › ${e.classes[0].id} › masteryStart.miecz: wartość większa niż 100`);
});
test("C2b: scena combat – reinforcements", () => {
  assert.deepEqual(combatErrs({ reinforcements: [{ id: "bandyta", count: 2 }] }), []);
  expectErr(combatErrs({ reinforcements: [{ id: "smok" }] }), 'story.json › w › reinforcements[0].id: nieznany wróg "smok"');
  expectErr(combatErrs({ reinforcements: [{ id: "bandyta", count: 0 }] }), "story.json › w › reinforcements[0].count: wartość mniejsza niż 1");
});
test("C2b: rules.combat – dual, aimed, mastery, firearm przez schemat", () => {
  const mutate = (fn) => { const d = minimalData(); fn(d.rules.combat); return validateData(d); };
  expectErr(mutate((c) => { delete c.dual; }), "rules.json › combat.dual: brak wymaganego pola");
  expectErr(mutate((c) => { delete c.aimed.glowa; }), "rules.json › combat.aimed.glowa: brak wymaganego pola");
  expectErr(mutate((c) => { c.aimed.glowa.penalty = 2.5; }), "rules.json › combat.aimed.glowa.penalty: oczekiwano liczby całkowitej");
  expectErr(mutate((c) => { c.aimed.nogi.extra = 1; }), "rules.json › combat.aimed.nogi.extra: nieznane pole");
  expectErr(mutate((c) => { delete c.mastery.max; }), "rules.json › combat.mastery.max: brak wymaganego pola");
  expectErr(mutate((c) => { delete c.firearm; }), "rules.json › combat.firearm: brak wymaganego pola");
  expectErr(mutate((c) => { c.aimed.glowa.effect = "brak"; }), 'rules.json › combat.aimed.glowa.effect: nieznany efekt "brak"');
});

// --- D1: artefakty i zjawiska ---
const withArtifact = (patch) => {
  const d = structuredClone(minimalData());
  d.items.push({ ...structuredClone(d.items.find((i) => i.id === "kamien_zmierzchu")), id: "x", ...patch });
  return validateData(d);
};
const withPhenomenon = (patch) => {
  const d = structuredClone(minimalData());
  d.phenomena.push({ ...structuredClone(d.phenomena.find((p) => p.id === "burza_iskier")), id: "x", ...patch });
  return validateData(d);
};
const kamien = () => structuredClone(minimalData().items.find((i) => i.id === "kamien_zmierzchu"));

test("D1: prawdziwe dane – artefakty, zjawiska, efekty, reguły", async () => {
  const d = await loadData();
  assert.deepEqual(validateData(d), []);
  const k = itemById(d, "kamien_zmierzchu");
  assert.equal(k.type, "artifact");
  assert.equal(k.slot, "talizman");
  assert.deepEqual(k.charge, { max: 100, start: 40 });
  const m = itemById(d, "miecz_gwiazd_test");
  assert.equal(m.hidden, true);
  assert.equal(m.slot, "bron");
  assert.equal(m.masteryType, "miecz");
  assert.deepEqual(d.phenomena.map((p) => [p.id, p.kind, p.frequency.chancePerDay, p.duration, p.timeOfDay, p.omen.hoursBefore]), [
    ["burza_iskier", "magiczne", 15, [2, 4], null, 2],
    ["noc_bez_gwiazd", "magiczne", 10, [3, 6], ["noc"], 1],
    ["mgla_ciszy", "pogodowe", 15, [2, 5], ["swit", "noc"], 1],
    ["ulewa", "pogodowe", 15, [3, 6], ["dzien"], 1],
    ["mgla_poranna", "pogodowe", 10, [2, 4], ["swit"], 1],
    ["upal", "pogodowe", 8, [4, 8], ["dzien"], 1],
    ["wichura", "pogodowe", 8, [2, 5], null, 1],
    ["grad", "pogodowe", 6, [1, 2], ["dzien"], 1],
    ["przymrozek", "pogodowe", 8, [4, 8], ["noc", "swit"], 1],
  ]);
  const [burza, noc, mgla] = d.phenomena;
  assert.deepEqual(burza.onArtifacts, { exposed: "full", carried: { multiplier: 3 } });
  assert.equal(burza.modifiers.rangedHitChance, -20);
  assert.equal(burza.bystroscSkillPenalty, -10);
  assert.deepEqual(noc.onArtifacts, { exposed: { multiplier: -2 }, carried: { multiplier: -1 } });
  assert.deepEqual(noc.enemyModifiers, { upior: { hitChance: 10, damage: 2 } });
  assert.deepEqual(mgla.blocks, ["proch"]);
  assert.equal(mgla.modifiers.skradanie, 20);
  assert.ok(d.effects.some((e) => e.id === "ostrze_ognia" && e.modifiers.extraDamage.type === "ogien"));
  assert.ok(d.effects.some((e) => e.id === "zaslona" && e.modifiers.damageTaken.sieczne === 0.6));
  assert.equal(d.rules.exposure.riskPerHour, 4);
  assert.equal(d.rules.artifacts.carriedRegenMultiplier, 0.5);
  assert.equal(d.rules.phenomena.maxPerDay, 1);
  assert.ok(slotAccepts(k, "talizman"));
  assert.ok(!slotAccepts(k, "bron"));
  assert.ok(slotAccepts(m, "bron") && slotAccepts(m, "bron_zapas") && !slotAccepts(m, "bron_druga") && !slotAccepts(m, "talizman"));
});
test("D1: walidacja artefaktów", () => {
  assert.deepEqual(withArtifact({}), []);
  expectErr(withArtifact({ charge: { max: 100, start: 120 } }), "items.json › x › charge.start: wartość poza zakresem 0–max");
  const k = kamien();
  expectErr(withArtifact({ regen: { ...k.regen, conditions: [{ when: "pelnia", multiplier: 2 }] } }), 'items.json › x › regen.conditions[0].when: nieznany warunek "pelnia"');
  expectErr(withArtifact({ regen: { ...k.regen, conditions: [{ when: "phenomenon:smok", multiplier: 2 }] } }), 'items.json › x › regen.conditions[0].when: nieznane zjawisko "smok"');
  assert.deepEqual(withArtifact({ regen: { ...k.regen, conditions: [{ when: "phenomenon:burza_iskier", multiplier: 2 }, { when: "in_combat", multiplier: 0 }] } }), []);
  expectErr(withArtifact({ passive: [{ minCharge: 101, modifiers: { bystrosc: 1 } }] }), "items.json › x › passive[0].minCharge: wartość poza zakresem 0–max");
  expectErr(withArtifact({ passive: [{ minCharge: 10, modifiers: { magia: 1 } }] }), "items.json › x › passive[0].modifiers.magia: nieznany modyfikator");
  const ab = k.abilities;
  expectErr(withArtifact({ abilities: [{ ...ab[0], cost: { type: "polowa" } }] }), 'items.json › x › abilities[0].cost.type: nieznany typ "polowa"');
  expectErr(withArtifact({ abilities: [{ ...ab[0], cost: { type: "percent", value: 120 } }] }), "items.json › x › abilities[0].cost.value: wartość poza zakresem 1–100");
  expectErr(withArtifact({ abilities: [{ ...ab[0], effect: { id: "smok", target: "self" } }] }), 'items.json › x › abilities[0].effect.id: nieznany efekt "smok"');
  expectErr(withArtifact({ abilities: [ab[0], { ...ab[1], id: ab[0].id }] }), `items.json › x › abilities[1].id: powtórzony identyfikator "${ab[0].id}"`);
  expectErr(withArtifact({ slot: "glowa" }), "items.json › x › slot: artefakt może być tylko w talizman albo bron");
});
test("D1: broń-artefakt walidowana też jak broń", () => {
  const d = structuredClone(minimalData());
  const m = structuredClone(d.items.find((i) => i.id === "miecz_gwiazd_test"));
  d.items.push({ ...m, id: "x", damage: [5, 2], range: "kosmos" });
  const errs = validateData(d);
  expectErr(errs, "items.json › x › damage: oczekiwano [min, max]");
  expectErr(errs, "items.json › x › range:");
  const e = structuredClone(minimalData());
  const { skill, ...noSkill } = structuredClone(e.items.find((i) => i.id === "miecz_gwiazd_test"));
  e.items.push({ ...noSkill, id: "x" });
  expectErr(validateData(e), "items.json › x › skill: brak wymaganego pola");
});
test("D1: walidacja zjawisk", () => {
  assert.deepEqual(withPhenomenon({}), []);
  expectErr(withPhenomenon({ kind: "dziwne" }), 'phenomena.json › x › kind: nieznany rodzaj "dziwne"');
  expectErr(withPhenomenon({ duration: [3, 2] }), "phenomena.json › x › duration: oczekiwano [min, max] godzin 1–24");
  expectErr(withPhenomenon({ duration: [0, 2] }), "phenomena.json › x › duration: oczekiwano [min, max] godzin 1–24");
  expectErr(withPhenomenon({ timeOfDay: ["polnoc"] }), 'phenomena.json › x › timeOfDay[0]: nieznana pora "polnoc"');
  expectErr(withPhenomenon({ frequency: { chancePerDay: 101 } }), "phenomena.json › x › frequency.chancePerDay: wartość poza zakresem 0–100");
  expectErr(withPhenomenon({ blocks: ["magia"] }), 'phenomena.json › x › blocks[0]: nieznana umiejętność "magia"');
  expectErr(withPhenomenon({ enemyModifiers: { upior: { pancerz: 2 } } }), "phenomena.json › x › enemyModifiers.upior.pancerz: nieznany modyfikator");
  expectErr(withPhenomenon({ bystroscSkillPenalty: 5 }), "phenomena.json › x › bystroscSkillPenalty:");
  expectErr(withPhenomenon({ modifiers: { magia: 1 } }), "phenomena.json › x › modifiers.magia: nieznany modyfikator");
});
test("D1: rules – sekcje artifacts, exposure, phenomena", () => {
  const d = structuredClone(minimalData());
  delete d.rules.exposure;
  expectErr(validateData(d), "rules.json › exposure: brak wymaganego pola");
});
test("D1: artefakt najwyżej raz – sklep, nagroda, łup sceny", () => {
  const s = structuredClone(minimalData());
  s.shops.push({ id: "s", name: "S", stock: [{ id: "kamien_zmierzchu", qty: 2 }], buys: [] });
  expectErr(validateData(s), "shops.json › s › stock[0].qty: artefakt może wystąpić najwyżej raz");
  expectErr(rewardErrs({ items: [{ id: "kamien_zmierzchu", qty: 2 }] }), "story.json › r › items[0].qty: artefakt może wystąpić najwyżej raz");
  assert.deepEqual(combatErrs({ loot: [{ chance: 100, giveItem: "kamien_zmierzchu" }, { chance: 50, giveMoney: 5 }] }), []);
  expectErr(combatErrs({ loot: [{ chance: 100, giveItem: { id: "kamien_zmierzchu", qty: 2 } }] }), "story.json › w › loot[0]: artefakt może wystąpić najwyżej raz");
  expectErr(combatErrs({ loot: [{ chance: 0, giveMoney: 5 }] }), "story.json › w › loot[0].chance: wartość poza zakresem 1–100");
});
test("D1: scena phenomenon", () => {
  const scenes = (phenomenon) => minimalData({ scenes: [{ id: "a", type: "phenomenon", phenomenon, goto: "b" }, { id: "b", type: "ending", text: "y" }] });
  assert.deepEqual(validateData(scenes("burza_iskier")), []);
  expectErr(validateData(scenes("smok")), 'story.json › a › phenomenon: nieznane zjawisko "smok"');
});

// --- E3a: art / portrait / stageArt ---
const bigArt = (w, h) => ({ w, h, palette: { a: 15 }, rows: Array(h).fill("a".repeat(w)) });
const artData = (scenes) => minimalData({ start: "a", scenes });
const NARR = (extra = {}) => [{ id: "a", type: "narration", text: "x", ...extra }, { id: "b", type: "ending", text: "y" }];

test("art: scena z nieznaną grafiką i z grafiką ponad limit sceny", () => {
  expectErr(validateData(artData(NARR({ art: "nie_ma" }))), 'story.json › a › art: nieznana grafika "nie_ma"');
  const d = artData(NARR({ art: "duza" }));
  d.art.duza = bigArt(100, 48);
  expectErr(validateData(d), "story.json › a › art: grafika 100×48 przekracza limit 96×48");
  d.art.duza = bigArt(96, 48);
  assert.deepEqual(validateData(d), []);
});

test("art: scena zdarzenia w travel.json", () => {
  const d = minimalData();
  const event = d.travel.events.find((e) => e.scenes);
  event.scenes[0].art = "nie_ma";
  expectErr(validateData(d), `travel.json › events › ${event.id} › ${event.scenes[0].id} › art: nieznana grafika "nie_ma"`);
});

test("portrait: nieznany, za duży (rozmowa i węzeł)", () => {
  const d = minimalData();
  const dlg = d.dialogues[0];
  dlg.portrait = "nie_ma";
  expectErr(validateData(d), `dialogues/${dlg.file} › portrait: nieznana grafika "nie_ma"`);
  dlg.portrait = "duza";
  d.art.duza = bigArt(60, 48);
  expectErr(validateData(d), `dialogues/${dlg.file} › portrait: grafika 60×48 przekracza limit 48×48`);
  delete dlg.portrait;
  d.art.maly = bigArt(48, 48);
  dlg.nodes[dlg.start].portrait = "maly";
  assert.deepEqual(validateData(d), []);
  dlg.nodes[dlg.start].portrait = "nie_ma";
  expectErr(validateData(d), `nodes.${dlg.start}.portrait: nieznana grafika "nie_ma"`);
});

test("stageArt: zły klucz, brak pliku, za duża grafika; zjawisko jako klucz", () => {
  const d = minimalData();
  d.art.sc = bigArt(96, 48);
  d.travel.stageArt = { depart: "sc", ulewa: "sc" };
  assert.deepEqual(validateData(d), []);
  d.travel.stageArt = { zly: "sc" };
  expectErr(validateData(d), 'travel.json › stageArt › zly: nieznany etap lub zjawisko');
  d.travel.stageArt = { depart: "nie_ma" };
  expectErr(validateData(d), 'travel.json › stageArt › depart: nieznana grafika "nie_ma"');
  d.art.sc = bigArt(100, 48);
  d.travel.stageArt = { camp: "sc" };
  expectErr(validateData(d), "travel.json › stageArt › camp: grafika 100×48 przekracza limit 96×48");
});

test("waitUntil: godzina 0–23, całkowita; 24 i tekst to błędy", () => {
  const ok = minimalData({ start: "a", scenes: [{ id: "a", type: "narration", text: "x", waitUntil: 18 }, { id: "b", type: "ending", text: "y" }] });
  assert.deepEqual(validateData(ok), []);
  const bad = minimalData({ start: "a", scenes: [{ id: "a", type: "narration", text: "x", waitUntil: 24 }, { id: "b", type: "ending", text: "y" }] });
  expectErr(validateData(bad), "story.json › a › waitUntil: wartość większa niż 23");
  const text = minimalData({ start: "a", scenes: [{ id: "a", type: "narration", text: "x", waitUntil: "wieczór" }, { id: "b", type: "ending", text: "y" }] });
  assert.ok(validateData(text).some((e) => e.includes("waitUntil")));
});
