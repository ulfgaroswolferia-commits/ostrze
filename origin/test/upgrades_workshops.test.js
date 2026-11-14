import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { chooseOption, enterNode, nodeView, validateDialogues } from "../src/systems/dialogue.js";
import { addItem, equip, countOf, carriedWeight } from "../src/systems/inventory.js";
import { itemById } from "../src/systems/items.js";
import { getStats } from "../src/systems/stats.js";
import { visibleSpots, spotScenes } from "../src/systems/spots.js";
import { createCombat } from "../src/systems/combat/state.js";
import { doAction } from "../src/systems/combat/actions.js";
import { createNewState } from "../src/engine/state.js";
import { runActions } from "../src/systems/actions.js";
import { CHAINS } from "../tools/upgrades/recipes.mjs";
import { buildOutputs } from "../tools/upgrades/generate.mjs";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkOverlay, hashText } from "../src/i18n/overlay.js";

const data = minimalData();
const rng = { int: (lo) => lo };
const fixed100 = { int: (lo, hi) => (lo === 1 && hi === 100 ? 50 : lo) };
const dialogue = (id) => data.dialogues.find((d) => d.id === id);
const optionIds = (id) => dialogue(id).nodes.warsztat.options.map((o) => o.id);
const keys = (state, id) => nodeView(state, data, id, "warsztat").options.map((o) => o.key);
/** A level-1 swordsman with only `base` in the bag, worn in the main hand, and no money. */
const fresh = (base = "miecz_krotki") => {
  const state = combatState(data, "miecz");
  state.world = createNewState({ seed: 1, startScene: "a", rules: data.rules }).world;
  state.character.money = 0;
  state.inventory.items = [];
  state.inventory.equipped = {};
  addItem(state, data, base, 1);
  assert.equal(equip(state, data, base, "bron").ok, true);
  return state;
};

test("wymiana zabiera założony miecz i pieniądze, nowy trafia do plecaka", () => {
  const state = fresh();
  state.character.money = 20;
  chooseOption(state, data, "ulepszenia_zbych", "warsztat", "u_miecz_krotki_u1", rng);
  assert.equal(state.inventory.equipped.bron, undefined);
  assert.equal(countOf(state, "miecz_krotki"), 0);
  assert.equal(countOf(state, "miecz_krotki_u1"), 1);
  assert.equal(state.character.money, 0);
});

test("za mało pieniędzy: nic się nie zmienia, odmowa", () => {
  const state = fresh();
  state.character.money = 19;
  const ks = keys(state, "ulepszenia_zbych");
  assert.ok(ks.includes("b_miecz_krotki_u1"));
  assert.ok(!ks.includes("u_miecz_krotki_u1"));
  const r = chooseOption(state, data, "ulepszenia_zbych", "warsztat", "b_miecz_krotki_u1", rng);
  assert.equal(r.next, "bez_groszy");
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(countOf(state, "miecz_krotki_u1"), 0);
  assert.equal(state.character.money, 19);
});

test("dokładnie tyle pieniędzy co koszt: opcja płatna, odmowa ukryta, saldo 0", () => {
  const state = fresh();
  state.character.money = 20;
  const ks = keys(state, "ulepszenia_zbych");
  assert.ok(ks.includes("u_miecz_krotki_u1") && !ks.includes("b_miecz_krotki_u1"));
  chooseOption(state, data, "ulepszenia_zbych", "warsztat", "u_miecz_krotki_u1", rng);
  assert.equal(state.character.money, 0);
});

test("drugi stopień niedostępny bez pierwszego", () => {
  const state = fresh();
  state.character.money = 500;
  assert.ok(optionIds("ulepszenia_polowa").includes("u_miecz_krotki_u2"));
  assert.ok(!keys(state, "ulepszenia_polowa").includes("u_miecz_krotki_u2"));
  assert.throws(() => chooseOption(state, data, "ulepszenia_polowa", "warsztat", "u_miecz_krotki_u2", rng));
  chooseOption(state, data, "ulepszenia_polowa", "warsztat", "u_miecz_krotki_u1", rng);
  assert.ok(keys(state, "ulepszenia_polowa").includes("u_miecz_krotki_u2"));
});

