import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { combatState } from "./helpers.js";
import { startQuest, advanceErrands, completeQuest, hubProgress } from "../src/systems/quests.js";
import { renderJournal } from "../src/ui/journal_screen.js";

const data = await loadData();
const strip = (s) => stripVTControlCharacters(s);
function hero(hub = "ulfgrod") {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.time.minutes = 9 * 60;
  s.world.map = { hub, phase: "place", spot: null, spotScene: null };
  s.world.location = hub;
  return s;
}

test("postęp huba: zadania obowiązkowe (wątek główny) liczone od zera, cele z licznikiem dają ułamek", () => {
  const s = hero();
  assert.deepEqual(hubProgress(s, data, "ulfgrod"), { percent: 0, done: 0, total: 5 });
  startQuest(s, data, "watek_ulfgrod");
  assert.equal(hubProgress(s, data, "ulfgrod").percent, 0);
  Object.assign(s.flags, { hjalmar_poznany: true, smyk_poznany: true });
  s.vars.zlecenia_stolicy = 1;
  advanceErrands(s, data, createRng(1));
  const p = hubProgress(s, data, "ulfgrod");
  assert.equal(p.done, 1);
  assert.equal(p.percent, 27, "1 cel + 1/3 drugiego z pięciu → 27%");
  s.vars.zlecenia_stolicy = 3;
  advanceErrands(s, data, createRng(1));
  assert.equal(hubProgress(s, data, "ulfgrod").percent, 40);
});

test("postęp huba: ukończony wątek to 100%, hub bez wątku głównego nie ma licznika, procent rośnie monotonicznie i nie przekracza 100", () => {
  const s = hero();
  startQuest(s, data, "watek_ulfgrod");
  let last = 0;
  for (const step of [{ hjalmar_poznany: true, smyk_poznany: true }, { dowod_zywego: true }, { palac_otwarty: true }]) {
    Object.assign(s.flags, step);
    s.vars.zlecenia_stolicy = 3;
    advanceErrands(s, data, createRng(1));
    const p = hubProgress(s, data, "ulfgrod").percent;
    assert.ok(p >= last && p <= 100);
    last = p;
  }
  assert.ok(last >= 80 && last < 100);
  s.flags.akt4b_koniec = true;
  advanceErrands(s, data, createRng(1));
  assert.equal(hubProgress(s, data, "ulfgrod").percent, 100);
  assert.equal(hubProgress(s, data, "nie_ma_takiego"), null);
});

test("postęp huba: porzucony wątek (po opuszczeniu huba) nie spada poniżej tego, co było zrobione", () => {
  const s = hero();
  startQuest(s, data, "watek_ulfgrod");
  Object.assign(s.flags, { hjalmar_poznany: true, smyk_poznany: true });
  s.vars.zlecenia_stolicy = 3;
  advanceErrands(s, data, createRng(1));
  const before = hubProgress(s, data, "ulfgrod").percent;
  s.quests.watek_ulfgrod.status = "failed";
  assert.equal(hubProgress(s, data, "ulfgrod").percent, before);
});

test("dziennik: pokazuje „Postęp w <hub>: N%” dla huba, w którym stoi gracz; bez huba lub bez wątku – bez linii", () => {
  const s = hero();
  assert.doesNotMatch(renderJournal(s, data).map(strip).join("\n"), /Postęp w/);
  startQuest(s, data, "watek_ulfgrod");
  Object.assign(s.flags, { hjalmar_poznany: true, smyk_poznany: true });
  s.vars.zlecenia_stolicy = 1;
  advanceErrands(s, data, createRng(1));
  const lines = renderJournal(s, data).map(strip);
  assert.ok(lines.some((l) => /Postęp w Ulfgród: 27%/.test(l)), lines.join("\n"));
  assert.ok(lines.every((l) => [...l].length <= 80));
  const s2 = hero("przystan_jarnowo");
  assert.doesNotMatch(renderJournal(s2, data).map(strip).join("\n"), /Postęp w/, "wątek jeszcze nie ruszył – licznik nie pojawia się");
  delete s.world.map;
  assert.ok(renderJournal(s, data).map(strip).some((l) => /Postęp w Ulfgród/.test(l)), "w podróży z aktywnym wątkiem też");
});

