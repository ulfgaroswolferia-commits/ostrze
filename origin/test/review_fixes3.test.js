import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { evaluate } from "../src/engine/conditions.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";
import { enterNode, chooseOption, nodeView } from "../src/systems/dialogue.js";
import { startQuest, advanceErrands, abandonQuestsOf } from "../src/systems/quests.js";
import { walkMinutes } from "../src/systems/travel.js";
import { rollVisitor } from "../src/systems/spots.js";
import { runActions } from "../src/systems/actions.js";
import { migrations } from "../src/engine/save.js";
import { actionsFor } from "../src/ui/inventory_screen.js";
import { createSceneList, runStory } from "../src/engine/loop.js";
import { InputExhaustedError } from "../src/ui/io.js";

const data = await loadData();
const fixed = { int: () => 1 };

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function start(flags = {}, search = 0) {
  const state = createNewState({ seed: 1, startScene: "akt3_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 50;
  Object.assign(state.flags, flags);
  state.world.location = "gluszec";
  state.world.search = search;
  return state;
}
const keys = (state, d, n) => nodeView(state, data, d, n).options.filter((o) => !o.disabled).map((o) => o.key);
const fill = (state, n) => { for (let i = 0; i < n; i++) state.quests[`wypelniacz_${i}`] = { status: "active" }; };

test("C1: odmowa startQuest (limit) nie zużywa głosu z kamieni – cmentarz wraca, a ucieczka też zaczyna zlecenie", () => {
  const echo = data.travel.locations.find((l) => l.id === "gluszec").spots.find((s) => s.id === "cmentarz").scenes[0];
  const s = start({ ...{ soltys_przyjal: true } });
  s.quests.przyjecie_w_osadzie = { status: "done" };
  s.quests.zwiad_na_wzgorzu = { status: "done" };
  s.time.minutes = 23 * 60;
  assert.equal(evaluate(echo.if, s, data), true);
  const full = structuredClone(data);
  full.quests.push(...Array.from({ length: 10 }, (_, i) => ({ id: `wypelniacz_${i}`, kind: "errand", name: "x", hub: "gluszec", description: "x", deadlineDays: null, objectives: [{ id: "o", text: "x", at: "gluszec.soltys", done: { flag: "nigdy" } }] })));
  const filled = start({});
  filled.quests.przyjecie_w_osadzie = { status: "done" };
  filled.quests.zwiad_na_wzgorzu = { status: "done" };
  fill(filled, 10);
  filled.time.minutes = 23 * 60;
  enterNode(filled, full, "echo_istoty", "slucham", fixed);
  assert.equal(filled.quests.co_widziala_ragnoslawa, undefined, "przy pełnym limicie zlecenie nie ruszyło");
  assert.equal(evaluate(echo.if, filled, full), true, "scena wraca następnej nocy");
  const run = start({});
  run.quests.przyjecie_w_osadzie = { status: "done" };
  run.quests.zwiad_na_wzgorzu = { status: "done" };
  enterNode(run, data, "echo_istoty", "uciekam", fixed);
  assert.equal(run.quests.co_widziala_ragnoslawa.status, "active", "ucieczka od głosu też otwiera zlecenie");
  assert.equal(evaluate(echo.if, run, data), false);
});

test("C2: wejście w akt III porzuca otwarte zlecenia Wilczego Brodu i zwalnia limit", () => {
  const s = start({});
  s.quests.lek_dla_wrzoska = { status: "active", done: [] };
  s.quests.dlug_kupca = { status: "active", done: [] };
  s.quests.eskorta_ostromira = { status: "active" };
  const lost = abandonQuestsOf(s, data, "wilczy_brod");
  assert.ok(lost.length >= 2);
  assert.equal(s.quests.lek_dla_wrzoska.status, "failed");
  assert.equal(s.quests.dlug_kupca.status, "failed");
  const mapScene = data.story.scenes.find((x) => x.id === "akt3_mapa");
  assert.equal(mapScene.leaves, "wilczy_brod");
  assert.equal(data.rules.quests.maxActive, 10);
});

test("C2 (e2e): z ośmioma otwartymi zleceniami z aktu II zlecenie wprowadzające i tak rusza", async () => {
  const state = createNewState({ seed: 1, startScene: "akt3_wejscie", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.world.location = "kamienna_przelecz";
  state.world.phenomenonRolledDay = 99;
  state.flags.akt2_koniec = true;
  state.time.minutes = 8 * 60;
  for (const id of ["lek_dla_wrzoska", "zboze_dla_mlyna", "dlug_kupca", "list_do_lesniczego", "kto_pyta_o_ocalalych", "swiatlo_w_mlynie", "zaginiony_pasterz_borek", "amulet_z_ruin"]) state.quests[id] = { status: "active", done: [] };
  const io = createAdaptiveIO([""]);
  const ctx = { state, data, io, rng: { int: (lo) => lo, setState() {}, getState: () => 0 }, debug: false, story: createSceneList(data.story.scenes), notices: [] };
  await assert.rejects(runStory(ctx), InputExhaustedError);
  assert.equal(state.quests.przyjecie_w_osadzie.status, "active");
  assert.equal(state.quests.lek_dla_wrzoska.status, "failed");
});

test("I3: odmowa startQuest przerywa resztę akcji węzła (nie dostajesz listu ani wosku bez zlecenia)", () => {
  const s = start({ soltys_przyjal: true });
  fill(s, 10);
  const full = structuredClone(data);
  full.quests.push(...Array.from({ length: 10 }, (_, i) => ({ id: `wypelniacz_${i}`, kind: "errand", name: "x", hub: "gluszec", description: "x", deadlineDays: null, objectives: [{ id: "o", text: "x", at: "gluszec.soltys", done: { flag: "nigdy" } }] })));
  enterNode(s, full, "kopacz", "q3_start", fixed);
  assert.equal(s.inventory.items.some((i) => i.id === "list_kopacza"), false);
  runActions(s, full, [{ startQuest: "falszywe_papiery" }, { giveItem: "wosk_pieczetny" }], fixed);
  assert.equal(s.inventory.items.some((i) => i.id === "wosk_pieczetny"), false);
  const najemnik = data.travel.locations.find((l) => l.id === "gluszec").visitors.find((v) => v.id === "najemnik");
  assert.deepEqual(najemnik.if.all[0], { questStatus: { id: "najemnik_w_karczmie", is: "none" } }, "gość wraca, dopóki zlecenie się nie zacznie");
});

test("I2: przedmiotów fabularnych (misc) nie da się wyrzucić", () => {
  const s = start({});
  s.inventory.items.push({ id: "list_kopacza", qty: 1 }, { id: "opatrunek", qty: 1 });
  const ctx = { state: s, data, io: createAdaptiveIO([]), rng: fixed, notices: [] };
  const dropOf = (id) => actionsFor(data.items.find((i) => i.id === id), ctx).find((a) => a.label === data.ui["inv.drop"]);
  assert.ok(dropOf("list_kopacza").disabled, "list nie do wyrzucenia");
  assert.match(dropOf("list_kopacza").hint, /fabularny/);
  assert.ok(!dropOf("opatrunek").disabled, "zwykły przedmiot można wyrzucić");
});

test("I4: czasy marszu w okolicy Głuszca zgodne z mapą (Kamieniołom za Borem, Bagna od Głuszca)", () => {
  assert.equal(walkMinutes(data, "bor_klusownikow", "kamieniolom"), 90);
  assert.equal(walkMinutes(data, "gluszec", "bagna_szarej_wody"), 300);
  assert.equal(walkMinutes(data, "gluszec", "kamieniolom"), 120 + 90);
  const bad = structuredClone(data);
  bad.travel.locations.find((l) => l.id === "kamieniolom").near.via = "wilczy_las";
  assert.ok(validateData(bad).some((m) => /via/.test(m)), "rodzic z innego regionu");
});

test("I5: zdarzenie na drodze używa osobnej kontroli bez karczmy i piwnicy", () => {
  const ev = data.travel.events.find((e) => e.id === "kontrola_zwiadowcow");
  assert.ok(ev.scenes.some((sc) => sc.dialogue === "kontrola_droga"));
  const road = data.dialogues.find((d) => d.id === "kontrola_droga");
  const text = JSON.stringify(road);
  assert.doesNotMatch(text, /Mruk|piwnic|beczk/);
  assert.doesNotMatch(JSON.stringify(data.dialogues.find((d) => d.id === "kontrola")), /szarych płaszczach/);
});

test("I6: kontrola pamięta wcześniejsze znalezienie insygniów i pozwala ponawiać test", () => {
  const s = start({ ukryte_insygnia: true, insygnia_odkryte: true }, 30);
  const k = keys(s, "kontrola", "kontrola");
  assert.ok(k.includes("stoj_znowu") && !k.includes("stoj_zle") && !k.includes("stoj"));
  enterNode(s, data, "kontrola", "obszukaj_znowu", fixed);
  assert.equal(s.world.search, 35, "drugi raz tylko +5, nie +25");
  const t = start({}, 30);
  chooseOption(t, data, "kontrola", "gadka_test", "gadka_t", { int: () => 100 });
  assert.equal(nodeView(t, data, "kontrola", "gadka_test").options.find((o) => o.key === "gadka_t").disabled, false, "nieudany test nie blokuje kolejnych kontroli");
});

test("I7: kontrola i obława w Głuszcu są wymuszone (zagrywają się same), reszta gości zostaje w menu", () => {
  const gl = data.travel.locations.find((l) => l.id === "gluszec");
  assert.deepEqual(gl.visitors.filter((v) => v.forced).map((v) => v.id).sort(), ["oblawa", "zwiadowcy_kontrola"]);
  assert.equal(rollVisitor(start({}, 80), data, "gluszec", fixed), "oblawa");
});

test("I1: stary zapis ze zleceniem „Mąka dla młyna” trafia do „Zboże dla młyna”", () => {
  const old = {
    version: 10, flags: { ostap_maka: true },
    quests: { maka_dla_mlyna: { status: "active", done: ["maka"] } },
    inventory: { items: [{ id: "worek_maki", qty: 1 }], quickSlots: [], equipped: {} },
    world: { discovered: [] },
  };
  const m = migrations[10](old);
  assert.equal(m.quests.zboze_dla_mlyna.status, "active");
  assert.deepEqual(m.quests.zboze_dla_mlyna.done, ["zboze"]);
  assert.equal(m.quests.maka_dla_mlyna, undefined);
  assert.equal(m.flags.ostap_zboze, true);
  assert.equal(m.flags.ostap_maka, undefined);
  assert.deepEqual(m.inventory.items, [{ id: "worek_zboza", qty: 1 }]);
});

test("zlecenie wprowadzające nadal rusza przez advanceErrands po porzuceniu zleceń", () => {
  const s = start({});
  s.quests.lek_dla_wrzoska = { status: "active", done: [] };
  abandonQuestsOf(s, data, "wilczy_brod");
  startQuest(s, data, "przyjecie_w_osadzie");
  advanceErrands(s, data, fixed);
  assert.equal(s.quests.przyjecie_w_osadzie.status, "active");
});
