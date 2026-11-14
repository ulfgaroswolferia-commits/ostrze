import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { evaluate } from "../src/engine/conditions.js";
import { combatState } from "./helpers.js";
import { enterNode, nodeView } from "../src/systems/dialogue.js";
import { advanceErrands } from "../src/systems/quests.js";
import { isKnown } from "../src/systems/places.js";

const data = await loadData();
const fixed = { int: () => 1 };

function start(flags = { soltys_przyjal: true, nocleg_oplacony: true, soltys_potwierdzil: true }) {
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

test("dane aktu III A (zlecenia 1–6) przechodzą walidację", () => assert.deepEqual(validateData(data), []));

test("Kłusownik i gajowy: obie strony kończą zlecenie, wybór zmienia rozmowę i nagrodę kamieniołomu", () => {
  for (const [stachNode, flag, finish] of [["q1_wydaj", "stach_wydany", "q1_wydany"], ["q1_oszczedz", "stach_oszczedzony", "q1_oszczedzony"]]) {
    const s = start();
    assert.ok(offered(s, "gajowy", "powitanie", "zlecenie"));
    go(s, "gajowy", "q1_start");
    assert.equal(status(s, "klusownik_i_gajowy"), "active");
    assert.ok(isKnown(s, data, "bor_klusownikow"));
    assert.equal(offered(s, "gajowy", "powitanie", "zlecenie"), false, "nie proponuje dwa razy");
    assert.equal(offered(s, "gajowy", "powitanie", flag === "stach_wydany" ? "q1_wydany" : "q1_oszczedzony"), false, "przed rozmową ze Stachem nie ma raportu");
    assert.ok(offered(s, "stach", "powitanie", "q1_sidla"));
    go(s, "stach", "q1_rozmowa");
    go(s, "stach", stachNode);
    assert.equal(s.flags[flag], true);
    assert.equal(status(s, "klusownik_i_gajowy"), "active", "jeszcze raport u gajowego");
    const money = s.character.money;
    go(s, "gajowy", finish);
    assert.equal(status(s, "klusownik_i_gajowy"), "done");
    assert.equal(s.character.money, money + 15);
    assert.ok(isKnown(s, data, "kamieniolom"));
  }
});

test("Dług młynarza: zwłoka, nacisk (pieniądze wracają do karczmarza) i nieudany test też kończą zlecenie", () => {
  const paths = [
    [["q2_zwloka"], "q2_zwloka", 0],
    [["q2_nacisk"], "q2_zaplacil", -12 + 12 + 0],
    [["q2_test_zle", "q2_zwloka"], "q2_zwloka", 0],
  ];
  for (const [radoszNodes, mrukNode] of paths.map(([a, b]) => [a, b])) {
    const s = start();
    const initial = s.character.money;
    go(s, "karczmarz_kogut", "q2_start");
    assert.equal(status(s, "dlug_mlynarza"), "active");
    assert.ok(s.world.hinted.includes("bagna_szarej_wody"));
    go(s, "radosz", "q2_rozmowa");
    for (const n of radoszNodes) go(s, "radosz", n);
    go(s, "karczmarz_kogut", mrukNode);
    assert.equal(status(s, "dlug_mlynarza"), "done", radoszNodes.join());
    assert.ok(s.character.money >= initial, "po całym zleceniu gracz nie jest na minusie");
  }
});

test("Listy z tamtej strony: list tam i z powrotem, bez listu Halina nie czyta, pamięć towarzyszy odblokowuje rozmowę", () => {
  const s = start({ soltys_przyjal: true, nocleg_oplacony: true, soltys_potwierdzil: true, towarzysze_zgineli: true, waha_sie: true });
  assert.ok(offered(s, "kopacz", "powitanie", "swoi"));
  assert.ok(offered(s, "halina", "powitanie", "waha"));
  assert.equal(offered(s, "halina", "powitanie", "q3_list"), false);
  go(s, "kopacz", "q3_start");
  assert.ok(has(s, "list_kopacza"));
  assert.ok(isKnown(s, data, "kapliczka_rozstaje"));
  assert.ok(offered(s, "halina", "powitanie", "q3_list"));
  const search = s.world.search;
  go(s, "halina", "q3_list");
  assert.equal(has(s, "list_kopacza"), false);
  assert.equal(s.world.search, search + 10);
  go(s, "kopacz", "q3_koniec");
  assert.equal(status(s, "listy_z_tamtej_strony"), "done");
});

test("Kto sprzedał ocalałego: kolejność znachorka → kowal → sołtys; odrzucenie stolicy otwiera osobną rozmowę", () => {
  const s = start({ soltys_przyjal: true, nocleg_oplacony: true, soltys_potwierdzil: true, odrzucil_stolice: true });
  assert.ok(offered(s, "soltys", "powitanie", "odrzucil"));
  go(s, "soltys", "q4_start");
  assert.equal(offered(s, "kowal_gluszec", "kuznia", "q4_kg"), false, "kowal czeka na znachorkę");
  go(s, "znachorka", "q4_zn");
  go(s, "kowal_gluszec", "q4_kg");
  s.world.search = 20;
  go(s, "soltys", "q4_koniec");
  assert.equal(status(s, "kto_sprzedal_ocalalego"), "done");
  assert.equal(s.world.search, 15);
});

test("Zwiad na wzgórzu: scena szczytu zależy od zlecenia, raport kowala kończy zlecenie", () => {
  const s = start();
  assert.ok(offered(s, "kowal_gluszec", "kuznia", "q5_start"));
  const hill = data.travel.locations.find((l) => l.id === "wzgorze_wartownicze").spots.find((x) => x.id === "szczyt");
  const visit = (st) => {
    const out = [];
    for (const sc of hill.scenes) {
      if (sc.if && !evaluate(sc.if, st, data)) continue;
      if (sc.type === "narration") out.push(sc.text);
      if (sc.type === "flag") { Object.assign(st.flags, sc.set); break; }
      if (sc.goto === "koniec") break;
    }
    return out.join(" ");
  };
  assert.match(visit(s), /Ze szczytu Głuszec widać jak na dłoni/, "przed zleceniem tylko widok");
  go(s, "kowal_gluszec", "q5_start");
  assert.ok(isKnown(s, data, "wzgorze_wartownicze"));
  assert.match(visit(s), /trzy czerwone płaszcze/);
  assert.equal(s.flags.wzgorze_zwiad, true);
  assert.doesNotMatch(visit(s), /trzy czerwone płaszcze/, "zwiad raz");
  go(s, "kowal_gluszec", "q5_koniec");
  assert.equal(status(s, "zwiad_na_wzgorzu"), "done");
});

test("Fałszywe papiery: wosk od Haliny do kowala, papiery obniżają poszukiwania i kowal o nich mówi", () => {
  const s = start({ soltys_przyjal: true, nocleg_oplacony: true, soltys_potwierdzil: true, halina_przeczytala: true });
  s.world.search = 40;
  go(s, "halina", "q6_start");
  assert.ok(has(s, "wosk_pieczetny"));
  go(s, "kowal_gluszec", "q6_kuj");
  assert.equal(has(s, "wosk_pieczetny"), false);
  assert.equal(s.world.search, 25);
  assert.equal(status(s, "falszywe_papiery"), "done");
  assert.ok(offered(s, "kowal_gluszec", "kuznia", "papiery_po"));
});

test("zlecenia 1–6: żaden węzeł zleceń nie jest ślepy, a start wymaga wcześniejszego przyjęcia w osadzie", () => {
  for (const id of ["gajowy", "stach", "kopacz", "halina", "radosz"]) {
    const d = data.dialogues.find((x) => x.id === id);
    for (const [nid, n] of Object.entries(d.nodes)) assert.ok((n.options ?? []).length >= 1, `${id}/${nid}`);
  }
  const fresh = start({});
  assert.equal(offered(fresh, "kopacz", "powitanie", "q3_start"), true, "kopacz bierze każdego, nie wymaga przyjęcia");
  assert.equal(offered(fresh, "karczmarz_kogut", "powitanie", "q2_dlug"), false);
  assert.equal(offered(fresh, "soltys", "powitanie", "q4_start"), false);
});
