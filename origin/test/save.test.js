import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import { savesDir } from "../src/config.js";
import { createRng } from "../src/engine/dice.js";
import { createNewState } from "../src/engine/state.js";
import { saveGame, loadGame, listSaves, SaveError } from "../src/engine/save.js";
import { tmpDir, minimalData } from "./helpers.js";

let prevHome;
beforeEach(async () => {
  prevHome = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
});
afterEach(() => {
  if (prevHome === undefined) delete process.env.OSTRZE_HOME;
  else process.env.OSTRZE_HOME = prevHome;
});

const fresh = () => createNewState({ seed: 1, startScene: "a", rules: { startHour: 6 } });

test("createNewState", () => {
  const s = createNewState({ seed: 42, startScene: "a", rules: { startHour: 6 } });
  assert.equal(s.time.minutes, 360); assert.equal(s.scene.id, "a"); assert.equal(s.version, 13);
  assert.deepEqual(s.flags, {}); assert.deepEqual(s.quests, {}); assert.equal(s.world.location, null);
});
test("zapis → odczyt daje ten sam stan + rngState z generatora, bez .tmp", async () => {
  const s = fresh();
  const rng = createRng(1); rng.next(); s.flags.x = true;
  await saveGame("1", s, rng);
  const back = await loadGame("1", minimalData());
  assert.equal(back.rngState, rng.getState()); assert.equal(back.flags.x, true);
  assert.ok(back.savedAt); assert.deepEqual(await readdir(savesDir()), ["1.json"]);
  assert.equal(s.savedAt, null);
});
test("nadpisanie istniejącego slotu", async () => {
  const d = minimalData(); const s = fresh();
  await saveGame("auto", s, createRng(1)); s.flags.y = true; await saveGame("auto", s, createRng(1));
  assert.equal((await loadGame("auto", d)).flags.y, true);
});
test("nieznany slot", async () => {
  await assert.rejects(saveGame("x", fresh(), createRng(1)), SaveError);
});
test("błędy odczytu", async () => {
  const d = minimalData();
  await assert.rejects(loadGame("2", d), { name: "LoadError", message: "brak zapisu" });
  await mkdir(savesDir(), { recursive: true });
  await writeFile(path.join(savesDir(), "2.json"), "{");
  await assert.rejects(loadGame("2", d), { message: "uszkodzony plik" });
  const s = fresh();
  await writeFile(path.join(savesDir(), "3.json"), JSON.stringify({ ...s, version: 99 }));
  await assert.rejects(loadGame("3", d), { message: "zapis z nowszej wersji gry" });
  await writeFile(path.join(savesDir(), "3.json"), JSON.stringify({ ...s, version: 0 }));
  await assert.rejects(loadGame("3", d), { message: "niepoprawna struktura (nieobsługiwana wersja zapisu)" });
  await writeFile(path.join(savesDir(), "3.json"), JSON.stringify({ ...s, scene: { id: "zniknela" } }));
  await assert.rejects(loadGame("3", d), { message: 'nieznana scena "zniknela"' });
  await writeFile(path.join(savesDir(), "3.json"), "[]");
  await assert.rejects(loadGame("3", d), { message: "niepoprawna struktura (oczekiwano obiektu)" });
  const { flags, ...broken } = s;
  await writeFile(path.join(savesDir(), "3.json"), JSON.stringify(broken));
  await assert.rejects(loadGame("3", d), { message: "niepoprawna struktura (flags)" });
});
test("listSaves opisuje poprawne i uszkodzone sloty", async () => {
  const d = minimalData(); const s = fresh();
  await saveGame("auto", s, createRng(1)); await writeFile(path.join(savesDir(), "1.json"), "{");
  const list = await listSaves(d);
  assert.deepEqual(list.map((e) => [e.slot, e.ok]), [["auto", true], ["1", false]]);
  assert.equal(list[0].summary.sceneId, "a"); assert.equal(list[0].summary.day, 1);
  assert.equal(list[0].summary.sceneTitle, null);
  assert.equal(list[1].error, "uszkodzony plik");
});

