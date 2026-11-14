import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { minimalData, combatState } from "./helpers.js";
import { routeById, locationById, eventById } from "../src/systems/travel.js";
import { itemById } from "../src/systems/items.js";

const expectErr = (errs, msg) => assert.ok(errs.some((e) => e.includes(msg)), `brak: ${msg}\n${errs.join("\n")}`);
/** minimalData with `fn` applied to a copy of travel.json (and the whole data), then validated. */
const withTravel = (fn) => {
  const d = structuredClone(minimalData());
  fn(d.travel, d);
  return validateData(d);
};
const ev = (t, id) => t.events.find((e) => e.id === id);

// --- D2a: dane podróży ---

test("D2a: prawdziwe dane – trasa, zdarzenia, jedzenie, wilk, ulewa, reguły", async () => {
  const d = await loadData();
  assert.deepEqual(validateData(d), []);
  const r = routeById(d, "brzezina_wilczy_brod");
  assert.equal(r.days, 2);
  assert.equal(r.fixed["1"], "bandyci_na_trakcie");
  assert.equal(locationById(d, "wilczy_brod").name, "Strażnica Wilczy Bród");
  assert.deepEqual(d.travel.events.map((e) => e.id).sort(), ["bandyci_na_trakcie","blednik_w_szkle","cisza","dezerter_na_drodze","dym_nad_stocznia","dzieci_i_smola","dziecko_z_listem","dzik_na_sciezce","gapowicz_na_dziobie","glodna_wdowa","glodny_wedrowiec","grad_nadciaga","handlarz_z_lodzi","handlarz_z_zaulka","huk_dalekiej_armaty","jarnowscy_celnicy","jarnowscy_zwiadowcy","jeniec_pod_straza","kapliczka_ofiary","kieszonkowcy_w_tlumie","klusownicy_w_boru","kolejka_do_bramy","kontrola_zwiadowcow","kowal_bez_kuzni","kowal_z_mlotem","krzykliwy_herold","kupiec_ostromir","kupiec_wedrowny","martwy_zolnierz","marudery_na_drodze","metalowy_szkielet","mewy_nad_lodzia","mewy_nad_wrakiem","mgla_nad_woda","mgla_poranna_nadciaga","noc_upiorow","oporzadzenie_rusznikarza","patrol_lodzi","patrol_na_goscincu","patrol_nocny","patrol_pikinierow","patrol_u_krateru","patrol_zwiadowcow","pielgrzym","pijany_zolnierz","polegly_goniec","porzucony_wozek","prosba_buty_dla_wartownika","prosba_chleb_dla_grabarza","prosba_gwozdzie_dla_stoczni","prosba_kobialka_dla_zielarki","prosba_list_od_gonca","prosba_notatnik_ucznia","prosba_odlamki_dla_zbieracza","prosba_ostatni_list_zolnierza","prosba_paczka_dla_mlynarki","prosba_siodlo_dla_zwiadowcow","prosba_swiece_na_kapliczke","prosba_zwoj_dla_pustelnika","przymrozek_nadciaga","pusta_lodka","rabus_przy_brodzie","rabusie_z_zasadzki","rozbity_oboz","rybacy_przy_sieci","rybak_z_siatka","rzezimieszek_w_bramie","spotkanie_alchemik","spotkanie_bortnik","spotkanie_drwal","spotkanie_handlarz_ze_szlaku","spotkanie_jeniec","spotkanie_kantynier","spotkanie_kowal_wedrowny","spotkanie_pustelnik","stare_boje","stary_zeglarz","straznik_zablakany","strzelec_z_dachu","studnia_przy_targu","szabrownicy_na_plazy","szabrownicy_przy_drodze","szept_ze_szkla","szkielet_zwiadowcy","szklany_zagon","sztorm_na_horyzoncie","ulewa_nadciaga","upal_nadciaga","utopiec_w_rowie","wdowa_na_molo","weszyciel_na_rynku","wiatr_od_morza","wichura_nadciaga","wilki","wozek_zaopatrzenia","wozy_z_frontu","wozy_z_lodzi","zagubiona_skrzynia","zebrak_na_moscie","zmije_w_trawie","zwloki_kupca"].sort());
  assert.equal(eventById(d, "ulewa_nadciaga").phenomenon, "ulewa");
  assert.equal(eventById(d, "nie_ma"), undefined);
  assert.equal(d.phenomena.find((p) => p.id === "ulewa").world.travel, "slow");
  const wilk = d.enemies.find((e) => e.id === "wilk");
  assert.deepEqual(wilk.loot, [{ chance: 60, giveItem: "mieso" }]);
  assert.ok(wilk.xp <= 15);
  const glod = d.effects.find((e) => e.id === "glod");
  assert.equal(glod.noExpire, true);
  assert.equal(glod.restHealMultiplier, 0.5);
  assert.deepEqual(d.rules.travel, {
    startLocation: "brzezina", maxRouteDays: 4, departHour: 6, marchHours: 10, eventHourRange: [2, 8],
    eventChance: 55, dangerousEventChance: 60, localEventChance: 40, localDangerBonus: 20, dangerousAttackWeight: 2, slowMinHours: 2,
    repeat: { decay: 0.8, floorWalk: 15, floorStage: 15 }, crowd: { above: 5, perPlace: 3, max: 15 }, night: { periods: ["zmierzch", "noc"], eventBonus: 20, attackWeight: 3 }, walkSegmentMinutes: 120, walkMaxEvents: 3, huntCooldownDays: 3, maxNearMinutes: 480,
    forage: { minutes: 60, base: 30, perBystrosc: 6, max: 90, night: -20, slow: -10 },
  });
  for (const c of d.classes) assert.ok(c.startItems.some((i) => i.id === "prowiant" && i.qty === 3), c.id);
  assert.deepEqual(itemById(d, "grzyby").food, { order: 1, risk: { effect: "trucizna", chance: 15, safeTagged: "medycyna" } });
  assert.equal(itemById(d, "prowiant").food.order, 3);
  assert.equal(itemById(d, "ziola_lesne").food, undefined);
  assert.ok(d.shops.find((s) => s.id === "kupiec_drogi").stock.some((s) => s.id === "prowiant"));
  assert.ok(d.shops.find((s) => s.id === "kramarz_szkolny").stock.some((s) => s.id === "prowiant"));
});

