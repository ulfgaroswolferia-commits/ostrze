import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countOf, equippedCount, freeCount, addItem, removeItem, equip, unequip, swapWeapons,
  quickCapacity, assignQuick, unassignQuick, carriedWeight, canAdd, isOverloaded, grantStartKit, useConsumable,
} from "../src/systems/inventory.js";
import { slotAccepts } from "../src/systems/items.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { getStats } from "../src/systems/stats.js";
import { renderCharacter } from "../src/ui/character_screen.js";
import { minimalData } from "./helpers.js";

const data = minimalData();

function fresh(sila = 5) {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  s.character = {
    name: "T", classId: "miecz", level: 1, xp: 0, money: 0,
    attributes: { sila, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 5, oglada: 5, fart: 5 },
    skillPoints: {}, tagged: [], perks: [], pendingLevelUp: null, hp: 35,
  };
  return s;
}
/** Runs `fn`, asserts it failed with `reason` and left the state untouched. */
function fails(state, reason, fn) {
  const before = structuredClone(state);
  const r = fn();
  assert.deepEqual(r, { ok: false, reason });
  assert.deepEqual(state, before);
}

test("createNewState: pusty ekwipunek", () => {
  assert.deepEqual(fresh().inventory, { items: [], equipped: {}, quickSlots: [], loaded: {} });
});
test("stosy: addItem ×2 łączy w jeden wpis; nieznany id rzuca", () => {
  const s = fresh();
  addItem(s, data, "opatrunek", 1); addItem(s, data, "opatrunek", 1);
  assert.deepEqual(s.inventory.items, [{ id: "opatrunek", qty: 2 }]);
  assert.equal(countOf(s, "opatrunek"), 2);
  assert.throws(() => addItem(s, data, "nie_ma", 1));
});
test("equip: jedna sztuka nie idzie do dwóch slotów, dwie tak", () => {
  const s = fresh(); addItem(s, data, "miecz_krotki", 1);
  assert.deepEqual(equip(s, data, "miecz_krotki", "bron_zapas"), { ok: true, trimmed: [] }); // spare slot first: same-kind rule only guards it against the hand
  fails(s, "inv.noFreeCopy", () => equip(s, data, "miecz_krotki", "bron"));
  addItem(s, data, "miecz_krotki", 1);
  assert.equal(equip(s, data, "miecz_krotki", "bron").ok, true);
  assert.equal(equippedCount(s, "miecz_krotki"), 2);
  assert.equal(freeCount(s, "miecz_krotki"), 0);
});
test("equip: zły slot i nieposiadany", () => {
  const s = fresh(); addItem(s, data, "kaptur_mysliwego", 1);
  fails(s, "inv.wrongSlot", () => equip(s, data, "kaptur_mysliwego", "tulow"));
  fails(s, "inv.notOwned", () => equip(s, data, "miecz_krotki", "bron"));
});
test("equip: zajęty slot jest nadpisywany", () => {
  const s = fresh(); addItem(s, data, "kaftan_przeszywany", 1); addItem(s, data, "kolczuga", 1);
  equip(s, data, "kaftan_przeszywany", "tulow"); equip(s, data, "kolczuga", "tulow");
  assert.equal(s.inventory.equipped.tulow, "kolczuga");
  assert.equal(freeCount(s, "kaftan_przeszywany"), 1);
});
test("removeItem: założona sztuka notFree, po zdjęciu stos znika", () => {
  const s = fresh(); addItem(s, data, "miecz_krotki", 1); equip(s, data, "miecz_krotki", "bron");
  fails(s, "inv.notFree", () => removeItem(s, data, "miecz_krotki", 1));
  unequip(s, data, "bron");
  assert.deepEqual(removeItem(s, data, "miecz_krotki", 1), { ok: true });
  assert.deepEqual(s.inventory.items, []);
});
test("unequip: pusty slot", () => {
  const s = fresh();
  fails(s, "inv.emptySlot", () => unequip(s, data, "bron"));
});
test("swapWeapons: pusty zapas", () => {
  const s = fresh(); addItem(s, data, "miecz_krotki", 1); equip(s, data, "miecz_krotki", "bron");
  assert.deepEqual(swapWeapons(s), { ok: true });
  assert.deepEqual(s.inventory.equipped, { bron_zapas: "miecz_krotki" });
  swapWeapons(s);
  assert.deepEqual(s.inventory.equipped, { bron: "miecz_krotki" });
});
function belted() {
  const s = fresh();
  addItem(s, data, "pas_zwykly", 1); addItem(s, data, "pas_ladownice", 1);
  addItem(s, data, "opatrunek", 1); addItem(s, data, "napar_ziol", 1); addItem(s, data, "garniec_wapno", 1);
  addItem(s, data, "miecz_krotki", 1);
  return s;
}
test("pas: pojemność, beltFull, notQuickType, notOwned, alreadyQuick, notQuick", () => {
  const s = belted();
  assert.equal(quickCapacity(s, data), 0);
  fails(s, "inv.beltFull", () => assignQuick(s, data, "opatrunek"));
  equip(s, data, "pas_zwykly", "pas");
  assert.equal(quickCapacity(s, data), 2);
  assert.deepEqual(assignQuick(s, data, "opatrunek"), { ok: true });
  fails(s, "inv.alreadyQuick", () => assignQuick(s, data, "opatrunek"));
  assignQuick(s, data, "napar_ziol");
  fails(s, "inv.beltFull", () => assignQuick(s, data, "garniec_wapno"));
  fails(s, "inv.notQuickType", () => assignQuick(s, data, "miecz_krotki"));
  fails(s, "inv.notOwned", () => assignQuick(s, data, "swieca_dymna"));
  fails(s, "inv.notQuick", () => unassignQuick(s, "garniec_wapno"));
  assert.deepEqual(unassignQuick(s, "napar_ziol"), { ok: true });
  assert.deepEqual(s.inventory.quickSlots, ["opatrunek"]);
});
test("pas: zmiana na mniejszy przycina ostatni, zdjęcie czyści", () => {
  const s = belted();
  equip(s, data, "pas_ladownice", "pas");
  for (const id of ["opatrunek", "napar_ziol", "garniec_wapno"]) assignQuick(s, data, id);
  const r = equip(s, data, "pas_zwykly", "pas");
  assert.deepEqual(r, { ok: true, trimmed: ["garniec_wapno"] });
  assert.deepEqual(s.inventory.quickSlots, ["opatrunek", "napar_ziol"]);
  const u = unequip(s, data, "pas");
  assert.deepEqual(u, { ok: true, trimmed: ["opatrunek", "napar_ziol"] });
  assert.deepEqual(s.inventory.quickSlots, []);
});
test("zużycie ostatniego opatrunku zdejmuje go z pasa", () => {
  const s = belted(); equip(s, data, "pas_zwykly", "pas"); assignQuick(s, data, "opatrunek");
  removeItem(s, data, "opatrunek", 1);
  assert.deepEqual(s.inventory.quickSlots, []);
  assert.equal(countOf(s, "opatrunek"), 0);
});
test("waga zestawu miecza = 8.7 kg (z 2 prowiantami)", () => {
  const s = fresh(); grantStartKit(s, data, "miecz");
  assert.ok(Math.abs(carriedWeight(s, data) - 8.7) < 1e-9);
});
test("canAdd: limit 150% udźwigu", () => {
  const s = fresh(); // carry 75
  assert.equal(getStats(s, data).derived.carry, 75);
  addItem(s, data, "strzala", 1);
  const w = (kg) => { s.inventory.items = [{ id: "strzala", qty: kg / 0.05 }]; };
  w(105); assert.equal(canAdd(s, data, "kolczuga", 1), false);
  w(100); assert.equal(canAdd(s, data, "kolczuga", 1), true);
  w(70); assert.equal(isOverloaded(s, data), false);
  w(80); assert.equal(isOverloaded(s, data), true);
});
test("unequip: hp obcięte do nowego hpMax", () => {
  const d = { ...data, items: [...data.items, { id: "test_kaptur", name: "T", type: "armor", slot: "glowa", weight: 0, modifiers: { hpMax: 10 } }] };
  const s = fresh(); addItem(s, d, "test_kaptur", 1); equip(s, d, "test_kaptur", "glowa");
  s.character.hp = getStats(s, d).derived.hpMax;
  const max = s.character.hp;
  unequip(s, d, "glowa");
  assert.equal(s.character.hp, max - 10);
});
test("grantStartKit: włócznia", () => {
  const s = fresh(); grantStartKit(s, data, "wlocznia");
  assert.equal(s.inventory.equipped.bron, "para_wloczni");
  assert.equal(s.character.money, 30);
  assert.deepEqual(s.inventory.quickSlots, ["opatrunek"]);
  assert.equal(countOf(s, "opatrunek"), 2);
});
test("karta postaci: linia wagi", () => {
  const s = fresh(); grantStartKit(s, data, "miecz");
  assert.match(renderCharacter(s, data), /Waga: 8\.7\/\d+ kg/);
});