test("slot, którego nie da się odczytać: tekst z ui, a komunikat systemu tylko w reason (debug)", async () => {
  const d = minimalData();
  await mkdir(path.join(savesDir(), "2.json"), { recursive: true }); // a directory: readFile fails with EISDIR, not ENOENT
  await assert.rejects(loadGame("2", d), (err) => err.message === "błąd odczytu pliku" && /EISDIR|EPERM|EACCES/.test(err.reason));
  const [entry] = await listSaves(d);
  assert.equal(entry.error, "błąd odczytu pliku");
  assert.match(entry.reason, /EISDIR|EPERM|EACCES/);
});

test("zapis v1 migruje do v3 z vars: {}", async () => {
  const { vars, ...v1 } = fresh();
  await mkdir(savesDir(), { recursive: true });
  await writeFile(path.join(savesDir(), "1.json"), JSON.stringify({ ...v1, version: 1 }));
  const s = await loadGame("1", minimalData());
  assert.equal(s.version, 13); assert.deepEqual(s.vars, {});
});
test("zapis v2 bez vars jest odrzucony", async () => {
  const { vars, ...broken } = fresh();
  await mkdir(savesDir(), { recursive: true });
  await writeFile(path.join(savesDir(), "1.json"), JSON.stringify(broken));
  await assert.rejects(loadGame("1", minimalData()), { message: "niepoprawna struktura (vars)" });
});

test("nieznana klasa / perk w zapisie → LoadError", async () => {
  const d = minimalData();
  const character = { name: "Ala", classId: "miecz", level: 1, xp: 0, money: 0, attributes: { sila: 5 }, skillPoints: {}, tagged: [], perks: [], pendingLevelUp: null, hp: 10, effects: [] };
  await mkdir(savesDir(), { recursive: true });
  const put = (c) => writeFile(path.join(savesDir(), "3.json"), JSON.stringify({ ...fresh(), character: c }));
  await put(character);
  assert.equal((await loadGame("3", d)).character.name, "Ala");
  await put({ ...character, classId: "luk" });
  await assert.rejects(loadGame("3", d), { name: "LoadError", message: 'nieznana klasa "luk"' });
  await put({ ...character, perks: ["brak"] });
  await assert.rejects(loadGame("3", d), { message: 'nieznany perk "brak"' });
  await put({ ...character, level: 0 });
  await assert.rejects(loadGame("3", d), { name: "LoadError" });
  await put({ ...character, pendingLevelUp: { skillPoints: 1 } });
  await assert.rejects(loadGame("3", d), { name: "LoadError" });
});

// --- v3: ekwipunek, migracja, naprawa ---
const put = async (state, slot = "1") => {
  await mkdir(savesDir(), { recursive: true });
  await writeFile(path.join(savesDir(), `${slot}.json`), JSON.stringify(state));
};
const hero = () => ({
  name: "Ala", classId: "miecz", level: 1, xp: 0, money: 7, attributes: { sila: 5 },
  skillPoints: {}, tagged: [], perks: [], pendingLevelUp: null, hp: 10, effects: [],
});
const withInv = (inventory, extra = {}) => ({ ...fresh(), character: hero(), inventory: { loaded: {}, ...inventory }, ...extra });

