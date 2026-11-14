import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { runActions } from "../src/systems/actions.js";
import { countOf } from "../src/systems/inventory.js";
import { combatState, tmpDir } from "./helpers.js";
import { renderItemCard } from "../src/ui/inventory_screen.js";
import { stripVTControlCharacters } from "node:util";

const data = await loadData();
let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

const dialogue = (id) => data.dialogues.find((d) => d.id === id);
const actionsOf = (id, node) => dialogue(id).nodes[node].actions;
function hero(classId = "miecz") {
  const state = createNewState({ seed: 1, startScene: "akt3b_final", rules: data.rules });
  const cs = combatState(data, classId);
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.world.phenomenonRolledDay = 99;
  return state;
}
/** A hero who carries almost the hard limit: not even 0.2 kg more fits. */
function loaded() {
  const state = hero();
  state.inventory.items.push({ id: "kolczuga", qty: 60 });
  return state;
}

test("I1: przeciążony bohater i tak dostaje odłamek ze Szkła i Ostrze z kuźni (przedmioty fabularne zawsze się mieszczą)", () => {
  const glass = loaded();
  runActions(glass, data, actionsOf("szklo_pamieta", "zabieram_dlug"), createRng(1));
  assert.equal(countOf(glass, "odlamek_krateru"), 1);
  assert.equal(glass.flags.szklo_wziete, true);
  for (const [node, blade, quality] of [["bogdan_miecz", "ostrze_gwiazd_bogdana", "ostrze_bogdana"], ["brygida_wlocznie", "para_gwiazd_surowa", "ostrze_surowe"]]) {
    const state = loaded();
    state.inventory.items.push({ id: "odlamek_krateru", qty: 1 });
    runActions(state, data, actionsOf("ostrze_z_nieba", node), createRng(1));
    assert.equal(countOf(state, blade), 1, `${node}: Ostrze`);
    assert.equal(state.flags.ostrze_odebrane, true);
    assert.equal(state.flags[quality], true);
    assert.equal(countOf(state, "odlamek_krateru"), 0);
  }
});

test("I1: pole unburdened jest walidowane i dotyczy czterech Ostrzy oraz odłamka", () => {
  assert.deepEqual(validateData(data), []);
  for (const id of ["ostrze_gwiazd_bogdana", "ostrze_gwiazd_surowe", "para_gwiazd_bogdana", "para_gwiazd_surowa", "odlamek_krateru"]) {
    assert.equal(data.items.find((i) => i.id === id).unburdened, true, id);
  }
  const bad = structuredClone(data);
  bad.items.find((i) => i.id === "odlamek_krateru").unburdened = "tak";
  assert.ok(validateData(bad).some((m) => /unburdened/.test(m)));
});

const legacy = async (sceneId, flags = {}, finished = ["akt3b_final"]) => {
  const state = hero();
  state.flags = { akt2_koniec: true, akt3a_koniec: true, akt3b_koniec: true, klasa_miecz: true, ...flags };
  state.world.location = "obserwatorium";
  state.world.finishedDialogues = finished;
  state.scene.id = sceneId;
  await saveGame("1", state, createRng(1));
  const warnings = [];
  const loaded = await loadGame("1", data, { warnings });
  return { loaded, warnings };
};

test("I3: zapis na usuniętej scenie koniec_* wraca na „Szkło, które pamięta”, a nie na mapę Wilczego Brodu", async () => {
  for (const id of ["koniec_uleglosc", "koniec_opor_z", "koniec_ucieczka_ludzie"]) {
    const { loaded, warnings } = await legacy(id);
    assert.equal(loaded.scene.id, "akt3b_final", id);
    assert.ok(warnings.length >= 1, "wczytanie zgłasza naprawę");
  }
});

test("I2: zapis po zakończonym starym dialogu rozdroza (bez szklo_wziete) odblokowuje nowe Szkło", async () => {
  const { loaded } = await legacy("akt3b_kuznia");
  assert.ok(!loaded.world.finishedDialogues.includes("akt3b_final"));
  const old = await legacy("koniec_opor");
  assert.ok(!old.loaded.world.finishedDialogues.includes("akt3b_final"));
});

test("I2: zapis z ukończonym Szkłem (flaga szklo_wziete) zachowuje listę zakończonych rozmów", async () => {
  const { loaded } = await legacy("akt3b_kuznia", { szklo_wziete: true });
  assert.ok(loaded.world.finishedDialogues.includes("akt3b_final"));
  assert.equal(loaded.scene.id, "akt3b_kuznia");
});

test("M1/M2: karta Ostrza pokazuje typ obrażeń i czytelne nazwy modyfikatorów, bez surowych kluczy", () => {
  const blade = data.items.find((i) => i.id === "ostrze_gwiazd_bogdana");
  const card = stripVTControlCharacters(renderItemCard(blade, hero(), data));
  assert.match(card, /gwiezdne/);
  assert.doesNotMatch(card, /meleeHitChance|critChance|\[\[/);
});

test("M3: ton – bez współczesnego „portfela” i „kitla” w nowych scenach", () => {
  const text = JSON.stringify([dialogue("szklo_pamieta"), dialogue("ostrze_z_nieba")]);
  assert.doesNotMatch(text, /portfel|kitel/);
  assert.equal((text.match(/cudza myśl/g) ?? []).length + (JSON.stringify(data.story).match(/cudza myśl/g) ?? []).length <= 1, true, "„cudza myśl” najwyżej raz");
});