test("Zbych nie ma drugiego stopnia, Szkarad nie ma miecza", () => {
  assert.ok(optionIds("ulepszenia_zbych").includes("u_miecz_krotki_u1"));
  assert.ok(!optionIds("ulepszenia_zbych").some((id) => /_u2$/.test(id)));
  assert.ok(!optionIds("ulepszenia_zbych").some((id) => /pistolet|kusza/.test(id)));
  assert.ok(!optionIds("ulepszenia_szkarad").some((id) => id.includes("miecz_krotki")));
  assert.ok(optionIds("ulepszenia_szkarad").some((id) => id.startsWith("u_pistolet_skalkowy")));
});

test("oferta każdego warsztatu zgadza się z tabelą rodzajów i stopni", () => {
  const offer = {
    ulepszenia_zbych: { biala: 1, pancerz: 1 },
    ulepszenia_bogdan: { biala: 1, pancerz: 1 },
    ulepszenia_polowa: { biala: 2, pancerz: 2, kusza: 2, palna: 1 },
    ulepszenia_brygida: { biala: 2, pancerz: 2, kusza: 2 },
    ulepszenia_szkarad: { palna: 2 },
  };
  for (const [id, stages] of Object.entries(offer)) {
    const want = CHAINS.filter((c) => c.stage <= (stages[c.kind] ?? 0)).map((c) => `u_${c.to}`).sort();
    assert.deepEqual(optionIds(id).filter((o) => o.startsWith("u_")).sort(), want, id);
    assert.ok(optionIds(id).includes("wyjscie"));
  }
});

test("Kuźnia polowa robi muszkę, ale nie spust", () => {
  const ids = optionIds("ulepszenia_polowa");
  assert.ok(ids.includes("u_pistolet_skalkowy_u1"));
  assert.ok(!ids.includes("u_pistolet_skalkowy_u2"));
});

test("broń w zapasie też podlega wymianie", () => {
  const state = fresh("pistolet_skalkowy");
  addItem(state, data, "miecz_krotki", 1);
  assert.equal(equip(state, data, "miecz_krotki", "bron_zapas").ok, true);
  state.character.money = 20;
  chooseOption(state, data, "ulepszenia_zbych", "warsztat", "u_miecz_krotki_u1", rng);
  assert.equal(state.inventory.equipped.bron_zapas, undefined);
  assert.equal(state.inventory.equipped.bron, "pistolet_skalkowy");
  assert.equal(countOf(state, "miecz_krotki"), 0);
  assert.equal(countOf(state, "miecz_krotki_u1"), 1);
});

test("zapasowa kopia: wymiana bierze wolną, założona zostaje", () => {
  const state = fresh();
  addItem(state, data, "miecz_krotki", 1);
  state.character.money = 20;
  chooseOption(state, data, "ulepszenia_zbych", "warsztat", "u_miecz_krotki_u1", rng);
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(countOf(state, "miecz_krotki"), 1);
  assert.equal(countOf(state, "miecz_krotki_u1"), 1);
});

test("każdy warsztat ma ważny dialog, a węzeł warsztatu zawsze ma wyjście", () => {
  for (const id of ["zbych", "bogdan", "polowa", "brygida", "szkarad"]) {
    const d = dialogue(`ulepszenia_${id}`);
    assert.ok(d, id);
    assert.deepEqual(validateDialogues([d], data), [], id);
    assert.ok(d.nodes.warsztat.options.some((o) => !o.requires && !o.check && o.goto === "end"));
  }
});

