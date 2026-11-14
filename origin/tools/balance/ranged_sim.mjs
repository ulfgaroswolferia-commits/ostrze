// Combat simulator for the ranged-weapon rework: plays every combat scene with the real combat functions.
//
//   node tools/balance/ranged_sim.mjs <save.json|wzorcowy> [--stan przed|po] [--kod <dir>] [--walk 2000] [--region a,b]
//        [--zapas <item>] [--pa <n>] [--tag <skills> --punkty <n>] [--belty wybuchowy|wzmocniony] [--ziarno 1] [--watki <n>] [--slad <scene>] [--json <out.json>]
//   node tools/balance/ranged_sim.mjs --progi <przed.json> <po.json>
//
// `--stan przed` needs `--kod`: a directory with an export of the old code (`git archive master | tar -x -C <dir>`).
// The save file is only read, through a temporary copy. Fights only: each one is isolated, starts at full HP, and road
// events are not modeled. The retreat strategy fires the retreat shot at most once per fight. The before state also
// starts every fight with the spare weapon loaded, although the old code never reloads it after a fight: conservative
// for the shooter-scene comparison (it understates the gain of the change).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const LIGHT_ARMOR = 2;
const AMMO_STOCK = 300;
const BENCH_TRIALS = 1000;
const MIN_HP_FOR_RATIO = 5; // scenes and regions where the sword loses less % HP than this are too noisy for a ratio
const MAX_REDUCTION = 25;
const MAX_LONG_HOLD = 5;

function parseArgs(argv) {
  const opts = { positional: [], stan: "po", walk: 2000, ziarno: 1 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--progi") opts.progi = true;
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
    else opts.positional.push(a);
  }
  opts.walk = Number(opts.walk);
  opts.ziarno = Number(opts.ziarno);
  if (opts.pa !== undefined) opts.pa = Number(opts.pa);
  return opts;
}

/** The game's modules from `root`, so the same logic runs on the current code and on an export of the old one. */
async function loadGameCode(root) {
  const mod = (p) => import(pathToFileURL(path.join(root, p)).href);
  const [dataMod, dice, save, stateMod, stats, character, inventory, combatState, actions, techniques, turn] = await Promise.all([
    "src/engine/data.js", "src/engine/dice.js", "src/engine/save.js", "src/engine/state.js", "src/systems/stats.js", "src/systems/character.js",
    "src/systems/inventory.js", "src/systems/combat/state.js", "src/systems/combat/actions.js", "src/systems/combat/techniques.js", "src/systems/combat/turn.js",
  ].map(mod));
  return { loadData: dataMod.loadData, createRng: dice.createRng, loadGame: save.loadGame, createNewState: stateMod.createNewState, getStats: stats.getStats, ...character, ...inventory, ...combatState, ...actions, ...techniques, ...turn };
}

// ---------------------------------------------------------------------------------------------------------------
// Heroes

const atNoon = (minutes) => Math.floor(minutes / 1440) * 1440 + 720;

/** Reads the save through a temporary copy with the game's own loader (migrations and repairs included). */
async function heroFromSave(game, data, file) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ostrze-sim-"));
  try {
    fs.mkdirSync(path.join(home, "saves"));
    fs.copyFileSync(file, path.join(home, "saves", "3.json"));
    process.env.OSTRZE_HOME = home;
    return await game.loadGame("3", data);
  } finally {
    delete process.env.OSTRZE_HOME;
    fs.rmSync(home, { recursive: true, force: true });
  }
}

/** The reference early hero: Siła 5, Zręczność 5 (7 AP), level 2, sword class with its start kit, level-up points in the class skill. */
function referenceHero(game, data) {
  const state = game.createNewState({ seed: 1, startScene: data.story.start, rules: data.rules });
  const attributes = game.creatorStartAttributes(data);
  attributes.krzepa += 2;
  attributes.bystrosc += 1;
  attributes.fart += 1;
  attributes.oglada += 1;
  const cls = data.classes.find((c) => c.id === "miecz");
  state.character = game.createCharacter({ name: "Wzorzec", classId: "miecz", attributes, tagged: [cls.taggedSkill, "wymowa", "medycyna"] }, data);
  game.grantStartKit(state, data, "miecz");
  state.character.level = 2;
  state.character.skillPoints[cls.taggedSkill] = game.skillPointsPerLevel(state.character, data.rules);
  return state;
}