test("postęp huba: wszystkie huby fabuły mają wątek główny z celami (licznik jest dostępny w całej grze)", () => {
  for (const hub of ["oboz_wronia", "ulfgrod", "loch_pod_palacem", "przystan_jarnowo", "wir_lysa_skala"]) {
    const p = hubProgress(hero(hub), data, hub);
    assert.ok(p && p.total >= 3, `${hub}: ${JSON.stringify(p)}`);
  }
  void completeQuest;
});

// --- zlecenia poboczne w hubie ---
import { sideQuestsOf, sideProgress } from "../src/systems/quests.js";
import { readFileSync, readdirSync } from "node:fs";

const realData = await loadData();

test("poboczne: bez wątków głównych, bez tego, czego wymaga fabuła, i bez losowych z drogi", () => {
  const ids = (hub) => sideQuestsOf(realData, hub).map((q) => q.id);
  for (const hub of ["wilczy_brod", "gluszec", "obserwatorium", "oboz_wronia", "ulfgrod", "przystan_jarnowo"]) assert.ok(ids(hub).length > 0, hub);
  assert.ok(!ids("oboz_wronia").includes("watek_front"));
  assert.ok(!ids("oboz_wronia").includes("buty_dla_wartownika"), "losowa");
  assert.ok(ids("oboz_wronia").includes("zold_w_kosciach"));
  assert.ok(!ids("gluszec").includes("przyjecie_w_osadzie"), "wymaga go fabuła");
  assert.ok(!ids("obserwatorium").includes("dlug_istoty_zlecenie"), "wymaga go fabuła");
  assert.ok(!ids("wilczy_brod").includes("eskorta_ostromira"), "wymaga go fabuła");
  assert.equal(sideProgress({ quests: {} }, realData, "wir_lysa_skala"), null, "bez pobocznych nie ma licznika");
});

test("poboczne: każde zlecenie startujące tylko ze zdarzenia drogi albo gościa jest oznaczone jako losowe", () => {
  const dir = new URL("../data/dialogues/", import.meta.url);
  const starters = new Map();
  for (const f of readdirSync(dir)) {
    const text = readFileSync(new URL(f, dir), "utf8");
    for (const m of text.matchAll(/"startQuest": "([a-z0-9_]+)"/g)) starters.set(m[1], [...(starters.get(m[1]) ?? []), f.replace(".json", "")]);
  }
  for (const q of realData.quests.filter((x) => (starters.get(x.id) ?? []).some((d) => d.startsWith("prosba_")))) assert.equal(q.random, true, q.id);
});

test("poboczne: licznik maleje przy ukończeniu, porażce i gdy fabuła zamknie zlecenie; aktywne dalej się liczy", () => {
  const s = hero();
  const hub = "wilczy_brod";
  const { total, left, closed } = sideProgress(s, realData, hub);
  assert.deepEqual([left, closed], [total, 0]);
  s.quests = { ...(s.quests ?? {}), lek_dla_wrzoska: { status: "done" } };
  assert.equal(sideProgress(s, realData, hub).left, total - 1);
  s.quests.zboze_dla_mlyna = { status: "failed" };
  assert.equal(sideProgress(s, realData, hub).left, total - 2);
  s.flags.zona_poinformowana = true;
  assert.equal(sideProgress(s, realData, hub).left, total - 3, "pasterz załatwiony inaczej");
  s.quests.zaginiony_pasterz_borek = { status: "active" };
  assert.equal(sideProgress(s, realData, hub).left, total - 2, "rozpoczęte zlecenie trzeba jednak skończyć");
});

test("dziennik: pokazuje, ile pobocznych zostało w hubie, a po wszystkim mówi to wprost", () => {
  const s = hero();
  s.world.map = { hub: "oboz_wronia" };
  const line = () => renderJournal(s, realData).find((l) => l.includes("Zlecenia poboczne")) ?? "";
  const { total } = sideProgress(s, realData, "oboz_wronia");
  assert.match(line(), new RegExp(`zosta(?:ło|ły) ${total} z ${total}`));
  for (const q of sideQuestsOf(realData, "oboz_wronia")) s.quests = { ...(s.quests ?? {}), [q.id]: { status: "done" } };
  assert.match(line(), new RegExp(`wszystkie załatwione \\(${total}\\)`));
});
