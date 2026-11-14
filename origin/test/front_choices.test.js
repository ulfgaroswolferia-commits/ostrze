import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { combatState, tmpDir } from "./helpers.js";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { evaluate } from "../src/engine/conditions.js";
import { addItem, countOf } from "../src/systems/inventory.js";
import { runActions } from "../src/systems/actions.js";
import { advanceErrands } from "../src/systems/quests.js";
import { routeById, farTrip } from "../src/systems/travel.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { destinationEntries } from "../src/ui/map_screen.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { setColorsEnabled } from "../src/ui/colors.js";
import { runScenes, createSceneList } from "../src/engine/loop.js";

const data = await loadData();
const dialogue = (id) => data.dialogues.find((d) => d.id === id);
const spot = (loc, id) => data.travel.locations.find((l) => l.id === loc).spots.find((s) => s.id === id);

let home;
beforeEach(async () => {
  home = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
  setColorsEnabled(false);
});
afterEach(() => {
  if (home === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = home;
});

function game(location = "oboz_wronia", known = []) {
  const state = createNewState({ seed: 1, startScene: "x", rules: data.rules });
  Object.assign(state, combatState(data, "miecz"));
  state.character.hp = 1000;
  state.world.location = location;
  state.world.discovered = [...(state.world.discovered ?? []), "oboz_wronia", ...known];
  state.flags ??= {};
  state.world.phenomenonRolledDay = 1e6;
  return state;
}

async function visit(state, locId, spotId, inputs) {
  const scenes = spot(locId, spotId).scenes;
  const io = createScriptedIO(inputs, { tty: true });
  Object.assign(io, { columns: 120, rows: 40 });
  const ctx = { state, data, io, rng: createRng(7), debug: false, notices: [] };
  state.world.finishedDialogues = state.world.finishedDialogues.filter((id) => !scenes.some((s) => s.id === id));
  await runScenes(ctx, createSceneList(scenes), scenes[0].id, { endId: "koniec" }).catch((e) => { if (!(e instanceof InputExhaustedError)) throw e; });
  return strip(io.output.join("")).replace(/\s*[▌▐▒]\s*/g, " ").replace(/\s+/g, " "); // frames wrap the text
}
const act = (state, dialogueId, nodeId) => runActions(state, data, dialogue(dialogueId).nodes[nodeId].actions, createRng(1));
const story = (id) => data.story.scenes.find((s) => s.id === id);

test("dane: nowe miejsca, zlecenie, list i portrety przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  for (const portrait of ["portret_hauk", "portret_gniewosz"]) assert.ok(data.art[portrait], portrait);
});

// --- Obóz Jarnowian: setnik Hauk ---

test("Hauk: prawda płaci najwięcej, fałsz mniej (i kapitan dopłaca), sabotaż tylko XP; każda droga zamyka ofertę", () => {
  const nodes = dialogue("setnik_hauk").nodes;
  const money = (id) => nodes[id].actions.find((a) => a.giveMoney)?.giveMoney ?? 0;
  assert.equal(money("prawda"), 90);
  assert.equal(money("falsz_ok"), 50);
  assert.equal(money("proch_ok"), 0);
  for (const [node, flag] of [["prawda", "wojna_wywiad_prawda"], ["falsz_ok", "wojna_wywiad_falsz"], ["proch_ok", "wojna_wywiad_proch"]]) {
    assert.ok(nodes[node].actions.some((a) => a.setFlag === flag), node);
    assert.ok(nodes[node].actions.some((a) => a.setFlag === "wywiad_zalatwiony"), node);
  }
  const captain = dialogue("kapitan").nodes;
  assert.ok(captain.wywiad_falsz.actions.some((a) => a.giveMoney === 60));
  assert.ok(captain.wywiad_proch.actions.some((a) => a.giveMoney === 40));
  assert.equal(captain.wywiad_prawda.actions.some((a) => a.giveMoney), false, "za sprzedanie swoich kapitan nie płaci");
});