/** Neutral conditions (noon, no phenomenon, no effects), a loaded spare weapon and enough ammunition. */
function prepareHero(game, data, state, opts) {
  const c = state.character;
  c.effects = [];
  c.pendingLevelUp = null;
  state.time.minutes = atNoon(state.time.minutes);
  state.world.phenomenon = null;
  state.world.phenomenonRolledDay = Math.floor(state.time.minutes / 1440);
  for (const id of opts.tag?.split(",") ?? []) {
    if (!c.tagged.includes(id)) c.tagged.push(id);
    c.skillPoints[id] = (c.skillPoints[id] ?? 0) + Number(opts.punkty ?? 0);
  }
  while (opts.pa !== undefined && game.getStats(state, data).derived.ap < opts.pa) {
    if (c.attributes.zrecznosc >= data.rules.creator.attributeMax) throw new Error(`--pa ${opts.pa}: nieosiągalne przy Zręczności ${data.rules.creator.attributeMax}`);
    c.attributes.zrecznosc++;
  }
  const eq = state.inventory.equipped;
  const current = eq.bron_zapas ? data.items.find((i) => i.id === eq.bron_zapas) : null;
  const spare = opts.zapas ?? (current?.reload && !/^luk/.test(current.id) ? current.id : "pistolet_skalkowy");
  // The swap and a burst work on the bag's copies, so every weapon the strategies hold must be there.
  for (const id of [spare, "kusza_lekka"]) if (game.countOf(state, id) < 1) game.addItem(state, data, id, 1);
  eq.bron_zapas = spare;
  state.inventory.loaded = { ...(state.inventory.loaded ?? {}), [spare]: 1 };
  for (const ammo of ["belt", "kula_z_prochem"]) game.addItem(state, data, ammo, AMMO_STOCK);
  // `--belty wybuchowy|wzmocniony`: a stock of that bolt kind; every crossbow starts loaded with it, explosive ones load first.
  const kit = { main: eq.bron, spare };
  if (opts.belty) {
    kit.bolt = `belt_${opts.belty}`;
    if (!data.items.some((i) => i.id === kit.bolt && i.ammoOf === "belt")) throw new Error(`--belty ${opts.belty}: nie ma bełtu ${kit.bolt}`);
    kit.boltWeapons = data.items.filter((i) => i.reload?.ammo === "belt").map((i) => i.id);
    game.addItem(state, data, kit.bolt, AMMO_STOCK);
    state.inventory.loadExplosive = data.items.find((i) => i.id === kit.bolt).explosive === true;
    loadBolt(state, kit, spare);
  }
  c.hp = game.getStats(state, data).derived.hpMax;
  return kit;
}

/** With `--belty`, a crossbow loaded in the setup holds that kind. */
function loadBolt(state, kit, weapon) {
  if (!kit.bolt || !kit.boltWeapons.includes(weapon)) return;
  state.inventory.loadedAmmo = { ...(state.inventory.loadedAmmo ?? {}), [weapon]: kit.bolt };
}

/** Bolts of `kit.bolt` the hero has, in the bag and loaded. */
function boltsHeld(game, state, kit) {
  const loaded = Object.entries(state.inventory.loadedAmmo ?? {}).filter(([, id]) => id === kit.bolt).reduce((n, [w]) => n + (state.inventory.loaded?.[w] ?? 0), 0);
  return game.countOf(state, kit.bolt) + loaded;
}

// ---------------------------------------------------------------------------------------------------------------
// Scenes

/**
 * Every combat `def` of travel, story and quests with its group (region); sparring is skipped. The key is the place
 * the scene belongs to plus its id (`lokacja/<id>/<scene>`, `zdarzenie/<id>/<scene>`, `zlecenie/<id>/<scene>`, `historia/<scene>`),
 * so runs of two code states pair on it and the seeds do not depend on the order of the data.
 */
function collectScenes(data) {
  const out = [];
  const keys = new Set();
  const walk = (node, group, owner) => {
    if (Array.isArray(node)) { for (const x of node) walk(x, group, owner); return; }
    if (!node || typeof node !== "object") return;
    if (node.type === "combat" && node.enemies && !node.training) {
      const key = `${owner}/${node.id}`;
      if (keys.has(key)) throw new Error(`collectScenes: powtórzony klucz sceny ${key}`);
      keys.add(key);
      out.push({ key, id: node.id, def: node, group });
    }
    for (const v of Object.values(node)) walk(v, group, owner);
  };
  const regionOf = new Map(data.travel.locations.map((l) => [l.id, l.region]));
  const routeRegion = new Map();
  for (const r of data.travel.routes) for (const id of Object.values(r.fixed ?? {})) routeRegion.set(id, r.region);
  for (const l of data.travel.locations) walk(l, l.region, `lokacja/${l.id}`);
  for (const e of data.travel.events) {
    const named = JSON.stringify(e.if ?? {}).match(/"region":"(\w+)"/)?.[1];
    walk(e, named ?? routeRegion.get(e.id) ?? "droga", `zdarzenie/${e.id}`);
  }
  for (const q of data.quests) walk(q, regionOf.get(q.location) ?? regionOf.get(q.hub) ?? "zlecenia", `zlecenie/${q.id}`);
  walk(data.story.scenes, "historia", "historia");
  return out;
}

const enemyDef = (data, id) => data.enemies.find((e) => e.id === id);
const isShooter = (e) => e.ai === "ranged" || e.attacks.some((a) => a.range === "far");

function sceneFacts(game, data, scene, level) {
  const enemies = game.seasoned(data, level, scene.def.enemies).map((g) => enemyDef(data, g.id));
  return { shooters: enemies.some(isShooter), maxArmor: Math.max(...enemies.map((e) => e.armor ?? 0)), enemyIds: enemies.map((e) => e.id) };
}

// ---------------------------------------------------------------------------------------------------------------
// Strategies: each returns the next action of the turn, or null to end it.