test("zapis v2 (inventory: null, postać bez money) wczytuje się jako v3", async () => {
  const { money, ...old } = hero();
  const { shops, claimedRewards, ...world } = fresh().world;
  await put({ ...fresh(), version: 2, character: old, inventory: null, world });
  const s = await loadGame("1", minimalData());
  assert.equal(s.version, 13); assert.equal(s.character.money, 0);
  assert.deepEqual(s.inventory, { items: [], equipped: {}, quickSlots: [], loaded: {} });
  assert.deepEqual(s.world.shops, {}); assert.deepEqual(s.world.claimedRewards, []);
});
test("zapis v2 bez postaci (null) też się migruje", async () => {
  const v2 = { ...fresh(), version: 2, character: null }; delete v2.inventory;
  await put(v2);
  const s = await loadGame("1", minimalData());
  assert.equal(s.character, null); assert.deepEqual(s.inventory.items, []);
});
test("pełny cykl zachowuje ekwipunek, pieniądze, sklepy i odebrane nagrody", async () => {
  const s = withInv({ items: [{ id: "miecz_krotki", qty: 1 }, { id: "opatrunek", qty: 3 }], equipped: { bron: "miecz_krotki" }, quickSlots: [] });
  s.world.shops.kramarz_szkolny = [{ id: "opatrunek", qty: 2 }];
  s.world.claimedRewards = ["r1"];
  const rng = createRng(1);
  await saveGame("1", s, rng);
  const back = await loadGame("1", minimalData());
  assert.deepEqual(back.inventory, s.inventory); assert.equal(back.character.money, 7);
  assert.deepEqual(back.world.shops, s.world.shops); assert.deepEqual(back.world.claimedRewards, ["r1"]);
});
test("nieznany przedmiot jest usuwany z ostrzeżeniem", async () => {
  await put(withInv({ items: [{ id: "usuniety", qty: 1 }], equipped: { bron: "usuniety" }, quickSlots: ["usuniety"] }));
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.inventory, { items: [], equipped: {}, quickSlots: [], loaded: {} });
  assert.equal(warnings.length, 1); assert.match(warnings[0], /usuniety/); assert.match(warnings[0], /^Zapis naprawiony: /);
});
test("nieznany sklep i przedmiot w sklepie są usuwane", async () => {
  const st = withInv({ items: [], equipped: {}, quickSlots: [] });
  st.world.shops = { zniknal: [{ id: "opatrunek", qty: 1 }], kramarz_szkolny: [{ id: "usuniety", qty: 1 }, { id: "opatrunek", qty: 2 }] };
  await put(st);
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.world.shops, { kramarz_szkolny: [{ id: "opatrunek", qty: 2 }] });
  assert.equal(warnings.length, 2); assert.ok(warnings.some((w) => w.includes("zniknal"))); assert.ok(warnings.some((w) => w.includes("usuniety")));
});
test("miecz założony w złym slocie jest zdejmowany", async () => {
  await put(withInv({ items: [{ id: "miecz_krotki", qty: 1 }], equipped: { tulow: "miecz_krotki" }, quickSlots: [] }));
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.inventory.equipped, {}); assert.equal(s.inventory.items[0].qty, 1);
  assert.equal(warnings.length, 1); assert.match(warnings[0], /miecz_krotki/);
});
test("założone bez pokrycia w torbie jest zdejmowane", async () => {
  await put(withInv({ items: [], equipped: { bron: "miecz_krotki" }, quickSlots: [] }));
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.inventory.equipped, {}); assert.equal(warnings.length, 1);
});
test("quickSlots: przycięte do pasa, bez duplikatów i bez sztuk w torbie", async () => {
  await put(withInv({
    items: [{ id: "pas_zwykly", qty: 1 }, { id: "opatrunek", qty: 2 }, { id: "napar_ziol", qty: 1 }, { id: "garniec_wapno", qty: 1 }],
    equipped: { pas: "pas_zwykly" },
    quickSlots: ["opatrunek", "opatrunek", "napar_ziol", "garniec_wapno", "swieca_dymna"],
  }));
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.inventory.quickSlots, ["opatrunek", "napar_ziol"]);
  assert.ok(warnings.length >= 1);
});
test("zły kształt ekwipunku i money → LoadError", async () => {
  await put(withInv({ items: "x", equipped: {}, quickSlots: [] }));
  await assert.rejects(loadGame("1", minimalData()), { name: "LoadError", message: /^niepoprawna struktura \(/ });
  await put({ ...withInv({ items: [], equipped: {}, quickSlots: [] }), character: { ...hero(), money: -5 } });
  await assert.rejects(loadGame("1", minimalData()), { name: "LoadError", message: /money/ });
});

// --- v4: efekty statusu i stan rozmów ---
const withFx = (effects, world = {}) => {
  const s = withInv({ items: [], equipped: {}, quickSlots: [] });
  s.character.effects = effects;
  Object.assign(s.world, world);
  return s;
};
test("zapis v3 (bez effects, failedChecks, finishedDialogues) wczytuje się jako v5", async () => {
  const { failedChecks, finishedDialogues, ...world } = fresh().world;
  await put({ ...withInv({ items: [], equipped: {}, quickSlots: [] }), version: 3, world });
  const s = await loadGame("1", minimalData());
  assert.equal(s.version, 13); assert.deepEqual(s.character.effects, []);
  assert.deepEqual(s.world.failedChecks, []); assert.deepEqual(s.world.finishedDialogues, []);
});
test("pełny cykl zachowuje efekty, failedChecks i finishedDialogues", async () => {
  const s = withFx([{ id: "trucizna", remaining: 3, stacks: 2 }], { failedChecks: ["k1"], finishedDialogues: ["d1"] });
  await saveGame("1", s, createRng(1));
  const warnings = [];
  const back = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(back.character.effects, [{ id: "trucizna", remaining: 3, stacks: 2 }]);
  assert.deepEqual(back.world.failedChecks, ["k1"]); assert.deepEqual(back.world.finishedDialogues, ["d1"]);
  assert.deepEqual(warnings, []);
});
test("efekt usunięty z danych jest zdejmowany z ostrzeżeniem", async () => {
  await put(withFx([{ id: "usuniety", remaining: 2, stacks: 1 }, { id: "trucizna", remaining: 2, stacks: 1 }]));
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.character.effects.map((e) => e.id), ["trucizna"]);
  assert.equal(warnings.length, 1); assert.match(warnings[0], /usuniety/);
});
test("efekt turowy (oslepienie) w zapisie jest usuwany z ostrzeżeniem", async () => {
  await put(withFx([{ id: "oslepienie", remaining: 1, stacks: 1 }]));
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.character.effects, []);
  assert.equal(warnings.length, 1); assert.match(warnings[0], /oslepienie/);
});
test("kumulacja ponad maxStacks jest obcinana z ostrzeżeniem", async () => {
  await put(withFx([{ id: "trucizna", remaining: 2, stacks: 9 }, { id: "zmeczenie", remaining: 5, stacks: 2 }]));
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.character.effects.map((e) => e.stacks), [3, 1]);
  assert.equal(warnings.length, 1); assert.match(warnings[0], /trucizna/); assert.match(warnings[0], /zmeczenie/);
});
test("niepoprawne effects / failedChecks → LoadError", async () => {
  await put(withFx([{ id: "trucizna", remaining: 0, stacks: 1 }]));
  await assert.rejects(loadGame("1", minimalData()), { name: "LoadError", message: /niepoprawna struktura/ });
  await put(withFx([{ id: "trucizna", remaining: 1, stacks: 0 }]));
  await assert.rejects(loadGame("1", minimalData()), { name: "LoadError" });
  await put(withFx([], { failedChecks: "x" }));
  await assert.rejects(loadGame("1", minimalData()), { name: "LoadError", message: /niepoprawna struktura/ });
  await put(withFx([], { finishedDialogues: [1] }));
  await assert.rejects(loadGame("1", minimalData()), { name: "LoadError" });
});