test("Hauk: w prawdziwym miejscu oferta przy pierwszej wizycie, po transakcji już inna rozmowa", async () => {
  const state = game("oboz_jarnowian_przedni", ["oboz_jarnowian_przedni"]);
  const money = state.character.money;
  const first = await visit(state, "oboz_jarnowian_przedni", "namiot_setnika", ["1", "<enter>"]);
  assert.match(first, /którędy idą wozy z prochem/);
  assert.equal(state.character.money, money + 90);
  assert.equal(state.flags.wojna_wywiad_prawda, true);
  const second = await visit(state, "oboz_jarnowian_przedni", "namiot_setnika", []);
  assert.doesNotMatch(second, /Płacę dziewięćdziesiąt/);
  assert.match(second, /Jak tam wozy/);
});

// --- Jar Dezerterów: sierżant Gniewosz ---

test("Gniewosz: zlecenie, list żelazny od kapitana kończy je powrotem do obozu i nagrodą", () => {
  const state = game("jar_dezerterow", ["jar_dezerterow"]);
  act(state, "gniewosz", "tak");
  assert.equal(evaluate({ questStatus: { id: "jar_bez_wyjscia", is: "active" } }, state, data), true);
  addItem(state, data, "list_zelazny", 1);
  const xp = state.character.xp;
  act(state, "gniewosz", "list");
  advanceErrands(state, data, createRng(1));
  assert.equal(state.flags.wojna_jar_powrot, true);
  assert.equal(countOf(state, "list_zelazny"), 0);
  assert.equal(evaluate({ questStatus: { id: "jar_bez_wyjscia", is: "active" } }, state, data), false);
  assert.ok(state.character.xp >= xp + 70);
});

test("Gniewosz: ucieczka kosztuje sześć worków prowiantu i cały dzień, a bez niego opcji nie ma", () => {
  const state = game("jar_dezerterow", ["jar_dezerterow"]);
  act(state, "gniewosz", "tak");
  const option = dialogue("gniewosz").nodes.s.options.find((o) => o.id === "prowadz");
  const had = countOf(state, "prowiant");
  if (had > 0) runActions(state, data, [{ takeItem: { id: "prowiant", qty: had } }], createRng(1));
  assert.equal(evaluate(option.requires, state, data), false);
  addItem(state, data, "prowiant", 6);
  assert.equal(evaluate(option.requires, state, data), true);
  const before = state.time.minutes;
  act(state, "gniewosz", "prowadz");
  assert.equal(countOf(state, "prowiant"), 0);
  assert.ok(state.time.minutes >= before + 600);
  assert.equal(state.flags.wojna_jar_ucieczka, true);
});

test("Kapitan: wydanie jaru płaci i kończy sprawę; list żelazny za wymowę albo łapówkę; opcje tylko przy otwartym zleceniu", () => {
  const options = dialogue("kapitan").nodes.sztab.options;
  const state = game();
  const list = options.find((o) => o.id === "jar_list");
  const betray = options.find((o) => o.id === "jar_wydaj");
  assert.equal(evaluate(list.requires, state, data), false);
  assert.equal(evaluate(betray.requires, state, data), false);
  act(state, "gniewosz", "tak");
  assert.equal(evaluate(list.requires, state, data), true);
  state.character.money = 100;
  const money = state.character.money;
  act(state, "kapitan", "jar_list_lapowka");
  assert.equal(state.character.money, money - 60);
  assert.equal(countOf(state, "list_zelazny"), 1);
  assert.equal(evaluate(list.requires, state, data), false, "drugi list już nie");
  act(state, "kapitan", "jar_wydaj");
  assert.equal(state.flags.wojna_jar_wydani, true);
  assert.equal(countOf(state, "list_zelazny"), 0, "list przepada razem ze sprawą");
  assert.equal(evaluate(betray.requires, state, data), false);
});

