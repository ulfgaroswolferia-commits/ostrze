import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { combatState, tmpDir } from "./helpers.js";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { evaluate } from "../src/engine/conditions.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { setColorsEnabled } from "../src/ui/colors.js";
import { runScenes, createSceneList } from "../src/engine/loop.js";
import { playedScenes, rollAmbush } from "../src/systems/spots.js";

const data = await loadData();
const smyk = data.dialogues.find((d) => d.id === "smyk");
const guard = data.dialogues.find((d) => d.id === "straznik_przy_smyku");
const spot = data.travel.locations.find((l) => l.id === "ulfgrod").spots.find((x) => x.id === "smyk_ulica");
const visible = (d, node, state) => d.nodes[node].options.filter((o) => !o.requires || evaluate(o.requires, state, data)).map((o) => o.id);

let home;
beforeEach(async () => {
  home = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
  setColorsEnabled(false);
});
afterEach(() => {
  if (home === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = home;
});

function game(money = 100, flags = {}) {
  const state = createNewState({ seed: 1, startScene: "x", rules: data.rules });
  Object.assign(state, combatState(data, "miecz"));
  state.character.money = money;
  state.world.location = "ulfgrod";
  Object.assign(state.flags, flags);
  state.vars = { ...state.vars, zlecenia_stolicy: 0 };
  return state;
}

/** One visit to the spot, as the map plays it: the ambush roll, its scenes, then the talk. */
async function visit(state, inputs) {
  const rng = createRng(1);
  const ambushed = rollAmbush(state, data, "ulfgrod", spot, rng);
  const scenes = playedScenes(data, "ulfgrod", "smyk_ulica", ambushed);
  state.world.finishedDialogues = state.world.finishedDialogues.filter((id) => !scenes.some((x) => x.id === id));
  const io = createScriptedIO(inputs, { tty: true });
  Object.assign(io, { columns: 120, rows: 40 });
  await runScenes({ state, data, io, rng, debug: false, notices: [] }, createSceneList(scenes), scenes[0].id, { endId: "koniec" })
    .catch((e) => { if (!(e instanceof InputExhaustedError)) throw e; });
  return { ambushed, text: strip(io.output.join("")).replace(/\s*[▌▐▒]\s*/g, " ").replace(/\s+/g, " ") };
}

test("dane przechodzą walidację; strażnik sam zadaje pytanie, zanim gracz na nie odpowie", () => {
  assert.deepEqual(validateData(data), []);
  assert.match(guard.nodes.s.text, /Szukam gówniarza w zielonej czapce/);
  assert.match(guard.nodes.s.text, /Widziałeś go\?/);
  assert.ok(data.art.portret_straznik_miejski);
});

test("pierwsze podejście do Smyka: drogę zachodzi strażnik, dopiero potem rozmowa; drugi raz już nie", async () => {
  const state = game();
  const first = await visit(state, ["1", "1", "1"]);
  assert.equal(first.ambushed, true);
  assert.match(first.text, /drogę zachodzi ci strażnik/);
  assert.match(first.text, /To mój szwagier/);
  assert.match(first.text, /To o co chodzi/, "po próbie normalna rozmowa ze Smykiem");
  const second = await visit(state, []);
  assert.equal(second.ambushed, false);
  assert.doesNotMatch(second.text, /zachodzi/);
});

test("wprowadzenie w błąd strażnika: zaufanie, XP i bez srebra; miasto i przejścia otwarte", async () => {
  const state = game();
  const xp = state.character.xp;
  await visit(state, ["1", "1", "1"]);
  assert.equal(state.flags.smyk_zaufal, true);
  assert.equal(state.character.money, 100);
  assert.ok(state.character.xp >= xp + 25);
  const after = visible(smyk, "powrot", state);
  assert.ok(after.includes("miasto") && after.includes("przejscia"));
  assert.ok(!after.includes("drobne"));
});

test("milczenie i odmowa też dają zaufanie, ale bez XP za kłamstwo", async () => {
  for (const pick of ["2", "4"]) {
    const state = game();
    const xp = state.character.xp;
    await visit(state, [pick, "1", "1"]);
    assert.equal(state.flags.smyk_zaufal, true, pick);
    assert.equal(state.character.xp, xp, pick);
  }
});

test("wydanie bez złej sławy zrywa zaufanie: srebro zostaje, przejść nie ma, za drobne jest miasto", async () => {
  const state = game();
  await visit(state, ["3", "1"]);
  assert.equal(state.flags.smyk_wydal, true);
  assert.equal(state.character.money, 110);
  const after = visible(smyk, "powrot", state);
  assert.ok(!after.includes("przejscia") && !after.includes("miasto"));
  assert.ok(after.includes("drobne"));
});

test("wydanie przy złej sławie to inny powód zaufania: interes", async () => {
  const state = game(100, { wojna_jar_wydani: true });
  const shown = visible(guard, "s", state);
  assert.ok(shown.includes("wydaj_interes") && !shown.includes("wydaj"));
  await visit(state, ["3", "1"]);
  assert.equal(state.flags.smyk_interes, true);
  assert.equal(state.character.money, 110);
  assert.ok(visible(smyk, "powrot", state).includes("przejscia"));
});

test("reputacja: pytanie Smyka ma odpowiedzi zależne od przeszłości", () => {
  const options = (flags) => visible(guard, "zmyl", game(100, flags));
  assert.deepEqual(options({}), ["nikt"]);
  assert.deepEqual(options({ wojna_ranni_wszyscy: true }), ["dobra", "nikt"]);
  assert.deepEqual(options({ wojna_dezerterzy_wydani: true }), ["zla", "nikt"]);
});

test("bez ślepego zaułka: po wydaniu za drobne jest miasto, praca na tablicy też je otwiera, a dowód i trzy sprawy prowadzą do pałacu", () => {
  const poor = game(0, { smyk_wydal: true });
  assert.ok(!visible(smyk, "ulica", poor).includes("drobne"));
  poor.vars.zlecenia_stolicy = 1;
  assert.ok(visible(smyk, "powrot", poor).includes("miasto"));
  const proof = game(0, { smyk_wydal: true, dowod_zywego: true });
  proof.vars.zlecenia_stolicy = 3;
  assert.ok(visible(smyk, "powrot", proof).includes("otwiera"));
  const drobne = smyk.nodes.ulica.options.find((o) => o.id === "drobne");
  assert.ok(drobne.actions.some((a) => a.takeMoney === 25));
  assert.ok(smyk.nodes.miasto.actions.some((a) => a.setFlag === "smyk_poznany"));
});

test("stary zapis po poprzedniej próbie: strażnik nie zatrzymuje drugi raz", () => {
  assert.equal(rollAmbush(game(100, { smyk_zaufal: true }), data, "ulfgrod", spot, createRng(1)), false);
});

test("Hjalmar: karczmarz przedstawia się przy pierwszej wizycie, można o niego zapytać i to zalicza rozmowę z celu", async () => {
  const hjalmar = data.dialogues.find((d) => d.id === "hjalmar");
  assert.match(hjalmar.nodes.lad.text, /Hjalmar/);
  const state = game();
  const seen = (node) => hjalmar.nodes[node].options.filter((o) => !o.requires || evaluate(o.requires, state, data)).map((o) => o.id);
  assert.equal(seen("lad")[0], "szukam");
  const io = createScriptedIO(["1"], { tty: true });
  Object.assign(io, { columns: 120, rows: 40 });
  await defaultHandlers.dialogue({ state, data, io, rng: createRng(1), debug: false, notices: [] }, { id: "karczma_test", type: "dialogue", dialogue: "hjalmar", camp: false })
    .catch((e) => { if (!(e instanceof InputExhaustedError)) throw e; });
  assert.equal(state.flags.hjalmar_poznany, true);
  assert.ok(!seen("powrot").includes("szukam"), "drugi raz nie pyta");
  assert.ok(seen("powrot").includes("miasto"));
});
