import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { evaluate } from "../src/engine/conditions.js";
import { createNewState } from "../src/engine/state.js";

const data = await loadData();
const HUB = "wir_lysa_skala";
const loc = data.travel.locations.find((l) => l.id === HUB);
const spot = (id) => loc.spots.find((s) => s.id === id);
const dlg = (id) => data.dialogues.find((d) => d.id === id);
const DUELS = [["galeria_lustr", ["sluga_wiru", "straz_szklanna"]], ["hala_cewek", ["straz_szklanna", "straz_szklanna"]], ["pomost_wiru", ["sluga_wiru", "straz_szklanna"]]];
const done = (id) => `wir_${id}_pokonany`;
const fresh = (flags = {}) => {
  const st = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  Object.assign(st.flags, flags);
  return st;
};

test("Wir: region, hub, miejsca i mapa; dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  assert.ok(data.travel.regions.wir && loc && loc.region === "wir" && !loc.near && !loc.far);
  for (const id of ["wejscie", ...DUELS.map(([s]) => s), "kryjowka", "komnata_wiru"]) assert.ok(spot(id), id);
  assert.equal(spot("kryjowka").type, "rest");
  assert.match(data.maps.wir, new RegExp(`\\{${HUB}\\}`));
});

test("Wir: pojedynek ze świtą ma wstęp, walkę z ucieczką i porażką do menu, flagę raz i scenę „pusto” po wygranej", () => {
  for (const [s, enemies] of DUELS) {
    const scenes = spot(s).scenes;
    const fight = scenes.find((x) => x.type === "combat");
    const counts = {};
    for (const id of enemies) counts[id] = (counts[id] ?? 0) + 1;
    assert.deepEqual(fight.enemies.map((e) => [e.id, e.count]).sort(), Object.entries(counts).sort(), s);
    assert.ok(fight.canFlee && fight.onFlee && fight.onDefeat, s);
    for (const target of [fight.onFlee, fight.onDefeat]) {
      const sc = scenes.find((x) => x.id === target);
      assert.equal(sc.goto, "koniec", `${s}: ${target}`);
      assert.deepEqual(sc.if, { notFlag: done(s) });
    }
    const flag = scenes.find((x) => x.type === "flag");
    assert.deepEqual(flag.set, { [done(s)]: true });
    assert.deepEqual(flag.if, { notFlag: done(s) });
    const empty = scenes[scenes.indexOf(flag) + 1];
    assert.ok(empty.type === "narration" && empty.goto === "koniec" && !empty.if, s);
    const st = fresh({ [done(s)]: true });
    assert.equal(scenes.find((x) => !x.if || evaluate(x.if, st, data)).id, empty.id);
  }
});

test("Wir: komnata wiru dopiero po trzech pojedynkach; wejście ma cztery stany zależne od postępu", () => {
  const st = fresh();
  assert.equal(evaluate(spot("komnata_wiru").if, st, data), false);
  for (const [s] of DUELS) st.flags[done(s)] = true;
  assert.equal(evaluate(spot("komnata_wiru").if, st, data), true);
  const scenes = spot("wejscie").scenes;
  assert.ok(scenes.length >= 4 && scenes.every((s) => s.goto === "koniec"));
  const played = (s) => scenes.find((x) => !x.if || evaluate(x.if, s, data))?.id;
  const all3 = Object.fromEntries(DUELS.map(([s]) => [done(s), true]));
  const ids = new Set([played(fresh()), played(fresh({ [done("galeria_lustr")]: true })), played(fresh(all3)), played(fresh({ ...all3, istota_rozmowa_odbyta: true }))]);
  assert.equal(ids.size, 4, [...ids].join());
});