test("zapis v3 i v4 bez dialogueProgress dostaje pusty obiekt", async () => {
  const { failedChecks, finishedDialogues, ...w3 } = fresh().world;
  await put({ ...withInv({ items: [], equipped: {}, quickSlots: [] }), version: 3, world: w3 });
  assert.deepEqual((await loadGame("1", minimalData())).world.dialogueProgress, {});
  const v4 = withInv({ items: [], equipped: {}, quickSlots: [] });
  delete v4.world.dialogueProgress;
  await put(v4);
  assert.deepEqual((await loadGame("1", minimalData())).world.dialogueProgress, {});
  assert.deepEqual(fresh().world.dialogueProgress, {});
});
test("dialogueProgress: wpis do nieznanej rozmowy lub węzła jest usuwany z ostrzeżeniem", async () => {
  await put(withFx([], { dialogueProgress: { sceny_nie_ma: "start" } }));
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.world.dialogueProgress, {});
  assert.equal(warnings.length, 1); assert.match(warnings[0], /sceny_nie_ma/);
  await put(withFx([], { dialogueProgress: { x: 5 } }));
  await assert.rejects(loadGame("1", minimalData()), { name: "LoadError", message: /niepoprawna struktura/ });
});
test("dialogueProgress: poprawny wpis przetrwa zapis i odczyt", async () => {
  const data = minimalData();
  data.dialogues = [{ id: "d", start: "a", nodes: { a: { speaker: "X", text: "t" }, b: { speaker: "X", text: "t" } } }];
  data.story.scenes.push({ id: "rozmowa", type: "dialogue", dialogue: "d" });
  await put(withFx([], { dialogueProgress: { rozmowa: "b", zla: "a" }, finishedDialogues: [] }));
  const warnings = [];
  const s = await loadGame("1", data, { warnings });
  assert.deepEqual(s.world.dialogueProgress, { rozmowa: "b" });
  assert.equal(warnings.length, 1); assert.match(warnings[0], /zla/);
});

