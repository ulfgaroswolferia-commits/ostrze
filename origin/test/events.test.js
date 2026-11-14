import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { pushEventNotices, formatRemaining, combatEventText } from "../src/ui/events.js";
import { statusBar } from "../src/ui/screen.js";
import { renderCharacter } from "../src/ui/character_screen.js";
import { setColorsEnabled } from "../src/ui/colors.js";
import { createCharacter, creatorStartAttributes } from "../src/systems/character.js";
import { createCombat } from "../src/systems/combat/state.js";
import { minimalData } from "./helpers.js";

setColorsEnabled(false);
const data = minimalData();
const notices = (events) => {
  const ctx = { data, notices: [] };
  pushEventNotices(ctx, events);
  return ctx.notices.map(strip);
};
const makeState = (effects) => {
  const character = createCharacter({
    name: "Thorgniew", classId: "miecz", attributes: { ...creatorStartAttributes(data), sila: 7, krzepa: 7, zrecznosc: 6 }, tagged: ["sieczna", "wrecz", "wymowa"],
  }, data);
  character.effects = effects;
  return { time: { minutes: 6 * 60 + 30 }, character, vars: {} };
};

test("pushEventNotices: dokładny tekst każdego typu zdarzenia", () => {
  assert.deepEqual(notices([
    { type: "zmiana_pory", to: "noc" },
    { type: "efekt_obrazenia", id: "trucizna", damage: 2 },
    { type: "efekt_koniec", id: "trucizna" },
    { type: "efekt_nalozony", id: "podchmielenie" },
    { type: "efekt_odparty", id: "trucizna" },
    { type: "otrzymano", id: "strzala", qty: 1 },
    { type: "otrzymano", id: "strzala", qty: 3 },
    { type: "oddano", id: "strzala", qty: 2 },
  ]), [
    "Zapadła noc.",
    "Zatruty: −2 HP.",
    "Mija: Zatruty.",
    "Jesteś teraz: Podchmielony.",
    "Opierasz się: Zatruty.",
    "Otrzymujesz: Strzała.",
    "Otrzymujesz: Strzała ×3.",
    "Oddajesz: Strzała ×2.",
  ]);
  assert.deepEqual(notices([
    { type: "pieniadze", delta: 5 },
    { type: "pieniadze", delta: -7 },
    { type: "xp", amount: 20 },
    { type: "bieglosc", masteryType: "miecz", before: 15, after: 16.4 },
    { type: "za_ciezko", id: "miecz_krotki", qty: 1 },
    { type: "flaga", id: "x", value: true },
    { type: "zmienna", changes: { wola: 1 } },
  ]), [
    "+5 gr",
    "−7 gr",
    "+20 PD",
    "Biegłość: Miecz 16.4.",
    "Krótki miecz się nie mieści – zostaje.",
  ]);
});

test("pushEventNotices: ponad 8 komunikatów – 8 + „…i n więcej.”", () => {
  const out = notices(Array.from({ length: 10 }, () => ({ type: "efekt_obrazenia", id: "trucizna", damage: 1 })));
  assert.equal(out.length, 9);
  assert.equal(out[8], "…i 2 więcej.");
});

test("formatRemaining: godziny, dni, dni z godzinami", () => {
  const ui = data.ui;
  assert.equal(formatRemaining(ui, 3), "3h");
  assert.equal(formatRemaining(ui, 23), "23h");
  assert.equal(formatRemaining(ui, 24), "1d");
  assert.equal(formatRemaining(ui, 29), "1d 5h");
  assert.equal(formatRemaining(ui, 48), "2d");
});

test("statusBar: efekty godzinowe, najwyżej 3 + reszta", () => {
  const one = makeState([{ id: "podchmielenie", remaining: 3, stacks: 1 }]);
  assert.match(strip(statusBar(one, data)), /HP \d+\/\d+ \[Podchmielony 3h\]/);
  const long = makeState([{ id: "podchmielenie", remaining: 29, stacks: 1 }, { id: "zmeczenie", remaining: 48, stacks: 1 }]);
  assert.match(strip(statusBar(long, data)), /\[Podchmielony 1d 5h\] \[Zmęczony 2d\]/);
  const many = { ...data, effects: [...data.effects, { id: "e4", name: "Czwarty", unit: "hour", duration: 2 }] };
  const four = makeState(["podchmielenie", "zmeczenie", "trucizna", "e4"].map((id) => ({ id, remaining: 2, stacks: 1 })));
  const bar = strip(statusBar(four, many));
  assert.match(bar, /\[Podchmielony 2h\] \[Zmęczony 2h\] \[Zatruty 2h\] \+1$/);
  assert.doesNotMatch(bar, /Czwarty/);
});

