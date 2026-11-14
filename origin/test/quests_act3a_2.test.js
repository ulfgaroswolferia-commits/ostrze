import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { evaluate } from "../src/engine/conditions.js";
import { combatState } from "./helpers.js";
import { enterNode, nodeView } from "../src/systems/dialogue.js";
import { advanceErrands, startQuest } from "../src/systems/quests.js";
import { rollVisitor } from "../src/systems/spots.js";
import { isKnown } from "../src/systems/places.js";

const data = await loadData();
const fixed = { int: () => 1 };
const BASE = { soltys_przyjal: true, nocleg_oplacony: true, soltys_potwierdzil: true };
const AROUND = ["bor_klusownikow", "stary_trakt", "kapliczka_rozstaje", "kamieniolom", "bagna_szarej_wody", "wzgorze_wartownicze"];

function start(flags = BASE) {
  const state = createNewState({ seed: 1, startScene: "akt3_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 40;
  Object.assign(state.flags, flags);
  state.world.location = "gluszec";
  return state;
}
const go = (state, d, n) => { enterNode(state, data, d, n, fixed); advanceErrands(state, data, fixed); };
const status = (state, id) => state.quests[id]?.status ?? "none";
const offered = (state, d, node, key) => nodeView(state, data, d, node).options.some((o) => o.key === key && !o.disabled);
const has = (state, id) => state.inventory.items.some((i) => i.id === id);

/** One visit to a scene spot as the runner plays it. */
function visit(spot, state) {
  const out = [];
  for (const sc of spot.scenes) {
    if (sc.if && !evaluate(sc.if, state, data)) continue;
    if (sc.type === "narration") out.push(sc.text);
    if (sc.type === "flag") { Object.assign(state.flags, sc.set); break; }
    if (sc.goto === "koniec") break;
  }
  return out.join(" ");
}

test("dane zleceń 7–12, gości i sklepów przechodzą walidację", () => assert.deepEqual(validateData(data), []));

test("Rannego nie zostawia się: opatrunek albo zniesienie do znachorki; dozorca płaci w obu wypadkach", () => {
  for (const [nodes, flag] of [[["opatrz_ok"], "ranny_opatrzony"], [["opatrz_zle", "zanies"], "ranny_u_znachorki"], [["zanies"], "ranny_u_znachorki"]]) {
    const s = start();
    go(s, "dozorca", "q7_start");
    assert.equal(offered(s, "dozorca", "powitanie", "q7_koniec"), false);
    for (const n of nodes) go(s, "ranny", n);
    assert.equal(s.flags[flag], true, nodes.join());
    const money = s.character.money;
    go(s, "dozorca", "q7_koniec");
    assert.equal(status(s, "rannego_nie_zostawia_sie"), "done");
    assert.equal(s.character.money, money + 18);
  }
  assert.ok(offered(start({ ...BASE, ranny_u_znachorki: true }), "znachorka", "powitanie", "ranny_po"));
  assert.ok(offered(start({ ...BASE, ranny_opatrzony: true }), "dozorca", "powitanie", "ranny_po"));
});

test("Szara trzcina: zbieranie podnosi poszukiwania, trzcina wraca do znachorki, nagroda to napary", () => {
  const s = start();
  go(s, "znachorka", "q8_start");
  assert.ok(isKnown(s, data, "bagna_szarej_wody"));
  assert.ok(offered(s, "trzcinowisko", "powitanie", "zbieraj"));
  go(s, "trzcinowisko", "zbieraj");
  assert.ok(has(s, "szara_trzcina"));
  assert.equal(s.world.search, 10);
  assert.equal(offered(s, "trzcinowisko", "powitanie", "zbieraj"), false, "raz");
  const before = s.inventory.items.find((i) => i.id === "napar_ziol")?.qty ?? 0;
  go(s, "znachorka", "q8_koniec");
  assert.equal(status(s, "szara_trzcina"), "done");
  assert.equal(has(s, "szara_trzcina"), false);
  assert.equal(s.inventory.items.find((i) => i.id === "napar_ziol").qty, before + 2);
});

test("Wdowa po strażniku: zależy od losu amuletu; córka kieruje do Głuszca; kopacz wskazuje grób", () => {
  for (const [flag, node] of [["amulet_oddany", "q9_start"], ["amulet_zatrzymany", "q9_start_z"]]) {
    const s = start({ ...BASE, [flag]: true });
    assert.ok(offered(s, "wdowa", "powitanie", node));
    go(s, "wdowa", node);
    assert.equal(status(s, "wdowa_po_straznik"), "active");
    go(s, "kopacz", "q9_grob");
    go(s, "wdowa", "q9_koniec");
    assert.equal(status(s, "wdowa_po_straznik"), "done");
  }
  assert.equal(offered(start(), "wdowa", "powitanie", "q9_start"), false, "bez losu amuletu wdowa nie ma sprawy");
  const c = start({ ...BASE, amulet_pasuje: true });
  go(c, "corka", "oddany");
  assert.ok(isKnown(c, data, "gluszec.wdowa"), "córka wskazuje matkę");
});

test("Najemnik w karczmie: cztery rozwiązania, poszukiwania zostają w 0–100, zlecenie kończy każde", () => {
  for (const [nodes, delta] of [[["pytanie", "klam_ok"], -10], [["pytanie", "klam_zle"], 15], [["pytanie", "lapowka"], -5], [["pytanie", "nie"], 5]]) {
    const s = start();
    s.world.search = 20;
    for (const n of nodes) go(s, "najemnik", n);
    assert.equal(s.flags.najemnik_rozwiazany, true, nodes.join());
    assert.equal(s.world.search, 20 + delta, nodes.join());
    assert.equal(status(s, "najemnik_w_karczmie"), "done", nodes.join());
  }
  const low = start();
  go(low, "najemnik", "pytanie");
  go(low, "najemnik", "klam_ok");
  assert.equal(low.world.search, 0, "klamra do zera");
});

test("Zaginiona karawana: ślady w wąwozie tylko przy aktywnym zleceniu; mapa przewodnika to skrót, nie warunek", () => {
  const s = start();
  const spot = data.travel.locations.find((l) => l.id === "stary_trakt").spots.find((x) => x.id === "rozbity_woz");
  assert.match(visit(spot, s), /Stara droga/);
  go(s, "furman", "q11_start");
  assert.match(visit(spot, s), /przewrócony wóz/);
  assert.equal(s.flags.woz_znaleziony, true);
  s.inventory.items.push({ id: "mapa_przewodnika", qty: 1 });
  assert.ok(offered(s, "furman", "powitanie", "q11_mapa"));
  go(s, "furman", "q11_koniec");
  assert.equal(status(s, "zaginiona_karawana"), "done", "mapa nie była potrzebna");
});

test("Co widziała Ragnosława: echo tylko nocą po wcześniejszych wątkach, kończy IIIa flagą akt3a_koniec", () => {
  const echo = data.travel.locations.find((l) => l.id === "gluszec").spots.find((x) => x.id === "cmentarz").scenes[0];
  assert.equal(echo.type, "dialogue");
  const s = start();
  s.time.minutes = 23 * 60;
  assert.equal(evaluate(echo.if, s, data), false, "bez wcześniejszych wątków cmentarz jest tylko cmentarzem");
  s.quests.przyjecie_w_osadzie = { status: "done" };
  s.quests.zwiad_na_wzgorzu = { status: "done" };
  assert.equal(evaluate(echo.if, s, data), true);
  s.time.minutes = 12 * 60;
  assert.equal(evaluate(echo.if, s, data), false, "za dnia nic się nie dzieje");
  s.time.minutes = 23 * 60;
  s.flags.dlug_istoty = true;
  assert.ok(offered(s, "echo_istoty", "powitanie", "dlug"));
  go(s, "echo_istoty", "slucham");
  assert.equal(status(s, "co_widziala_ragnoslawa"), "active");
  assert.equal(s.flags.echo_slyszal, true);
  go(s, "halina", "q12_halina");
  assert.equal(status(s, "co_widziala_ragnoslawa"), "done");
  assert.equal(s.flags.akt3a_koniec, true);
});

test("goście Głuszca: najemnik po przyjęciu, pielgrzym po tropie kowala, handlarz zawsze; raz zagrani znikają", () => {
  const s = start({});
  const rng = (n) => ({ int: () => n });
  assert.equal(rollVisitor(s, data, "gluszec", rng(1)), "wedrowny_handlarz", "przed przyjęciem tylko handlarz");
  s.quests.przyjecie_w_osadzie = { status: "done" };
  assert.equal(rollVisitor(s, data, "gluszec", rng(1)), "najemnik");
  s.quests.najemnik_w_karczmie = { status: "active" };
  s.flags.kowal_wskazal = true;
  assert.equal(rollVisitor(s, data, "gluszec", rng(1)), "falszywy_pielgrzym");
  s.flags.pielgrzym_byl = true;
  assert.equal(rollVisitor(s, data, "gluszec", rng(1)), "wedrowny_handlarz");
  assert.equal(rollVisitor(s, data, "gluszec", rng(100)), null);
  for (const [node, delta, flag] of [["oskarz_ok", -10, "informator_przepedzony"], ["oskarz_zle", 15, null], ["odpusc", 0, null]]) {
    const p = start({ ...BASE, kowal_wskazal: true });
    p.world.search = 20;
    go(p, "pielgrzym_falszywy", node);
    assert.equal(p.world.search, 20 + delta, node);
    if (flag) assert.equal(p.flags[flag], true);
  }
});

test("odkrycie wszystkich sześciu lokacji okolicy jest możliwe w dowolnej kolejności zleceń", () => {
  const s = start({});
  assert.ok(!AROUND.some((id) => isKnown(s, data, id)));
  go(s, "soltys", "przyjety");
  go(s, "kopacz", "q3_start");
  go(s, "gajowy", "q1_start");
  go(s, "znachorka", "q8_start");
  s.flags.soltys_potwierdzil = true;
  go(s, "kowal_gluszec", "q5_start");
  go(s, "karczmarz_kogut", "plotki");
  for (const id of AROUND) assert.ok(isKnown(s, data, id), id);
});