test("finishedCombats: nowy stan {}, stary zapis dostaje {}, wpis przetrwa, zły typ odrzucony", async () => {
  assert.deepEqual(fresh().world.finishedCombats, {});
  const old = withInv({ items: [], equipped: {}, quickSlots: [] });
  delete old.world.finishedCombats;
  await put(old);
  assert.deepEqual((await loadGame("1", minimalData())).world.finishedCombats, {});
  await put(withFx([], { finishedCombats: { a: "win" } }));
  assert.deepEqual((await loadGame("1", minimalData())).world.finishedCombats, { a: "win" });
  await put(withFx([], { finishedCombats: { a: 5 } }));
  await assert.rejects(loadGame("1", minimalData()), { name: "LoadError", message: /niepoprawna struktura/ });
});

// --- v5: stan naładowania broni ---
const withLoaded = (loaded) => withInv({ items: [], equipped: {}, quickSlots: [], loaded });
test("zapis v4 (bez loaded) wczytuje się jako v5 z loaded: {}", async () => {
  const v4 = { ...withInv({ items: [], equipped: {}, quickSlots: [] }), version: 4 };
  delete v4.inventory.loaded;
  await put(v4);
  const s = await loadGame("1", minimalData());
  assert.equal(s.version, 13); assert.deepEqual(s.inventory.loaded, {});
  assert.deepEqual(fresh().inventory.loaded, {});
});
test("loaded: pełny cykl zachowuje { luk_mysliwski: 1 } bez ostrzeżeń", async () => {
  await saveGame("1", withLoaded({ luk_mysliwski: 1 }), createRng(1));
  const warnings = [];
  const back = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(back.inventory.loaded, { luk_mysliwski: 1 }); assert.deepEqual(warnings, []);
});
test("loaded: przedmiot bez reload lub nieznany jest usuwany z ostrzeżeniem", async () => {
  await put(withLoaded({ miecz_krotki: 1, luk_mysliwski: 1, usuniety: 1 }));
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.inventory.loaded, { luk_mysliwski: 1 });
  assert.equal(warnings.length, 1); assert.match(warnings[0], /miecz_krotki/); assert.match(warnings[0], /usuniety/);
});
test("loaded: wartość ponad capacity jest obcinana z ostrzeżeniem", async () => {
  await put(withLoaded({ kusza_lekka: 5 }));
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.inventory.loaded, { kusza_lekka: 1 });
  assert.equal(warnings.length, 1); assert.match(warnings[0], /kusza_lekka/);
});
test("loaded: ujemna lub nie-liczba → LoadError", async () => {
  await put(withLoaded({ luk_mysliwski: -1 }));
  await assert.rejects(loadGame("1", minimalData()), { name: "LoadError", message: /niepoprawna struktura/ });
  await put(withLoaded({ luk_mysliwski: "x" }));
  await assert.rejects(loadGame("1", minimalData()), { name: "LoadError" });
});