test("D2a: walidacja travel.json – lokacje, trasy, regiony", () => {
  expectErr(withTravel((t) => { t.routes[0].from = "x"; }), 'travel.json › routes › brzezina_wilczy_brod › from: nieznana lokacja "x"');
  expectErr(withTravel((t) => { t.routes[0].to = t.routes[0].from; }), "travel.json › routes › brzezina_wilczy_brod › to: cel taki sam jak start");
  expectErr(withTravel((t) => { t.routes[0].region = "bagna"; }), 'travel.json › routes › brzezina_wilczy_brod › region: nieznany region "bagna"');
  expectErr(withTravel((t) => { t.routes[0].fixed = { 3: "cisza" }; }), "travel.json › routes › brzezina_wilczy_brod › fixed.3: dzień poza zakresem 1–2");
  expectErr(withTravel((t) => { t.routes[0].fixed = { 1: "smok" }; }), 'travel.json › routes › brzezina_wilczy_brod › fixed.1: nieznane zdarzenie "smok"');
  expectErr(withTravel((t) => { t.locations[0].region = "bagna"; }), 'travel.json › locations › brzezina › region: nieznany region "bagna"');
  expectErr(withTravel((t) => { t.regions.pogorze.forage[0].qty = [3, 1]; }), "travel.json › regions › pogorze › forage[0].qty: oczekiwano [min, max] liczb całkowitych, 1 ≤ min ≤ max");
  expectErr(withTravel((t) => { t.regions.pogorze.forage[0].item = "smok"; }), 'travel.json › regions › pogorze › forage[0].item: nieznany przedmiot "smok"');
  expectErr(withTravel((t) => { t.regions.pogorze.forage[0].weight = 0; }), "travel.json › regions › pogorze › forage[0].weight: wartość mniejsza niż 1");
  expectErr(withTravel((t) => { t.locations.push({ ...t.locations[0] }); }), "travel.json › locations › brzezina: zduplikowane id");
});