// --- useConsumable ---
test("useConsumable: opatrunek leczy, przesuwa czas o 10 min, zużywa sztukę", () => {
  const s = fresh(); s.character.hp = 10; s.character.skillPoints.medycyna = 5;
  addItem(s, data, "opatrunek", 2);
  const skill = getStats(s, data).skills.medycyna;
  const r = createRng(7).int(3, 6);
  const t0 = s.time.minutes;
  const res = useConsumable(s, data, "opatrunek", createRng(7));
  assert.equal(res.ok, true);
  assert.equal(res.healed, Math.floor(r * (1 + skill / 100)));
  assert.ok(Array.isArray(res.events));
  assert.equal(s.character.hp, 10 + res.healed);
  assert.equal(s.time.minutes, t0 + 10);
  assert.equal(countOf(s, "opatrunek"), 1);
});
test("useConsumable: pełne HP – healed 0, sztuka zużyta; przypięta sztuka też schodzi", () => {
  const s = fresh(); addItem(s, data, "opatrunek", 1);
  s.inventory.quickSlots.push("opatrunek");
  const res = useConsumable(s, data, "opatrunek", createRng(7));
  assert.equal(res.healed, 0);
  assert.equal(s.character.hp, 35);
  assert.deepEqual(s.inventory.items, []);
  assert.deepEqual(s.inventory.quickSlots, []);
});
test("useConsumable: miecz notUsable, brak notOwned – bez zmian stanu", () => {
  const s = fresh(); addItem(s, data, "miecz_krotki", 1);
  fails(s, "inv.notUsable", () => useConsumable(s, data, "miecz_krotki", createRng(1)));
  fails(s, "inv.notOwned", () => useConsumable(s, data, "opatrunek", createRng(1)));
});