test("spoty ulepszeń: Zbych po pierwszej rozmowie z nim, Szkarad po poznaniu Szkarada, reszta od razu", () => {
  const state = fresh();
  const shown = (loc) => visibleSpots(state, data, loc).map((v) => v.spot.id);
  assert.ok(!shown("wilczy_brod").includes("ulepszenia"));
  state.flags.dialog_met_kowal = true; // set by the engine when the talk with Zbych starts
  for (const loc of ["wilczy_brod", "gluszec", "oboz_wronia", "obserwatorium"]) {
    assert.ok(shown(loc).includes("ulepszenia"), loc);
    assert.ok(spotScenes(data, loc, "ulepszenia").some((s) => s.type === "dialogue"));
  }
  assert.ok(!shown("wilczy_brod").includes("szkarad"));
  assert.ok(!shown("wilczy_brod").includes("szkarad_ulepszenia"));
  // Zbych's gossip node reveals Szkarad's stall; the upgrade spot follows by itself.
  const nodes = dialogue("kowal").nodes;
  const nodeId = Object.keys(nodes).find((k) => nodes[k].actions?.some((a) => a.reveal === "wilczy_brod.szkarad"));
  assert.ok(nodeId, "Zbych ujawnia Szkarada");
  enterNode(state, data, "kowal", nodeId, rng);
  assert.ok(shown("wilczy_brod").includes("szkarad"));
  assert.ok(shown("wilczy_brod").includes("szkarad_ulepszenia"));
});

/** The paid and the refused bolt exchange of a workshop, as the hero sees them now. */
const boltKeys = (state, id) => keys(state, id).filter((k) => /belt_/.test(k));

test("10 bełtów + 20 gr → 10 wzmocnionych", () => {
  const state = fresh("kusza_lekka");
  addItem(state, data, "belt", 12);
  state.character.money = 25;
  const r = chooseOption(state, data, "ulepszenia_brygida", "warsztat", "u_belt_wzmocniony", rng);
  assert.equal(r.next, "zrobione_belty");
  assert.equal(countOf(state, "belt"), 2);
  assert.equal(countOf(state, "belt_wzmocniony"), 10);
  assert.equal(state.character.money, 5);
  assert.equal(state.inventory.equipped.bron, "kusza_lekka", "kusza zostaje w ręku");
});

test("przy 9 bełtach opcji nie ma", () => {
  const state = fresh("kusza_lekka");
  addItem(state, data, "belt", 9);
  addItem(state, data, "belt_wzmocniony", 9);
  state.character.money = 500;
  assert.deepEqual(boltKeys(state, "ulepszenia_brygida"), []);
  state.character.money = 0;
  assert.deepEqual(boltKeys(state, "ulepszenia_brygida"), [], "odmowy też nie ma");
  addItem(state, data, "belt", 1);
  assert.deepEqual(boltKeys(state, "ulepszenia_brygida"), ["b_belt_wzmocniony"]);
});

test("wzmocnione na wybuchowe za 100 gr; tylko tam, gdzie robią drugi stopień kusz", () => {
  const state = fresh("kusza_lekka");
  addItem(state, data, "belt_wzmocniony", 10);
  state.character.money = 100;
  chooseOption(state, data, "ulepszenia_polowa", "warsztat", "u_belt_wybuchowy", rng);
  assert.equal(countOf(state, "belt_wzmocniony"), 0);
  assert.equal(countOf(state, "belt_wybuchowy"), 10);
  assert.equal(state.character.money, 0);
  for (const id of ["polowa", "brygida"]) {
    assert.ok(optionIds(`ulepszenia_${id}`).includes("u_belt_wzmocniony"), id);
    assert.ok(optionIds(`ulepszenia_${id}`).includes("u_belt_wybuchowy"), id);
  }
  for (const id of ["zbych", "bogdan", "szkarad"]) assert.ok(!optionIds(`ulepszenia_${id}`).some((o) => o.includes("belt")), id);
});

/** A crossbowman with `have` × 10 bolts and `money`, the bag filled with plain bolts until less than `kg` is free. */
const fullBag = (have, money, kg) => {
  const state = fresh("kusza_lekka");
  addItem(state, data, have, 10);
  state.character.money = money;
  const room = () => (data.rules.inventory.hardLimitPercent / 100) * getStats(state, data).derived.carry - carriedWeight(state, data);
  while (room() >= kg) addItem(state, data, "belt", 1);
  return state;
};

