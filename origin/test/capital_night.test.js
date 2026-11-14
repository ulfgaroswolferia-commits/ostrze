import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { createSceneList, runScenes } from "../src/engine/loop.js";
import { combatState, createAdaptiveIO } from "./helpers.js";

const data = await loadData();
const palac = data.travel.locations.find((l) => l.id === "palac");
const komnata = palac.spots.find((s) => s.id === "komnata_tronowa");
const pick = (...labels) => labels.map((l) => ({ pick: l }));
const PLAN = [...pick("Dalej", "Milczę. Patrzę.", "Patrzę.", "Dalej", "Dalej", "Dalej", "Dalej")];

function state(flags = {}, vars = {}) {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.time.minutes = 23 * 60;
  s.world.location = "palac";
  Object.assign(s.flags, { palac_otwarty: true }, flags);
  Object.assign(s.vars, vars);
  return s;
}
async function night(s) {
  const io = createAdaptiveIO(PLAN);
  const ctx = { state: s, data, io, rng: createRng(1), debug: false, notices: [] };
  await runScenes(ctx, createSceneList(komnata.scenes), komnata.scenes[0].id, { endId: "koniec" });
  return stripVTControlCharacters(io.text()).replace(/\s+/g, " ");
}
const VARIANTS = ["noc_bunt", "noc_zamach", "noc_pekniecie"];

test("Noc długich noży: dane przechodzą walidację, komnata jest dostępna tylko po otwarciu pałacu i nocą", () => {
  assert.deepEqual(validateData(data), []);
  assert.deepEqual(komnata.if, { all: [{ flag: "palac_otwarty" }, { timeOfDay: "noc" }] });
  assert.ok(palac.spots.every((s) => (s.type === "scene" || s.type === "talk")));
});

for (const [label, flags, expected, re] of [
  ["bunt Tomasza (sojusz_dezerter)", { sojusz_dezerter: true }, "noc_bunt", /Tomasza/],
  ["zamach starego żołnierza (sojusz_straznicy)", { sojusz_straznicy: true }, "noc_zamach", /stary żołnierz/],
  ["pęknięcie paktu (bez sojuszy)", {}, "noc_pekniecie", /Pakt kończy się/],
  ["bunt ma pierwszeństwo przed zamachem", { sojusz_dezerter: true, sojusz_straznicy: true }, "noc_bunt", /Tomasza/],
]) {
  test(`Noc długich noży: ${label} – cesarz umiera, dokładnie jedna flaga wariantu, koniec odsłony`, async () => {
    const s = state(flags);
    const text = await night(s);
    assert.match(text, re);
    assert.equal(s.flags.cesarz_nie_zyje, true);
    assert.equal(s.flags.akt4b_koniec, true);
    assert.deepEqual(VARIANTS.filter((v) => s.flags[v]), [expected]);
  });
}

test("Noc długich noży: ostatnie słowa cesarza zależą od woli i długu bohatera", async () => {
  assert.match(await night(state({}, { wola: 3 })), /Chcesz zabić tę, która cię przysłała/);
  assert.match(await night(state({}, { dlug: 3 })), /Dług spłacisz/);
  assert.match(await night(state({})), /Herbata|Dobranoc/);
});

test("Noc długich noży: bohater tylko patrzy – dialog cesarza nie ma opcji zabicia, a żaden węzeł nie jest ślepy", () => {
  const d = data.dialogues.find((x) => x.id === "cesarz");
  for (const [id, n] of Object.entries(d.nodes)) assert.ok((n.options ?? []).length >= 1, id);
  assert.ok(!Object.values(d.nodes).flatMap((n) => n.options).some((o) => /zabijam|atakuj|dobywam|^zabij/i.test(o.text)));
  const start = d.nodes[d.start].options;
  assert.ok(start.some((o) => o.requires?.var === "wola") && start.some((o) => o.requires?.var === "dlug"));
});