test("ilości: addItem/removeItem rzucają przy ilości niedodatniej lub niecałkowitej", () => {
  const s = fresh();
  for (const bad of [0, -1, 1.5, NaN, "2", undefined]) {
    assert.throws(() => addItem(s, data, "opatrunek", bad), /ilo/i);
    assert.throws(() => removeItem(s, data, "opatrunek", bad), /ilo/i);
  }
  assert.deepEqual(s.inventory.items, []);
});
test("grantStartKit: nieudane założenie ze startEquipped to błąd danych", () => {
  const d = { ...data, classes: data.classes.map((c) => (c.id === "miecz" ? { ...c, startEquipped: { bron: "kaftan_przeszywany" } } : c)) };
  const s = fresh();
  assert.throws(() => grantStartKit(s, d, "miecz"), /kaftan_przeszywany/);
});

test("useConsumable: opatrunek zdejmuje krwawienie – zdarzenie efekt_koniec w effects", () => {
  const s = fresh(); addItem(s, data, "opatrunek", 1);
  s.character.effects = [{ id: "krwawienie", remaining: 5, stacks: 1 }];
  const res = useConsumable(s, data, "opatrunek", createRng(7));
  assert.deepEqual(res.effects, [{ type: "efekt_koniec", id: "krwawienie" }]);
  assert.equal(s.character.effects.some((e) => e.id === "krwawienie"), false);
});
test("useConsumable: opatrunek bez krwawienia – brak zdarzeń efektów", () => {
  const s = fresh(); addItem(s, data, "opatrunek", 1);
  assert.deepEqual(useConsumable(s, data, "opatrunek", createRng(7)).effects, []);
});
test("useConsumable: bimber nakłada podchmielenie, bez leczenia", () => {
  const s = fresh(); addItem(s, data, "bimber", 1);
  const res = useConsumable(s, data, "bimber", createRng(7));
  assert.equal(res.healed, 0);
  assert.ok(s.character.effects.some((e) => e.id === "podchmielenie"));
  assert.deepEqual(res.effects, [{ type: "efekt_nalozony", id: "podchmielenie" }]);
});

