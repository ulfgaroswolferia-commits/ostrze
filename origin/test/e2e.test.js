import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { runApp } from "../src/app.js";
import { loadData } from "../src/engine/data.js";
import { loadGame } from "../src/engine/save.js";
import { PassThrough } from "node:stream";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { createScriptedIO, createTerminalIO, InputExhaustedError } from "../src/ui/io.js";
import { setColorsEnabled, setRich256, setGraphics } from "../src/ui/colors.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { tmpDir, createAdaptiveIO, endAfterFirstDay } from "./helpers.js";
import { countOf } from "../src/systems/inventory.js";
import { buyPrice, sellPrice } from "../src/systems/shop.js";
import { itemById } from "../src/systems/items.js";
import { getStats } from "../src/systems/stats.js";
import { priceAdjust } from "../src/systems/shop.js";
import { hasEffect } from "../src/systems/effects.js";

let data, savedHome;
beforeEach(async () => {
  savedHome = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
  setColorsEnabled(false);
  data = endAfterFirstDay(await loadData());
});
afterEach(() => {
  if (savedHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = savedHome;
});

/** A state without the save stamp and the rng snapshot (`rngState` is only refreshed by saveGame, so a live state's copy is stale). */
const strip = (s) => { const { savedAt, rngState, ...rest } = s; return rest; };
/**
 * True when a raw frame shows an illustration: a text row of the frame (starts with the left edge ▌) with half blocks in its scene part (before the ▒ bar).
 * The frame itself is made of blocks (▀ ▄ on its edges and dividers), so these are looked for in the panels only.
 */
const hasArt = (raw) => raw.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").split("\n").some((l) => l.startsWith("▌") && /[▀▄]/.test(l.slice(2, -2).split("▒")[0]));
const run = (io, options) => runApp({ data, io, options: { debug: false, ...options } });

// Line-mode answers (see the widgets' non-TTY rules in src/ui/menu.js).
const CREATOR = ["Thorgniew", "1", "1++", "2+", "3++", "8", "7", "9", "12", "1"];
const LEVEL_UP = ["1+++", "2+++", "12", "5"];
/**
 * Fights are played by the adaptive driver (`createAdaptiveIO` in test/helpers.js), which reads the combat screen, so
 * the scripts do not depend on the RNG path. A fight entry also answers its summary screen.
 * - The sword class wins the sparing; the spear class only ends its turns there – a LOSS (HP 1, no death, no reload).
 * - The trip to Wilczy Bród (`{ trip }` step): bandits on day 1, then whatever the stage rolls; the sword class fights
 *   every fight to a WIN, the spear class runs from all of them (the bandits' FLIGHT narration).
 */
const WIN = { fight: "win" };
/** Sparing intro, the fight with its summary, the instructor's comment (win or loss narration). */
const SPARING = ["", WIN, ""];
const SPARING_SPEAR = ["", { fight: "lose" }, ""];
/** The departure narration, then the whole trip (see `{ trip }` in test/helpers.js). */
const ROAD = ["", { trip: { fight: "win" } }];
const ROAD_SPEAR = ["", { trip: { fight: "flee" } }];
/** Quartermaster's stall: narration, talk ("Bywaj." is option 5 on the fresh hub), camp "Dalej", shop menu "Odejdź". */
const STALL = ["", "5", "", "3"];
/** The two intro narrations before the school at dawn (E2a). */
const INTRO = ["", ""];
/** The courier's narration, his talk ("Bywaj." is option 5), the delegation talk ("Pójdę się spakować." is option 2); each talk ends with a camp "Dalej". */
const COURIER = ["", "5", "", "2", ""];
/** The talk at the gate ("Ruszamy." is option 4 while nobody was talked to) and its camp "Dalej". */
const GATE = ["4", ""];
/** menu, dawn, creator, sparing, reward camp, level-up, stall, departure and trip – up to the demo_kurier prompt. */
const TO_COURIER = ["1", ...INTRO, "", ...CREATOR, ...SPARING, "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, ...ROAD];

/** In Wilczy Bród: the commander's talk ("Bywaj." is option 4), "Wróć na mapę" (8th row of the places), on the map the story's way on. */
const AT_HUB = ["1", "4", "9", "1"];
/** courier, the hub, rest 4 h, rest summary, ending, menu exit. */
const FROM_COURIER = ["", ...AT_HUB, { expose: "2" }, "1+++", "2", "", "", "4"];
const FULL = [...TO_COURIER, ...FROM_COURIER];
/** The spear class (wola ≥ 1) plays only the defiant evening scene; demo_posluch needs wola ≤ 0, so the answers equal the sword class's. */
const FROM_COURIER_SPEAR = FROM_COURIER;

/** PD of every won fight in order, from the summary lines ("Zwycięstwo. +60 PD."). */
const winsXp = (text) => [...text.matchAll(/Zwycięstwo\. \+(\d+) PD\./g)].map((m) => Number(m[1]));
/** PD of the bandit fight: the first win after the sparing (which the sword class wins too). */
const banditXp = (text, wonSparing = true) => winsXp(text)[wonSparing ? 1 : 0];
/** Road ambush loot: each fallen bandit (40 PD; one who fled pays half) drops 4 gr, so 2 bandits pay 40 + 20 per fallen one. */
const roadPurse = (roadXp) => 4 * ((roadXp - 40) / 20);
/** Bandages the road bandits dropped ("Otrzymujesz: Opatrunek." on the summary; "×1" in older notices). */
const droppedBandages = (text) => (text.match(/Otrzymujesz: Opatrunek( ×1)?\./g) ?? []).length;

/** `night: false` – a test that replaced the route's fixed events, so the night of the wraiths (and the Entity) never happened. */
function assertDemoResult(state, { night = true } = {}) {
  assert.equal(state.scene.id, "demo_koniec");
  assert.equal(state.character.level, 2);
  assert.equal(state.character.perks.length, 1);
  // sword stance 1 + the campfire talk (Ragnosława's obedience, warmth to Wojmir) 2 + the Entity's first answer (humble) 1
  assert.equal(state.vars.dlug, night ? 4 : 3);
  assert.equal(state.vars.wola ?? 0, 0);
  assert.equal(state.flags.towarzysze_zaufanie, true);
  if (night) {
    assert.equal(state.flags.towarzysze_zgineli, true);
    assert.equal(state.flags.dlug_istoty, true);
  }
  assert.equal(state.flags.klasa_miecz, true);
  // The sword route wins both fights; a misaligned script cannot reach the end with these flags.
  assert.equal(state.flags.combat_demo_sparing_walka_wygrana, true);
  assert.equal(state.flags.combat_bandyci_walka_wygrana, true);
  assert.equal(state.world.location, "wilczy_brod");
  assert.equal(state.world.travel, null);
}

test("demo B1 bez TTY: kreator, awans z perkiem, odpoczynek przez zmierzch, koniec", async () => {
  const io = createAdaptiveIO(FULL);
  const { lastState } = await run(io, { seed: 7 });
  assertDemoResult(lastState);
  // the trip ends at dawn (day 4, or 5 after a downpour); then courier 480 + rest 240 → 18:10
  assert.equal(lastState.time.minutes % (24 * 60), 18 * 60 + 10);
  assert.ok([4, 5].includes(Math.floor(lastState.time.minutes / (24 * 60)) + 1));
  assert.match(io.text(), /Docierasz do: Strażnica Wilczy Bród\./);
  assert.match(io.text(), /Zapada zmierzch./);
  assert.match(io.text(), /Zapadła noc\./);
  assert.doesNotMatch(io.text(), /\[\[/);
  // the prologue's clock agrees with its prose: the courier comes "around noon", the march starts "the next day at dawn"
  assert.match(io.text(), /Dzień 1, 12:00[^\n]*\n(?:[^\n]*\n){0,5}?Kurier\n/);
  assert.match(io.text(), /Dzień 2, 06:00[^\n]*\n(?:[^\n]*\n){0,8}?W drogę\n/);
});

test("demo B1 w trybie TTY (strzałki)", async () => {
  const R = "<right>", D = "<down>", E = "<enter>";
  const creator = ["Thorgniew", E,
    R, R, D, R, D, R, R, D, D, D, D, D, E,
    "7", "9", D, D, D, E,
    E, E, E]; // the summary sheet is paged in the frame (Enter per page), then "Zatwierdź"
  const levelUp = [R, R, R, D, R, R, R, ...Array(10).fill(D), E, "5"];
  // The driver plays both fights by keys (letters and digits) and answers their summary screens.
  const sparing = [E, WIN, E];
  const road = [E, { trip: { fight: "win" } }];
  const keys = ["1", E, E, E, ...creator, ...sparing, E, ...levelUp, E, "5", E, "2", E, E, "5", E, "3", "4", E, ...road, E, ...AT_HUB, { expose: "2" }, R, R, R, D, E, E, E, E, "5"];
  const io = createAdaptiveIO(keys, { tty: true });
  const { lastState } = await run(io, { seed: 7 });
  assertDemoResult(lastState);
  await assert.rejects(io.ask("?"), InputExhaustedError); // every scripted input was consumed
  assert.match(io.text(), /Zapada zmierzch./);
  assert.doesNotMatch(io.text(), /\[\[/);
});

test("zapis w połowie + wczytanie + dokończenie = ten sam stan co przejście bez przerwy", async () => {
  const full = (await run(createAdaptiveIO(FULL), { seed: 7 })).lastState;
  await run(createAdaptiveIO([...TO_COURIER, "^C", "t"]), { seed: 7 });
  const resumed = (await run(createAdaptiveIO(["2", "1", ...FROM_COURIER]))).lastState;
  assertDemoResult(resumed);
  assert.deepEqual(strip(resumed), strip(full));
});

test("zapis w środku nocy upiorów (rozmowa z Istotą) + wczytanie + dokończenie = ten sam stan co przejście bez przerwy", async () => {
  const full = (await run(createAdaptiveIO(FULL), { seed: 7 })).lastState;
  const toNight = ["1", ...INTRO, "", ...CREATOR, ...SPARING, "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, "", { trip: { fight: "win", interruptAt: "Tkanka zrośnięta" } }, "t"];
  await run(createAdaptiveIO(toNight), { seed: 7 });
  const saved = await loadGame("auto", data);
  assert.equal(saved.scene.id, "demo_podroz");
  assert.equal(saved.world.travel.eventScene, "noc_przebudzenie");
  assert.equal(saved.flags.towarzysze_zgineli, true);
  const resumed = (await run(createAdaptiveIO(["2", "1", { trip: { fight: "win" } }, ...FROM_COURIER]))).lastState;
  assertDemoResult(resumed);
  assert.deepEqual(strip(resumed), strip(full));
});

test("wczytanie zapisu zrobionego w kreatorze startuje kreator od nowa", async () => {
  await run(createScriptedIO(["1", ...INTRO, "", "^C", "t"]), { seed: 7 });
  const saved = await loadGame("auto", data);
  assert.equal(saved.scene.id, "demo_kreator");
  assert.equal(saved.character, null);
  const { lastState } = await run(createAdaptiveIO(["2", "1", ...CREATOR, ...SPARING, "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, ...ROAD, ...FROM_COURIER]));
  assert.equal(lastState.character.name, "Thorgniew");
  assertDemoResult(lastState);
});

test("[P] na narracji po kreatorze pokazuje postać i wraca do sceny", async () => {
  const io = createScriptedIO(["1", ...INTRO, "", ...CREATOR, "p", "", "^C", "n"]);
  await run(io, { seed: 7 });
  const out = io.text();
  assert.match(out, /Atrybuty/);
  assert.equal((out.match(/Mgła zalega|Gnieworad wciska/g) ?? []).length >= 2, true);
  assert.match(out, /Thorgniew, poz. 1/);
});

test("Ctrl+C w późniejszej scenie + t zapisuje slot auto na bieżącej scenie", async () => {
  await run(createAdaptiveIO([...TO_COURIER, "^C", "t"]), { seed: 7 });
  assert.equal((await loadGame("auto", data)).scene.id, "demo_kurier");
});

test("Ctrl+C + n zostawia slot auto z nowej gry", async () => {
  await run(createScriptedIO(["1", "^C", "n"]), { seed: 1 });
  assert.equal((await loadGame("auto", data)).scene.id, "prolog_wstep");
});

test("zamknięte wejście w grze: autozapis do slotu auto i komunikat", async () => {
  const io = createAdaptiveIO([...TO_COURIER, "^D"]);
  await run(io, { seed: 7 });
  assert.equal((await loadGame("auto", data)).scene.id, "demo_kurier");
  assert.match(io.text(), /Wejście zamknięte – zapisano grę w slocie „auto”./);
});

test("zamknięte wejście w menu kończy po cichu", async () => {
  const io = createScriptedIO(["^D"]);
  await run(io, {});
  assert.doesNotMatch(io.text(), /Wejście zamknięte/);
});

test("komunikat „Zapisano.” jest widoczny na ekranie po save_point (po pasku stanu)", async () => {
  const io = createAdaptiveIO(FULL);
  await run(io, { seed: 7 });
  const lines = io.text().split("\n");
  const at = lines.lastIndexOf("Zapisano."); // the story's save point (the trip's departures auto-save too)
  assert.ok(at > 0, "brak komunikatu");
  assert.ok(lines.slice(Math.max(0, at - 4), at).some((l) => /Dzień \d+, \d\d:\d\d · \p{L}+ · .*HP \d+\/\d+/u.test(l)), lines.slice(at - 4, at).join("\n")); // the status line, with hunger tags or notices around it
});

test("komunikat o błędzie nowej gry trafia na pierwszy ekran gry", async () => {
  process.env.OSTRZE_HOME = path.join(await tmpDir(), "plik");
  await writeFile(process.env.OSTRZE_HOME, "x");
  const io = createScriptedIO(["1", "^C", "n", ]);
  await run(io, { seed: 1 });
  const lines = io.text().split("\n");
  const at = lines.findIndex((l) => l.startsWith("Nie udało się zapisać"));
  assert.ok(at > 0);
  assert.match(lines[at - 1], /Dzień 1, /);
});

test("odpowiedzi z pipe'a (terminalowe IO) przechodzą całe demo", async () => {
  // The driver plays the demo once; its answers (fights included) are then piped in at once with the same seed.
  const driven = createAdaptiveIO(FULL);
  await run(driven, { seed: 7 });
  const input = new PassThrough(); const output = new PassThrough();
  const io = createTerminalIO({ input, output });
  try {
    input.end(driven.answers().join("\n") + "\n");
    const { lastState } = await run(io, { seed: 7 });
    assertDemoResult(lastState);
  } finally { io.close(); }
});

test("wyjątek w scenie → slot crash i powrót do menu", async () => {
  const handlers = { ...defaultHandlers, narration: async () => { throw new Error("bum"); } };
  const io = createScriptedIO(["1", "4"]);
  await run(io, { seed: 1, handlers });
  assert.match(io.text(), /slocie „crash”/);
  assert.doesNotMatch(io.text(), /\n\s+at /);
  assert.equal((await loadGame("crash", data)).scene.id, "prolog_wstep");
});

test("pusta lista zapisów", async () => {
  const io = createScriptedIO(["2", "4"]);
  await run(io, {});
  assert.match(io.text(), /Brak zapisów\./);
});

test("wyjątek w scenie przy nieudanym zapisie crash nie twierdzi, że zapisano", async () => {
  process.env.OSTRZE_HOME = path.join(await tmpDir(), "plik");
  await writeFile(process.env.OSTRZE_HOME, "x");
  const handlers = { ...defaultHandlers, narration: async () => { throw new Error("bum"); } };
  const io = createScriptedIO(["1", "4"]);
  await run(io, { seed: 1, handlers });
  assert.match(io.text(), /Nie udało się zapisać stanu gry\./);
  assert.doesNotMatch(io.text(), /slocie „crash”/);
});

test("scena reward bez postaci: komunikat, menu, bez slotu crash", async () => {
  const custom = { ...data, story: { start: "c", scenes: [
    { id: "c", type: "character_creation" }, { id: "r", type: "reward", xp: 10 }, { id: "k", type: "ending", text: "x" }] } };
  const io = createScriptedIO(["1", "4"]);
  await runApp({ data: custom, io, options: { debug: false, seed: 1, scene: "r" } });
  assert.match(io.text(), /Ta scena wymaga postaci/);
  await assert.rejects(loadGame("crash", custom));
});

/** Reward camp: inventory (wear the hood from the reward), character sheet, save to slot 1, continue. */
const CAMP_HOOD = ["e", "6", "1", "w", "p", "", "z", "1", ""];
/** Stall narration, then shop: buy opatrunek, then sell one back (slider: "Gotowe" keeps quantity 1), confirm each; leave. */
const STALL_BUY = ["", "5", "", "1", "1", "2", "t", "2", "1", "2", "t", "3"];

test("demo B2, klasa miecza: kaptur z nagrody, kram, zapis w obozie, koniec", async () => {
  const input = ["1", ...INTRO, "", ...CREATOR, ...SPARING, ...CAMP_HOOD, ...LEVEL_UP, ...COURIER, ...STALL_BUY, ...GATE, ...ROAD, ...FROM_COURIER.slice(0, -1), "4"];
  const io = createAdaptiveIO(input);
  const { lastState } = await run(io, { seed: 7 });
  assertDemoResult(lastState);
  await assert.rejects(io.ask("?"), InputExhaustedError); // every scripted input was consumed
  const inv = lastState.inventory;
  assert.equal(inv.equipped.glowa, "kaptur_mysliwego");
  const price = buyPrice(data, itemById(data, "opatrunek"), getStats(lastState, data).skills.handel ?? 0);
  const handel = getStats(lastState, data).skills.handel ?? 0;
  const gain = sellPrice(data, itemById(data, "opatrunek"), handel);
  assert.equal(lastState.character.money, 30 + 15 - price + gain + roadPurse(banditXp(io.text())));
  // 2 start + 1 bought - 1 sold, plus what the bandits dropped, minus what the driver used in fights
  assert.equal(inv.items.find((s) => s.id === "opatrunek").qty, 2 + droppedBandages(io.text()) - (io.used().bandage ?? 0));
  assert.equal(lastState.world.shops.kramarz_szkolny.find((e) => e.id === "opatrunek").qty, 4); // 4 - 1 bought + 1 sold
  assert.deepEqual(lastState.world.claimedRewards, ["demo_nagroda"]);
  assert.match(io.text(), /Bystrość/);
  assert.match(io.text(), /Kaptur myśliwego/);
  // The slot saved in the reward camp holds the pre-shop inventory, and loading it does not replay the reward.
  const saved = await loadGame("1", data);
  assert.equal(saved.scene.id, "demo_nagroda");
  assert.equal(saved.inventory.equipped.glowa, "kaptur_mysliwego");
  assert.equal(saved.inventory.items.find((s) => s.id === "opatrunek").qty, 2);
  assert.equal(saved.character.money, 45);
  assert.deepEqual(saved.world.claimedRewards, ["demo_nagroda"]);
  assert.equal(saved.character.xp, 30 + 160); // sparing + reward; the bandits came after the save
});

test("demo B2, klasa włóczni: pełne przejście z pustymi odpowiedziami w obozie i kramie", async () => {
  const creator = [...CREATOR.slice(0, 1), "2", ...CREATOR.slice(2)];
  const input = ["1", ...INTRO, "", ...creator, ...SPARING_SPEAR, "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, ...ROAD_SPEAR, ...FROM_COURIER_SPEAR];
  const io = createAdaptiveIO(input);
  const { lastState } = await run(io, { seed: 7 });
  assert.equal(lastState.scene.id, "demo_koniec");
  assert.equal(lastState.inventory.equipped.bron, "para_wloczni");
  assert.equal(lastState.flags.klasa_wlocznia, true);
  assert.equal(lastState.vars.wola, 1);
  assert.equal(lastState.character.money, 30 + 15);
  await assert.rejects(io.ask("?"), InputExhaustedError); // every scripted input was consumed
});

/**
 * Sword class haggles ([Handel 35] = option 1), then buys a drink ("Nalej łyka"), then leaves ("Bywaj.").
 * The check is rolled from the seeded rng, which the sparing fight (played by the driver) has already used, so the
 * seed is part of the test: at seed 1 the haggle SUCCEEDS (flag `kwatermistrz_rabat`); the dialogue answers are
 * fixed, so another seed may fail the check. The fights themselves do not depend on the seed.
 * After a success the haggle option is hidden (`notFlag`), so the hub is Wymowa 1, Nalej 2, kaptur 3, Bywaj 4; each result node has one "Dalej." option (1).
 */
const TALK_HAGGLE = ["", "1", "1", "2", "1", "4"];
const TO_STALL = ["1", ...INTRO, "", ...CREATOR, ...SPARING, "", ...LEVEL_UP, ...COURIER];

test("demo C1, klasa miecza: targ, bimber u kwatermistrza, rabat w kramie, efekt mija po odpoczynku", async () => {
  // Stop in the shop (^C + t) to look at the state right after the talk.
  const early = createAdaptiveIO([...TO_STALL, ...TALK_HAGGLE, "", "^C", "t"]);
  await run(early, { seed: 1 });
  const mid = await loadGame("auto", data);
  assert.equal(mid.scene.id, "demo_kram");
  assert.equal(mid.flags.kwatermistrz_rabat, true);
  assert.equal(mid.flags.dialog_kwatermistrz_end, true);
  assert.equal(hasEffect(mid, "podchmielenie"), true);
  assert.equal(mid.character.money, 30 + 15 - 2);
  assert.match(early.text(), /\[Podchmielony 3h\]/);

  const input = [...TO_STALL, ...TALK_HAGGLE, "", "1", "1", "2", "t", "3", ...GATE, ...ROAD, ...FROM_COURIER];
  const io = createAdaptiveIO(input);
  const { lastState } = await run(io, { seed: 1 });
  assertDemoResult(lastState);
  await assert.rejects(io.ask("?"), InputExhaustedError); // every scripted input was consumed
  const handel = getStats(lastState, data).skills.handel ?? 0;
  const cheap = buyPrice(data, itemById(data, "opatrunek"), handel, { buyPercent: -10, sellPercent: 10 });
  assert.deepEqual(priceAdjust(lastState, data, "kramarz_szkolny"), { buyPercent: -10, sellPercent: 10 });
  assert.equal(lastState.character.money, 30 + 15 - 2 - cheap + roadPurse(banditXp(io.text())));
  assert.equal(hasEffect(lastState, "podchmielenie"), false); // wore off by the end of the rest
  assert.equal(lastState.flags.dialog_kwatermistrz_end, true);
  assert.deepEqual(lastState.world.finishedDialogues, ["prolog_kurier", "prolog_delegacja", "demo_kram_rozmowa", "prolog_brama", "bandyci_ognisko", "noc_przebudzenie", "noc_pobojowisko", "noc_rozdroze", "kom_pierwszy"]);
});

test("demo C1, klasa włóczni: „Bywaj.” od razu, bez rabatu i bimbru", async () => {
  const creator = [...CREATOR.slice(0, 1), "2", ...CREATOR.slice(2)];
  const io = createAdaptiveIO(["1", ...INTRO, "", ...creator, ...SPARING_SPEAR, "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, ...ROAD_SPEAR, ...FROM_COURIER_SPEAR]);
  const { lastState } = await run(io, { seed: 7 });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assert.equal(lastState.flags.kwatermistrz_rabat, undefined);
  assert.equal(lastState.flags.dialog_kwatermistrz_end, true);
  assert.equal(lastState.character.money, 30 + 15);
  assert.equal(lastState.inventory.equipped.bron, "para_wloczni");
  assert.equal(lastState.vars.wola, 1);
});

test("demo C2a, klasa miecza: wygrywa sparing i zasadzkę – flagi, PD, łup, bez amunicji w magazynku", async () => {
  const io = createAdaptiveIO(FULL);
  const { lastState: st } = await run(io, { seed: 7 });
  await assert.rejects(io.ask("?"), InputExhaustedError); // every scripted input was consumed
  assert.equal(st.flags.combat_demo_sparing_walka_wygrana, true);
  assert.equal(st.flags.combat_demo_sparing_walka_porazka, undefined);
  assert.equal(st.flags.combat_bandyci_walka_wygrana, true);
  assert.equal(st.flags.combat_bandyci_walka_ucieczka, undefined);
  const roadXp = banditXp(io.text()); // 40 PD per fallen bandit, 20 per one who fled
  assert.ok([40, 60, 80].includes(roadXp), String(roadXp));
  assert.equal(st.character.xp, 30 + 160 + roadXp); // sparing + reward + the road
  assert.equal(st.character.money, 30 + 15 + roadPurse(roadXp)); // start + reward + the fallen bandits' purses
  assert.deepEqual(st.inventory.loaded, {}); // no ranged weapon, nothing loaded
  assert.match(io.text(), /Radogost łapie się za żebra/);
  assert.doesNotMatch(io.text(), /Leżysz w błocie|pokrzywy smagają/);
  assert.match(io.text(), /Zwycięstwo\. \+30 PD\./); // the sparing
});

test("demo C2a, klasa włóczni: przegrywa sparing (żyje, HP 1 → dalej) i ucieka bandytom", async () => {
  const creator = [...CREATOR.slice(0, 1), "2", ...CREATOR.slice(2)];
  // Stop right after the lost sparing (^C + t at the reward scene): training leaves no wounds, HP is as before the fight.
  await run(createAdaptiveIO(["1", ...INTRO, "", ...creator, ...SPARING_SPEAR, "^C", "t"]), { seed: 7 });
  const afterSparing = await loadGame("auto", data);
  assert.equal(afterSparing.flags.combat_demo_sparing_walka_porazka, true);
  assert.equal(afterSparing.character.hp, 41); // full HP of a fresh level-1 character
  const io = createAdaptiveIO(["1", ...INTRO, "", ...creator, ...SPARING_SPEAR, "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, ...ROAD_SPEAR, ...FROM_COURIER_SPEAR]);
  const { lastState: st } = await run(io, { seed: 7 });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assert.equal(st.flags.combat_demo_sparing_walka_porazka, true);
  assert.equal(st.flags.combat_demo_sparing_walka_wygrana, undefined);
  assert.equal(st.flags.combat_bandyci_walka_ucieczka, true);
  assert.equal(st.flags.combat_bandyci_walka_wygrana, undefined);
  assert.equal(st.character.xp, 160); // a lost sparing and a flight earn nothing
  assert.equal(st.character.money, 30 + 15); // no loot
  assert.deepEqual(st.inventory.loaded, {});
  assert.match(io.text(), /Leżysz w błocie/);
  assert.match(io.text(), /pokrzywy smagają/);
  assert.doesNotMatch(io.text(), /Radogost łapie się/);
  assert.match(io.text(), /Przegrywasz/); // the sparing summary, not a defeat screen with a reload
  assert.equal(io.text().includes(data.ui["combat.defeat"]), false);
});

/** Shop: Kup → Sztylet (row 11 of the stall's stock) → confirm, then leave. */
const STALL_DAGGER = ["", "5", "", "1", "11", "t", "3"];
/** Road camp: inventory → Sztylet (row 7, after the start provisions) → "Załóż do drugiej ręki" (3) → back, "Dalej". */
const CAMP_DAGGER = ["e", "7", "3", "w", ""];
const SPEAR_TECHNIQUES = { fight: "win", techniques: ["throw", "pickup"] };

for (const seed of [7, 10, 42]) {
  test(`demo z technikami, klasa miecza (ziarno ${seed}): sztylet w drugiej ręce, atak obiema, biegłość rośnie`, async () => {
    const plan = ["1", ...INTRO, "", ...CREATOR, ...SPARING, "", ...LEVEL_UP, ...COURIER, ...STALL_DAGGER, ...GATE, ...CAMP_DAGGER,
      { trip: { fight: "win", techniques: ["dual"] } }, ...FROM_COURIER];
    const io = createAdaptiveIO(plan);
    const { lastState: st } = await run(io, { seed });
    await assert.rejects(io.ask("?"), InputExhaustedError); // every scripted input was consumed
    assert.equal(st.scene.id, "demo_koniec");
    assert.equal(st.inventory.equipped.bron_druga, "sztylet");
    assert.equal(countOf(st, "sztylet"), 1);
    assert.ok(io.used().dual >= 1, "atak obiema nie został użyty");
    assert.equal(st.flags.combat_bandyci_walka_wygrana, true);
    assert.ok(st.character.mastery.miecz > 15);
    assert.equal(st.flags.klasa_miecz, true);
  });

  test(`demo z technikami, klasa włóczni (ziarno ${seed}): rzut i podniesienie, wygrana z bandytami, włócznia wraca`, async () => {
    const creator = [...CREATOR.slice(0, 1), "2", ...CREATOR.slice(2)];
    const plan = ["1", ...INTRO, "", ...creator, "", SPEAR_TECHNIQUES, "", "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, "", { trip: SPEAR_TECHNIQUES }, ...FROM_COURIER_SPEAR];
    const io = createAdaptiveIO(plan);
    const { lastState: st } = await run(io, { seed });
    await assert.rejects(io.ask("?"), InputExhaustedError);
    assert.equal(st.scene.id, "demo_koniec");
    assert.ok(io.used().throw >= 1 && io.used().pickup >= 1, JSON.stringify(io.used()));
    assert.match(io.text(), /Rzucasz: Włócznia/);
    assert.match(io.text(), /Podnosisz: Włócznia\./);
    assert.equal(st.flags.combat_bandyci_walka_wygrana, true);
    assert.ok(st.character.mastery.wlocznie > 15);
    assert.equal(countOf(st, "para_wloczni"), 1); // the thrown spear is back in the bag (Review Focus 1)
    assert.equal(st.inventory.equipped.bron, "para_wloczni");
    assert.equal(st.flags.klasa_wlocznia, true);
  });
}

// --- D1: Kamień Zmierzchu po bandytach, talizman, wystawienie w odpoczynku ---
/** Courier camp: inventory → Kamień Zmierzchu → "Załóż" (talizman) → back; then the courier's rest with the stone exposed. */
const WEAR_STONE = ["e", { pick: "Kamień Zmierzchu" }, "1", "w"];
const FROM_COURIER_EXPOSED = ["", ...AT_HUB, { expose: "1" }, ...FROM_COURIER.slice(2 + AT_HUB.length)];
const FROM_COURIER_EXPOSED_SPEAR = ["", ...AT_HUB, { expose: "1" }, ...FROM_COURIER_SPEAR.slice(2 + AT_HUB.length)];

/** Whatever the night brought: a thief in the text, or the stone worn and charged above its start. */
function assertStoneNight(io, st) {
  assert.match(io.text(), /Otrzymujesz: Kamień Zmierzchu\./);
  assert.match(io.text(), /Wystawić artefakt/);
  assert.equal(st.artifacts.kamien_zmierzchu.exposed, false);
  if (io.text().includes(data.ui["event.thief"])) return; // the thief may have taken the stone
  assert.equal(st.inventory.equipped.talizman, "kamien_zmierzchu");
  assert.equal(countOf(st, "kamien_zmierzchu"), 1);
  assert.ok(st.artifacts.kamien_zmierzchu.charge > 40, String(st.artifacts.kamien_zmierzchu.charge));
}

for (const seed of [7, 10, 42]) {
  test(`D1 demo, klasa miecza (ziarno ${seed}): kamień po bandytach, talizman, wystawienie`, async () => {
    const plan = ["1", ...INTRO, "", ...CREATOR, ...SPARING, "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, ...ROAD, ...WEAR_STONE, ...FROM_COURIER_EXPOSED];
    const io = createAdaptiveIO(plan);
    const { lastState: st } = await run(io, { seed });
    await assert.rejects(io.ask("?"), InputExhaustedError); // every scripted input was consumed
    assert.equal(st.scene.id, "demo_koniec");
    assertStoneNight(io, st);
  });

  test(`D1 demo, klasa włóczni (ziarno ${seed}): wygrana z bandytami daje kamień, wystawienie`, async () => {
    const creator = [...CREATOR.slice(0, 1), "2", ...CREATOR.slice(2)];
    const plan = ["1", ...INTRO, "", ...creator, "", SPEAR_TECHNIQUES, "", "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, "", { trip: SPEAR_TECHNIQUES }, ...WEAR_STONE, ...FROM_COURIER_EXPOSED_SPEAR];
    const io = createAdaptiveIO(plan);
    const { lastState: st } = await run(io, { seed });
    await assert.rejects(io.ask("?"), InputExhaustedError);
    assert.equal(st.scene.id, "demo_koniec");
    assertStoneNight(io, st);
  });
}

test("D1 demo: ucieczka przed bandytami – bez kamienia i bez pytania o wystawienie", async () => {
  const creator = [...CREATOR.slice(0, 1), "2", ...CREATOR.slice(2)];
  const io = createAdaptiveIO(["1", ...INTRO, "", ...creator, ...SPARING_SPEAR, "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, ...ROAD_SPEAR, ...FROM_COURIER_SPEAR]);
  const { lastState: st } = await run(io, { seed: 7 });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assert.equal(countOf(st, "kamien_zmierzchu"), 0);
  assert.doesNotMatch(io.text(), /Wystawić artefakt/);
  assert.deepEqual(st.artifacts, {});
});

// --- D2a: podróż do Wilczego Brodu ---
/** Loaded data with the route's fixed events set to `fixed` (day → event id); `patch` may change the copy further. */
function tripData(fixed, patch = () => {}) {
  const d = structuredClone(data);
  d.travel.routes[0].fixed = fixed;
  d.rules.travel.eventChance = 0; // only the fixed events: the extra day of a downpour must not roll a random one
  d.rules.travel.dangerousEventChance = 0;
  patch(d);
  return d;
}

test("D2a demo: ulewa w 2. dniu i bez prowiantu – głód w obozie, podróż trwa 3 dni, dalej koniec demo", async () => {
  const d = tripData({ 1: "bandyci_na_trakcie", 2: "ulewa_nadciaga" }, (x) => {
    for (const c of x.classes) c.startItems = c.startItems.filter((i) => i.id !== "prowiant");
  });
  const io = createAdaptiveIO(FULL);
  const { lastState: st } = await runApp({ data: d, io, options: { debug: false, seed: 7 } });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assertDemoResult(st, { night: false });
  assert.match(io.text(), /Głodny: Siła -1, Krzepa -1/);
  assert.match(io.text(), /Ulewa – zaszedłeś tylko pół drogi\. Do celu dzień dłużej\./);
  assert.match(io.text(), /dzień 3 z 3/i);
});

test("D2a demo: klasa włóczni ucieka przed bandytami i przed wilkami – dociera do strażnicy", async () => {
  const d = tripData({ 1: "bandyci_na_trakcie", 2: "wilki" });
  const creator = [...CREATOR.slice(0, 1), "2", ...CREATOR.slice(2)];
  const io = createAdaptiveIO(["1", ...INTRO, "", ...creator, ...SPARING_SPEAR, "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, ...ROAD_SPEAR, ...FROM_COURIER_SPEAR]);
  const { lastState: st } = await runApp({ data: d, io, options: { debug: false, seed: 7 } });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assert.equal(st.scene.id, "demo_koniec");
  assert.match(io.text(), /pokrzywy smagają/);
  assert.match(io.text(), /Wdrapujesz się na zwalony pień/);
  assert.equal(st.world.location, "wilczy_brod");
});

test("D2a demo: przerwanie na wymarszu 2. dnia i wczytanie wznawia ten wymarsz", async () => {
  const toTrip = ["1", ...INTRO, "", ...CREATOR, ...SPARING, "", ...LEVEL_UP, ...COURIER, ...STALL, ...GATE, ""];
  // Interrupted in the evening of day 2 (quiet mornings have no screen) without saving: the auto save of that dawn stays.
  await run(createAdaptiveIO([...toTrip, { trip: { fight: "win", interruptAt: "dzień 2 z" } }, "n"]), { seed: 7 }).catch((e) => { if (!(e instanceof InputExhaustedError)) throw e; });
  const saved = await loadGame("auto", data);
  assert.equal(saved.scene.id, "demo_podroz");
  assert.equal(saved.world.travel.day, 2);
  assert.equal(saved.world.travel.phase, "depart");
  const io = createAdaptiveIO(["2", "1", { trip: { fight: "win" } }, ...FROM_COURIER]);
  const { lastState: st } = await run(io);
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assertDemoResult(st);
  assert.match(io.text(), /Dzień 2 z 2/);
  assert.doesNotMatch(io.text(), /Dzień 1 z 2/);
});

// --- D2b: mapa, zadania, eskorta ---
/** In Wilczy Bród: the commander's talk (three questions, "Biorę to.", "Bywaj."), "Wróć na mapę". */
const TAKE_NORA = ["1", "1", "1", "1", "1", "1", "9"];
/** The rest after the map, as in FROM_COURIER. */
const AFTER_MAP = FROM_COURIER.slice(1 + AT_HUB.length);
/** The nora on site: narration, the fight, the after-fight narration, the reward's camp menu. */
const NORA_SITE = ["", WIN, ""];

test("D2b demo: zadanie komendanta – wyprawa do Wilczej Nory, wataha, zapłata, powrót, dalej fabułą", async () => {
  const io = createAdaptiveIO([...TO_COURIER, "", ...TAKE_NORA, "1", { trip: { fight: "win" } }, ...NORA_SITE, { trip: { fight: "win" } }, "9", "1", ...AFTER_MAP]);
  const { lastState: st } = await run(io, { seed: 7 });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assertDemoResult(st);
  assert.equal(st.quests.wilcza_nora.status, "active");
  assert.equal(st.quests.wilcza_nora.reported, true);
  assert.match(io.text(), /Nowe zadanie: Wilcza Nora\./);
  assert.match(io.text(), /Dokąd iść?\?/);
  assert.match(io.text(), /Docierasz do: Wilcza Nora\./);
  assert.equal(st.world.map, null);
});

test("D2b demo: eskorta Ostromira – zlecenie w drodze, wyprawa do Przełęczy, zapłata i prowiant", async () => {
  const d = structuredClone(data);
  d.travel.routes[0].fixed = { 1: "bandyci_na_trakcie", 2: "kupiec_ostromir" };
  d.quests.find((q) => q.id === "eskorta_ostromira").eventChance = 0;
  const escort = d.quests.find((q) => q.id === "eskorta_ostromira");
  escort.scenes = escort.scenes.filter((s) => s.id !== "przelecz_rada"); // Ostromir's farewell has its own test (e2e_dalekie_szlaki)
  d.story.scenes.find((s) => s.id === "akt2_koniec_scena").type = "ending"; // this run stops at the end of act II; act III has its own tests
  const toCourier = TO_COURIER.map((x) => (typeof x === "object" && "trip" in x ? { trip: { ...x.trip, accept: true } } : x));
  const io = createAdaptiveIO([...toCourier, "", ...AT_HUB.slice(0, 3), "1", { trip: { fight: "win" } }, "", "", { trip: { fight: "win" } }, "9", "1", ...AFTER_MAP]);
  const { lastState: st } = await runApp({ data: d, io, options: { debug: false, seed: 7 } });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assert.equal(st.scene.id, "akt2_koniec_scena");
  assert.equal(st.flags.akt2_koniec, true);
  assert.equal(st.quests.eskorta_ostromira.status, "done");
  assert.match(io.text(), /Nowe zadanie: Eskorta kupca Ostromira\./);
  assert.match(io.text(), /Kamienna Przełęcz · eskorta „Eskorta kupca Ostromira” · 1 dzień · termin:/);
  assert.match(io.text(), /Otrzymujesz: \+40 gr · Prowiant ×2/);
});

test("D2b demo: „Prześpij noc” z niewykonaną norą – bez pytania, zadanie zostaje", async () => {
  const io = createAdaptiveIO([...TO_COURIER, "", ...TAKE_NORA, "2", ...AFTER_MAP]);
  const { lastState: st } = await run(io, { seed: 7 });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assertDemoResult(st);
  assert.equal(st.quests.wilcza_nora.status, "active");
  assert.doesNotMatch(io.text(), /przepadną|Zadanie przepadło/);
});

// --- E1: demo w ramkach, za mały terminal ---
test("E1 demo w TTY: każda klatka to domknięta ramka ≤ 24 wiersze i ≤ 80 kolumn", async () => {
  const R = "<right>", D = "<down>", E = "<enter>";
  const creator = ["Thorgniew", E, R, R, D, R, D, R, R, D, D, D, D, D, E, "7", "9", D, D, D, E, E, E, E];
  const levelUp = [R, R, R, D, R, R, R, ...Array(10).fill(D), E, "5"];
  const keys = ["1", E, E, E, ...creator, E, WIN, E, E, ...levelUp, E, "5", E, "2", E, E, "5", E, "3", "4", E, E, { trip: { fight: "win" } }, E, ...AT_HUB, { expose: "2" }, R, R, R, D, E, E, E, E, "5"];
  const io = createAdaptiveIO(keys, { tty: true });
  const { lastState } = await run(io, { seed: 7 });
  assertDemoResult(lastState);
  const clean = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  const frames = io.output.join("").split("\x1b[2J\x1b[3J\x1b[H").slice(1);
  assert.ok(frames.length > 100, `za mało klatek: ${frames.length}`);
  let boxes = 0;
  for (const raw of frames) {
    const lines = clean(raw).split("\n").filter((l) => l !== "");
    if (!lines[0]?.startsWith("█▀")) continue; // the defeat screen and similar one-liners stay plain
    boxes++;
    // Stray text written below a frame would scroll it: a frame chunk is exactly rows − 1 lines.
    assert.equal(raw.split("\n").length - 1, 23, `luźny tekst w klatce:\n${clean(raw)}`);
    const box = lines.filter((l) => /^[█▌]/.test(l));
    assert.ok(box.length <= 24, `ramka ${box.length} wierszy:\n${box.join("\n")}`);
    assert.ok(/^█▄+█$/.test(box.at(-1)), box.at(-1));
    for (const l of box) assert.ok([...l].length + (l.match(/⚡/g) ?? []).length <= 80, `${[...l].length} kolumn: ${l}`);
  }
  assert.ok(boxes > 100, `ramek: ${boxes}`);
});

test("E1 za mały terminal (70×20): tryb liniowy z komunikatem o powiększeniu okna", async () => {
  const io = createScriptedIO(["1", "", "^C", "t"], { tty: true });
  io.columns = 70;
  io.rows = 20;
  await run(io, { seed: 7 });
  const out = io.text();
  assert.doesNotMatch(out, /█▀/);
  assert.match(out, /Powiększ okno do 80×24, aby zobaczyć panele\./);
});

test("E1b demo w TTY 160×45: każda klatka to dokładnie rows − 1 wierszy, ≤ 200 kolumn, bez luźnego tekstu", async () => {
  const R = "<right>", D = "<down>", E = "<enter>";
  const creator = ["Thorgniew", E, R, R, D, R, D, R, R, D, D, D, D, D, E, "7", "9", D, D, D, E, E, E, E];
  const levelUp = [R, R, R, D, R, R, R, ...Array(10).fill(D), E, "5"];
  const keys = ["1", E, E, E, ...creator, E, WIN, E, E, ...levelUp, E, "5", E, "2", E, E, "5", E, "3", "4", E, E, { trip: { fight: "win" } }, E, ...AT_HUB, { expose: "2" }, R, R, R, D, E, E, E, E, "5"];
  const io = createAdaptiveIO(keys, { tty: true });
  io.columns = 160;
  io.rows = 45;
  const { lastState } = await run(io, { seed: 7 });
  assertDemoResult(lastState);
  const clean = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  const frames = io.output.join("").split("\x1b[2J\x1b[3J\x1b[H").slice(1);
  let boxes = 0;
  for (const raw of frames) {
    const lines = clean(raw).split("\n").filter((l) => l !== "");
    if (!lines[0]?.startsWith("█▀")) continue;
    boxes++;
    assert.equal(raw.split("\n").length - 1, 44, `luźny tekst w klatce:\n${clean(raw)}`);
    for (const l of lines.filter((x) => /^[█▌]/.test(x))) assert.ok([...l].length + (l.match(/⚡/g) ?? []).length <= 200, `${[...l].length} kolumn: ${l}`);
  }
  assert.ok(boxes > 100, `ramek: ${boxes}`);
});

test("E3a demo w TTY 200×50 w kolorze: każda klatka rows − 1 wierszy, ≤ 200 kolumn, ilustracje (▀) w klatkach", async () => {
  const R = "<right>", D = "<down>", E = "<enter>";
  const creator = ["Thorgniew", E, R, R, D, R, D, R, R, D, D, D, D, D, E, "7", "9", D, D, D, E, E, E, E];
  const levelUp = [R, R, R, D, R, R, R, ...Array(10).fill(D), E, "5"];
  const keys = ["1", E, E, E, ...creator, E, WIN, E, E, ...levelUp, E, "5", E, "2", E, E, "5", E, "3", "4", E, E, { trip: { fight: "win" } }, E, ...AT_HUB, { expose: "2" }, R, R, R, D, E, E, E, E, "5"];
  setColorsEnabled(true);
  setRich256(true);
  const io = createAdaptiveIO(keys, { tty: true });
  io.columns = 200;
  io.rows = 50;
  const { lastState } = await run(io, { seed: 7 });
  assertDemoResult(lastState);
  const clean = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  const frames = io.output.join("").split("\x1b[2J\x1b[3J\x1b[H").slice(1);
  let boxes = 0;
  for (const raw of frames) {
    const lines = clean(raw).split("\n").filter((l) => l !== "");
    if (!lines[0]?.startsWith("█▀")) continue;
    boxes++;
    assert.equal(raw.split("\n").length - 1, 49, `luźny tekst w klatce:\n${clean(raw)}`);
    for (const l of lines.filter((x) => /^[█▌]/.test(x))) assert.ok([...l].length + (l.match(/⚡/g) ?? []).length <= 200, `${[...l].length} kolumn: ${l}`);
  }
  assert.ok(boxes > 100, `ramek: ${boxes}`);
  assert.ok(frames.some(hasArt), "w co najmniej jednej klatce widać ilustrację");
  const withBlocks = (needle) => frames.some((f) => f.includes(needle) && hasArt(f));
  for (const needle of ["Ziemia pod gwiazdami", "Brzezina", "Cesarski kurier", "Mistrz Gnieworad", "Skarimir", "Ragnosława", "Wojmir Cienki", "Tkanka zrośnięta", "Świt"]) {
    assert.ok(withBlocks(needle), `ilustracja w ekranie „${needle}”`);
  }
  setColorsEnabled(false);
  setRich256(null);
});

test("demo w TTY 200×50 bez 256 kolorów: żadnej ilustracji ani znaków ASCII zamiast niej, tekst na całą szerokość", async () => {
  const R = "<right>", D = "<down>", E = "<enter>";
  const creator = ["Thorgniew", E, R, R, D, R, D, R, R, D, D, D, D, D, E, "7", "9", D, D, D, E, E, E, E];
  const levelUp = [R, R, R, D, R, R, R, ...Array(10).fill(D), E, "5"];
  const keys = ["1", E, E, E, ...creator, E, WIN, E, E, ...levelUp, E, "5", E, "2", E, E, "5", E, "3", "4", E, E, { trip: { fight: "win" } }, E, ...AT_HUB, { expose: "2" }, R, R, R, D, E, E, E, E, "5"];
  setColorsEnabled(true);
  setRich256(false);
  try {
    const io = createAdaptiveIO(keys, { tty: true });
    io.columns = 200;
    io.rows = 50;
    const { lastState } = await run(io, { seed: 7 });
    assertDemoResult(lastState);
    const clean = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
    const frames = io.output.join("").split("\x1b[2J\x1b[3J\x1b[H").slice(1);
    assert.ok(frames.some((f) => f.includes("Brzezina")), "ekran Brzeziny");
    for (const raw of frames) {
      assert.ok(!raw.includes("\x1b[38;5;"), "bez kodów 256 kolorów");
      const ramp = clean(raw).split("\n").find((l) => /[#@%*+=]{4}/.test(l));
      assert.equal(ramp, undefined, "wiersz obrazka w ASCII");
    }
  } finally {
    setColorsEnabled(false);
    setRich256(null);
  }
});

/** The whole demo in a 200×50 colour terminal with the given look of the pictures; the frames of the run. */
async function demoFrames(mode) {
  const R = "<right>", D = "<down>", E = "<enter>";
  const creator = ["Thorgniew", E, R, R, D, R, D, R, R, D, D, D, D, D, E, "7", "9", D, D, D, E, E, E, E];
  const levelUp = [R, R, R, D, R, R, R, ...Array(10).fill(D), E, "5"];
  const keys = ["1", E, E, E, ...creator, E, WIN, E, E, ...levelUp, E, "5", E, "2", E, E, "5", E, "3", "4", E, E, { trip: { fight: "win" } }, E, ...AT_HUB, { expose: "2" }, R, R, R, D, E, E, E, E, "5"];
  setColorsEnabled(true);
  setRich256(true);
  setGraphics(mode);
  try {
    const io = createAdaptiveIO(keys, { tty: true });
    io.columns = 200;
    io.rows = 50;
    const { lastState } = await run(io, { seed: 7 });
    assertDemoResult(lastState);
    return io.output.join("").split("\x1b[2J\x1b[3J\x1b[H").slice(1);
  } finally {
    setGraphics("color");
    setColorsEnabled(false);
    setRich256(null);
  }
}
const FRAME_GREEN = "\x1b[38;5;28m"; // the frame's own colour (src/ui/colors.js)
const pictureCodes = (raw) => [...raw.matchAll(/\x1b\[38;5;(\d+)m(?:\x1b\[48;5;(\d+)m)?[▀▄]\x1b\[0m/g)].flatMap((m) => [m[1], m[2]]).filter(Boolean).map(Number);
const isGray = (c) => c === 16 || c === 231 || (c >= 232 && c <= 255);

test("demo w trybie czarno-białym: ilustracje w szarości, ramki dalej zielone", async () => {
  const frames = await demoFrames("gray");
  const brzezina = frames.filter((f) => f.includes("Brzezina") && hasArt(f));
  assert.ok(brzezina.length > 0, "ilustracja Brzeziny");
  for (const f of frames.filter(hasArt)) {
    const codes = pictureCodes(f);
    assert.ok(codes.length > 0);
    assert.deepEqual(codes.filter((c) => !isGray(c)), [], "kolor w ilustracji");
    assert.ok(f.includes(FRAME_GREEN), "ramka bez koloru");
  }
});

test("demo w trybie bez grafik: żadnej ilustracji ani ASCII, ramki dalej zielone", async () => {
  const frames = await demoFrames("none");
  const clean = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  assert.ok(frames.some((f) => f.includes("Brzezina")), "ekran Brzeziny");
  for (const f of frames) {
    assert.equal(hasArt(f), false, "ilustracja");
    assert.equal(pictureCodes(f).length, 0, "piksele obrazka");
    assert.equal(clean(f).split("\n").find((l) => /[#@%*+=]{4}/.test(l)), undefined, "wiersz obrazka w ASCII");
  }
  assert.ok(frames.some((f) => f.includes(FRAME_GREEN)), "ramka bez koloru");
});

test("E2a demo w TTY 80×24 w kolorze: żadnej ilustracji (brak miejsca), wygląd jak dotąd", async () => {
  const R = "<right>", D = "<down>", E = "<enter>";
  const creator = ["Thorgniew", E, R, R, D, R, D, R, R, D, D, D, D, D, E, "7", "9", D, D, D, E, E, E, E];
  const levelUp = [R, R, R, D, R, R, R, ...Array(10).fill(D), E, "5"];
  const keys = ["1", E, E, E, ...creator, E, WIN, E, E, ...levelUp, E, "5", E, "2", E, E, "5", E, "3", "4", E, E, { trip: { fight: "win" } }, E, ...AT_HUB, { expose: "2" }, R, R, R, D, E, E, E, E, "5"];
  setColorsEnabled(true);
  setRich256(true);
  const io = createAdaptiveIO(keys, { tty: true });
  io.columns = 80;
  io.rows = 24;
  const { lastState } = await run(io, { seed: 7 });
  assertDemoResult(lastState);
  const clean = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  const frames = io.output.join("").split("\x1b[2J\x1b[3J\x1b[H").slice(1);
  let boxes = 0;
  for (const raw of frames) {
    const lines = clean(raw).split("\n").filter((l) => l !== "");
    if (!lines[0]?.startsWith("█▀")) continue;
    boxes++;
    assert.equal(raw.split("\n").length - 1, 23, `luźny tekst w klatce:\n${clean(raw)}`);
    for (const l of lines.filter((x) => /^[█▌]/.test(x))) assert.ok([...l].length + (l.match(/⚡/g) ?? []).length <= 80, `${[...l].length} kolumn: ${l}`);
  }
  assert.ok(boxes > 100, `ramek: ${boxes}`);
  assert.ok(!frames.filter((f) => !f.includes("[48;5;16m")).some(hasArt), "w 80×24 żadna klatka (poza ekranem startowym) nie ma ilustracji");
  setColorsEnabled(false);
  setRich256(null);
});

test("wyjście z menu głównego czyści ekran terminala", async () => {
  const io = createScriptedIO(["5"], { tty: true });
  Object.assign(io, { columns: 120, rows: 40 });
  await runApp({ data, io, options: { debug: false, seed: 7 } });
  assert.ok(io.output.join("").endsWith("\x1b[2J\x1b[3J\x1b[H"), JSON.stringify(io.output.join("").slice(-40)));
});
