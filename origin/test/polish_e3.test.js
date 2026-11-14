import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { combatState } from "./helpers.js";
import { enterNode, nodeView } from "../src/systems/dialogue.js";
import { isKnown } from "../src/systems/places.js";

const data = await loadData();
const fixed = { int: () => 1 };
function start(flags = {}) {
  const state = createNewState({ seed: 1, startScene: "akt3b_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.world.location = "obserwatorium";
  Object.assign(state.flags, flags);
  return state;
}
const offered = (s, d, n, key) => nodeView(s, data, d, n).options.some((o) => o.key === key && !o.disabled);

test("stany „w toku”: Hieronim i Brygida przypominają o aktywnych zleceniach, Tomasz reaguje na decyzję", () => {
  const s = start();
  assert.equal(offered(s, "hieronim", "powitanie", "w_toku"), false);
  s.quests.pamiec_kamieni = { status: "active", done: [] };
  assert.equal(offered(s, "hieronim", "powitanie", "w_toku"), true);
  assert.equal(offered(s, "brygida", "powitanie", "w_toku"), false);
  s.quests.wrak_maszyny = { status: "active", done: [] };
  assert.equal(offered(s, "brygida", "powitanie", "w_toku"), true);
  assert.equal(offered(start({ sojusz_dezerter: true }), "tomasz", "powitanie", "po_pomoc"), true);
  assert.equal(offered(start({ dezerter_rozstrzygniete: true }), "tomasz", "powitanie", "po_zostan"), true);
  assert.equal(offered(start({ dezerter_rozstrzygniete: true, dezerter_wydany: true }), "tomasz", "powitanie", "po_zostan"), false);
});

test("daleka lokacja odsłania też sąsiada, przez którego się do niej idzie (Strażnica–Krater, Wrak/Zapadlisko–Menhiry)", () => {
  const a = start({ hieronim_potwierdzil: true });
  enterNode(a, data, "hieronim", "q9_start", fixed);
  assert.ok(isKnown(a, data, "ostatnia_strazica") && isKnown(a, data, "krater_gwiazdy"));
  const b = start({ hieronim_potwierdzil: true });
  enterNode(b, data, "hieronim", "q5_start", fixed);
  assert.ok(isKnown(b, data, "zapadlisko_ciszy") && isKnown(b, data, "menhiry"));
  const c = start({ brygida_poznana: true });
  enterNode(c, data, "brygida", "q4_start", fixed);
  assert.ok(isKnown(c, data, "wrak_maszyny") && isKnown(c, data, "menhiry"));
});