for (const [from, to, cost, kg] of [["belt", "belt_wzmocniony", 20, 1], ["belt_wzmocniony", "belt_wybuchowy", 100, 1.5]]) {
  test(`za ciężko na ${to}: kowal mówi o pełnej torbie, nic nie przepada`, () => {
    for (const shop of ["polowa", "brygida"]) {
      const state = fullBag(from, cost, kg);
      const before = countOf(state, from);
      const r = chooseOption(state, data, `ulepszenia_${shop}`, "warsztat", `u_${to}`, rng);
      assert.ok(r.events.some((e) => e.type === "za_ciezko"), shop);
      assert.equal(r.next, "za_ciezko", shop);
      assert.notEqual(dialogue(`ulepszenia_${shop}`).nodes.za_ciezko.text, dialogue(`ulepszenia_${shop}`).nodes.zrobione_belty.text);
      assert.equal(countOf(state, from), before, shop);
      assert.equal(countOf(state, to), 0, shop);
      assert.equal(state.character.money, cost, shop);
      assert.equal(chooseOption(state, data, `ulepszenia_${shop}`, "za_ciezko", "dalej", rng).next, "warsztat");
    }
  });
}

test("ponad twardym limitem wagi: miecz i pancerz wymienione, nic nie przepada", () => {
  const armor = CHAINS.find((c) => c.kind === "pancerz" && c.stage === 1);
  for (const [chain, slot] of [[CHAINS.find((c) => c.to === "miecz_krotki_u1"), "bron"], [armor, armor && itemById(data, armor.from).slot]]) {
    const state = fresh();
    state.inventory.items = [];
    state.inventory.equipped = {};
    addItem(state, data, chain.from, 1);
    assert.equal(equip(state, data, chain.from, slot).ok, true);
    state.character.money = chain.cost;
    const hard = (data.rules.inventory.hardLimitPercent / 100) * getStats(state, data).derived.carry;
    while (carriedWeight(state, data) <= hard) addItem(state, data, "belt", 1); // e.g. forage or hunger put him over
    const before = carriedWeight(state, data);
    const r = chooseOption(state, data, "ulepszenia_zbych", "warsztat", `u_${chain.to}`, rng);
    assert.equal(r.next, slot === "bron" ? "zrobione" : "zrobione_pancerz", chain.to);
    assert.ok(!r.events.some((e) => e.type === "za_ciezko"), chain.to);
    assert.equal(countOf(state, chain.from), 0, chain.to);
    assert.equal(countOf(state, chain.to), 1, chain.to);
    assert.equal(state.character.money, 0, chain.to);
    assert.ok(Math.abs(carriedWeight(state, data) - before) < 1e-9, "waga bez zmian");
  }
});

test("wymiana bez sprawdzania wagi tylko do wagi oddanego: cięższe dalej za ciężko", () => {
  const state = fresh();
  state.inventory.items = [];
  addItem(state, data, "belt_wzmocniony", 10);
  const hard = (data.rules.inventory.hardLimitPercent / 100) * getStats(state, data).derived.carry;
  while (carriedWeight(state, data) <= hard) addItem(state, data, "belt", 1);
  // taken first, then the heavier pack: the removed weight does not cover it
  const r = runActions(state, data, [{ takeItem: { id: "belt_wzmocniony", qty: 10 } }, { giveItem: { id: "belt_wybuchowy", qty: 10 } }], rng);
  assert.ok(r.events.some((e) => e.type === "za_ciezko"));
  assert.equal(countOf(state, "belt_wybuchowy"), 0);
});

test("tooHeavy: walidacja celu i wymaganego giveItem", () => {
  const talk = (option) => ({ id: "t", start: "a", nodes: { a: { speaker: "X", text: "y", options: [option, { id: "w", text: "z", goto: "end" }] }, b: { speaker: "X", text: "pełno" } } });
  const give = { actions: [{ giveItem: "belt" }] };
  assert.deepEqual(validateDialogues([talk({ id: "o", text: "x", goto: "end", tooHeavy: "b", ...give })], data), []);
  assert.match(validateDialogues([talk({ id: "o", text: "x", goto: "end", tooHeavy: "nie_ma", ...give })], data).join(), /tooHeavy: nieznany węzeł/);
  assert.match(validateDialogues([talk({ id: "o", text: "x", goto: "end", tooHeavy: "b" })], data).join(), /tooHeavy: opcja bez giveItem/);
});

