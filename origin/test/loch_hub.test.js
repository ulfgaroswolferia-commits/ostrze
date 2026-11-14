import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { evaluate } from "../src/engine/conditions.js";
import { createNewState } from "../src/engine/state.js";

const data = await loadData();
const HUB = "loch_pod_palacem";
const loc = data.travel.locations.find((l) => l.id === HUB);
const spot = (id) => loc.spots.find((s) => s.id === id);
const dlg = (id) => data.dialogues.find((d) => d.id === id);
const DUELS = [["straznik_progu", "straznik_progu"], ["szeptacz", "szeptacz"], ["kustosz_kabli", "kustosz_kabli"], ["niespiacy", "niespiacy"]];
const done = (id) => `loch_${id}_pokonany`;
const fresh = () => createNewState({ seed: 1, startScene: "a", rules: data.rules });

test("loch: region, hub, miejsca i mapa; dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  assert.ok(data.travel.regions.loch && loc && loc.region === "loch" && !loc.near && !loc.far);
  for (const id of ["wejscie", ...DUELS.map(([s]) => s), "kryjowka", "komnata_rdzenia"]) assert.ok(spot(id), id);
  assert.equal(spot("kryjowka").type, "rest");
  assert.match(data.maps.loch, new RegExp(`\\{${HUB}\\}`));
});

test("loch: pojedynek ma wstęp, walkę z porażką i ucieczką wracającymi do menu, po walce flagę „pokonany”; powtórka nie gra się drugi raz", () => {
  for (const [s, enemy] of DUELS) {
    const scenes = spot(s).scenes;
    const fight = scenes.find((x) => x.type === "combat");
    assert.deepEqual(fight.enemies, [{ id: enemy, count: 1 }], s);
    assert.ok(fight.canFlee && fight.onFlee && fight.onDefeat, s);
    for (const target of [fight.onFlee, fight.onDefeat]) {
      const sc = scenes.find((x) => x.id === target);
      assert.equal(sc.goto, "koniec", `${s}: ${target}`);
      assert.deepEqual(sc.if, { notFlag: done(s) }, `${s}: ${target} nie gra się po wygranej`);
    }
    const flag = scenes.find((x) => x.type === "flag");
    assert.deepEqual(flag.set, { [done(s)]: true }, s);
    assert.equal(flag.goto, "koniec");
    for (const sc of [scenes[0], fight]) assert.deepEqual(sc.if, { notFlag: done(s) }, `${s}: ${sc.id}`);
    // po wygranej reszta scen nie gra się
    const st = fresh();
    st.flags[done(s)] = true;
    for (const sc of scenes.filter((x) => x.if && JSON.stringify(x.if) === JSON.stringify({ notFlag: done(s) }))) assert.equal(evaluate(sc.if, st, data), false);
  }
});

test("loch: kolejność – trzech strażników w dowolnej kolejności, potem Nieśpiący, potem komnata Rdzenia", () => {
  const st = fresh();
  assert.equal(spot("niespiacy").if && evaluate(spot("niespiacy").if, st, data), false);
  assert.equal(evaluate(spot("komnata_rdzenia").if, st, data), false);
  for (const [s] of DUELS.slice(0, 3)) assert.equal(spot(s).if, undefined, `${s}: dostępny od początku`);
  for (const [s] of DUELS.slice(0, 3).reverse()) st.flags[done(s)] = true;
  assert.equal(evaluate(spot("niespiacy").if, st, data), true);
  assert.equal(evaluate(spot("komnata_rdzenia").if, st, data), false);
  st.flags[done("niespiacy")] = true;
  assert.equal(evaluate(spot("komnata_rdzenia").if, st, data), true);
});

test("loch: wejście ma cztery stany zależne od postępu, wzajemnie wykluczające się i zawsze któryś gra", () => {
  const scenes = spot("wejscie").scenes;
  assert.ok(scenes.length >= 4);
  assert.ok(scenes.every((s) => s.goto === "koniec"));
  const played = (st) => scenes.find((s) => !s.if || evaluate(s.if, st, data))?.id;
  const ids = new Set();
  const st = fresh();
  ids.add(played(st));
  st.flags[done("szeptacz")] = true; ids.add(played(st));
  for (const [s] of DUELS.slice(0, 3)) st.flags[done(s)] = true;
  ids.add(played(st));
  st.flags[done("niespiacy")] = true; ids.add(played(st));
  assert.equal(ids.size, 4, [...ids].join());
});

test("loch: komnata Rdzenia – rozmowa, walka bez ucieczki z porażką do menu, flaga pelnomocnik_pokonany; boss tylko raz", () => {
  const scenes = spot("komnata_rdzenia").scenes;
  const fight = scenes.find((x) => x.type === "combat");
  assert.deepEqual(fight.enemies, [{ id: "pelnomocnik", count: 1 }]);
  assert.ok(!fight.canFlee && fight.onDefeat);
  assert.equal(scenes.find((x) => x.id === fight.onDefeat).goto, "koniec");
  assert.ok(scenes.some((x) => x.type === "dialogue" && x.dialogue === "pelnomocnik"));
  assert.deepEqual(scenes.find((x) => x.type === "flag").set, { pelnomocnik_pokonany: true });
  const st = fresh();
  st.flags.pelnomocnik_pokonany = true;
  assert.equal(scenes.filter((x) => x.if && evaluate(x.if, st, data) === false).length >= 3, true);
});

test("loch: dialog Pełnomocnika – bez ślepych węzłów, trzy wejścia (zamiar, dług, umowa), każde kończy się walką", () => {
  const d = dlg("pelnomocnik");
  assert.ok(d);
  for (const [nid, n] of Object.entries(d.nodes)) assert.ok((n.options ?? []).length >= 1, nid);
  const start = d.nodes[d.start].options;
  assert.ok(start.some((o) => o.requires?.var === "wola") && start.some((o) => o.requires?.var === "dlug") && start.length >= 4);
  const reaches = (id, seen = new Set()) => id === "end" || (!seen.has(id) && (seen.add(id), d.nodes[id].options.every((o) => reaches(o.goto, seen))));
  for (const o of start) assert.ok(reaches(o.goto), o.id);
});

test("wątek lochu: trzy kroki, ostatni wskazuje komnatę Rdzenia", () => {
  const q = data.quests.find((x) => x.id === "watek_loch");
  assert.ok(q && q.main && q.hub === HUB && q.objectives.length === 3);
  assert.equal(q.objectives.at(-1).at, `${HUB}.komnata_rdzenia`);
  assert.deepEqual(q.objectives.at(-1).done, { flag: "pelnomocnik_pokonany" });
});

test("loch: po wygranej pojedynku miejsce pokazuje scenę „pusto” (nie jest martwe), a cel 1 wątku wskazuje wejście", () => {
  for (const [s] of DUELS) {
    const scenes = spot(s).scenes;
    const flag = scenes.find((x) => x.type === "flag");
    assert.deepEqual(flag.if, { notFlag: done(s) }, `${s}: flaga tylko raz`);
    const empty = scenes[scenes.indexOf(flag) + 1];
    assert.ok(empty && empty.type === "narration" && empty.goto === "koniec" && !empty.if, `${s}: scena po wygranej`);
    const st = fresh();
    st.flags[done(s)] = true;
    const played = scenes.find((x) => !x.if || evaluate(x.if, st, data));
    assert.equal(played.id, empty.id);
  }
  assert.equal(data.quests.find((x) => x.id === "watek_loch").objectives[0].at, `${HUB}.wejscie`);
});