test("renderCharacter: sekcja efektów i rozbicie ze źródła efektu", () => {
  const state = makeState([{ id: "trucizna", remaining: 4, stacks: 2 }, { id: "podchmielenie", remaining: 3, stacks: 1 }, { id: "zmeczenie", remaining: 30, stacks: 1 }]);
  const out = strip(renderCharacter(state, data));
  assert.match(out, /Efekty/);
  assert.match(out, /Zatruty · zostały 4 h ×2/);
  assert.match(out, /Podchmielony · zostały 3 h\n/);
  assert.match(out, /Zmęczony · zostało 1d 6h/);
  assert.match(out, /\+10 Podchmielony/);
  assert.doesNotMatch(strip(renderCharacter(makeState([]), data)), /Efekty/);
});

test("statusBar: stopnie efektu ×n", () => {
  const two = makeState([{ id: "podchmielenie", remaining: 3, stacks: 2 }]);
  assert.match(strip(statusBar(two, data)), /\[Podchmielony ×2 3h\]/);
});

const fixedRng = { int: () => 1 };
const combatText = (event) => {
  const combat = createCombat(makeState([]), data, { enemies: [{ id: "bandyta", count: 2 }] }, fixedRng);
  const text = combatEventText(data.ui, data, combat, event);
  return text === null ? null : strip(text);
};

test("combatEventText: dokładny tekst każdego typu zdarzenia walki", () => {
  const cases = [
    [{ type: "atak", attacker: "player", target: "bandyta#1", hit: true, damage: 6, crit: false }, "Trafiasz Bandytę 1 za 6."],
    [{ type: "atak", attacker: "player", target: "bandyta#2", hit: true, damage: 9, crit: true }, "Trafiasz Bandytę 2 za 9 (krytyk!)."],
    [{ type: "atak", attacker: "player", target: "bandyta#1", hit: false, damage: 0, crit: false }, "Chybiasz."],
    [{ type: "atak", attacker: "bandyta#2", target: "player", hit: true, damage: 4, crit: false }, "Bandyta 2 trafia cię za 4."],
    [{ type: "atak", attacker: "bandyta#2", target: "player", hit: false, damage: 0, crit: false }, "Bandyta 2 chybia."],
    [{ type: "przeladowanie", weapon: "luk_mysliwski" }, "Przeładowujesz: Łuk myśliwski."],
    [{ type: "uzycie", item: "opatrunek" }, "Używasz: Opatrunek."],
    [{ type: "uzycie", item: "garnek_huku", hit: true }, "Używasz: Garnek huku."],
    [{ type: "uzycie", item: "garnek_huku", hit: false }, "Rzucasz: Garnek huku – chybiasz."],
    [{ type: "uzycie", item: "garnek_huku", hit: false, fumble: true }, "Garnek huku wybucha ci w rękach!"],
    [{ type: "leczenie", amount: 7 }, "Odzyskujesz 7 HP."],
    [{ type: "zmiana_broni" }, "Zmieniasz broń."],
    [{ type: "ruch", mover: "bandyta#1", target: "bandyta#1", band: "melee" }, "Bandyta 1 wchodzi w zwarcie."],
    [{ type: "ruch", mover: "bandyta#1", target: "bandyta#1", band: "far" }, "Bandyta 1 oddala się na dystans."],
    [{ type: "ruch", mover: "player", target: "bandyta#1", band: "melee" }, "Ruszasz na Bandytę 1."],
    [{ type: "ruch", mover: "player", target: "bandyta#2", band: "far" }, "Odskakujesz, trzymając Bandytę 2 na dystans."],
    [{ type: "obrona", bonus: 12 }, "Stajesz w gardzie (obrona +12)."],
    [{ type: "ucieczka", success: true }, "Uciekasz z walki."],
    [{ type: "ucieczka", success: false }, "Nie udaje ci się uciec."],
    [{ type: "wrog_pokonany", target: "bandyta#1" }, "Bandyta 1 pada."],
    [{ type: "wrog_ucieka", target: "bandyta#2" }, "Bandyta 2 ucieka."],
    [{ type: "tura_przepada", target: "bandyta#1" }, "Bandyta 1 jest ogłuszony i traci turę."],
    [{ type: "tura_przepada", target: "player" }, "Kręci ci się w głowie – tracisz turę."],
    [{ type: "remis" }, "Walka się dłuży – obie strony odpuszczają po 200 rundach."],
    [{ type: "pd", amount: 40 }, "+40 PD"],
    [{ type: "bieglosc", masteryType: "miecz", before: 15, after: 16.4 }, "Biegłość: Miecz 16.4."],
    [{ type: "efekt_nalozony", id: "zamroczenie", target: "bandyta#1" }, "Bandyta 1: zamroczenie."],
    [{ type: "efekt_nalozony", id: "zamroczenie", target: "player" }, "Jesteś teraz: Zamroczony."],
    [{ type: "efekt_nalozony", id: "zadymienie", target: "battlefield" }, "Na polu walki: W dymie."],
    [{ type: "efekt_odparty", id: "ogluszenie", target: "bandyta#2" }, "Bandyta 2 odpiera: ogłuszenie."],
    [{ type: "efekt_odparty", id: "ogluszenie", target: "player" }, "Opierasz się: Ogłuszony."],
    [{ type: "efekt_odporny", id: "krwawienie", target: "bandyta#1" }, "Bandyta 1 jest odporny: krwawienie."],
    [{ type: "efekt_obrazenia", id: "krwawienie", damage: 2, target: "bandyta#1" }, "Bandyta 1: krwawienie −2 HP."],
    [{ type: "efekt_obrazenia", id: "krwawienie", damage: 2, target: "player" }, "Krwawi: −2 HP."],
    [{ type: "efekt_koniec", id: "zamroczenie", target: "bandyta#1" }, "Bandyta 1: zamroczenie mija."],
    [{ type: "efekt_koniec", id: "zamroczenie", target: "player" }, "Mija: Zamroczony."],
    [{ type: "efekt_ap", id: "strach", ap: 1, target: "player" }, "Tracisz 1 PA: Przerażony."],
    [{ type: "flaga", id: "x", value: true }, null],
  ];
  for (const [event, expected] of cases) assert.equal(combatText(event), expected, JSON.stringify(event));
});

