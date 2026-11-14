import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { dataDir } from "../src/config.js";
import { parsePix } from "../src/engine/pix.js";
import { createCharacter } from "../src/systems/character.js";
import { grantStartKit } from "../src/systems/inventory.js";
import { doAction } from "../src/systems/combat/actions.js";
import { TECHNIQUE_IDS, doTechnique } from "../src/systems/combat/techniques.js";
import { beginTurn, endTurn, runEnemyTurns, outcomeOf, finishCombat } from "../src/systems/combat/turn.js";
import { InputExhaustedError, InputClosedError, InterruptError } from "../src/ui/io.js";
import { stripVTControlCharacters } from "node:util";
import { readFrame } from "./frame_read.js";

export function tmpDir() {
  return fsp.mkdtemp(path.join(os.tmpdir(), "ostrze-test-"));
}

const readReal = (file) => JSON.parse(fs.readFileSync(path.join(dataDir(), file), "utf8"));

/** Real dialogues in file-name order, with `file` like loadData. */
const readDialogues = () => fs.readdirSync(path.join(dataDir(), "dialogues")).filter((f) => f.endsWith(".json")).sort()
  .map((file) => ({ ...readReal(`dialogues/${file}`), file }));

/** Real art like loadData: `{ id: { w, h, palette, rows } }`. */
const readArt = () => Object.fromEntries(fs.readdirSync(path.join(dataDir(), "art")).filter((f) => f.endsWith(".pix")).sort()
  .map((f) => [f.slice(0, -4), parsePix(fs.readFileSync(path.join(dataDir(), "art", f), "utf8"))]));

/** Real region maps like loadData: `{ region: text }`. */
const readMaps = () => Object.fromEntries(fs.readdirSync(path.join(dataDir(), "maps")).filter((f) => f.endsWith(".txt")).sort()
  .map((f) => [f.slice(0, -4), fs.readFileSync(path.join(dataDir(), "maps", f), "utf8")]));

/** The fixture fights are scripted: the noise of a quick kill (random reinforcements) is tested on its own. */
function withoutKillNoise(rules) {
  rules.combat.noise.chance = 0;
  return rules;
}

/** Valid GameData; `overrides` are merged into `story` ({ start, scenes }). */
export function minimalData(overrides = {}) {
  return {
    ui: readReal("ui.json"),
    rules: withoutKillNoise(readReal("rules.json")),
    attributes: readReal("attributes.json"),
    skills: readReal("skills.json"),
    classes: readReal("classes.json").map((c) => ({ ...c, startItems: c.startItems.map((i) => (i.id === "prowiant" ? { ...i, qty: 2 } : i)) })), // a fixed kit for the tests that count weight and rows; the real start: test/three_tweaks.test.js
    perks: readReal("perks.json"),
    effects: readReal("effects.json"),
    enemies: readReal("enemies.json"),
    phenomena: readReal("phenomena.json"),
    travel: readReal("travel.json"),
    quests: readReal("quests.json"),
    art: readArt(),
    maps: readMaps(),
    items: readReal("items.json"),
    shops: readReal("shops.json"),
    loot: readReal("loot.json"),
    dialogues: readDialogues(),
    story: {
      start: "a",
      scenes: [
        { id: "a", type: "narration", text: "x" },
        { id: "b", type: "ending", text: "y" },
      ],
      ...overrides,
    },
  };
}

/** Level-1 state with the class start kit (all attribute points spread evenly), for combat tests. */
export function combatState(data, classId) {
  const rules = data.rules.creator;
  const attributes = Object.fromEntries(data.attributes.map((a) => [a.id, rules.attributeStart + (rules.gifts[a.id] ?? 0)]));
  let pool = rules.points;
  while (pool > 0) {
    for (const a of data.attributes) if (pool > 0 && attributes[a.id] < rules.attributeMax) { attributes[a.id]++; pool--; }
  }
  const cls = data.classes.find((c) => c.id === classId);
  const tagged = [...new Set([cls.taggedSkill, "wymowa", "medycyna"])].slice(0, rules.taggedCount);
  const character = createCharacter({ name: "Test", classId, attributes, tagged }, data);
  const state = { character, time: { minutes: 12 * 60 }, flags: {}, vars: {}, inventory: { items: [], equipped: {}, quickSlots: [], loaded: {} } };
  grantStartKit(state, data, classId);
  return state;
}

