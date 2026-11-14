import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { combatState } from "./helpers.js";
import { nodeView, enterNode } from "../src/systems/dialogue.js";

const data = await loadData();
const fixed = { int: () => 1 };
function start(flags = {}, items = []) {
  const state = createNewState({ seed: 1, startScene: "demo_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  Object.assign(state.flags, flags);
  for (const id of items) state.inventory.items.push({ id, qty: 1 });
  return state;
}
const keys = (state, dialogue, node) => nodeView(state, data, dialogue, node).options.filter((o) => !o.disabled).map((o) => o.key);

test("młynarz: po znalezieniu szkła nie odsyła już do młyna, a reaguje na odłamek i na kamień od kowala", () => {
  const before = keys(start(), "ostap", "mlyn");
  assert.ok(before.includes("dlaczego") && !before.includes("odlamek"));
  const found = keys(start({ odlamek_zebrany: true }), "ostap", "mlyn");
  assert.ok(!found.includes("dlaczego"), "nie zachęca do szukania tego, co gracz już znalazł");
  assert.ok(found.includes("odlamek") && !found.includes("kamien"));
  const stone = keys(start({ odlamek_zebrany: true, ostap_odlamek: true, kamien_rozpoznany: true }), "ostap", "mlyn");
  assert.ok(stone.includes("kamien") && stone.includes("swiatlo_po"));
  const s = start({ odlamek_zebrany: true });
  enterNode(s, data, "ostap", "odlamek_o", fixed);
  assert.equal(s.flags.ostap_odlamek, true);
  assert.ok(keys(s, "ostap", "mlyn").every((k) => k !== "odlamek"), "reaguje raz");
});

test("kowal: odłamek bez zlecenia zostaje u gracza, a po rozpoznaniu kowal ma co powiedzieć", () => {
  const s = start({}, ["odlamek_szkla"]);
  assert.ok(keys(s, "kowal", "kuznia").includes("odlamek_pokaz"));
  enterNode(s, data, "kowal", "odlamek_pokaz", fixed);
  assert.equal(s.flags.kamien_rozpoznany, true);
  assert.ok(s.inventory.items.some((i) => i.id === "odlamek_szkla"), "odłamek nie znika bez zlecenia");
  const after = keys(s, "kowal", "kuznia");
  assert.ok(after.includes("kamien_po") && !after.includes("odlamek_pokaz"));
});

test("zwiadowcy: po podsłuchu nie da się podsłuchiwać w kółko; zawsze jest wyjście", () => {
  const heard = keys(start({ zwiadowcy_slysza: true }), "zwiadowcy", "obozowisko");
  assert.deepEqual(heard, ["juz", "odejdz"]);
  assert.ok(keys(start(), "zwiadowcy", "obozowisko").includes("skradanie"));
});

test("córka i karczmarz reagują na to, co się stało (amulet oddany/zatrzymany, Borek wrócił)", () => {
  assert.ok(keys(start({ amulet_oddany: true }), "corka", "corka").includes("po_oddany"));
  assert.ok(keys(start({ amulet_pasuje: true, amulet_zatrzymany: true }), "corka", "corka").includes("po_zatrzymany"));
  const w = start({ zona_poinformowana: true });
  assert.ok(keys(w, "wrzosek", "powitanie").includes("borek_wrocil"));
  enterNode(w, data, "wrzosek", "borek_wrocil", fixed);
  assert.ok(!keys(w, "wrzosek", "powitanie").includes("borek_wrocil"));
});