test("Jar po wszystkim: szałas i obozowisko są puste, a na Wzgórzu Wisielców widać skutek wydania", async () => {
  const state = game("jar_dezerterow", ["jar_dezerterow"]);
  state.flags.jar_rozstrzygniety = true;
  assert.match(await visit(state, "jar_dezerterow", "szalas_gniewosza", ["<enter>"]), /stoi pusty/);
  assert.match(await visit(state, "jar_dezerterow", "oboz_dezerterow", []), /Szałasy stoją puste/);
  state.flags.wojna_jar_wydani = true;
  assert.match(await visit(state, "wzgorze_wisielcow", "stary_dozorca", []), /Trzydziestu dwóch/);
});

// --- wieści ---

const NEWS = [
  ["wojna_wywiad_prawda", /Tabor z prochem spłonął/, /Spalili tabor/],
  ["wojna_wywiad_falsz", /pod fort na starym trakcie/, /czterdziestu wyspiarzy/],
  ["wojna_wywiad_proch", /połowa rusznic tylko kaszlnęła/, /mokrym prochem/],
  ["wojna_jar_powrot", /Trzydziestu dwóch chłopa z jaru/, /Wrócili/],
  ["wojna_jar_wydani", /Związani jednym sznurem/, /Wisieli wczoraj/],
  ["wojna_jar_ucieczka", /Szałasy puste/, /Zniknęli/],
];
for (const [flag, fire, gossip] of NEWS) {
  test(`wieści ${flag}: przy ognisku raz, u Bronki i w scenie po cesarzu; bez flagi ich nie ma`, async () => {
    const quiet = game();
    assert.doesNotMatch(await visit(quiet, "oboz_wronia", "ognisko", []), fire);
    const state = game();
    state.flags[flag] = true;
    assert.match(await visit(state, "oboz_wronia", "ognisko", ["<enter>"]), fire);
    assert.equal(state.flags[`wiesc_${flag}`], true);
    assert.doesNotMatch(await visit(state, "oboz_wronia", "ognisko", []), fire, "drugi raz już nie");
    const node = Object.values(dialogue("kantyna").nodes).find((n) => gossip.test(n.text));
    assert.ok(node, "Bronka");
    assert.ok(dialogue("kantyna").nodes.powitanie.options.some((o) => o.requires?.flag === flag), "opcja u Bronki");
    assert.ok(data.story.scenes.some((s) => s.id.startsWith("akt4c_cisza_") && s.if?.flag === flag), "scena po cesarzu");
  });
}

test("wieści: hetman wie, co się stało z wywiadem", () => {
  const options = dialogue("hetman").nodes.namiot.options;
  for (const flag of ["wojna_wywiad_prawda", "wojna_wywiad_falsz", "wojna_wywiad_proch"]) assert.ok(options.some((o) => o.requires?.flag === flag), flag);
});

// --- ruch po mapie ---

test("mapa: skrót jest krótszy niż przez hub i nie jest szeregowy; miejsca po przeciwnych stronach nie mają skrótu", () => {
  const shortcuts = data.travel.routes.filter((r) => r.id.startsWith("skrot_"));
  assert.ok(shortcuts.length >= 8);
  for (const r of shortcuts) {
    const [a, b] = [farTrip(data, r.from).days, farTrip(data, r.to).days];
    assert.ok(r.days < a + b, `${r.id}: ${r.days} ≥ ${a}+${b}`);
    assert.ok(r.days >= Math.abs(a - b), `${r.id}: krótszy, niż pozwala geometria`);
  }
  assert.equal(routeById(data, "skrot_oboz_jarnowian_przedni_wzgorze_wisielcow").days, 3);
  assert.equal(routeById(data, "skrot_jar_dezerterow_oboz_jarnowian_przedni") ?? routeById(data, "skrot_oboz_jarnowian_przedni_jar_dezerterow") ? 3 : 0, 3);
  assert.equal(shortcuts.some((r) => [r.from, r.to].includes("ruiny_straznicy") && [r.from, r.to].includes("twierdza_graniczna")), false, "południe i północny wschód");
});

