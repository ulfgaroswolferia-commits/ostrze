# SDD ledger — plan: docs/superpowers/plans/2026-10-21-cykl-c2a-walka-rdzen.md

Branch: cykl-c2a (from master bcde992). Spec: docs/superpowers/specs/2026-10-21-cykl-c2a-walka-rdzen-design.md (binding, reachable).

## Pre-flight scan

| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1→T3..T8 | data.enemies (+nameAcc), data.art, rules.combat, effects skipTurn/dazed, weapon.effects | OK |
| T1 self | garnek_huku added to kramarz stock → existing scenes test "Wróć" row index shifts (happened in C1) | note to T1 |
| T2→T5 | inventory.loaded | OK |
| T3→T4..T7 | createCombat, dealDamage(training), formulas | OK; def includes scene id (flags in T7) |
| T4 self | applyEffect({inCombat}) modifies src/systems/effects.js | listed |
| T5 self | needs useConsumable(…, {advance:false}) in src/systems/inventory.js, not in T5 file list | Ruling 1 |
| T5↔T6 | free attack on step-back (T5) needs an enemy attack resolver before AI exists (T6) | Ruling 2 |
| T6→T7 | enemyTurn, onAllyDeath | OK |
| T7→T9 | beginTurn/endTurn/runEnemyTurns/outcomeOf/finishCombat | OK |
| T8→T9 | renderCombat, combatActionItems, combatEventText | OK |
| T9 self | DefeatError caught in app.js; loop.js result.goto used for onFlee/onDefeat | OK (verified loop.js) |
| T3 self | ranged example 55 = 30+35−10; kusza vs armor 6 pierce 3 ×0.5 → 3 | consistent |
| T7 self | 2 bandits xp 40 each → 80; fled half → 20 | consistent |

Ruling 1: Task 5 may modify src/systems/inventory.js to add useConsumable(state, data, id, rng, { advance = true } = {}) — the plan's interface requires it — cost if wrong: none.
Ruling 2: Task 5 owns `resolveEnemyAttack(state, data, combat, uid, attack, rng)` → events (hit chance via enemyHitChance, damage via mitigate on player armor/reduction, blunt daze, attack effects with dazed penalty) exported from src/systems/combat/actions.js; Task 6's AI calls it instead of reimplementing — avoids duplicated attack logic — cost if wrong: function moves between files.