function tools(game, data) {
  const noMove = new Set(data.effects.filter((e) => e.noMove).map((e) => e.id));
  const rooted = (e) => e.effects.some((x) => noMove.has(x.id));
  const living = (combat) => game.livingEnemies(combat);
  const melee = (combat) => living(combat).filter((e) => e.band === "melee");
  const far = (combat) => living(combat).filter((e) => e.band === "far");
  const can = (s, combat, id) => !game.playerActions(s, data, combat).find((a) => a.id === id).disabled;
  const tech = (s, combat, id) => game.techniqueActions(s, data, combat).find((t) => t.id === id);
  const usable = (s, combat, id) => { const t = tech(s, combat, id); return Boolean(t && !t.disabled); };
  const strongest = (list) => list.reduce((a, b) => (b.hp > a.hp ? b : a));
  const weakest = (list) => list.reduce((a, b) => (b.hp < a.hp ? b : a));
  const rangedAi = (e) => enemyDef(data, e.id).ai === "ranged";
  const closesIn = (e) => enemyDef(data, e.id).ai !== "ranged" && enemyDef(data, e.id).attacks.some((a) => (a.range ?? "melee") === "melee");
  return { rooted, living, melee, far, can, tech, usable, strongest, weakest, rangedAi, closesIn };
}

/** Melee: strikes the weakest foe in reach; with nobody in reach walks up (`wait`: takes the ready stance and lets them come). */
function swordPolicy(game, data, t, { head, wait }) {
  return (s, combat, mem) => {
    const eq = s.inventory.equipped;
    if (eq.bron !== mem.main) return t.can(s, combat, "swap") ? { id: "swap" } : null;
    const inReach = t.melee(combat);
    if (inReach.length) {
      mem.waits = 0;
      const target = t.weakest(inReach).uid;
      if (head && !game.zoneActions(s, data, combat).find((z) => z.id === "glowa")?.disabled) return { id: "aimed", zone: "glowa", target };
      if (t.can(s, combat, "attack")) return { id: "attack", target };
      return t.far(combat).length && t.usable(s, combat, "ready") ? { id: "ready" } : null;
    }
    const far = t.far(combat);
    const walk = !wait || mem.waits >= 2 || far.some((e) => t.rangedAi(e) || t.rooted(e));
    if (walk) {
      if (!t.can(s, combat, "move")) return null;
      const goal = far.find(t.rangedAi) ?? far.find(t.rooted) ?? far[0];
      return { id: "move", target: goal.uid };
    }
    if (t.usable(s, combat, "ready")) return { id: "ready" };
    mem.waits = (mem.waits ?? 0) + 1;
    return null;
  };
}

/** Opening shot: swap, shoot, swap back, ready when the AP allow, then the sword. A leftover swap waits for the next turn. */
function openingPolicy(game, data, t, sword) {
  return (s, combat, mem) => {
    const eq = s.inventory.equipped;
    if (!mem.opened) {
      mem.opened = true;
      const spare = data.items.find((i) => i.id === mem.spare);
      if (t.far(combat).length && eq.bron === mem.main && combat.playerAp >= game.playerActions(s, data, combat).find((a) => a.id === "swap").apCost + spare.apCost) {
        mem.step = "shoot";
        return { id: "swap" };
      }
    }
    if (mem.step === "shoot") {
      mem.step = "back";
      const far = t.far(combat);
      const goal = far.filter(t.closesIn);
      if (far.length && t.can(s, combat, "attack")) return { id: "attack", target: t.strongest(goal.length ? goal : far).uid };
    }
    if (mem.step === "back") {
      if (eq.bron !== mem.main) {
        if (!t.can(s, combat, "swap")) return null;
        mem.step = "ready";
        return { id: "swap" };
      }
      mem.step = "ready";
    }
    if (mem.step === "ready") {
      mem.step = null;
      if (!t.melee(combat).length) {
        if (t.usable(s, combat, "ready")) mem.hold = true;
        return mem.hold ? { id: "ready" } : null;
      }
    }
    if (mem.hold) { mem.hold = false; return null; }
    return sword(s, combat, mem);
  };
}

/** Retreat shot once, when one or two foes are in melee, then the sword; the rest of that turn goes to the ready stance. */
function retreatPolicy(game, data, t, sword) {
  return (s, combat, mem) => {
    if (mem.hold) { mem.hold = false; return null; }
    const inReach = t.melee(combat);
    const opensTurn = mem.round !== combat.round; // not right after walking up; a shooter is not a foe to step away from
    mem.round = combat.round;
    const foes = inReach.filter(t.closesIn);
    if (!mem.fired && opensTurn && foes.length && inReach.length <= 2 && t.usable(s, combat, "odskok")) {
      mem.fired = true;
      mem.after = true;
      return { id: "odskok", target: t.strongest(foes).uid };
    }
    if (mem.after) {
      mem.after = false;
      if (!inReach.length) {
        if (t.usable(s, combat, "ready")) { mem.hold = true; return { id: "ready" }; }
        return null;
      }
    }
    return sword(s, combat, mem);
  };
}

/** A ranged weapon held as the main one: shoot, load when the AP allow. `kite`: also steps back from a foe in melee before shooting. */
function rangedPolicy(game, data, t, { kite }) {
  return (s, combat, mem) => {
    const weapon = data.items.find((i) => i.id === s.inventory.equipped.bron);
    if (!weapon) return null;
    if ((s.inventory.loaded?.[weapon.id] ?? 0) < 1) return t.can(s, combat, "reload") ? { id: "reload" } : null;
    const inReach = t.melee(combat);
    if (kite && inReach.length && t.can(s, combat, "move") && combat.playerAp >= data.rules.combat.moveAp + weapon.apCost) {
      return { id: "move", target: t.strongest(inReach).uid };
    }
    if (!t.can(s, combat, "attack")) return null;
    const far = t.far(combat);
    const free = far.filter((e) => t.closesIn(e) && !t.rooted(e));
    const goal = kite ? (free.length ? t.strongest(free) : far.length ? t.weakest(far) : t.weakest(inReach))
      : (inReach.length ? t.weakest(inReach) : t.strongest(far));
    return { id: "attack", target: goal.uid };
  };
}