test("Wir: starcie z Istotą jest w obu wynikach portalu – dwie walki bez ucieczki, porażka do menu, rozmowa raz, wynik zależny od portalu", () => {
  const scenes = spot("komnata_wiru").scenes;
  const fights = scenes.filter((x) => x.type === "combat");
  assert.equal(fights.length, 2);
  for (const f of fights) {
    assert.deepEqual(f.enemies, [{ id: "istota_szklanna", count: 1 }]);
    assert.ok(!f.canFlee && f.onDefeat);
    assert.equal(scenes.find((x) => x.id === f.onDefeat).goto, "koniec");
  }
  for (const flags of [{ portal_rozbrojony: true, istota_rozmowa_odbyta: true }, { portal_sprawny: true, istota_rozmowa_odbyta: true }]) {
    const st = fresh(flags);
    assert.equal(fights.filter((f) => !f.if || evaluate(f.if, st, data)).length, 1, JSON.stringify(flags));
  }
  assert.equal(fights.filter((f) => !f.if || evaluate(f.if, fresh(), data)).length, 0, "bez decyzji o portalu walka się nie zaczyna");
  const talk = scenes.find((x) => x.type === "dialogue");
  assert.equal(talk.dialogue, "istota_bez_maski");
  assert.deepEqual(talk.if, { notFlag: "istota_rozmowa_odbyta" });
  const outcomes = scenes.filter((x) => x.type === "flag").flatMap((x) => Object.keys(x.set));
  assert.ok(outcomes.includes("istota_zginela") && outcomes.includes("istota_uciekla"));
  const st = fresh({ portal_rozbrojony: true });
  const set = scenes.filter((x) => x.type === "flag" && (!x.if || evaluate(x.if, st, data))).flatMap((x) => Object.keys(x.set));
  assert.ok(set.includes("istota_zginela") && !set.includes("istota_uciekla"));
});

test("Wir: rozmowa z Istotą bez maski – bez ślepych węzłów, raz, trzy tony, prawda ustawia istota_prawda", () => {
  const d = dlg("istota_bez_maski");
  assert.ok(d);
  for (const [nid, n] of Object.entries(d.nodes)) assert.ok((n.options ?? []).length >= 1, nid);
  assert.ok((d.nodes[d.start].actions ?? []).some((a) => a.setFlag === "istota_rozmowa_odbyta"));
  const hub = d.nodes.rozmowa.options;
  for (const flag of ["istota_wyrok", "istota_przetarg", "istota_zwloka"]) assert.ok(hub.some((o) => JSON.stringify(o.requires ?? {}).includes(flag)), flag);
  assert.ok(Object.values(d.nodes).some((n) => (n.actions ?? []).some((a) => a.setFlag === "istota_prawda")));
  assert.ok(d.nodes.rozmowa.options.some((o) => o.goto === "walka") && d.nodes.walka.options.every((o) => o.goto === "end"));
});

test("Wir: wątek wir – trzy kroki, ostatni wskazuje komnatę", () => {
  const q = data.quests.find((x) => x.id === "watek_wir");
  assert.ok(q && q.main && q.hub === HUB && q.objectives.length === 3);
  assert.deepEqual(q.objectives.at(-1).done, { any: [{ flag: "istota_zginela" }, { flag: "istota_uciekla" }] });
  assert.equal(q.objectives.at(-1).at, `${HUB}.komnata_wiru`);
});

test("Wir: obietnica z istota_wyrok ma wariant dla portalu sprawnego, prawda znika z listy po wysłuchaniu, remis w walce z Istotą idzie do porażki", () => {
  const d = dlg("istota_bez_maski");
  const opts = d.nodes.rozmowa.options;
  const wyrokR = opts.find((o) => o.id === "ton_wyrok");
  const wyrokS = opts.find((o) => o.id === "ton_wyrok_s");
  assert.ok(JSON.stringify(wyrokR.requires).includes("portal_rozbrojony"));
  assert.ok(wyrokS && JSON.stringify(wyrokS.requires).includes("portal_sprawny") && JSON.stringify(wyrokS.requires).includes("istota_wyrok"));
  const st = fresh({ istota_wyrok: true, portal_sprawny: true });
  const visible = opts.filter((o) => !o.requires || evaluate(o.requires, st, data)).map((o) => o.id);
  assert.ok(visible.includes("ton_wyrok_s") && !visible.includes("ton_wyrok"));
  assert.ok(JSON.stringify(opts.find((o) => o.id === "prawda").requires).includes("istota_prawda"));
  for (const f of spot("komnata_wiru").scenes.filter((x) => x.type === "combat")) assert.equal(f.onFlee, "komnata_wir_porazka");
});

test("Wir: dialog Istoty wprowadza imię i maskę zgodnie z wcześniejszymi aktami", () => {
  const w = dlg("istota_bez_maski").nodes.wstep.text;
  assert.match(w, /Szklanna/);
  assert.match(w, /przyłbic|zdjęt/);
  assert.doesNotMatch(w, /z głosu/);
});