## Tasks
Task 1: dispatched (BASE bcde992)
Task 1: minor (deferred): hit bounds 5/95 hardcoded in combat/data.js (spec says 5–95); enemy attack effects may be hour effects (OK: e.g. poison, applied via applyEffect); art tabs/control chars not rejected; helpers duplicates art parsing
Task 1: complete (commits bcde992..4667d0d, review clean)
Task 2: dispatched (BASE 4667d0d)
Task 2: minor (deferred): grantStartKit inventory fallback lacks loaded:{} (dead code); misplaced createNewState assertion in v4 migration test; equal-to-capacity keep case only indirect
Task 2: complete (commits 4667d0d..d5a451e, review clean)
Task 3: dispatched (BASE d5a451e)
Task 3: Ruling 3: training end-of-fight (HP 1 = win/defeat) is owned by Task 7's outcomeOf per plan; Task 7 must make isOver agree with outcomeOf (single source of truth) and test sparring ending in win/defeat — reviewer's Important resolved by plan ownership — cost if wrong: sparring only ends by 200-round draw (caught by T7 tests).
Task 3: minor (deferred): isOver without state never returns defeat; dealDamage negative/below-1 edge; hardcoded 75/5/95 (flee clamp could use hitMin/hitMax); duplicate names for two count-1 entries of same id; unused damageType param
Task 3: complete (commits d5a451e..13a43d8, review clean after ruling)
Task 4: dispatched (BASE 13a43d8)
Task 4: note: implementation written before RED; RED reconstructed
Task 4: minor (deferred): STRACH_MORALE=20 hardcoded (spec gives no key) ; chancePenalty / shorten branch / bystrosc −2 / enemy loseAp untested; dead tickHour call in test; applyToEnemy no dead/fled guard
Task 4: carry to T7: endTurnEffects must be called even for a skipped (stunned) turn, otherwise the armed stun repeats
Task 4: complete (commits 13a43d8..79c87b0, review clean)
Task 5: dispatched (BASE 79c87b0)
Ruling 4: battlefield effects (combat.battlefield, e.g. zadymienie rangedHitChance −35 / fleeChance +40) must feed playerHitChance, enemyHitChance and fleeChance — gap from Task 3 formulas; assigned to Task 6 (modify formulas.js + tests) — cost if wrong: smoke would do nothing.
Task 5: carry to T7: reset combat.defendBonus at start of player's next turn; deaths from effect ticks need wrog_pokonany + morale drop there (player kills already handled in T5 — don't double)
Ruling 5: step-back free attack requires the ENEMY to have a melee attack (concept 7 "jeżeli ma broń zwarcia"); a stunned enemy gets no free attack; all_enemies throwables need no target — cost if wrong: small balance change.
Task 5: minor (deferred): fumble mid all_enemies leaves earlier victims affected
Task 5: carry to T7/T9: free attack can kill the player during move → caller must check outcome after every doAction
Task 5: fix round 1/5 dispatched (weak no-mutation test; Ruling 5 stunned/no free attack; all_enemies needsTarget) — FIX_BASE 272a299
Task 5: fix round 1/5 (4 addressed, 0 open; residual minor: all_enemies with no living enemies → TypeError, unreachable; commits 272a299..3485b8f)
Task 5: complete (commits 79c87b0..3485b8f, review clean)
Task 6: dispatched (BASE 3485b8f)
Ruling 6: in C2a enemy `far` attacks are usable only from the far band (spec's enemy hit formula has no in-melee penalty; demo enemies are melee-only); revisit with rangedInMeleePenalty for enemies in C2b — cost if wrong: far-only enemies idle in melee.
Task 6: minor (deferred): MAX_STEPS cap silent (validate enemy attack apCost ≥ 1 already?); pickWeighted fallback hides mis-sized roll; flee smoke assertion clamp-weak
Task 6: complete (commits 3485b8f..18d68d1, review clean)
Task 7: dispatched (BASE 18d68d1)
Ruling 7: bandyta retuned to hp 22, Pałka 5–9, hit 65 (reviewer measured ~90–94% win, ~50% HP lost; old numbers: 100% win, ~12% HP lost — no risk) and the sim asserts avg HP lost ≥ 25% hpMax + no draws — spec says demo numbers are a starting point tuned in E — cost if wrong: demo fight harder than intended.
Task 7: minor (deferred): training fight entered at HP 1 = immediate defeat (Task 9 should note); "HP never < 1" test only checks final HP
Task 7: fix round 1/5 dispatched (toothless bandits / non-discriminating sim; stunned tick-death; remis event; xpFled) — FIX_BASE 8bf84ad
Task 7: fix round 1/5 (5 addressed, 0 open; commits 8bf84ad..dc8b891)
Task 7: minor (deferred): console.log in combat_sim.test.js pollutes test output
Task 7: complete (commits 18d68d1..dc8b891, review clean)
Task 8: dispatched (BASE dc8b891)
Task 8: minor (deferred): belt/log/time glyphs hardcoded; long belt/effects lines truncated silently; enemy crit/unknown uid texts untested; crit suffix via regex on translation; "Bandyta 1: Zamroczony." vs mockup
Task 8: carry to T9: player move logged as if the enemy moved (`ruch` without mover) — add `mover` to the event and a player-move text ("Zbliżasz się do {target}." / "Odskakujesz od {target}.")
Task 8: complete (commits dc8b891..6416848, review clean)
Task 9: dispatched (BASE 6416848)
Ruling 8: interrupting a dialogue-started fight restores the pre-choice snapshot but keeps world.failedChecks from the post-choice state (a failed check stays failed) — cost if wrong: none; closes a re-roll exploit.
Ruling 9: after a fight started from a dialogue the dialogue scene's camp menu stays ("no camp after fight" applies to combat scenes) — cost if wrong: one extra menu.
Task 9: minor (deferred): menu cursor kept by index may land on another action after reload/use; LoadError on newest save → menu without trying next; draw summary reads "Wycofujesz się"; mixed progress/done locals in dialogue.js; summary screen height at 80×24 unverified
Task 9: fix round 1/5 dispatched (non-discriminating rollback tests; failedChecks re-roll exploit; lethal defeat not shown; 200-seed scene sparing test; step-back text; log view height; sparing-win asserts) — FIX_BASE db6fbb4
Task 9: fix round 1/5 (7 addressed, 0 open; commits db6fbb4..9ca703f)
Task 9: complete (commits 6416848..9ca703f, review clean)
Task 10: dispatched (BASE 9ca703f)
Ruling 10: a training (sparing) fight restores the player's HP to its pre-fight value afterwards (blunt wooden sparring leaves no lasting wounds) — avoids entering the lethal ambush at HP 1 — cost if wrong: sparing has no lasting consequence beyond flags/XP.
Task 10: minor (deferred): resume-equality strip drops rngState (weakens slightly); demo_droga repeats "prawdziwe"; sequences tied to RNG path (accepted)
Task 10: fix round 1/5 dispatched (training HP restore; exhaustion+flag asserts in B1 e2e; narration punctuation/wording; named constant) — FIX_BASE e8fc240
Task 10: fix round 1/5 (4 addressed; residual minor: non-TTY B1 test lacks exhaustion assert despite report claim — flag asserts cover vacuity; commits e8fc240..a33b4fc)
Task 10: complete (commits 9ca703f..a33b4fc, review clean)
Final review: dispatched (MERGE_BASE bcde992, HEAD a33b4fc)
Final review: With fixes — Important: (1) interrupt on the level-up screen after a combat scene auto-saves with rewards paid but scene still current → replay doubles XP/loot (reproduced); (2) TTY: belt shown as "[1] Opatrunek" but digit 1 picks action row 1 (Atak)
Ruling 11: combat scenes get a claimed-once guard like rewards/dialogues: `world.finishedCombats = { [sceneId]: outcome }` written inside the handler right after rewards (inside the rollback try, so an interrupt during the summary still rolls back); on re-entry the fight is skipped and combatNext(scene, recorded outcome) is used; load defaults the field to {} (like dialogueProgress) — cost if wrong: a combat scene revisited by story goto won't refight.
Ruling 12: digits keep selecting actions (one widget everywhere); the belt line drops the "[n]" brackets — cost if wrong: no belt quick-keys (could come later).
Ruling 13: final fix wave also: remove console.log from sim; training starts at HP max(hp,2) (restored after); pickers redraw top block + picker only (no overflow at 24 rows); line mode never shows art; training-loss summary text; dedicated disabled reasons (no reload weapon / nothing to swap); log texts for thrown miss/fumble; draw summary text; defeat loads next-newest save if the newest fails; turn effects applied during the holder's own turn are not counted down at that turn's end (generalised "armed"); unique numbering for same-id enemies across entries. Deferred: scrollable full log view, "+N" marker for long enemy turns, adaptive e2e driver (C2b) — cost if wrong: polish later.
Final fix wave: dispatched (FIX_BASE a33b4fc)
Final fix wave: 13/13 addressed, re-review clean (commits a33b4fc..52db96c); npm test 536/536, --validate clean
Deferred to C2b / later: scrollable full combat log; "+N" marker when enemy turns produce more entries than the 3-line log; adaptive e2e driver instead of RNG-path-bound input sequences; enemy far attacks from melee with penalty (Ruling 6); belt quick-keys (Ruling 12)
