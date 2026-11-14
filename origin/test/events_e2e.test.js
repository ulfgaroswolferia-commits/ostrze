import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { validateData } from "../src/engine/data.js";
import { rollStageEvent, startTravel } from "../src/systems/travel.js";
import { startQuest, advanceErrands } from "../src/systems/quests.js";
import { runActions } from "../src/systems/actions.js";
import { isKnown } from "../src/systems/places.js";
import { countOf } from "../src/systems/inventory.js";

const data = minimalData();
const REGIONS = ["pogorze", "glusz", "gwiazdy"];
/** Region an event is restricted to (null = every region). */
const regionOf = (e) => {
  const cond = e.if;
  if (!cond) return null;
  if (cond.region) return cond.region;
  return (cond.all ?? []).find((c) => c.region)?.region ?? null;
};
const inRegion = (e, region) => e.weight > 0 && (regionOf(e) === null || regionOf(e) === region);
const dialogueOf = (id) => data.dialogues.find((d) => d.id === id);
const sceneTypes = (e) => (e.scenes ?? []).map((s) => s.type);
const actionsOf = (dialogue) => Object.values(dialogue.nodes).flatMap((n) => [...(n.actions ?? []), ...(n.options ?? []).flatMap((o) => o.actions ?? [])]);

test("zdarzenia: ponad 42 w grze, dane przechodzą walidację", () => {
  assert.ok(data.travel.events.length >= 42, `jest ${data.travel.events.length}`);
  assert.deepEqual(validateData(data), []);
});

test("zdarzenia: każdy region ma ≥ 12 dostępnych, ≥ 3 ataki, ≥ 3 znaleziska, ≥ 2 spotkania z kimś, ≥ 1 zlecenie, ≥ 1 sytuację moralną", () => {
  for (const region of REGIONS) {
    const own = data.travel.events.filter((e) => regionOf(e) === region);
    const all = data.travel.events.filter((e) => inRegion(e, region));
    assert.ok(all.length >= 12, `${region}: ${all.length} dostępnych`);
    assert.ok(own.filter((e) => e.kind === "attack").length >= 3, `${region}: ataki`);
    const finds = own.filter((e) => (e.scenes ?? []).some((s) => s.type === "dialogue" && actionsOf(dialogueOf(s.dialogue)).some((a) => a.giveRandom)));
    assert.ok(finds.length >= 3, `${region}: znaleziska ${finds.length}`);
    const people = own.filter((e) => e.kind === "encounter" && (sceneTypes(e).includes("shop") || (e.id.startsWith("spotkanie_"))));
    assert.ok(people.length >= 2, `${region}: spotkania z kimś ${people.length}`);
    const quests = own.filter((e) => (e.scenes ?? []).some((s) => s.type === "dialogue" && actionsOf(dialogueOf(s.dialogue)).some((a) => a.startQuest)));
    assert.ok(quests.length >= 2, `${region}: zlecenia z drogi ${quests.length}`);
    const moral = own.filter((e) => (e.scenes ?? []).some((s) => s.type === "dialogue" && actionsOf(dialogueOf(s.dialogue)).some((a) => a.addVar)));
    assert.ok(moral.length >= 1, `${region}: sytuacja moralna`);
  }
});

test("zdarzenia: każdy atak ma walkę z ucieczką, a handlarze mają towar i sklep w danych", () => {
  for (const e of data.travel.events.filter((x) => x.kind === "attack")) {
    const fights = (e.scenes ?? []).filter((s) => s.type === "combat");
    assert.ok(fights.length >= 1, `${e.id}: brak walki`);
    for (const f of fights) assert.ok(f.canFlee === true && f.onFlee && e.scenes.some((s) => s.id === f.onFlee), `${e.id}: walka bez ucieczki`);
  }
  for (const e of data.travel.events) for (const s of (e.scenes ?? []).filter((x) => x.type === "shop")) {
    const shop = data.shops.find((x) => x.id === s.shop);
    assert.ok(shop && (!s.shop.startsWith("wedrowny_") || shop.stock.length >= 8), `${e.id}: sklep ${s.shop}`);
  }
});

