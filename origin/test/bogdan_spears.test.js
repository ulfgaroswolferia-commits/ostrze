import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { combatState, tmpDir } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { createScriptedIO } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { loadData } from "../src/engine/data.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";
import { createCombat } from "../src/systems/combat/state.js";
import { doTechnique, techniqueActions } from "../src/systems/combat/techniques.js";
import { endTurnEffects, startTurnEffects } from "../src/systems/combat/effects.js";
import { techniqueItems } from "../src/ui/combat_screen.js";
import { renderItemCard } from "../src/ui/inventory_screen.js";
import { combatEventText } from "../src/ui/events.js";
import { setColorsEnabled } from "../src/ui/colors.js";

const data = await loadData();
const ITEM = "para_gwiazd_bogdana";
const RECALL = "artifact:powrot_do_reki";
const SPARKS = "artifact:iskry";

/** rng rolling `lo` for everything, or the listed values one by one first. */
const rolls = (...values) => ({ int: (lo) => (values.length ? values.shift() : lo) });

function fight({ enemies = [{ id: "bandyta" }], charge } = {}) {
  const state = combatState(data, "miecz");
  addItem(state, data, ITEM, 1);
  assert.equal(equip(state, data, ITEM, "bron").ok, true);
  if (charge !== undefined) state.artifacts[ITEM].charge = charge;
  const combat = createCombat(state, data, { enemies }, rolls());
  combat.playerAp = 9;
  return { state, combat };
}
const option = (state, combat, id) => techniqueActions(state, data, combat).find((a) => a.id === id);

beforeEach(() => setColorsEnabled(false));

test("Powrót do ręki: bez rzuconej włóczni niedostępny, po rzucie przywołuje ją z dystansu za ładunek i daje obronę", () => {
  const { state, combat } = fight();
  const uid = combat.enemies[0].uid;
  combat.enemies[0].band = "far";

  assert.equal(option(state, combat, RECALL).reason, "combat.notThrown");
  assert.deepEqual(doTechnique(state, data, combat, { id: RECALL }, rolls()), { ok: false, reason: "combat.notThrown" });

  assert.equal(doTechnique(state, data, combat, { id: "throw", target: uid }, rolls(1)).ok, true);
  assert.ok(combat.thrown);
  assert.equal(option(state, combat, "pickup").reason, "combat.pickUpFar", "zwykłe podniesienie nie sięga na dystans");

  const defense = getStats(state, data).derived.defense;
  const ap = combat.playerAp;
  assert.equal(option(state, combat, RECALL).disabled, false);
  const r = doTechnique(state, data, combat, { id: RECALL }, rolls());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(combat.thrown, null);
  assert.equal(combat.playerAp, ap - 1);
  assert.equal(state.artifacts[ITEM].charge, 40);
  assert.equal(getStats(state, data).derived.defense, defense + 15);
  assert.equal(option(state, combat, "throw").disabled, false, "można rzucić znowu");
});

test("Powrót do ręki: osłona trwa przez turę wrogów i kolejną turę gracza, potem znika", () => {
  const { state, combat } = fight();
  combat.thrown = { uid: combat.enemies[0].uid, itemId: ITEM };
  doTechnique(state, data, combat, { id: RECALL }, rolls());
  const has = () => state.character.effects.some((e) => e.id === "wracajacy_grot");
  endTurnEffects(state, data, combat, "player");
  assert.equal(has(), true, "na czas tury wrogów");
  startTurnEffects(state, data, combat, "player", rolls());
  assert.equal(has(), true, "w następnej turze gracza");
  endTurnEffects(state, data, combat, "player");
  assert.equal(has(), false);
});

test("Iskry: ranią bez rzutu na trafienie, omijają pancerz, ogłuszają tylko po udanym rzucie", () => {
  const armored = data.enemies.find((e) => e.armor >= 3 && !e.effectResist?.ogluszenie && !e.immune?.includes("ogluszenie") && !e.reduction?.gwiezdne && !e.damageTaken?.gwiezdne);
  const { state, combat } = fight({ enemies: [{ id: armored.id }] });
  const foe = combat.enemies[0];
  foe.hp = foe.hpMax = 100;
  const stunned = doTechnique(state, data, combat, { id: SPARKS, target: foe.uid }, rolls(8, 35, 100));
  assert.equal(stunned.ok, true);
  assert.equal(foe.hp, 92);
  assert.equal(state.artifacts[ITEM].charge, 35);
  assert.ok(foe.effects.some((e) => e.id === "ogluszenie"), JSON.stringify(stunned.events));
  assert.equal(stunned.events.find((e) => e.type === "atak").damage, 8);

  foe.effects.length = 0;
  const plain = doTechnique(state, data, combat, { id: SPARKS, target: foe.uid }, rolls(6, 36));
  assert.equal(foe.hp, 86);
  assert.equal(foe.effects.length, 0, "36 > 35: bez ogłuszenia");
  assert.equal(plain.events.some((e) => e.type.startsWith("efekt")), false);
});