test("slotAccepts: sztylet w trzech slotach broni, miecz nie w drugiej ręce", () => {
  const it = (id) => data.items.find((i) => i.id === id);
  for (const slot of ["bron", "bron_zapas", "bron_druga"]) assert.equal(slotAccepts(it("sztylet"), slot), true);
  assert.equal(slotAccepts(it("miecz_krotki"), "bron_druga"), false);
  assert.equal(slotAccepts(it("miecz_krotki"), "bron"), true);
  assert.equal(slotAccepts(it("kaptur_mysliwego"), "bron_druga"), false);
});
test("equip: sztylet do drugiej ręki, miecz wrongSlot, dwie sztuki do bron+bron_druga", () => {
  const s = fresh(); addItem(s, data, "sztylet", 1); addItem(s, data, "miecz_krotki", 1);
  assert.equal(equip(s, data, "sztylet", "bron_druga").ok, true);
  assert.equal(s.inventory.equipped.bron_druga, "sztylet");
  fails(s, "inv.wrongSlot", () => equip(s, data, "miecz_krotki", "bron_druga"));
  fails(s, "inv.noFreeCopy", () => equip(s, data, "sztylet", "bron"));
  addItem(s, data, "sztylet", 1);
  assert.equal(equip(s, data, "sztylet", "bron").ok, true);
  assert.equal(equippedCount(s, "sztylet"), 2);
});
test("swapWeapons zostawia bron_druga", () => {
  const s = fresh(); addItem(s, data, "sztylet", 1); addItem(s, data, "miecz_krotki", 1);
  equip(s, data, "sztylet", "bron_druga"); equip(s, data, "miecz_krotki", "bron");
  swapWeapons(s);
  assert.deepEqual(s.inventory.equipped, { bron_druga: "sztylet", bron_zapas: "miecz_krotki" });
});

test("para broni zajmuje obie ręce: nie da się dołożyć drugiej ręki, a założona para odkłada to, co w niej było", () => {
  const s = fresh();
  for (const id of ["para_wloczni", "sztylet", "miecz_krotki"]) addItem(s, data, id, 1);
  const eq = s.inventory.equipped;

  assert.equal(equip(s, data, "para_wloczni", "bron").ok, true);
  assert.deepEqual(equip(s, data, "sztylet", "bron_druga"), { ok: false, reason: "inv.pairHands" });
  assert.equal(eq.bron_druga, undefined);

  equip(s, data, "miecz_krotki", "bron");
  assert.equal(equip(s, data, "sztylet", "bron_druga").ok, true);
  const r = equip(s, data, "para_wloczni", "bron");
  assert.equal(r.freed, "sztylet");
  assert.equal(eq.bron_druga, undefined);
  assert.equal(countOf(s, "sztylet"), 1, "sztylet wraca do plecaka, nie znika");
});

test("para broni: wyciągnięta zza pleców też zwalnia drugą rękę, a schowana nie blokuje jej", () => {
  const s = fresh();
  for (const id of ["para_wloczni", "sztylet", "miecz_krotki"]) addItem(s, data, id, 1);
  const eq = s.inventory.equipped;
  equip(s, data, "miecz_krotki", "bron");
  equip(s, data, "para_wloczni", "bron_zapas");
  assert.equal(equip(s, data, "sztylet", "bron_druga").ok, true, "para na plecach nie zajmuje rąk");

  swapWeapons(s, data);
  assert.equal(eq.bron, "para_wloczni");
  assert.equal(eq.bron_druga, undefined);
});
