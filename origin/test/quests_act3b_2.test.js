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
const READY = { hieronim_przyjal: true, brygida_poznana: true, hieronim_potwierdzil: true };

function start(flags = {}, extra = {}) {
  const state = createNewState({ seed: 1, startScene: "akt3b_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 40;
  state.world.location = "obserwatorium";
  Object.assign(state.flags, READY, flags);
  Object.assign(state.world, extra.world ?? {});
  return state;
}
const go = (state, d, n) => { enterNode(state, data, d, n, fixed); advanceErrands(state, data, fixed); };
const status = (state, id) => state.quests[id]?.status ?? "none";
const offered = (state, d, node, key) => nodeView(state, data, d, node).options.some((o) => o.key === key && !o.disabled);
const done = (state, ...ids) => { for (const id of ids) state.quests[id] = { status: "done" }; };

test("dane zleceń 6–10 i finału przechodzą walidację", () => assert.deepEqual(validateData(data), []));

test("Cesarski dezerter: pomoc, papiery od kowala, wydanie i zostawienie – każde zamyka zlecenie i zmienia stan", () => {
  for (const [node, check] of [
    ["q6_pomoc", (s) => { assert.equal(s.flags.sojusz_dezerter, true); assert.equal(s.world.search, 15); }],
    ["q6_papiery", (s) => { assert.equal(s.flags.sojusz_dezerter, true); assert.equal(s.world.search, 10); }],
    ["q6_wydaj", (s, money) => { assert.equal(s.flags.dezerter_wydany, true); assert.equal(s.character.money, money + 30); assert.equal(s.flags.sojusz_dezerter, undefined); }],
    ["q6_zostan", (s) => { assert.equal(s.flags.sojusz_dezerter, undefined); assert.equal(s.flags.dezerter_wydany, undefined); }],
  ]) {
    const s = start({ papiery_falszywe: true }, { world: { search: 20 } });
    assert.ok(offered(s, "tomasz", "powitanie", "q6_start"));
    go(s, "tomasz", "q6_start");
    assert.equal(status(s, "cesarski_dezerter"), "active");
    const money = s.character.money;
    go(s, "tomasz", node);
    assert.equal(status(s, "cesarski_dezerter"), "done", node);
    check(s, money);
  }
  assert.equal(offered(start({}), "tomasz", "q6_start", "papiery"), false, "bez papierów z Głuszca nie ma opcji z papierami");
  const w = start({ dezerter_rozstrzygniete: true, dezerter_wydany: true });
  assert.ok(offered(w, "tomasz", "powitanie", "po_wydany"));
  assert.ok(offered(w, "hieronim", "powitanie", "dezerter_po_wydany"));
  assert.equal(offered(w, "hieronim", "powitanie", "dezerter_po"), false, "po wydaniu Hieronim nie pyta, jak Tomasz się trzyma");
});

test("Dług Istoty: trzy decyzje (uznanie, pamięć o długu, odmowa) zmieniają dlug/wola i zamykają zlecenie", () => {
  for (const [node, varName, delta, flags] of [["dlug_przyjety", "dlug", 2, {}], ["dlug_pamietam", "dlug", 3, { dlug_istoty: true }], ["dlug_odrzucony", "wola", 2, {}]]) {
    const s = start({ rdzen_oddany: true, ...flags });
    assert.ok(offered(s, "brygida", "powitanie", "rdzen_slucham"));
    go(s, "brygida", "rdzen_slucham");
    go(s, "brygida", "istota_rdzen");
    assert.equal(offered(s, "brygida", "istota_rdzen", "pamietam"), Boolean(flags.dlug_istoty), "opcja pamięci tylko ze starą pamięcią");
    go(s, "brygida", node);
    assert.equal(s.vars[varName], delta, node);
    assert.equal(status(s, "dlug_istoty_zlecenie"), "done", node);
    assert.ok(offered(s, "hieronim", "powitanie", "dlug_po"));
    assert.ok(offered(s, "brygida", "powitanie", node === "dlug_odrzucony" ? "rdzen_po_b" : "rdzen_po_a"));
  }
  assert.equal(offered(start({}), "brygida", "powitanie", "rdzen_slucham"), false, "najpierw rdzeń musi trafić do Brygidy");
});

test("Wieści z Głuszca: dwa warianty zależne od obławy; wysłanie pieniędzy daje sojusz wędrowców; odmowa też zamyka", () => {
  const calm = start({});
  assert.ok(offered(calm, "hieronim", "powitanie", "q8_b") && !offered(calm, "hieronim", "powitanie", "q8_a"));
  const raid = start({ oblawa_ucieczka: true });
  assert.ok(offered(raid, "hieronim", "powitanie", "q8_a") && !offered(raid, "hieronim", "powitanie", "q8_b"));
  for (const [s, entry] of [[calm, "q8_b"], [raid, "q8_a"]]) {
    go(s, "hieronim", entry);
    const money = s.character.money;
    go(s, "hieronim", "q8_wyslij");
    assert.equal(s.character.money, money - 20);
    assert.equal(s.flags.sojusz_wedrowcy, true);
    assert.equal(status(s, "wiesci_z_gluszca"), "done");
  }
  const no = start({});
  go(no, "hieronim", "q8_b");
  go(no, "hieronim", "q8_nie");
  assert.equal(no.flags.sojusz_wedrowcy, undefined);
  assert.equal(status(no, "wiesci_z_gluszca"), "done");
  assert.ok(offered(no, "hieronim", "powitanie", "glusz_po"));
  const poor = start({});
  poor.character.money = 5;
  assert.equal(offered(poor, "hieronim", "q8_b", "wyslij"), false);
  assert.equal(offered(poor, "hieronim", "q8_b", "nie"), true, "bez pieniędzy zostaje odmowa");
});

test("Ostatnia Strażnica: namowa z ponawianiem, prowiant i pamięć o Wojmirze dają sojusz; odmowa nie blokuje raportu", () => {
  const s = start({});
  go(s, "hieronim", "q9_start");
  assert.ok(isKnown(s, data, "ostatnia_strazica"));
  const bad = chooseOption(s, data, "stary_zolnierz", "namow_test", "namow_t", { int: () => 100 });
  assert.equal(bad.next, "odmowa");
  go(s, "stary_zolnierz", "odmowa");
  assert.equal(nodeView(s, data, "stary_zolnierz", "namow_test").options.find((o) => o.key === "namow_t").disabled, false, "można ponowić");
  go(s, "hieronim", "q9_nie");
  assert.equal(status(s, "ostatnia_strazica_zlecenie"), "done", "odmowa nie blokuje zlecenia");
  assert.equal(s.flags.sojusz_straznicy, undefined);
  for (const [node, flags, items] of [["sojusz", {}, []], ["prowiant", {}, [{ id: "prowiant", qty: 2 }]], ["zaufanie", { towarzysze_zaufanie: true }, []]]) {
    const t = start(flags);
    t.inventory.items.push(...items);
    go(t, "hieronim", "q9_start");
    go(t, "stary_zolnierz", node);
    assert.equal(t.flags.sojusz_straznicy, true, node);
    go(t, "hieronim", "q9_po");
    assert.equal(status(t, "ostatnia_strazica_zlecenie"), "done", node);
  }
  assert.equal(offered(start({}), "stary_zolnierz", "powitanie", "zaufanie"), false);
  assert.equal(offered(start({ towarzysze_zaufanie: true }), "stary_zolnierz", "powitanie", "zaufanie"), false, "tylko przy aktywnym zleceniu");
});

test("Przygotowania: wymagają długu Istoty i strażnicy; Brygida, potem Hieronim; kończą odsłonę flagą akt3b_koniec", () => {
  const early = start({});
  assert.equal(offered(early, "hieronim", "powitanie", "q10_start"), false);
  const ok = start({ hieronim_straznica_ok: true });
  done(ok, "dlug_istoty_zlecenie");
  assert.ok(offered(ok, "hieronim", "powitanie", "q10_start"));
  go(ok, "hieronim", "q10_start");
  assert.equal(offered(ok, "hieronim", "powitanie", "q10_ostatnie"), false, "najpierw Brygida");
  go(ok, "brygida", "q10_brygida");
  assert.ok(offered(ok, "hieronim", "powitanie", "q10_ostatnie"));
  go(ok, "hieronim", "q10_tak");
  assert.equal(ok.flags.sojusz_astrolog, true);
  assert.equal(status(ok, "przygotowania"), "done");
  assert.equal(ok.flags.akt3b_koniec, true);
  const alone = start({ hieronim_straznica_ok: true });
  done(alone, "dlug_istoty_zlecenie");
  go(alone, "hieronim", "q10_start");
  go(alone, "brygida", "q10_brygida");
  go(alone, "hieronim", "q10_nie");
  assert.equal(alone.flags.sojusz_astrolog, undefined);
  assert.equal(alone.flags.akt3b_koniec, true);
});

test("opór jest osiągalny: wola ≥ 2 dają odmowa kamieniom, odmowa Istocie i inne wybory; uległość i ucieczka zawsze", () => {
  const s = start({ rdzen_oddany: true });
  go(s, "hieronim", "q3_start");
  go(s, "menhir", "odrzucil");
  assert.equal(s.vars.wola, 1);
  go(s, "brygida", "rdzen_slucham");
  go(s, "brygida", "dlug_odrzucony");
  assert.ok(s.vars.wola >= 2);
});