test("zdarzenia: trzydniowa podróż trasą hub–hub ma średnio ≥ 1,5 zdarzenia (200 podróży)", () => {
  for (const [route, from] of [["wilczy_brod_gluszec", "wilczy_brod"], ["gluszec_obserwatorium", "gluszec"], ["brzezina_wilczy_brod", "brzezina"]]) {
    let total = 0;
    const days = data.travel.routes.find((r) => r.id === route).days;
    for (let seed = 1; seed <= 200; seed++) {
      const state = createNewState({ seed, startScene: "a", rules: data.rules });
      const cs = combatState(data, "miecz");
      state.character = cs.character; state.inventory = cs.inventory;
      state.world.location = from;
      startTravel(state, data, route);
      const noFixed = structuredClone(data);
      for (const r of noFixed.travel.routes) r.fixed = {};
      const rng = createRng(seed);
      for (let day = 1; day <= days; day++) {
        state.world.travel.day = day;
        if (rollStageEvent(state, noFixed, rng)) total++;
      }
    }
    assert.ok(total / 200 >= (days >= 3 ? 1.5 : 1.0), `${route}: średnio ${(total / 200).toFixed(2)}`);
  }
});

const ROAD_QUESTS = [
  ["paczka_dla_mlynarki", "paczka_kupca", "stary_mlyn.mlynarka"],
  ["list_od_gonca", "list_gonca", "wilczy_las.stary_dab"],
  ["ostatni_list_zolnierza", "list_zolnierza", "kapliczka_rozstaje.grob_zolnierza"],
  ["kobialka_dla_zielarki", "kobialka_ziol", "bagna_szarej_wody.szalas_zielarki"],
  ["notatnik_ucznia", "notatnik_ucznia", "obserwatorium.skrzynka_uczniow"],
  ["odlamki_dla_zbieracza", "sakiewka_odlamkow", "pole_szkla.zbieracz_odlamkow"],
];
for (const [questId, token, place] of ROAD_QUESTS) {
  test(`zlecenie z drogi „${questId}”: przyjęcie daje przedmiot i ujawnia miejsce, dostawa kończy zlecenie z nagrodą`, () => {
    const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
    const cs = combatState(data, "miecz");
    state.character = cs.character; state.inventory = cs.inventory;
    const quest = data.quests.find((q) => q.id === questId);
    assert.ok(quest && quest.kind === "errand", questId);
    assert.ok(isKnown(state, data, place) === false, "miejsce dostawy jest ukryte przed przyjęciem zlecenia");
    startQuest(state, data, questId);
    assert.equal(state.quests[questId].status, "active");
    assert.equal(countOf(state, token), 1, "przedmiot do dostarczenia");
    assert.ok(isKnown(state, data, place), "przyjęcie ujawnia miejsce dostawy");
    // delivery: the target's dialogue takes the token and sets the flag the objective waits for
    const spot = data.travel.locations.find((l) => l.id === place.split(".")[0]).spots.find((s) => s.id === place.split(".")[1]);
    const delivery = dialogueOf(spot.scenes.find((s) => s.type === "dialogue").dialogue);
    const give = Object.values(delivery.nodes).find((n) => (n.actions ?? []).some((a) => a.takeItem));
    runActions(state, data, give.actions, createRng(1));
    advanceErrands(state, data, createRng(1));
    assert.equal(state.quests[questId].status, "done");
    assert.equal(countOf(state, token), 0);
  });
}

test("zdarzenia: zlecenia z drogi startują tylko dopóki ich nie podjęto (nie powtarzają się po przyjęciu)", () => {
  for (const [questId] of ROAD_QUESTS) {
    const events = data.travel.events.filter((e) => (e.scenes ?? []).some((s) => s.type === "dialogue" && actionsOf(dialogueOf(s.dialogue)).some((a) => a.startQuest === questId)));
    assert.ok(events.length === 1, `${questId}: zdarzeń ${events.length}`);
    assert.ok(JSON.stringify(events[0].if).includes(questId), `${questId}: brak warunku questStatus`);
  }
});
