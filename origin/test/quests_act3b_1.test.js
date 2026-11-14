import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { combatState } from "./helpers.js";
import { enterNode, chooseOption, nodeView } from "../src/systems/dialogue.js";
import { advanceErrands } from "../src/systems/quests.js";
import { isKnown } from "../src/systems/places.js";

const data = await loadData();
const fixed = { int: () => 1 };

function start(flags = {}) {
  const state = createNewState({ seed: 1, startScene: "akt3b_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 40;
  state.world.location = "obserwatorium";
  Object.assign(state.flags, flags);
  return state;
}
const go = (state, d, n) => { enterNode(state, data, d, n, fixed); advanceErrands(state, data, fixed); };
const status = (state, id) => state.quests[id]?.status ?? "none";
const offered = (state, d, node, key) => nodeView(state, data, d, node).options.some((o) => o.key === key && !o.disabled);
const count = (state, id) => state.inventory.items.find((i) => i.id === id)?.qty ?? 0;
const READY = { hieronim_przyjal: true, brygida_poznana: true, hieronim_potwierdzil: true };

test("dane zleceń 1–5 IIIb przechodzą walidację", () => assert.deepEqual(validateData(data), []));

test("Swój w Obserwatorium: trzy wymiany nieufności, Brygida, raport; odkrywa pole i menhiry; bez rzutów i pieniędzy", () => {
  const s = start({ komendant_wie_o_szkole: true });
  assert.ok(offered(s, "hieronim", "p1", "p1c"), "pamięć o komendancie z Wilczego Brodu");
  go(s, "hieronim", "p1");
  go(s, "hieronim", "p2");
  assert.equal(s.flags.hieronim_przyjal, undefined);
  s.quests.przyjecie_w_obserwatorium = { status: "active", done: [] };
  go(s, "hieronim", "p3");
  assert.equal(s.flags.hieronim_przyjal, true);
  assert.ok(isKnown(s, data, "pole_szkla") && isKnown(s, data, "menhiry"));
  assert.ok(s.world.hinted.includes("ostatnia_strazica"));
  assert.equal(offered(s, "hieronim", "powitanie", "p1"), false, "przyjęcie raz");
  const money = s.character.money;
  assert.equal(offered(s, "hieronim", "powitanie", "p_koniec"), false, "najpierw Brygida");
  go(s, "brygida", "poznanie");
  assert.equal(s.flags.brygida_poznana, true);
  go(s, "hieronim", "p_koniec");
  assert.equal(status(s, "przyjecie_w_obserwatorium"), "done");
  assert.equal(s.character.money, money + 10);
  for (const n of ["p1", "p2"]) assert.ok(data.dialogues.find((d) => d.id === "hieronim").nodes[n].options.some((o) => !o.requires && !o.check));
});

test("Szkło z krateru: trzy odłamki w dowolnej kolejności, nie da się wziąć dwa razy, Hieronim zabiera komplet", () => {
  const s = start(READY);
  go(s, "hieronim", "q2_start");
  assert.ok(isKnown(s, data, "krater_gwiazdy"));
  for (const col of ["czerwony", "zielony", "niebieski"]) {
    assert.ok(offered(s, "szklo", "powitanie", `s_${col}`));
    go(s, "szklo", `s_${col}`);
    assert.equal(offered(s, "szklo", "powitanie", `s_${col}`), false, "każdy kolor raz");
  }
  assert.equal(count(s, "odlamek_krateru"), 3);
  assert.equal(status(s, "szklo_z_krateru"), "active");
  const money = s.character.money;
  go(s, "hieronim", "q2_koniec");
  assert.equal(status(s, "szklo_z_krateru"), "done");
  assert.equal(count(s, "odlamek_krateru"), 0);
  assert.equal(s.character.money, money + 20);
});

test("Pamięć kamieni: przyjęcie daje dług, odmowa wolę; Hieronim reaguje inaczej; oba zamykają zlecenie", () => {
  for (const [node, varName, hNode] of [["przyjal", "dlug", "q3_przyjal"], ["odrzucil", "wola", "q3_odrzucil"]]) {
    const s = start(READY);
    go(s, "hieronim", "q3_start");
    assert.equal(offered(s, "hieronim", "powitanie", hNode), false);
    go(s, "menhir", node);
    assert.equal(s.vars[varName], 1);
    assert.equal(offered(s, "menhir", "powitanie", "sluchaj"), false, "kamienie raz");
    assert.ok(offered(s, "hieronim", "powitanie", hNode));
    go(s, "hieronim", hNode);
    assert.equal(status(s, "pamiec_kamieni"), "done");
  }
});

test("Wrak Maszyny: cichy test z ponawianiem albo siła (zmęczenie i hałas); Brygida bierze rdzeń", () => {
  const s = start(READY);
  go(s, "brygida", "q4_start");
  assert.ok(isKnown(s, data, "wrak_maszyny"));
  const fail = chooseOption(s, data, "panel_wraku", "wyjmij", "w_cicho", { int: () => 100 });
  assert.equal(fail.next, "iskry");
  const again = nodeView(s, data, "panel_wraku", "wyjmij").options.find((o) => o.key === "w_cicho");
  assert.equal(again.disabled, false, "nieudana próba nie blokuje kolejnej");
  go(s, "panel_wraku", "wyjety");
  assert.equal(count(s, "rdzen_maszyny"), 1);
  go(s, "brygida", "q4_koniec");
  assert.equal(status(s, "wrak_maszyny"), "done");
  const forced = start(READY);
  go(forced, "brygida", "q4_start");
  go(forced, "panel_wraku", "sila");
  assert.equal(count(forced, "rdzen_maszyny"), 1);
  assert.equal(forced.world.search, 5);
  assert.ok(forced.character.effects.some((e) => e.id === "zmeczenie"));
  assert.equal(offered(forced, "panel_wraku", "powitanie", "wyjmij"), false, "rdzeń raz");
});

test("Mgła Ciszy: zwiadowca we mgle, wyprowadzenie, raport u Hieronima", () => {
  const s = start(READY);
  go(s, "hieronim", "q5_start");
  assert.ok(isKnown(s, data, "zapadlisko_ciszy"));
  go(s, "zaginiony_zwiadowca", "znaleziony");
  assert.equal(s.flags.zwiadowca_znaleziony, true);
  go(s, "zaginiony_zwiadowca", "wyprowadzony");
  assert.equal(status(s, "mgla_ciszy"), "active", "jeszcze raport");
  go(s, "hieronim", "q5_koniec");
  assert.equal(status(s, "mgla_ciszy"), "done");
});

test("odkrycie wszystkich lokacji pierwszej połowy IIIb w dowolnej kolejności zleceń", () => {
  const s = start(READY);
  s.flags.hieronim_przyjal = true;
  go(s, "hieronim", "p3");
  go(s, "hieronim", "q5_start");
  go(s, "brygida", "q4_start");
  go(s, "hieronim", "q2_start");
  for (const id of ["pole_szkla", "menhiry", "krater_gwiazdy", "wrak_maszyny", "zapadlisko_ciszy"]) assert.ok(isKnown(s, data, id), id);
});