test("broń bez offhand w bron_druga jest zdejmowana z ostrzeżeniem", async () => {
  await put(withInv({ items: [{ id: "miecz_krotki", qty: 1 }], equipped: { bron_druga: "miecz_krotki" }, quickSlots: [] }));
  const warnings = [];
  const s = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(s.inventory.equipped, {}); assert.equal(warnings.length, 1); assert.match(warnings[0], /miecz_krotki/);
});
test("sztylet w bron_druga przechodzi wczytanie", async () => {
  await put(withInv({ items: [{ id: "sztylet", qty: 1 }], equipped: { bron_druga: "sztylet" }, quickSlots: [] }));
  const s = await loadGame("1", minimalData(), { warnings: [] });
  assert.deepEqual(s.inventory.equipped, { bron_druga: "sztylet" });
});

// --- v6: biegłość w broni ---
test("zapis v5 → v6: biegłość zera + start klasy; naprawa przycina i usuwa nieznane", async () => {
  const d = minimalData();
  const v5 = { ...withInv({ items: [], equipped: {}, quickSlots: [] }), version: 5 };
  delete v5.character.mastery; v5.character.classId = "wlocznia";
  await put(v5);
  const s = await loadGame("1", d);
  assert.equal(s.version, 13);
  assert.deepEqual(s.character.mastery, { miecz: 0, wlocznie: 15, luk: 0, kusza: 0, palna: 0, rzucana: 0 });
  const bad = withInv({ items: [], equipped: {}, quickSlots: [] });
  bad.character.mastery = { miecz: 150, luk: -3, x: 5 };
  await put(bad);
  const warnings = [];
  const fixed = await loadGame("1", d, { warnings });
  assert.deepEqual(fixed.character.mastery, { miecz: 100, wlocznie: 0, luk: 0, kusza: 0, palna: 0, rzucana: 0 });
  assert.equal(warnings.length, 1); assert.match(warnings[0], /biegłość/);
});
test("biegłość: pełny cykl zapisu bez ostrzeżeń", async () => {
  const s = withInv({ items: [], equipped: {}, quickSlots: [] });
  s.character.mastery = { miecz: 16.4, wlocznie: 0, luk: 0, kusza: 0, palna: 0, rzucana: 0 };
  await saveGame("1", s, createRng(1));
  const warnings = [];
  const back = await loadGame("1", minimalData(), { warnings });
  assert.equal(back.character.mastery.miecz, 16.4); assert.deepEqual(warnings, []);
});