test("mapa: z dalekiego miejsca widać skrót do innego znanego miejsca, nieznanych nie", () => {
  const state = game("wzgorze_wisielcow", ["wzgorze_wisielcow", "jar_dezerterow"]);
  const entries = destinationEntries(state, data, "oboz_wronia");
  assert.deepEqual(entries.map((e) => e.id).sort(), ["jar_dezerterow", "oboz_wronia"]);
  const jar = entries.find((e) => e.id === "jar_dezerterow");
  assert.equal(jar.kind, "far");
  assert.equal(jar.viaHub, undefined);
  assert.equal(jar.days, routeById(data, jar.route).days);
  assert.ok(jar.days < 7, "krócej niż 3 + 4 przez obóz");
  assert.match(jar.label, new RegExp(`${jar.days} dni`));
});

test("mapa: po przeciwnych stronach huba droga wiedzie przez hub, czas to suma; podróż dociera przez hub do celu", async () => {
  const state = game("ruiny_straznicy", ["ruiny_straznicy", "ostoja_zbojcow"]);
  state.world.location = "ruiny_straznicy";
  const entries = destinationEntries(state, data, "wilczy_brod");
  const target = entries.find((e) => e.id === "ostoja_zbojcow");
  assert.equal(target.viaHub, true);
  assert.equal(target.days, 1 + 3);
  assert.match(target.description, /Bród/);

  const front = game("oboz_wronia", []);
  assert.deepEqual(destinationEntries(front, data, "oboz_wronia").filter((e) => e.kind === "far"), [], "hub bez odkryć: nic");
});

test("mapa: skrót w prawdziwej scenie – kilka dni drogi, dotarcie do celu, bez przechodzenia przez obóz", async () => {
  const state = game("wzgorze_wisielcow", ["wzgorze_wisielcow", "jar_dezerterow"]);
  const io = createScriptedIO(["w", ...Array(120).fill("<enter>")], { tty: true });
  Object.assign(io, { columns: 120, rows: 40 });
  const ctx = { state, data: structuredClone({ ...data, travel: { ...data.travel, events: [] } }), io, rng: createRng(3), debug: false, notices: [] };
  const { runTrip } = await import("../src/scenes/trip.js");
  const entry = destinationEntries(state, data, "oboz_wronia").find((e) => e.id === "jar_dezerterow");
  const seen = [];
  const key = io.readKey.bind(io);
  io.readKey = async () => { seen.push(state.world.location); return key(); };
  await runTrip(ctx, { route: entry.route, reverse: entry.reverse });
  assert.equal(state.world.location, "jar_dezerterow");
  assert.equal(seen.includes("oboz_wronia"), false);
});

test("mapa: wybór celu przez hub w prawdziwej mapie zapisuje obie nogi podróży i kończy w celu", async () => {
  const state = game("ruiny_straznicy", ["ruiny_straznicy", "ostoja_zbojcow", "wilczy_brod"]);
  const d = structuredClone({ ...data, travel: { ...data.travel, events: [] } });
  d.rules.travel.eventChance = 0;
  d.rules.travel.dangerousEventChance = 0;
  state.world.map = { hub: "wilczy_brod", phase: "choose", quest: null, questScene: null, spot: null, spotScene: null, far: null, walk: null, ambush: null };
  const entries = destinationEntries(state, d, "wilczy_brod");
  const n = entries.findIndex((e) => e.id === "ostoja_zbojcow") + 1;
  assert.ok(n > 0);
  const io = createScriptedIO([String(n), ...Array(60).fill("<enter>")], { tty: true });
  Object.assign(io, { columns: 120, rows: 40 });
  const ctx = { state, data: d, io, rng: createRng(3), debug: false, notices: [] };
  const scene = { id: "mapa_proba", type: "map", hub: "wilczy_brod", title: "Bród", main: { label: "Dalej", doneLabel: "Dalej", goto: "x" } };
  await defaultHandlers.map(ctx, scene).catch((e) => { if (!(e instanceof InputExhaustedError)) throw e; });
  assert.equal(state.world.location, "ostoja_zbojcow");
  assert.equal(state.world.map.far, null);
  assert.equal(state.world.map.farNext ?? null, null);
});