/**
 * Plays a whole fight the way the combat scene will: enemies first if they lead, then player turns driven by
 * `strategy(state, data, combat)` -> action (a technique id goes through `doTechnique`) | null (null = end turn), until an outcome appears.
 */
export function playFight(state, data, combat, rng, strategy) {
  runEnemyTurns(state, data, combat, rng);
  while (!outcomeOf(state, combat)) {
    const begun = beginTurn(state, data, combat, rng);
    if (outcomeOf(state, combat)) break;
    for (let guard = 0; !begun.skip && !outcomeOf(state, combat) && guard < 50; guard++) {
      const action = strategy(state, data, combat);
      if (!action) break;
      const r = TECHNIQUE_IDS.includes(action.id) ? doTechnique(state, data, combat, action, rng) : doAction(state, data, combat, action, rng);
      if (!r.ok || r.endTurn) break;
    }
    if (outcomeOf(state, combat)) break;
    endTurn(state, data, combat);
    runEnemyTurns(state, data, combat, rng);
  }
  return finishCombat(state, data, combat, rng);
}

// ---------------------------------------------------------------------------------------------------------------
// Adaptive test driver: scripted IO that plays fights by reading the combat screen (any RNG path).

const UI = readReal("ui.json");
const ITEMS = readReal("items.json");
/** The fixed text of a ui string before its first placeholder. */
const lead = (key) => UI[key].split("{")[0];
const PLAYER_LINE = lead("combat.playerLine");
const SUMMARY_LINES = ["combat.summaryWin", "combat.summaryFled", "combat.summaryLost", "combat.summaryLostTraining", "combat.summaryDraw"].map(lead).map((l) => l.slice(0, 14)); // a frame wraps a long line, so only its start is compared
const BANDAGE = ITEMS.find((i) => i.id === "opatrunek").name;
/** Label starts of the Techniki submenu rows by technique id. */
const TECHNIQUE_LABELS = {
  dual: [lead("combat.tech.dual")], guard: [lead("combat.tech.guard")],
  throw: [lead("combat.tech.throw"), UI["combat.tech.throwAny"]], pickup: [lead("combat.tech.pickup"), UI["combat.tech.pickupAny"]],
};
/** Texts the `{ trip }` step looks for on the travel screens. */
const ARRIVAL = UI["travel.arrival"].split("{")[0];
const TRIP_TALK = ["Sam mam mało", "Nie tym razem", "Bywaj.", "Dość. Idę dalej.", "Stoję i patrzę", "Idę."]; // the hungry wanderer: refuse, then say goodbye; the battlefield and the crossroads
const MAX_TRIP_ANSWERS = 500;
/** Screens a trip never shows: reaching one means the game left the trip (a crash). */
const TRIP_ESCAPES = [UI["error.crash"], UI["error.crashNoSave"]];