// --- v7: artefakty i zjawiska ---
test("zapis v6 → v7: wpisy artefaktów z torby, brak zjawiska, dzień losowania = bieżący", async () => {
  const d = minimalData();
  const v6 = { ...withInv({ items: [{ id: "kamien_zmierzchu", qty: 1 }], equipped: { talizman: "kamien_zmierzchu" }, quickSlots: [] }), version: 6 };
  delete v6.artifacts; delete v6.world.phenomenon; delete v6.world.phenomenonRolledDay;
  v6.time.minutes = 2 * 24 * 60 + 300;
  await put(v6);
  const s = await loadGame("1", d);
  assert.equal(s.version, 13);
  assert.deepEqual(s.artifacts, { kamien_zmierzchu: { charge: 40, exposed: false } });
  assert.equal(s.world.phenomenon, null);
  assert.equal(s.world.phenomenonRolledDay, 3);
});
test("v7: naprawa ładunku, nieznanych artefaktów, wystawienia i zjawiska", async () => {
  const s = withInv({ items: [{ id: "kamien_zmierzchu", qty: 1 }], equipped: {}, quickSlots: [] });
  s.artifacts = { kamien_zmierzchu: { charge: 150, exposed: true }, smoczy_kamien: { charge: 3, exposed: false } };
  s.world.phenomenon = { id: "smok", startsAt: 0, endsAt: 60, omenAt: 0, omenShown: true, started: true };
  s.world.phenomenonRolledDay = 1;
  await put(s);
  const warnings = [];
  const back = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(back.artifacts, { kamien_zmierzchu: { charge: 100, exposed: false } });
  assert.equal(back.world.phenomenon, null);
  assert.ok(warnings.length >= 1);
});
test("v7: pełny cykl zapisu ze zjawiskiem bez ostrzeżeń", async () => {
  const s = withInv({ items: [{ id: "kamien_zmierzchu", qty: 1 }], equipped: {}, quickSlots: [] });
  s.artifacts = { kamien_zmierzchu: { charge: 63.5, exposed: false } };
  s.world.phenomenon = { id: "burza_iskier", startsAt: 600, endsAt: 780, omenAt: 480, omenShown: true, started: false };
  s.world.phenomenonRolledDay = 1;
  await saveGame("1", s, createRng(1));
  const warnings = [];
  const back = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(back.artifacts, s.artifacts);
  assert.deepEqual(back.world.phenomenon, s.world.phenomenon);
  assert.deepEqual(warnings, []);
});

test("zapis v7 → v8: lokacja startowa, brak podróży, pusta lista zdarzeń", async () => {
  const d = minimalData();
  const v7 = { ...fresh(), version: 7 };
  delete v7.world.travel; delete v7.world.eventsSeen; v7.world.location = null;
  await put(v7);
  const s = await loadGame("1", d);
  assert.equal(s.version, 13);
  assert.equal(s.world.location, "brzezina");
  assert.equal(s.world.travel, null);
  assert.deepEqual(s.world.eventsSeen, []);
});
test("v8: naprawa podróży – nieznane zdarzenie → wymarsz bez zdarzenia; nieznana trasa → brak podróży; nieznana lokacja → start", async () => {
  const d = minimalData();
  const s = fresh();
  s.world.location = "brzezina";
  s.world.travel = { route: "brzezina_wilczy_brod", day: 2, daysTotal: 2, phase: "event", event: "smok", eventHour: 3, eventScene: "x",
    hoursWalked: 3, slowHours: 0, slowBy: null, dangerous: false, delayed: false, foraged: false };
  await put(s);
  const warnings = [];
  const back = await loadGame("1", d, { warnings });
  assert.equal(back.world.travel.phase, "depart");
  assert.equal(back.world.travel.day, 2);
  assert.equal(back.world.travel.event, null);
  assert.equal(back.world.travel.eventScene, null);
  assert.equal(back.world.travel.hoursWalked, 0);
  assert.ok(warnings.some((w) => w.includes("smok")), warnings.join("\n"));
  s.world.travel.route = "do_rzymu";
  s.world.location = "rzym";
  await put(s);
  const w2 = [];
  const b2 = await loadGame("1", d, { warnings: w2 });
  assert.equal(b2.world.travel, null);
  assert.equal(b2.world.location, "brzezina");
  assert.ok(w2.some((w) => w.includes("do_rzymu")) && w2.some((w) => w.includes("rzym")), w2.join("\n"));
  s.world.travel = { ...s.world.travel, route: "brzezina_wilczy_brod", phase: "event", event: "wilki", eventScene: "wilki_walka" };
  s.world.location = "brzezina";
  await put(s);
  const w3 = [];
  const b3 = await loadGame("1", d, { warnings: w3 });
  assert.equal(b3.world.travel.eventScene, "wilki_walka", "poprawna scena zdarzenia zostaje");
  assert.deepEqual(w3, []);
});