test("D2a: walidacja travel.json – zdarzenia i ich sceny", () => {
  expectErr(withTravel((t) => { ev(t, "ulewa_nadciaga").scenes = [{ id: "u1", type: "narration", text: "x" }]; }), "travel.json › events › ulewa_nadciaga: wymagane dokładnie jedno z scenes / phenomenon");
  expectErr(withTravel((t) => { delete ev(t, "cisza").scenes; }), "travel.json › events › cisza: wymagane dokładnie jedno z scenes / phenomenon");
  expectErr(withTravel((t) => { ev(t, "ulewa_nadciaga").phenomenon = "smok"; }), 'travel.json › events › ulewa_nadciaga › phenomenon: nieznane zjawisko "smok"');
  expectErr(withTravel((t) => { const e = ev(t, "cisza"); delete e.scenes; e.phenomenon = "ulewa"; }), "travel.json › events › cisza › phenomenon: dozwolone tylko dla kind weather");
  expectErr(withTravel((t) => { ev(t, "cisza").kind = "piknik"; }), "travel.json › events › cisza › kind: dozwolone wartości");
  expectErr(withTravel((t) => { ev(t, "cisza").weight = -1; }), "travel.json › events › cisza › weight: wartość mniejsza niż 0");
  expectErr(withTravel((t) => { ev(t, "cisza").scenes = []; }), "travel.json › events › cisza › scenes: pusta lista scen");
  const ciszaId = (t) => ev(t, "cisza").scenes[0].id;
  expectErr(withTravel((t) => { ev(t, "cisza").scenes[0].id = "a"; }), 'travel.json › events › cisza › a: id sceny "a" już zajęte');
  expectErr(withTravel((t) => { ev(t, "cisza").scenes.push({ id: "c_koniec", type: "ending", text: "x" }); }), "travel.json › events › cisza › c_koniec › type: scena niedozwolona w zdarzeniu");
  expectErr(withTravel((t) => { ev(t, "cisza").scenes[0].goto = "a"; }), (() => { const d = minimalData(); return `travel.json › events › cisza › ${ciszaId(d.travel)} › goto: nieznana scena "a"`; })());
  assert.deepEqual(withTravel((t) => { ev(t, "cisza").scenes[0].goto = "koniec"; }), []);
  expectErr(validateData(minimalData({ scenes: [{ id: "a", type: "narration", text: "x", goto: "koniec" }, { id: "b", type: "ending", text: "y" }] })), 'story.json › a › goto: nieznana scena "koniec"');
  expectErr(withTravel((t) => { ev(t, "cisza").if = { travelDay: {} }; }), "travel.json › events › cisza › if.travelDay: oczekiwano gte lub lte");
  expectErr(withTravel((t) => { ev(t, "cisza").if = { region: "bagna" }; }), 'travel.json › events › cisza › if.region: nieznany region "bagna"');
  expectErr(withTravel((t) => { ev(t, "cisza").if = { location: "rzym" }; }), 'travel.json › events › cisza › if.location: nieznana lokacja "rzym"');
  assert.deepEqual(withTravel((t) => { ev(t, "cisza").if = { all: [{ region: "pogorze" }, { travelDay: { gte: 2 } }, { location: "brzezina" }] }; }), []);
  expectErr(withTravel((t) => { t.events.push({ ...structuredClone(ev(t, "cisza")) }); }), "travel.json › events › cisza: zduplikowane id");
});