function buildStrategies(game, data, stan) {
  const t = tools(game, data);
  const sword = swordPolicy(game, data, t, { head: true, wait: false });
  const list = {
    miecz: { policy: sword },
    miecz_zwykly: { policy: swordPolicy(game, data, t, { head: false, wait: false }) },
    miecz_czeka: { policy: swordPolicy(game, data, t, { head: true, wait: true }) },
    strzal: { policy: openingPolicy(game, data, t, sword) },
  };
  if (stan === "przed") return { t, list };
  return { t, list: {
    ...list,
    odskok: { policy: retreatPolicy(game, data, t, sword) },
    kusza: { policy: rangedPolicy(game, data, t, { kite: false }), hand: "kusza_lekka" },
    kusza_kiting: { policy: rangedPolicy(game, data, t, { kite: true }), hand: "kusza_lekka" },
    pistolet: { policy: rangedPolicy(game, data, t, { kite: false }), hand: "spare" },
  } };
}

/** The hero as this strategy enters the fight: a ranged main weapon goes to the hand and is loaded. */
function heroFor(base, kit, strategy) {
  if (!strategy.hand) return base;
  const state = structuredClone(base);
  const weapon = strategy.hand === "spare" ? kit.spare : strategy.hand;
  state.inventory.equipped.bron_zapas = kit.main;
  state.inventory.equipped.bron = weapon;
  state.inventory.loaded[weapon] = 1;
  loadBolt(state, kit, weapon);
  return state;
}

// ---------------------------------------------------------------------------------------------------------------
// One fight, the way src/scenes/combat.js plays it

function playFight(game, data, t, base, def, policy, kit, rng, stats) {
  // Only what a fight changes is copied; the clock stays within the hour, so the world is not touched.
  const state = { ...base, time: { ...base.time }, flags: {}, character: structuredClone(base.character), inventory: structuredClone(base.inventory), artifacts: structuredClone(base.artifacts) };
  const hpMax = game.getStats(state, data).derived.hpMax;
  state.character.hp = hpMax;
  const combat = game.createCombat(state, data, def, rng);
  const mem = { main: kit.main, spare: kit.spare, waits: 0 };
  const held = new Map();
  let longest = 0;
  let turns = 0;
  let selfHp = 0;
  const boltsBefore = kit.bolt ? boltsHeld(game, state, kit) : 0;
  game.runEnemyTurns(state, data, combat, rng);
  while (!game.outcomeOf(state, combat)) {
    const begun = game.beginTurn(state, data, combat, rng);
    if (game.outcomeOf(state, combat)) break;
    turns++;
    if (!begun.skip) {
      for (let guard = 0; guard < 40 && !game.outcomeOf(state, combat); guard++) {
        const action = policy(state, combat, mem);
        if (!action) break;
        const r = game.doAction(state, data, combat, action, rng);
        stats.trace?.push(`  runda ${combat.round}: ${action.id}${action.zone ? `/${action.zone}` : ""} ${action.target ?? ""} -> ${r.ok ? `PA ${combat.playerAp}, HP ${state.character.hp}` : r.reason}`);
        if (!r.ok) { stats.refused++; break; }
        for (const ev of r.events ?? []) if (ev.type === "wybuch") selfHp += ev.selfDamage;
        if (r.endTurn) break;
      }
    }
    if (game.outcomeOf(state, combat)) break;
    // A foe that wants to close in and is rooted on its coming turn is kept from returning.
    for (const e of t.far(combat)) {
      const streak = t.closesIn(e) && t.rooted(e) ? (held.get(e.uid) ?? 0) + 1 : 0;
      held.set(e.uid, streak);
      longest = Math.max(longest, streak);
    }
    for (const e of t.melee(combat)) held.set(e.uid, 0);
    game.endTurn(state, data, combat);
    game.runEnemyTurns(state, data, combat, rng);
  }
  const { outcome } = game.finishCombat(state, data, combat, rng);
  const bolts = kit.bolt ? boltsBefore - boltsHeld(game, state, kit) : 0;
  return { outcome, hpLostPct: (100 * (hpMax - Math.max(0, state.character.hp))) / hpMax, turns, longest, selfHp, bolts };
}

const hashSeed = (text, seed) => {
  let h = seed >>> 0;
  for (const ch of text) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h;
};