test("Iskry: zabijają jak zwykły cios (wróg pokonany, bez efektu), wymagają celu i ładunku", () => {
  const { state, combat } = fight({ enemies: [{ id: "bandyta" }, { id: "bandyta" }] });
  const [foe] = combat.enemies;
  foe.hp = 5;
  assert.deepEqual(doTechnique(state, data, combat, { id: SPARKS }, rolls()), { ok: false, reason: "combat.noTarget" });
  assert.equal(state.artifacts[ITEM].charge, 50, "pomyłka nic nie kosztuje");

  const r = doTechnique(state, data, combat, { id: SPARKS, target: foe.uid }, rolls(10, 1, 100));
  assert.equal(foe.dead, true);
  assert.ok(r.events.some((e) => e.type === "wrog_pokonany"));
  assert.equal(r.events.some((e) => e.type.startsWith("efekt")), false);

  const empty = fight({ charge: 14 });
  assert.equal(option(empty.state, empty.combat, SPARKS).reason, "artifact.noCharge");
});

test("ładunek ma teraz znaczenie: zdolności schodzą poniżej progu premii i premia znika", () => {
  const { state, combat } = fight({ charge: 25 });
  const foe = combat.enemies[0];
  foe.hp = foe.hpMax = 100;
  const hit = getStats(state, data).derived.meleeHitChance;
  doTechnique(state, data, combat, { id: SPARKS, target: foe.uid }, rolls(6, 100));
  assert.equal(state.artifacts[ITEM].charge, 10);
  assert.equal(getStats(state, data).derived.meleeHitChance, hit - 5);
});

test("menu walki, karta przedmiotu i dziennik pokazują zdolności zrozumiale", () => {
  const { state, combat } = fight();
  const techniques = techniqueActions(state, data, combat);
  const items = techniqueItems(data, techniques);
  const row = (id) => items[techniques.findIndex((a) => a.id === id)];
  assert.match(row(RECALL).label, /^Powrót do ręki \(◆10 · 1 PA\)/);
  assert.match(row(RECALL).hint, /Nic nie rzucono/);
  assert.match(row(SPARKS).label, /^Iskry \(◆15 · 3 PA\)/);
  assert.match(row(SPARKS).description, /6–10 obrażeń gwiezdnych/);

  const card = strip(renderItemCard(data.items.find((i) => i.id === ITEM), state, data));
  assert.match(card, /Powrót do ręki/);
  assert.match(card, /Iskry.*na wroga/);
  assert.match(card, /35% szansy na ogłuszenie/);

  const foe = combat.enemies[0];
  foe.hp = foe.hpMax = 100;
  const { events } = doTechnique(state, data, combat, { id: SPARKS, target: foe.uid }, rolls(8, 100));
  const log = events.map((e) => combatEventText(data.ui, data, combat, e)).join(" ");
  assert.match(log, /Para Gwiazd .*Iskry/);
  assert.match(log, /za 8/);
});

test("surowa para nie ma zdolności", () => {
  assert.equal(data.items.find((i) => i.id === "para_gwiazd_surowa").abilities, undefined);
});

test("w prawdziwej scenie: wygrana walka zostawia zużyty ładunek", async () => {
  const home = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
  try {
    const state = createNewState({ seed: 1, startScene: "x", rules: data.rules });
    Object.assign(state, fight().state);
    const inputs = ["t", "7", "1", ...Array(200).fill("<enter>")];
    const ctx = { state, data, io: createScriptedIO(inputs, { tty: true }), rng: createRng(3), debug: false, notices: [] };
    Object.assign(ctx.io, { columns: 120, rows: 40 });
    state.character.hp = 500;
    await defaultHandlers.combat(ctx, { id: "probny", type: "combat", enemies: [{ id: "bandyta" }], start: "melee", quiet: true });
    assert.equal(state.flags.combat_probny_wygrana, true);
    assert.ok(state.artifacts[ITEM].charge >= 35 && state.artifacts[ITEM].charge < 40, String(state.artifacts[ITEM].charge));
    assert.match(strip(ctx.io.output.join("")), /Iskry/);
  } finally {
    if (home === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = home;
  }
});