test("koszt wybuchowego przewyższa kulę", () => {
  const price = (id) => itemById(data, id).value * data.rules.shop.buyBase; // shop price of one piece, before haggling
  const ammo = CHAINS.filter((c) => c.qty);
  const per = (to) => ammo.find((c) => c.to === to).cost / 10;
  assert.equal(price("belt"), 3);
  assert.equal(per("belt_wzmocniony"), 2);
  assert.equal(per("belt_wybuchowy"), 10);
  const explosive = price("belt") + per("belt_wzmocniony") + per("belt_wybuchowy");
  assert.equal(explosive, 15);
  assert.equal(price("kula_z_prochem"), 9);
  assert.ok(explosive > price("kula_z_prochem"));
});

test("prawdziwa gra: kuźnia Zbycha w Wilczym Brodzie, wymiana, założenie, walka: trafienie o 5 wyższe", () => {
  const hitChance = (state) => {
    const combat = createCombat(state, data, { id: "walka_t", enemies: [{ id: "bandyta", count: 1 }], start: "melee", canFlee: true }, rng);
    combat.playerAp = 10;
    const r = doAction(state, data, combat, { id: "attack", target: combat.enemies[0].uid }, fixed100);
    assert.equal(r.ok, true);
    return r.events.find((e) => e.type === "atak" && e.attacker === "player").chance;
  };
  const state = fresh();
  state.character.money = 100;
  state.flags.dialog_met_kowal = true;
  const before = hitChance(state);

  const spot = visibleSpots(state, data, "wilczy_brod").find((v) => v.spot.id === "ulepszenia" && v.available);
  assert.ok(spot, "spot widoczny w Wilczym Brodzie");
  const scene = spotScenes(data, "wilczy_brod", "ulepszenia")[0];
  assert.equal(scene.type, "dialogue");
  const view = nodeView(state, data, scene.dialogue, dialogue(scene.dialogue).start);
  assert.ok(view.options.some((o) => o.key === "u_miecz_krotki_u1"));
  const r = chooseOption(state, data, scene.dialogue, "warsztat", "u_miecz_krotki_u1", rng);
  assert.equal(r.next, "zrobione");
  chooseOption(state, data, scene.dialogue, "zrobione", "dalej", rng);
  assert.equal(state.character.money, 80);
  assert.equal(equip(state, data, "miecz_krotki_u1", "bron").ok, true);
  assert.equal(hitChance(state), before + 5);
});

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"));
const WORKSHOP_IDS = ["zbych", "bogdan", "polowa", "brygida", "szkarad"];

test("generator: ponowne uruchomienie nie zmienia żadnego pliku (PL i nakładka EN)", () => {
  const outputs = buildOutputs();
  for (const id of WORKSHOP_IDS) assert.ok(outputs.has(`data/lang/en/dialogues/ulepszenia_${id}.json`), id);
  assert.ok(outputs.has("data/lang/en/items.json"));
  for (const [rel, content] of outputs) {
    assert.equal(readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"), content, `${rel}: uruchom node tools/upgrades/generate.mjs`);
  }
});

test("nakładka EN warsztatów: komplet wpisów, aktualne skróty, bez sierot", () => {
  for (const id of WORKSHOP_IDS) {
    const file = `dialogues/ulepszenia_${id}.json`;
    const r = checkOverlay(file, readJson(`data/${file}`), readJson(`data/lang/en/${file}`));
    for (const [kind, paths] of Object.entries(r)) assert.deepEqual(paths, [], `${file}: ${kind}`);
  }
});

test("--validate --lang en nie zgłasza niczego w plikach ulepszeń", () => {
  // Without --strict the run ends with "Dane poprawne." whenever the overlays have no errors, and on the way it lists every
  // file with missing or stale entries, so the check holds however much of the rest is translated.
  const r = spawnSync(process.execPath, ["bin/game.js", "--validate", "--lang", "en", "--scope", "all"], { cwd: ROOT, encoding: "utf8" });
  const lines = `${r.stdout}\n${r.stderr}`.split(/\r?\n/);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim().split(/\r?\n/).at(-1), "Dane poprawne.", "walidacja doszła do końca");
  assert.deepEqual(lines.filter((l) => l.includes("ulepszenia_")), []);
  assert.deepEqual(lines.filter((l) => l.includes("lang/en/items.json")), [], "żadnych błędów nakładki przedmiotów");
  // items.json reports one line for the whole file, so the _u entries are checked directly
  const r2 = checkOverlay("items.json", readJson("data/items.json"), readJson("data/lang/en/items.json"));
  const upgrade = (p) => /^\[[^\]]+_u[12]\]\./.test(p);
  for (const kind of ["stale", "orphan", "varMismatch", "nonText", "empty"]) assert.deepEqual(r2[kind].filter(upgrade), [], `items.json _u: ${kind}`);
  assert.deepEqual(r2.missing.filter(upgrade).filter((p) => !p.endsWith(".description")), [], "items.json _u: brak nazwy albo throwName");
});