function runScene(game, data, t, base, scene, policy, kit, opts, stats) {
  const rng = game.createRng(hashSeed(scene.key, opts.ziarno));
  const r = { n: opts.walk, wins: 0, defeats: 0, draws: 0, hp: 0, hpSq: 0, turns: 0, held3: 0, held4: 0, selfHp: 0, bolts: 0 };
  for (let i = 0; i < opts.walk; i++) {
    const f = playFight(game, data, t, base, scene.def, policy, kit, rng, stats);
    r.selfHp += f.selfHp;
    r.bolts += f.bolts;
    if (f.outcome === "win") r.wins++;
    else if (f.outcome === "defeat") r.defeats++;
    else r.draws++;
    r.hp += f.hpLostPct;
    r.hpSq += f.hpLostPct ** 2;
    r.turns += f.turns;
    if (f.longest >= 3) r.held3++;
    if (f.longest >= 4) r.held4++;
  }
  const hp = r.hp / r.n;
  return {
    n: r.n, win: (100 * r.wins) / r.n, defeat: (100 * r.defeats) / r.n, draw: (100 * r.draws) / r.n, hp, hpVar: Math.max(0, r.hpSq / r.n - hp ** 2),
    turns: r.turns / r.n, held3: (100 * r.held3) / r.n, held4: (100 * r.held4) / r.n,
    ...(kit.bolt ? { selfHp: r.selfHp / r.n, bolts: r.bolts / r.n } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Damage of one turn, per armor of the foe (real doAction on a foe that cannot die)

/** Shots per turn of a weapon that shoots when loaded and reloads when the AP allow (AP left over are lost), averaged over many turns. */
function shotsPerTurn(ap, weapon) {
  const turns = 120;
  let loaded = 1;
  let shots = 0;
  for (let i = 0; i < turns; i++) {
    let left = ap;
    for (;;) {
      if (loaded && left >= weapon.apCost) { loaded = 0; shots++; left -= weapon.apCost; }
      else if (!loaded && left >= weapon.reload.apCost) { loaded = 1; left -= weapon.reload.apCost; }
      else break;
    }
  }
  return shots / turns;
}

function benchTurns(game, data, base, kit, enemyIds, stan, opts) {
  const rng = game.createRng(opts.ziarno + 7);
  const ap = game.getStats(base, data).derived.ap;
  const sum = {};
  let row;
  const dealt = (combat, action, state, kind) => {
    const foe = combat.enemies[0];
    const before = foe.hp;
    const r = game.doAction(state, data, combat, { ...action, target: foe.uid }, rng);
    if (!r.ok) row.refused[kind] = (row.refused[kind] ?? 0) + 1;
    return r.ok ? before - foe.hp : 0;
  };
  const crossbowHero = structuredClone(base);
  crossbowHero.inventory.equipped.bron_zapas = kit.main;
  crossbowHero.inventory.equipped.bron = "kusza_lekka";
  const fresh = (state, id) => {
    state.character.hp = 100000;
    state.character.effects = [];
    const combat = game.createCombat(state, data, { id: "pomiar", enemies: [{ id }], start: "melee", quiet: true }, rng);
    combat.enemies[0].hp = 100000;
    combat.playerAp = 99;
    return combat;
  };
  for (const id of enemyIds) {
    const armor = enemyDef(data, id).armor ?? 0;
    row = (sum[armor] ??= { types: 0, blow: 0, retreat: 0, shot: 0, refused: {} });
    row.types++;
    const state = structuredClone(base);
    for (let i = 0; i < BENCH_TRIALS; i++) {
      state.inventory = structuredClone(base.inventory); // a barrel burst takes the weapon away
      const c1 = fresh(state, id);
      row.blow += dealt(c1, { id: "attack" }, state, "cios") / BENCH_TRIALS;
      if (stan === "po") {
        state.inventory.loaded[kit.spare] = 1;
        row.retreat += dealt(fresh(state, id), { id: "odskok" }, state, "odskok") / BENCH_TRIALS;
        crossbowHero.inventory.loaded = { kusza_lekka: 1 };
        loadBolt(crossbowHero, kit, "kusza_lekka");
        row.shot += dealt(fresh(crossbowHero, id), { id: "attack" }, crossbowHero, "kusza") / BENCH_TRIALS;
      }
    }
  }
  const out = {};
  for (const [armor, r] of Object.entries(sum)) {
    out[armor] = { types: r.types, oneBlow: r.blow / r.types, twoBlows: (2 * r.blow) / r.types, retreat: r.retreat / r.types, crossbowShot: r.shot / r.types, refused: r.refused };
  }
  const mainWeapon = data.items.find((i) => i.id === kit.main);
  const crossbow = data.items.find((i) => i.id === "kusza_lekka");
  return { ap, swordBlowsPerTurn: Math.floor(ap / mainWeapon.apCost), crossbowShotsPerTurn: shotsPerTurn(ap, crossbow), byArmor: out };
}

// ---------------------------------------------------------------------------------------------------------------
// Reports

const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const f1 = (v) => v.toFixed(1);

function aggregate(scenes, strat) {
  const rows = scenes.map((s) => s.results[strat]).filter(Boolean);
  return { scenes: rows.length, win: mean(rows.map((r) => r.win)), hp: mean(rows.map((r) => r.hp)), turns: mean(rows.map((r) => r.turns)), held3: mean(rows.map((r) => r.held3)), held4: mean(rows.map((r) => r.held4)) };
}

function printRun(run) {
  const { meta, scenes } = run;
  console.log(`Stan: ${meta.stan}; bohater: ${meta.hero.kind}, poziom ${meta.hero.level}, PA ${meta.hero.ap}, HP ${meta.hero.hpMax}; zapasowa: ${meta.hero.spare}; walk na scenę: ${meta.walk}; scen: ${scenes.length}; odrzucone akcje: ${meta.refused}; czas: ${meta.seconds} s`);
  const strats = Object.keys(scenes[0]?.results ?? {});
  const line = (label, list) => {
    if (!list.length) return;
    console.log(`\n${label} (scen: ${list.length})`);
    for (const st of strats) {
      const a = aggregate(list, st);
      console.log(`  ${st.padEnd(14)} wygrane ${f1(a.win).padStart(5)}%  utracone HP ${f1(a.hp).padStart(5)}%  tury ${f1(a.turns).padStart(4)}  zatrzymanie 3+ ${f1(a.held3).padStart(4)}%  4+ ${f1(a.held4).padStart(4)}%`);
    }
  };
  for (const g of [...new Set(scenes.map((s) => s.group))]) line(g, scenes.filter((s) => s.group === g));
  line("Sceny ze strzelcami", scenes.filter((s) => s.shooters));
  line("Sceny bez strzelców", scenes.filter((s) => !s.shooters));
  if (meta.bolt) {
    console.log(`\n${meta.bolt}: zużycie i obrażenia od własnych odłamków na walkę, wszystkie sceny`);
    for (const st of strats) {
      const rows = scenes.map((s) => s.results[st]);
      console.log(`  ${st.padEnd(14)} bełtów ${f2(mean(rows.map((r) => r.bolts)))}  własne odłamki ${f2(mean(rows.map((r) => r.selfHp)))} HP`);
    }
  }
  if (meta.stan === "przed") return;
  console.log(`\nObrażenia jednej akcji, wróg w zwarciu od startu (dla kuszy to najlepszy przypadek); ciosów na turę ${run.bench.swordBlowsPerTurn}, strzałów z kuszy na turę ${f2(run.bench.crossbowShotsPerTurn)}:`);
  for (const [armor, r] of Object.entries(run.bench.byArmor)) {
    console.log(`  pancerz ${armor}: dwa zwykłe ciosy ${f1(r.twoBlows)}; akcja odskoku ${f1(r.retreat)}; strzał z kuszy ${f1(r.crossbowShot)} (typów wrogów: ${r.types})${refusedText(r.refused)}`);
  }
}

const f2 = (v) => v.toFixed(2);
const refusedText = (refused = {}) => {
  const list = Object.entries(refused);
  return list.length ? `; UWAGA, odrzucone akcje liczone jako 0: ${list.map(([k, n]) => `${k} ${n}`).join(", ")}` : "";
};

const verdict = (ok) => (ok ? "PASS" : "FAIL");

/**
 * The thresholds of the brief for one before/after pair of runs. A verdict uses only the brief's overall condition
 * (all scenes of the run together); regions and scenes are printed as information.
 */
function printThresholds(before, after) {
  const scenes = after.scenes;
  const hero = after.meta.hero;
  console.log(`Progi: bohater ${hero.kind}, poziom ${hero.level}, PA ${hero.ap}; ${after.meta.walk} walk na scenę`);
  console.log("Walki są osobne: każda od pełnego HP, bez zdarzeń na drodze i bez tego, co droga zabiera przed walką.");
  for (const [label, run] of [["przed", before], ["po", after]].filter(([, r]) => r)) {
    const n = run.meta.refused;
    console.log(`Odrzucone akcje (${label}): ${n}${n ? " UWAGA: strategia próbowała akcji, której gra nie przyjęła" : ""}`);
  }
  console.log("");
  const better = (a, b) => a.hp < b.hp && a.win >= b.win;
  const stat = (a) => `wygrane ${f1(a.win)}%, HP ${f1(a.hp)}%, tury ${f1(a.turns)}`;

  const light = scenes.filter((s) => s.maxArmor <= LIGHT_ARMOR);
  const crossbow = aggregate(light, "kusza");
  for (const st of ["miecz", "miecz_zwykly"]) {
    const a = aggregate(light, st);
    const wins = light.filter((s) => better(s.results.kusza, s.results[st])).length;
    console.log(`1. ${verdict(a.hp <= crossbow.hp && a.win >= crossbow.win)} ${st} bije lekką kuszę, sceny z pancerzem do ${LIGHT_ARMOR} (${light.length}): ${stat(a)} przeciw kuszy ${stat(crossbow)}; informacyjnie: scen, gdzie kusza lepsza: ${wins}/${light.length}`);
  }
  const { swordBlowsPerTurn: blows, crossbowShotsPerTurn: shots, byArmor } = after.bench;
  const lightRows = Object.entries(byArmor).filter(([a]) => Number(a) <= LIGHT_ARMOR);
  for (const [armor, r] of lightRows) {
    console.log(`   informacyjnie, pancerz ${armor}, obrażenia na turę: miecz ${f1(blows * r.oneBlow)} (${blows} zwykłe ciosy), kusza ${f1(shots * r.crossbowShot)} (${f2(shots)} strzału na turę, strzał z bliska: najlepszy dla kuszy przypadek)${refusedText(r.refused)}`);
  }

  for (const st of ["miecz", "miecz_zwykly", "miecz_czeka"]) {
    const n = scenes.filter((s) => better(s.results.odskok, s.results[st])).length;
    console.log(`2a. ${verdict(n < scenes.length)} odskok nie jest lepszy w każdej scenie względem ${st}: lepszy w ${n}/${scenes.length}; średnio ${stat(aggregate(scenes, "odskok"))} przeciw ${stat(aggregate(scenes, st))}`);
  }
  const types = lightRows.reduce((n, [, r]) => n + r.types, 0);
  const weighted = (key) => lightRows.reduce((sum, [, r]) => sum + r[key] * r.types, 0) / types;
  const retreat = weighted("retreat");
  const twoBlows = weighted("twoBlows");
  console.log(`2b. ${verdict(retreat < 2 * twoBlows)} akcja odskoku (sam strzał z odejściem, nie cała tura) przeciw dwóm zwykłym ciosom bronią główną (przy parze broni bez ataku obiema), pancerz do ${LIGHT_ARMOR}: ${f1(retreat)} przeciw ${f1(twoBlows)}, stosunek ${f2(retreat / twoBlows)} (próg < 2)`);
  for (const [armor, r] of lightRows) console.log(`   informacyjnie, pancerz ${armor}: odskok ${f1(r.retreat)}, dwa ciosy ${f1(r.twoBlows)}, stosunek ${f2(r.retreat / r.twoBlows)}${refusedText(r.refused)}`);

  const calm = scenes.filter((s) => !s.shooters);
  for (const [shot, sword] of [["strzal", "miecz"], ["strzal", "miecz_zwykly"], ["strzal", "miecz_czeka"], ["odskok", "miecz"], ["odskok", "miecz_zwykly"]]) {
    const cut = (list) => { const b = aggregate(list, sword).hp; return b > 0 ? 100 * (1 - aggregate(list, shot).hp / b) : 0; };
    const loss = (list) => `${f1(aggregate(list, sword).hp)} -> ${f1(aggregate(list, shot).hp)}`;
    const groups = [...new Set(calm.map((s) => s.group))].map((g) => calm.filter((s) => s.group === g));
    const measurable = groups.filter((list) => aggregate(list, sword).hp >= MIN_HP_FOR_RATIO);
    const tooSmall = groups.filter((list) => aggregate(list, sword).hp < MIN_HP_FOR_RATIO);
    const scenesMeasurable = calm.filter((s) => s.results[sword].hp >= MIN_HP_FOR_RATIO);
    const over = scenesMeasurable.filter((s) => cut([s]) > MAX_REDUCTION);
    const all = cut(calm);
    console.log(`3. ${verdict(all <= MAX_REDUCTION)} ${shot} względem ${sword}, sceny bez strzelców (${calm.length}): spadek straty HP ${f1(all)}% (${loss(calm)})`);
    console.log(`   informacyjnie, regiony ze stratą miecza od ${MIN_HP_FOR_RATIO}% HP: ${measurable.map((list) => `${list[0].group} ${f1(cut(list))}% (${loss(list)})`).join(", ") || "brak"}${tooSmall.length ? `; za mała strata na stosunek: ${tooSmall.map((list) => `${list[0].group} (${loss(list)})`).join(", ")}` : ""}`);
    console.log(`   informacyjnie, sceny ponad ${MAX_REDUCTION}% (z ${scenesMeasurable.length} ze stratą miecza od ${MIN_HP_FOR_RATIO}%): ${over.length}${over.length ? ` (${over.slice(0, 12).map((s) => `${s.id} ${f1(cut([s]))}% (${loss([s])})`).join(", ")})` : ""}`);
  }

  if (before) {
    // Noise of a mean over scenes: each scene adds the variance of its own mean (binomial for wins, measured for HP).
    const winVar = (r) => (r.win * (100 - r.win)) / r.n;
    const hpVar = (r) => r.hpVar / r.n;
    const seOfMean = (rows, fn) => Math.sqrt(rows.reduce((sum, r) => sum + fn(r), 0)) / rows.length;
    const shooters = scenes.filter((s) => s.shooters);
    const old = new Map(before.scenes.map((s) => [s.key, s]));
    const paired = shooters.filter((s) => old.has(s.key));
    console.log(`4. sceny ze strzelcami: ${paired.length} z ${shooters.length} sparowanych po kluczu sceny; margines szumu: 2 błędy standardowe różnicy`);
    for (const st of ["miecz", "strzal"]) {
      const nowRows = paired.map((s) => s.results[st]);
      const wasRows = paired.map((s) => old.get(s.key).results[st]);
      const now = aggregate(paired, st);
      const was = aggregate(paired.map((s) => old.get(s.key)), st);
      const winMargin = 2 * Math.sqrt(seOfMean(nowRows, winVar) ** 2 + seOfMean(wasRows, winVar) ** 2);
      const hpMargin = 2 * Math.sqrt(seOfMean(nowRows, hpVar) ** 2 + seOfMean(wasRows, hpVar) ** 2);
      const worse = paired.filter((s) => {
        const o = old.get(s.key).results[st];
        const n = s.results[st];
        return n.win < o.win - 2 * Math.sqrt(winVar(n) + winVar(o)) || n.hp > o.hp + 2 * Math.sqrt(hpVar(n) + hpVar(o));
      });
      const shown = worse.slice(0, 12).map((s) => {
        const o = old.get(s.key).results[st];
        const n = s.results[st];
        return `${s.id}: wygrane ${f1(o.win)} -> ${f1(n.win)}, HP ${f1(o.hp)} -> ${f1(n.hp)}`;
      });
      console.log(`4. ${verdict(now.win >= was.win - winMargin && now.hp <= was.hp + hpMargin)} ${st}: przed ${stat(was)}; po ${stat(now)} (margines: wygrane ${f1(winMargin)} pkt, HP ${f1(hpMargin)} pkt)`);
      console.log(`   informacyjnie, sceny gorsze ponad margines sceny: ${worse.length}/${paired.length}${shown.length ? ` (${shown.join("; ")})` : ""}`);
    }
    for (const st of ["miecz", "strzal"]) {
      const both = scenes.filter((s) => old.has(s.key));
      console.log(`   informacyjnie, wszystkie sceny, ${st}: przed ${stat(aggregate(both.map((s) => old.get(s.key)), st))}; po ${stat(aggregate(both, st))}`);
    }
  }

  for (const st of Object.keys(scenes[0].results)) {
    const a = aggregate(scenes, st);
    if (a.held3 === 0 && a.held4 === 0) continue;
    const worst = scenes.reduce((x, s) => (s.results[st].held4 > x.results[st].held4 ? s : x));
    const over = scenes.filter((s) => s.results[st].held4 > MAX_LONG_HOLD).length;
    console.log(`5. ${verdict(a.held4 <= MAX_LONG_HOLD)} ${st}: wróg zatrzymany ponad 3 tury z rzędu w ${f1(a.held4)}% walk (próg ${MAX_LONG_HOLD}%); 3 tury lub więcej: ${f1(a.held3)}%`);
    console.log(`   informacyjnie: najgorsza scena ${worst.id} ${f1(worst.results[st].held4)}%, scen ponad ${MAX_LONG_HOLD}%: ${over}/${scenes.length}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------

/** Loads one code state and hero. Item lookups scan the list, so the items a fight keeps asking for go to its front. */
async function setUp(opts) {
  const source = opts.positional[0];
  const game = await loadGameCode(opts.kod ? path.resolve(opts.kod) : REPO);
  const loaded = await game.loadData();
  const base = source === "wzorcowy" ? referenceHero(game, loaded) : await heroFromSave(game, loaded, source);
  const kit = prepareHero(game, loaded, base, opts);
  const hot = new Set([...Object.values(base.inventory.equipped), ...base.inventory.items.map((i) => i.id), "piesci"]);
  const data = { ...loaded, items: [...loaded.items.filter((i) => hot.has(i.id)), ...loaded.items.filter((i) => !hot.has(i.id))] };
  const regions = opts.region?.split(",");
  const scenes = collectScenes(data).filter((s) => !regions || regions.includes(s.group));
  return { game, data, base, kit, scenes, level: base.character.level };
}

/** Plays the scenes at `indices` (one worker's share). */
async function runScenes(opts, indices) {
  const { game, data, base, kit, scenes, level } = await setUp(opts);
  const { t, list } = buildStrategies(game, data, opts.stan);
  const stats = { refused: 0 };
  const rows = indices.map((i) => {
    const scene = scenes[i];
    const { shooters, maxArmor } = sceneFacts(game, data, scene, level);
    const row = { index: i, key: scene.key, id: scene.id, group: scene.group, shooters, maxArmor, results: {} };
    for (const [name, strategy] of Object.entries(list)) {
      const hero = heroFor(base, kit, strategy);
      if (opts.slad === scene.key || opts.slad === scene.id) {
        const trace = [];
        playFight(game, data, t, hero, scene.def, strategy.policy, kit, game.createRng(opts.ziarno), { refused: 0, trace });
        console.log(`${scene.key}, ${name}:\n${trace.join("\n")}`);
      }
      row.results[name] = runScene(game, data, t, hero, scene, strategy.policy, kit, opts, stats);
    }
    return row;
  });
  return { rows, refused: stats.refused };
}

function inWorker(workerOpts, indices) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { opts: workerOpts, indices } });
    let answered = false;
    worker.once("message", (result) => { answered = true; resolve(result); });
    worker.once("error", reject);
    // A worker that ends without its result would leave Promise.all waiting forever.
    worker.once("exit", (code) => {
      if (code !== 0 || !answered) reject(new Error(`wątek symulacji zakończył się bez wyniku (kod ${code})`));
    });
  });
}

async function simulate(opts) {
  const source = opts.positional[0];
  if (!source) throw new Error("Podaj zapis albo „wzorcowy”.");
  if (opts.stan === "przed" && !opts.kod) throw new Error("--stan przed wymaga --kod <katalog z eksportem master>.");
  const { game, data, base, kit, scenes, level } = await setUp(opts);
  const started = Date.now();
  const threads = Math.max(1, Number(opts.watki ?? os.availableParallelism() - 1));
  const shares = Array.from({ length: threads }, (_, w) => scenes.map((_s, i) => i).filter((i) => i % threads === w));
  const done = await Promise.all(shares.filter((share) => share.length).map((share) => inWorker(opts, share)));
  const results = done.flatMap((d) => d.rows).sort((a, b) => a.index - b.index);
  const lightIds = [...new Set(scenes.flatMap((s) => sceneFacts(game, data, s, level).enemyIds))].filter((id) => (enemyDef(data, id).armor ?? 0) <= LIGHT_ARMOR);
  const bench = benchTurns(game, data, base, kit, lightIds, opts.stan, opts);
  const stat = game.getStats(base, data);
  const run = {
    meta: {
      stan: opts.stan, walk: opts.walk, ziarno: opts.ziarno, ...(kit.bolt ? { bolt: kit.bolt } : {}), refused: done.reduce((n, d) => n + d.refused, 0), seconds: Math.round((Date.now() - started) / 1000),
      hero: { kind: source === "wzorcowy" ? "wzorcowy" : "z zapisu", level, ap: stat.derived.ap, hpMax: stat.derived.hpMax, spare: kit.spare },
    },
    scenes: results,
    bench,
  };
  printRun(run);
  if (opts.json) fs.writeFileSync(opts.json, JSON.stringify(run));
}

if (!isMainThread) {
  parentPort.postMessage(await runScenes(workerData.opts, workerData.indices));
} else {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.progi) {
    const [before, after] = opts.positional.map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
    printThresholds(before, after);
  } else {
    await simulate(opts);
  }
}