test("zapis v8 → v9: mapa pusta, podróż dostaje reverse/quest/turnBack, zadania zostają", async () => {
  const d = minimalData();
  const v8 = { ...fresh(), version: 8 };
  delete v8.world.map;
  v8.world.location = "brzezina";
  v8.world.travel = { route: "brzezina_wilczy_brod", day: 1, daysTotal: 2, phase: "depart", event: null, eventHour: null, eventScene: null,
    hoursWalked: 0, slowHours: 0, slowBy: null, dangerous: false, delayed: false, foraged: false };
  await put(v8);
  const s = await loadGame("1", d);
  assert.equal(s.version, 13);
  assert.equal(s.world.map, null);
  assert.equal(s.world.travel.reverse, false);
  assert.equal(s.world.travel.quest, null);
  assert.equal(s.world.travel.turnBack, false);
  assert.deepEqual(s.quests, {});
});
test("v9: naprawa zadań przy wczytaniu – ostrzeżenie", async () => {
  const s = fresh();
  s.world.location = "wilczy_brod";
  s.quests = { smok: { status: "active", acceptedAt: 0, deadline: null, departed: false } };
  await put(s);
  const warnings = [];
  const back = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(back.quests, {});
  assert.ok(warnings.some((w) => w.includes("smok")), warnings.join("\n"));
});
test("zapis v9 → v10: discovered i hinted puste", async () => {
  const v9 = { ...fresh(), version: 9 };
  delete v9.world.discovered; delete v9.world.hinted;
  await put(v9);
  const s = await loadGame("1", minimalData());
  assert.equal(s.version, 13);
  assert.deepEqual(s.world.discovered, []);
  assert.deepEqual(s.world.hinted, []);
});
test("v10: nieznane id w discovered jest usuwane z ostrzeżeniem", async () => {
  const s = fresh();
  s.world.discovered = ["wilczy_brod", "duch"];
  await put(s);
  const warnings = [];
  const back = await loadGame("1", minimalData(), { warnings });
  assert.deepEqual(back.world.discovered, ["wilczy_brod"]);
  assert.ok(warnings.some((w) => w.includes("duch")), warnings.join("\n"));
});
test("zapis v11 → v12: passes i hunts puste", async () => {
  const v11 = { ...fresh(), version: 11 };
  delete v11.world.passes; delete v11.world.hunts;
  await put(v11);
  const s = await loadGame("1", minimalData());
  assert.equal(s.version, 13);
  assert.deepEqual(s.world.passes, {});
  assert.deepEqual(s.world.hunts, {});
});
test("zapis v11 → v12: spacer w toku (stary kształt, krok 1) kończy się po migracji", async () => {
  const v11 = { ...fresh(), version: 11 };
  v11.world.map = { hub: "wilczy_brod", phase: "walk", quest: null, questScene: null, spot: null, spotScene: null, visitor: null, walk: { to: "wilczy_las", step: 1, left: 20, event: "pielgrzym", eventScene: "pielgrzym_spotkanie" } };
  await put(v11);
  const s = await loadGame("1", minimalData());
  assert.deepEqual(s.world.map.walk, { to: "wilczy_las", legs: [0, 20], events: ["pielgrzym"], step: 1, eventScene: "pielgrzym_spotkanie" });
});
test("zapis v11 → v12: spacer jeszcze nie rozpoczęty znika", async () => {
  const v11 = { ...fresh(), version: 11 };
  v11.world.map = { hub: "wilczy_brod", phase: "walk", quest: null, questScene: null, spot: null, spotScene: null, visitor: null, walk: { to: "wilczy_las", step: 0, left: 40, event: null, eventScene: null } };
  await put(v11);
  const s = await loadGame("1", minimalData());
  assert.equal(s.world.map.walk, null);
  assert.equal(s.world.map.phase, "choose");
});