test("broń dostaje się do ręki, pancerz się zakłada: osobne węzły po wymianie", () => {
  for (const id of WORKSHOP_IDS) {
    const d = dialogue(`ulepszenia_${id}`);
    for (const o of d.nodes.warsztat.options.filter((x) => x.id.startsWith("u_"))) {
      const chain = CHAINS.find((c) => `u_${c.to}` === o.id);
      const want = chain.qty ? "zrobione_belty" : chain.kind === "pancerz" ? "zrobione_pancerz" : "zrobione";
      assert.equal(o.goto, want, `${id} ${o.id}`);
    }
    assert.doesNotMatch(d.nodes.zrobione.text, /Załóż|załóż/, `${id}: broni się nie zakłada`);
    if (d.nodes.zrobione_pancerz) assert.match(d.nodes.zrobione_pancerz.text, /[Zz]ałóż/, id);
  }
  assert.equal(dialogue("ulepszenia_szkarad").nodes.zrobione_pancerz, undefined, "Szkarad nie robi pancerzy");
});

test("opcje i nazwy po angielsku idą ze słownika", () => {
  const zbych = readJson("data/lang/en/dialogues/ulepszenia_zbych.json");
  assert.equal(zbych["nodes.warsztat.options.[u_miecz_krotki_u1].text"].t, "Short sword: grip (20 gr)");
  assert.equal(zbych["nodes.warsztat.speaker"].t, "Zbych the Smith");
  const polowa = readJson("data/lang/en/dialogues/ulepszenia_polowa.json");
  assert.equal(polowa["nodes.warsztat.options.[u_belt_wzmocniony].text"].t, "Bolts: 10 plain for reinforced (20 gr)");
  assert.equal(polowa["nodes.warsztat.options.[u_kusza_lekka_u2].text"].t.startsWith("Light crossbow: limb ("), true);
  const items = readJson("data/lang/en/items.json");
  const pl = Object.fromEntries(readJson("data/items.json").map((i) => [i.id, i]));
  assert.deepEqual(items["[miecz_krotki_u2].name"], { t: "Short sword (grip, sharpened)", h: hashText(pl.miecz_krotki_u2.name) });
  assert.equal(items["[kolczuga_u1].name"].t, "Mail shirt (leather)");
  assert.equal(items["[para_wloczni_u1].throwName"].t, "Spear");
  // an upgrade's description is the base one plus a sentence: written only once the base description is translated
  for (const [p, e] of Object.entries(items)) {
    const m = /^\[(.+)_u[12]\]\.description$/.exec(p);
    if (m) assert.ok(items[`[${m[1]}].description`], `${p} bez przekładu opisu bazowego`);
  }
});

test("opis _u po angielsku: opis bazowy z nakładki i zdanie ulepszenia", () => {
  const base = readJson("data/items.json").find((i) => i.id === "miecz_krotki");
  const overlay = { "[miecz_krotki].description": { t: "A short, broad blade.", h: hashText(base.description) } };
  const items = JSON.parse(buildOutputs({ itemsOverlay: overlay }).get("data/lang/en/items.json"));
  assert.equal(items["[miecz_krotki].description"].t, "A short, broad blade.", "cudze wpisy zostają");
  assert.equal(items["[miecz_krotki_u1].description"].t, "A short, broad blade. New grip. Sits surer in the hand.");
  const stale = { "[miecz_krotki].description": { t: "Old.", h: "00000000" } };
  const again = JSON.parse(buildOutputs({ itemsOverlay: stale }).get("data/lang/en/items.json"));
  assert.equal(again["[miecz_krotki_u1].description"], undefined, "nieaktualny opis bazowy nie przechodzi");
});