test("combatEventText: zdarzenia C2b – reakcja, skok, rzut bronią, podniesienie, broń palna", () => {
  const cases = [
    [{ type: "atak", attacker: "player", target: "bandyta#1", weapon: "para_wloczni", hit: true, damage: 5, crit: false, reaction: true }, "Dosięgasz Bandytę 1 – Para włóczni – za 5."],
    [{ type: "atak", attacker: "player", target: "bandyta#1", weapon: "para_wloczni", hit: true, damage: 8, crit: true, reaction: true }, "Dosięgasz Bandytę 1 – Para włóczni – za 8 (krytyk!)."],
    [{ type: "atak", attacker: "player", target: "bandyta#1", weapon: "para_wloczni", hit: false, damage: 0, crit: false, reaction: true }, "Twoja broń (Para włóczni) chybia."],
    [{ type: "atak", attacker: "player", target: "bandyta#2", weapon: "sztylet", hit: true, damage: 3, crit: false, thrown: true }, "Rzucasz: Sztylet – trafiasz Bandytę 2 za 3."],
    [{ type: "atak", attacker: "player", target: "bandyta#2", weapon: "sztylet", hit: true, damage: 6, crit: true, thrown: true }, "Rzucasz: Sztylet – trafiasz Bandytę 2 za 6 (krytyk!)."],
    [{ type: "atak", attacker: "player", target: "bandyta#2", weapon: "sztylet", hit: false, damage: 0, crit: false, thrown: true }, "Rzucasz: Sztylet – chybiasz."],
    [{ type: "ruch", mover: "bandyta#1", target: "bandyta#1", band: "melee", leap: true }, "Bandyta 1 skacze na ciebie!"],
    [{ type: "podniesienie", item: "sztylet" }, "Podnosisz: Sztylet."],
    [{ type: "niewypal", weapon: "pistolet_skalkowy" }, "Niewypał! Pistolet skałkowy nie strzela."],
    [{ type: "rozerwanie", weapon: "pistolet_skalkowy", damage: 4 }, "Lufa pęka! Pistolet skałkowy rozrywa się w dłoni – tracisz 4 HP."],
    [{ type: "strach_bronia", fear: 20 }, "Huk wystrzału płoszy wrogów (morale −20)."],
    [{ type: "posilki", enemies: ["bandyta#1", "bandyta#2"] }, "Na odgłosy walki nadbiegają posiłki: Bandyta 1, Bandyta 2. Walka trwa!"],
    [{ type: "dym", id: "zadymienie" }, "Na polu walki: W dymie."],
    [{ type: "bieglosc", masteryType: "wlocznie", before: 15, after: 15.8 }, "Biegłość: Włócznie 15.8."],
  ];
  for (const [event, expected] of cases) assert.equal(combatText(event), expected, JSON.stringify(event));
});