/** Number (1-based) of the row starting with `label` in the latest menu of `text` ("[n] …" lines, or "▶ "/"  " rows on a TTY). */
function rowNumber(text, label, tty) {
  const lines = text.split("\n");
  // A frame's choice rows: "▌ … ▒ ▶ [2] Nie tym razem.   ▐" or a one-line "▶ [1] Tak   [2] Nie".
  for (const l of [...lines].reverse()) {
    const inner = l.replace(/^▌ /, "").replace(/ *▐$/, "");
    for (const m of inner.matchAll(/\[(\d+)\] ([^[]*)/g)) {
      if (/^▌/.test(l) && m[2].trimEnd().startsWith(label)) return m[1];
    }
  }
  if (!tty) {
    const row = lines.reverse().find((l) => /^\[\d+\] /.test(l) && l.replace(/^\[\d+\] /, "").startsWith(label));
    return row ? /^\[(\d+)\]/.exec(row)[1] : null;
  }
  let block = [];
  let current = [];
  for (const l of lines) {
    if (/^(▶ | {2})\S/.test(l)) current.push(l.slice(2));
    else if (current.length) { block = current; current = []; }
  }
  if (current.length) block = current;
  const i = block.findIndex((r) => r.startsWith(label));
  return i >= 0 ? String(i + 1) : null;
}

/** The answer tokens for one prompt of a trip (see `{ trip }` in createAdaptiveIO). */
function tripAnswer(trip, text, question, tty) {
  if (question === UI["prompt.enter"]) return [tty ? "<enter>" : ""];
  if (question === null && text.slice(text.lastIndexOf("█▀")).includes(UI["frame.next"])) return ["<enter>"]; // a frame's "Enter – dalej"
  if (text.includes(EXPOSE_START)) return ["2"];
  if (text.includes(UI["rest.hours"])) {
    if (tty) return ["<right>", "<right>", "<right>", "<down>", "<enter>"];
    return new RegExp(`${UI["rest.hours"].replace(/[?]/g, "\\?")} 1\\b`).test(text) ? ["1+++"] : ["2"];
  }
  if (text.includes(UI["camp.pitch"]) || text.includes(UI["travel.goOn"])) return [trip.forage && text.includes(UI["camp.forage"]) ? "2" : "1"];
  if (text.includes(UI["shop.leave"]) && text.includes(UI["shop.buy"])) return ["3"];
  for (const label of trip.accept ? ["Biorę to", ...TRIP_TALK] : TRIP_TALK) {
    const n = rowNumber(text, label, tty);
    if (n) return [n];
  }
  return ["1"]; // "Ruszaj w drogę", "Dalej" and the other camp menus
}

/** The rest's "expose the artifact?" question, recognised by its start (a frame wraps it). */
const EXPOSE_START = UI["rest.expose"].slice(0, 30);

const KEY_TOKENS = { "<up>": "up", "<down>": "down", "<left>": "left", "<right>": "right", "<enter>": "enter", "<esc>": "escape", "<backspace>": "backspace" };
const MAX_FIGHT_ANSWERS = 3000;

/**
 * A menu row is unusable when line mode marks it "(niedostępne)", when it ends with a reason "(… .)", or when its
 * "(N PA)" cost is above the AP left (a TTY greys such rows only by colour).
 */
function usableRow(text, ap) {
  if (text.endsWith(UI["menu.unavailable"]) || /\([^()]*\.\)$/.test(text)) return false;
  if (/\([^()]*…$/.test(text)) return false; // a reason cut by the narrow choice panel
  const cost = /\((\d+) PA\)/.exec(text);
  return !cost || Number(cost[1]) <= ap;
}

/**
 * The latest combat screen in `output` written at index `from` or later: player HP/AP, belt, the menu title and rows,
 * whether it is the fight summary. null = no combat screen there.
 */
function readCombatScreen(output, from, tty) {
  if (tty) {
    const framed = readFramedCombat(output, from);
    if (framed !== undefined) return framed;
  }
  let at = output.length - 1;
  while (at >= from && !stripVTControlCharacters(output[at]).includes(PLAYER_LINE)) at--;
  if (at < from) return null;
  const [player, weapon = "", ...rest] = stripVTControlCharacters(output.slice(at).join("")).split("\n");
  const [, hp, hpMax] = /HP (\d+)\/(\d+)/.exec(player).map(Number);
  const ap = Number(/\((\d+)\/\d+\)/.exec(player.slice(player.indexOf(PLAYER_LINE)))[1]);
  const title = rest.find((l) => l !== "" && !/^(\[\d+\] |▶ | {2})/.test(l)) ?? null;
  let rows;
  if (!tty) rows = rest.filter((l) => /^\[\d+\] /.test(l)).map((l) => l.replace(/^\[\d+\] /, ""));
  else {
    const all = rest.filter((l) => /^(▶ | {2})\S/.test(l)).map((l) => l.slice(2));
    const back = all.findIndex((r) => r === `[W] ${UI["combat.back"]}`);
    rows = back >= 0 ? all.slice(0, back + 1) : all.filter((r) => /^\[[A-Z]\] /.test(r));
  }
  return {
    hp, hpMax, ap, title, belt: weapon.slice(weapon.indexOf(lead("combat.weaponLine"))),
    rows: rows.map((text) => ({ text, hotkey: /^\[([A-Z])\] /.exec(text)?.[1].toLowerCase() ?? null, usable: usableRow(text, ap) })),
    summary: SUMMARY_LINES.some((s) => rest.some((l) => l.startsWith(s))),
  };
}

/**
 * The combat screen of the latest frame written at `from` or later (frames since E1): HP and AP from the hero panel, the
 * choice panel's rows (two columns for the actions), the summary line from the scene panel. undefined = no frame there
 * (the old screen is read instead); null = the latest frame is not a fight.
 */
function readFramedCombat(output, from) {
  const raw = output.slice(from).join("");
  const start = raw.lastIndexOf("\x1b[2J\x1b[3J\x1b[H");
  if (start < 0) return undefined;
  const lines = stripVTControlCharacters(raw.slice(start + 11)).split("\n");
  if (!lines[0]?.startsWith("█▀")) return undefined;
  const all = lines.join("\n");
  const apMatch = /PA [●○]+ \((\d+)\/(\d+)\)/.exec(all);
  if (!apMatch) return null;
  const [, hp, hpMax] = /HP [█░]+ (\d+)\/(\d+)/.exec(all).map(Number);
  const frame = readFrame(lines.slice(0, lines.findIndex((l) => /^█▄+█$/.test(l)) + 1));
  const rows = frame.choices.map((c) => c.replace(/^(▶ | {2})/, "").trim()).filter((c) => c.startsWith("["))
    .map((c) => c.replace(/^\[\d+\] /, "")).map((text) => ({
      text, hotkey: /^\[([A-Z])\] /.exec(text)?.[1].toLowerCase() ?? null, usable: usableRow(text, Number(apMatch[1])),
    }));
  return {
    hp, hpMax, ap: Number(apMatch[1]), title: frame.choiceTitle || null, belt: lines[2] ?? "", rows,
    summary: SUMMARY_LINES.some((s) => frame.scene.some((l) => l.trim().startsWith(s))),
  };
}

/**
 * One answer for the fight `plan` ({ fight: "win"|"lose"|"flee", techniques?: string[] }) on `screen`.
 * `memo.declined` holds the menus already backed out of this turn (cleared when the turn ends or AP grows);
 * `memo.used` counts the techniques and bandages chosen.
 */
function fightAnswer(plan, screen, memo) {
  if (screen.ap > memo.ap) memo.declined.clear();
  memo.ap = screen.ap;
  const { rows } = screen;
  const answerFor = (i) => rows[i].hotkey ?? String(i + 1);
  const firstRow = (test) => rows.findIndex((r) => r.usable && r.hotkey !== "w" && test(r.text));
  const decline = (menu) => { memo.declined.add(menu); return "w"; };
  if (screen.title === UI["combat.pickTechnique"]) {
    for (const id of plan.techniques ?? []) {
      if (id === "throw" && memo.thrown) continue; // one throw per fight, then pick the weapon up and fight on
      const i = firstRow((text) => TECHNIQUE_LABELS[id].some((label) => text.startsWith(label)));
      if (i < 0) continue;
      if (id === "throw") memo.thrown = true;
      memo.used[id] = (memo.used[id] ?? 0) + 1;
      return answerFor(i);
    }
    return decline("t");
  }
  if (screen.title === UI["combat.pickItem"]) {
    const i = firstRow((text) => text.startsWith(BANDAGE));
    if (i < 0) return decline("u");
    memo.used.bandage = (memo.used.bandage ?? 0) + 1;
    return answerFor(i);
  }
  if (screen.title === UI["combat.pickTarget"]) {
    const i = firstRow(() => true);
    return i >= 0 ? answerFor(i) : "w";
  }
  // The action list.
  const can = (key) => !memo.declined.has(key) && rows.some((r) => r.hotkey === key && r.usable);
  const endTurn = () => { memo.declined.clear(); return "k"; };
  if (plan.fight === "lose") return endTurn();
  if (screen.hp * 100 < screen.hpMax * 40 && screen.belt.includes(BANDAGE) && can("u")) return "u";
  if (plan.fight === "flee") return can("c") ? "c" : endTurn();
  if (plan.techniques?.length && can("t")) return "t";
  if (can("a")) return "a";
  return endTurn();
}

/**
 * Scripted IO like `createScriptedIO`, where `plan` may also hold `{ pick: label }` (line mode: the number of the latest row
 * starting with `label`), `{ expose: "1"|"2" }` (the answer to the rest's question
 * about exposing an artifact; skipped when the question does not come) and fights: `{ fight: "win"|"lose"|"flee", techniques? }`
 * (technique ids in order of preference: "dual", "guard", "throw", "pickup"). In a fight the driver reads the
 * latest combat screen and answers by itself: a requested technique when available (a throw at most once per fight),
 * else "Atak" on the first target, a bandage below 40% HP, "Koniec tury" when nothing is affordable; "lose" only ends
 * turns, "flee" tries "Ucieczka". Enter on the summary ends the fight entry.
 * `answers()` lists every answer given, in order (to replay the same game elsewhere, e.g. through a pipe); `used()`
 * counts the techniques and bandages the driver chose.
 * A `{ trip: { fight, techniques?, forage?, accept?, interruptAt? } }` step plays a whole trip: "Ruszaj", "Dalej",
 * foraging in camp when `forage`, not exposing the artifact, 4 hours of sleep, leaving shops, refusing the hungry wanderer
 * and road offers (taking offers – "Biorę to" – with `accept`),
 * and every fight as `{ fight, techniques }`; it ends when the arrival notice shows. With `interruptAt` it answers "^C"
 * on the first screen containing that text instead (the step is then over).
 */
export function createAdaptiveIO(plan, { tty = false } = {}) {
  const queue = [...plan];
  const typed = [];
  const output = [];
  const given = [];
  const used = {};
  let fightStart = 0;
  let memo = null;
  let lastAnswerAt = 0;
  let pending = [];
  let tripAnswers = 0;
  function take(question) {
    // An `{ expose }` step answers the rest's "expose the artifact?" question; it is skipped when that question did not come.
    while (typeof queue[0] === "object" && "expose" in queue[0]) {
      if (output.slice(lastAnswerAt).some((line) => stripVTControlCharacters(line).includes(EXPOSE_START))) break;
      queue.shift();
    }
    if (queue.length === 0) throw new InputExhaustedError();
    const head = queue[0];
    let answer;
    if (typeof head === "object" && "trip" in head) {
      const text = stripVTControlCharacters(output.slice(lastAnswerAt).join(""));
      if (++tripAnswers > MAX_TRIP_ANSWERS) throw new Error(`driver: podróż się nie kończy (${MAX_TRIP_ANSWERS} odpowiedzi)`);
      if (TRIP_ESCAPES.some((e) => text.includes(e))) throw new Error(`driver: podróż przerwana – ${JSON.stringify(text.slice(0, 200))}`);
      if (pending.length) answer = pending.shift();
      else if (text.includes(ARRIVAL)) {
        queue.shift();
        tripAnswers = 0;
        return take(question);
      } else if (head.trip.interruptAt && text.includes(head.trip.interruptAt)) {
        queue.shift();
        answer = "^C";
      } else if (readCombatScreen(output, fightStart, tty)) {
        // The night wraiths cannot be beaten with ordinary weapons (and cannot be fled): that fight is always played to a loss.
        const night = /Upiór nocy/i.test(text);
        queue.unshift({ fight: night ? "lose" : head.trip.fight, ...(head.trip.techniques && !night ? { techniques: head.trip.techniques } : {}) });
        return take(question);
      } else {
        [answer, ...pending] = tripAnswer(head.trip, text, question, tty);
      }
      fightStart = output.length;
    } else if (typeof head === "object" && "pick" in head) {
      // `{ pick: label }`: the number of the latest "[n] label…" row written since the last answer.
      const rows = stripVTControlCharacters(output.slice(lastAnswerAt).join("")).split("\n");
      const row = rows.reverse().find((l) => l.startsWith("[") && l.replace(/^\[\d+\] (\* |\[zlecenie\] )?/, "").startsWith(head.pick));
      if (!row) throw new Error(`driver: brak pozycji ${JSON.stringify(head.pick)}, pytanie: ${JSON.stringify(question)}`);
      answer = /^\[(\d+)\]/.exec(row)[1];
      queue.shift();
      fightStart = output.length;
    } else if (typeof head === "object" && "expose" in head) {
      answer = head.expose;
      queue.shift();
      fightStart = output.length;
    } else if (typeof head === "object") {
      const screen = readCombatScreen(output, fightStart, tty);
      if (!screen) throw new Error(`driver: oczekiwano ekranu walki ${JSON.stringify(head)}, pytanie: ${JSON.stringify(question)}`);
      memo ??= { ap: 0, declined: new Set(), count: 0, thrown: false, used };
      if (++memo.count > MAX_FIGHT_ANSWERS) throw new Error(`driver: walka ${JSON.stringify(head)} się nie kończy; ostatni ekran: ${JSON.stringify(screen)}
${stripVTControlCharacters(output.slice(-2).join(""))}`);
      const recapShown = question === null && stripVTControlCharacters(output.slice(lastAnswerAt).join("")).includes(lead("combat.recap"));
      if (recapShown) answer = "<enter>"; // the turn recap of the enemies' phase waits for Enter
      else if (question === UI["prompt.enter"] || (question === null && screen.summary)) {
        answer = question === null ? "<enter>" : "";
        if (screen.summary || screen.hp === 0) { queue.shift(); memo = null; fightStart = output.length; }
      } else answer = fightAnswer(head, screen, memo);
    } else {
      answer = queue.shift();
      fightStart = output.length;
    }
    given.push(answer);
    lastAnswerAt = output.length;
    if (answer === "^C") throw new InterruptError();
    if (answer === "^D") throw new InputClosedError();
    return answer;
  }
  return {
    output,
    columns: 80,
    rows: 24,
    isTTY: tty,
    write(text) { output.push(`${text}\n`); },
    writeRaw(text) { output.push(text); },
    async ask(question) {
      output.push(question);
      return take(question);
    },
    async readKey() {
      if (typed.length) return typed.shift();
      const next = take(null);
      if (KEY_TOKENS[next]) return { name: KEY_TOKENS[next] };
      if (next === "") return { name: "enter" }; // an empty answer is Enter (a prompt that waits for a key in a frame)
      const chars = [...next];
      if (chars.length === 1) return { name: "char", char: next };
      if (/^<.*>$/.test(next)) throw new Error(`nieznany token klawisza: ${next}`);
      // typed text (a name): key by key, then Enter
      typed.push(...chars.slice(1).map((char) => ({ name: "char", char })), { name: "enter" });
      return { name: "char", char: chars[0] };
    },
    close() {},
    text() { return stripVTControlCharacters(output.join("")); },
    answers() { return [...given]; },
    /** How many times each technique id (and "bandage") was chosen in fights. */
    used() { return { ...used }; },
  };
}

/** Real data whose "Zamknij dzień" ends the game (the old demo ending), so a scripted run of the first day has an end. */
export function endAfterFirstDay(data) {
  const d = structuredClone(data);
  d.story.scenes.find((s) => s.id === "demo_dalej").goto = "demo_koniec";
  d.story.scenes.push({ id: "demo_koniec", art: "koniec", type: "ending", text: "Wieczorem brama skrzypi i do strażnicy wjeżdża jeździec w czerwonym płaszczu, na spienionym koniu. Komendant spluwa pod nogi i mówi, że od jutra będzie gorzej. Koniec dostępnej opowieści." });
  return d;
}

/**
 * Prunes the real data for a fixture that replaced the quests: act III regions go, then every dialogue and event that names a quest
 * which is no longer there (and, repeatedly, whatever then points at a dropped dialogue).
 */
export function pruneMissingQuests(data) {
  const droppedIds = data.travel.locations.filter((l) => ["glusz", "gwiazdy", "front", "stolica", "loch", "jarnowo"].includes(l.region)).map((l) => l.id);
  data.travel.locations = data.travel.locations.filter((l) => !["glusz", "gwiazdy", "front", "stolica", "loch", "jarnowo"].includes(l.region));
  data.travel.routes = data.travel.routes.filter((r) => !droppedIds.includes(r.from) && !droppedIds.includes(r.to));
  for (const region of ["glusz", "gwiazdy", "front", "stolica", "loch", "jarnowo"]) delete data.maps[region];
  const have = new Set(data.quests.map((q) => q.id));
  const missing = (text) => [...text.matchAll(/"(?:startQuest|completeQuest)":\s*"([a-z0-9_]+)"|"questStatus":\s*\{\s*"id":\s*"([a-z0-9_]+)"/g)].some((m) => !have.has(m[1] ?? m[2]));
  const toGone = (text) => droppedIds.some((id) => text.includes(`"${id}"`) || text.includes(`"${id}.`));
  data.dialogues = data.dialogues.filter((d) => !missing(JSON.stringify(d)) && !toGone(JSON.stringify(d)));
  const dialogues = new Set(data.dialogues.map((d) => d.id));
  data.travel.events = data.travel.events.filter((e) => !missing(JSON.stringify(e)) && !toGone(JSON.stringify(e)) && (e.scenes ?? []).every((s) => s.type !== "dialogue" || dialogues.has(s.dialogue)));
  return data;
}