test("D2a: walidacja – reguły travel, food, glod", () => {
  expectErr(withTravel((_, d) => { d.rules.travel.eventHourRange = [2, 10]; }), "rules.json › travel.eventHourRange: oczekiwano [a, b], 0 ≤ a ≤ b < marchHours");
  expectErr(withTravel((_, d) => { d.rules.travel.startLocation = "rzym"; }), 'rules.json › travel.startLocation: nieznana lokacja "rzym"');
  expectErr(withTravel((_, d) => { d.rules.travel.eventChance = 101; }), "rules.json › travel.eventChance: wartość poza zakresem 0–100");
  expectErr(withTravel((_, d) => { delete d.rules.travel; }), "rules.json › travel: brak wymaganego pola");
  expectErr(withTravel((_, d) => { d.items.find((i) => i.id === "grzyby").food.risk.safeTagged = "grzybiarstwo"; }), 'items.json › grzyby › food.risk.safeTagged: nieznana umiejętność "grzybiarstwo"');
  expectErr(withTravel((_, d) => { d.items.find((i) => i.id === "grzyby").food.order = 0; }), "items.json › grzyby › food.order: wartość poza zakresem 1–9");
  expectErr(withTravel((_, d) => { d.items.find((i) => i.id === "piesci").food = { order: 1 }; }), "items.json › piesci › food: dozwolone tylko dla consumable");
  expectErr(withTravel((_, d) => { d.effects.find((e) => e.id === "oslepienie").noExpire = true; }), "effects.json › oslepienie › noExpire: dozwolone tylko dla unit hour");
  expectErr(withTravel((_, d) => { d.effects.find((e) => e.id === "glod").restHealMultiplier = 0; }), "effects.json › glod › restHealMultiplier: oczekiwano liczby > 0");
});

test("D2a: jedzenie ze startu nie trafia na pas szybkiego dostępu", () => {
  const s = combatState(minimalData(), "miecz");
  assert.ok(s.inventory.items.some((i) => i.id === "prowiant" && i.qty === 2));
  assert.deepEqual(s.inventory.quickSlots, ["opatrunek"]);
});

test("D2a: scena travel – trasa musi istnieć", () => {
  const travelScene = (route) => minimalData({ scenes: [{ id: "a", type: "travel", route }, { id: "b", type: "ending", text: "y" }] });
  assert.deepEqual(validateData(travelScene("brzezina_wilczy_brod")), []);
  expectErr(validateData(travelScene("do_rzymu")), 'story.json › a › route: nieznana trasa "do_rzymu"');
  expectErr(validateData(minimalData({ scenes: [{ id: "a", type: "travel", route: "brzezina_wilczy_brod", time: 5 }, { id: "b", type: "ending", text: "y" }] })), "story.json › a › time:");
});

test("final: scena travel może mieć tytuł (lista zapisów)", () => {
  const scenes = minimalData({ scenes: [{ id: "a", type: "travel", route: "brzezina_wilczy_brod", title: "Podróż" }, { id: "b", type: "ending", text: "y" }] });
  assert.deepEqual(validateData(scenes), []);
});
test("final: demo_podroz ma tytuł", async () => {
  const d = await loadData();
  assert.ok(d.story.scenes.find((s) => s.id === "demo_podroz").title);
});

test("limit trasy: rules.travel.maxRouteDays = 4; dłuższa trasa w danych to błąd (opóźnienia pogody liczą się ponad)", () => {
  assert.equal(minimalData().rules.travel.maxRouteDays, 4);
  assert.deepEqual(withTravel((t) => { t.routes[0].days = 4; }), []);
  expectErr(withTravel((t) => { t.routes[0].days = 5; }), "travel.json › routes › brzezina_wilczy_brod › days: więcej niż 4 dni (rules.travel.maxRouteDays)");
  expectErr(withTravel((_, d) => { delete d.rules.travel.maxRouteDays; }), "rules.json › travel.maxRouteDays: brak wymaganego pola");
});
