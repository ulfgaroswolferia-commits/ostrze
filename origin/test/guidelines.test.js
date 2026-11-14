import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";

// Pilnuje reguł z docs/wytyczne-tresci-i-qa.md, które da się sprawdzić na prawdziwych danych.
const data = await loadData();

test("wytyczne 1.2: każda porażka testu w dialogu prowadzi do węzła z tekstem odprawy (≥100 znaków)", () => {
  for (const d of data.dialogues) {
    for (const [nid, node] of Object.entries(d.nodes)) {
      for (const o of node.options ?? []) {
        if (!o.check) continue;
        const target = d.nodes[o.failure];
        assert.ok(target, `${d.id}/${nid}/${o.id}: porażka kończy dialog bez riposty`);
        assert.ok(target.text.length >= 100, `${d.id}/${nid}/${o.id}: za krótka riposta`);
      }
    }
  }
});

test("wytyczne 1.4: każda lokacja ze spotami ma postać do pogadania (≥4 stany reakcji)", () => {
  for (const loc of data.travel.locations.filter((l) => (l.spots ?? []).length)) {
    const chatter = loc.spots.filter((s) => (s.scenes ?? []).length >= 4);
    assert.ok(chatter.length >= 1, `${loc.id}: brak postaci do pogadania`);
  }
});

test("wytyczne 5.7: rozmówcy z dialogami mają portret, a lokacje obraz", () => {
  for (const id of ["wrzosek", "kowal", "lesniczy", "zona_borka", "corka"]) {
    assert.ok(data.dialogues.find((d) => d.id === id)?.portrait, `${id}: brak portretu`);
  }
  for (const id of ["stary_mlyn", "trakt_kupiecki", "lesniczowka", "ruiny_straznicy"]) {
    assert.ok(data.travel.locations.find((l) => l.id === id)?.art, `${id}: brak obrazu lokacji`);
  }
});

test("interfejs: każdy typ przedmiotu ma nazwę w ui.json (bez „[[itemType.…]]” na karcie)", () => {
  for (const type of new Set(data.items.map((i) => i.type))) {
    assert.ok(data.ui[`itemType.${type}`], `brak itemType.${type}`);
  }
});

test("walka: gracz otwiera starcie w Wilczej Norze (nic nie dzieje się przed pierwszym ruchem); zasadzki są oznaczone", async () => {
  const { createCombat } = await import("../src/systems/combat/state.js");
  const { combatState } = await import("./helpers.js");
  const nora = data.quests.find((q) => q.id === "wilcza_nora").scenes.find((s) => s.type === "combat");
  assert.notEqual(nora.ambush, true);
  const state = combatState(data, "wlocznia");
  const wolf = (n) => ({ int: () => n });
  for (const roll of [1, 10]) assert.equal(createCombat(state, data, nora, wolf(roll)).order[0], "player");
  const events = data.travel.events.flatMap((e) => e.scenes ?? []).filter((s) => s.type === "combat" && ["bandyci_walka", "noc_walka"].includes(s.id));
  assert.ok(events.length && events.every((s) => s.ambush === true), "zasadzki na drodze zachowują inicjatywę");
});

test("akt III: każda rozmówca ma portret, każda lokacja okolicy Głuszca obraz, a nowi wrogowie własną grafikę", () => {
  const people = ["gajowy", "stach", "kopacz", "halina", "radosz", "soltys", "karczmarz_kogut", "znachorka", "kowal_gluszec", "dozorca", "ranny", "wdowa", "najemnik", "furman", "pielgrzym_falszywy", "kontrola"];
  for (const id of people) {
    const portrait = data.dialogues.find((d) => d.id === id)?.portrait;
    assert.ok(portrait && data.art[portrait], `${id}: brak portretu`);
  }
  for (const loc of data.travel.locations.filter((l) => l.region === "glusz")) assert.ok(loc.art && data.art[loc.art], `${loc.id}: brak obrazu`);
  for (const id of ["zwiadowca_cesarski", "klusownik"]) assert.equal(data.enemies.find((e) => e.id === id).art, id);
});

test("akt III B: rozmówcy z portretem, każda lokacja Szklanych Wzgórz z obrazem, ekran dialogu finału z portretem", () => {
  for (const id of ["hieronim", "brygida", "tomasz", "stary_zolnierz", "echo_istoty"]) {
    const portrait = data.dialogues.find((d) => d.id === id)?.portrait;
    assert.ok(portrait && data.art[portrait], `${id}: brak portretu`);
  }
  for (const loc of data.travel.locations.filter((l) => l.region === "gwiazdy")) assert.ok(loc.art && data.art[loc.art], `${loc.id}: brak obrazu`);
  assert.ok(data.art.obserwatorium, "obraz wejścia w akt IIIb");
});
