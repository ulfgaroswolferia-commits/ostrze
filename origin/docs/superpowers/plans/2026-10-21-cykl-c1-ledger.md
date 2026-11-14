# SDD ledger — plan: docs/superpowers/plans/2026-10-21-cykl-c1-efekty-dialogi.md

Branch: cykl-c1 (from master d1412f8). Spec: docs/superpowers/specs/2026-10-21-cykl-c1-efekty-dialogi-design.md (binding, reachable).

## Pre-flight scan

| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1→T2 | effectById, data.effects → applyEffect/effectSources | OK |
| T2 self | stats↔effects↔time imports: time→effects(tickHour)→stats(getStats)→time(timeOfDay) | Ruling 2 |
| T2↔T9 | both say rest calls clearBySleep | Ruling 1 |
| T2→T5/T6/T8 | advanceTime(state, min, data, rng) | OK |
| T1/T2→T3 | effectById, maxStacks → repairEffects | OK |
| T3→T6/T10 | world.failedChecks, world.finishedDialogues | OK |
| T4→T6/T8 | evaluate(cond,state,data), validateCondition opts, conditionOpts(data) | OK |
| T5→T6 | validateActions, runActions; addXp(character, amount, data) is the real signature | note in T5 dispatch |
| T7 self | removes pushTimeNotices; callers in loop/rest/inventory_screen | OK |
| T7→T8/T9/T10 | pushEventNotices | OK |
| T6→T10 | nodeView/enterNode/chooseOption/finishDialogue | OK |
| T6→T11 | kwatermistrz.json stub then full content | OK |
| T8→T11 | priceModifiers, bimber in stock | OK |
| T1..T11 self | tests vs interfaces (checkChance 30/60/95/5; price 54/13; trucizna resist 25; clamp HP 3→1) | consistent |

Ruling 1: Task 2 only implements clearBySleep (system); wiring it into rest.js (and its notices) belongs to Task 9 — plan lists it in both — cost if wrong: none (ordering only).
Ruling 2: Import cycle time.js → effects.js → stats.js → time.js is allowed only because all uses are inside functions; stats.js must NOT import effects.js (effectSources reads data.effects directly); test/time.test.js (imports time.js alone) must keep passing — cost if wrong: module-init error, caught by tests.

## Tasks
Task 1: dispatched (BASE d1412f8)
Ruling 3 (user remark 2026-10-21: phenomena effects last e.g. 2 days): long effects are plain unit "hour" with duration in hours (2 days = 48); Task 7 formats remaining ≥ 24 h as days+hours on status bar and card ("2d", "1d 5h"; ui keys) — cost if wrong: display only.
Task 1: minor (deferred): throwable effects iterated twice in items.js; tick.loseApChance/loseAp ranges+pairing unvalidated (C2); only one malformed tick.damage shape tested; duplicate error when unit invalid
Task 1: complete (commits d1412f8..89bc19e, review clean)
Task 2: dispatched (BASE 89bc19e)
Task 2: minor (deferred): effectSources doesn't scale object-valued modifiers (extraDamage/damageTaken) by stacks; dead setup in effects.test fresh(); tests missing stacks>1 in getStats, advanceTime without character, resisted re-apply
Ruling 4: resistOutcome "shorten" on an already-active effect must never worsen nor shorten it (resisted re-application = no change); on a new effect applies halved duration — fix in final wave — cost if wrong: only matters if rules switch to shorten (demo uses cancel).
Task 2: complete (commits 89bc19e..2b1d02c, review clean)
Task 3: dispatched (BASE 2b1d02c)
Task 3: minor (deferred): repairEffects doesn't collapse duplicate effect ids; no test for v3 char with legacy effect / missing world
Task 3: complete (commits 2b1d02c..fc9227f, review clean)
Task 4: dispatched (BASE fc9227f)
Ruling 5: commit trailers name the model that actually wrote the commit (subagents' own attribution reminder) — mixed Opus/Sonnet trailers are expected — cost if wrong: cosmetic.
Task 4: minor (deferred): mid-file imports in conditions.test.js; item/attribute/skill objects accept extra keys; no tests for empty timeOfDay list / item.qty 0
Task 4: complete (commits fc9227f..a23006d, review clean)
Task 5: dispatched (BASE a23006d)
Task 5: note: implementer wrote code before tests (RED reconstructed by moving impl aside)
Task 5: minor (deferred): time-action test doesn't check count/HP≥1; addVar {} passes as no-op; startCombat only checked as object (C2)
Ruling 6: giveItem/takeItem object form requires qty (string form = 1 piece) — brief "id albo { id, qty ≥ 1 }" — cost if wrong: content authors must write qty.
Task 5: fix round 1/5 dispatched (missing qty → NaN; mixed equipped/free takeItem test) — FIX_BASE 37d3535
Task 5: fix round 1/5 (2 addressed, 0 open; commits 37d3535..5babb3d)
Task 5: complete (commits 14ab42a..5babb3d, review clean)
Task 6: dispatched (BASE 5babb3d)
Task 6: ⚠️ resolved by controller: dialogue.locked/failed ui keys are Task 10's (in its brief); failedChecks exists since T3
Task 6: minor (deferred): author `file` field allowed in dialogue schema; weak prefix-only assertions for end:<bad> and requires errors; finishDialogue accepts any result; data.dialogues ?? [] masks missing field; no test showLocked+failed / debug on non-check
Task 6: complete (commits 5babb3d..b18e186, review clean)
Task 7: dispatched (BASE b18e186)
Task 7: note for T10: colors.js has no 'ok' role — use 'heal' (green) for success notices
Task 7: minor (deferred): pieniadze delta 0 renders "+0 gr"; ×1 strip via regex on template text; no test turn-effect excluded from bar
Task 7: carry to T9: rest.js calls pushEventNotices per hour → 12h sleep with poison ≈ 12 notices > cap; T9 must collect all hours' events and push once (Review Focus 4)
Task 7: complete (commits b18e186..3457ddc, review clean)
Task 8: dispatched (BASE 3457ddc)
Task 8: ⚠️ resolved by controller: removes/applies validated in T1; sell flow uses sellable() adjusted price
Task 8: minor (deferred): no test for applies resisted, shop header "(rabat)" + shown==charged at scene level, "+0 HP" at full HP; shop.discount key placed among inv.* keys
Task 8: complete (commits 3457ddc..c37f5eb, review clean)
Task 9: dispatched (BASE c37f5eb)
Task 9: minor (deferred): effect scene emits "Jesteś teraz" again on refresh of active effect; no tests for mixed remove+add validation / force type
Task 9: fix round 1/5 dispatched (non-discriminating cap test; weak notice counting) — FIX_BASE 37daf3d
Task 9: fix round 1/5 (3 addressed, 0 open; residual: first-8 notices regex-shaped, not exact; commits 37daf3d..5f295a7); controller ran npm test: see below
Task 9: complete (commits c37f5eb..5f295a7, review clean)
Task 10: dispatched (BASE 5f295a7)
Task 10: minor (deferred): duplicated render lambda in done branch; results of an option that ends the dialogue show only on the camp screen; single-item lockedHint untested; loose onCombat assertion
Task 10: complete (commits 5f295a7..702d691, review clean)
Task 11: dispatched (BASE 702d691)
Task 11: minor (deferred): Polish typos in kwatermistrz.json (doliczę, ściszając, "mamie"→żonie/babie); effect-gone assertion checks narration expiry not rest; ^C+t run lacks InputExhausted assertion; duplicate shop.js import in e2e; "(2 gr)" hardcoded in option text; full greeting repeats on hub return
Task 11: complete (commits 702d691..b57f9e2, review clean)
Final review: dispatched (MERGE_BASE d1412f8, HEAD b57f9e2)
Final review: With fixes — Important: interrupt/crash mid-dialogue saves state with actions already run but scene not finished → replay repeats actions; Ruling 4 still open
Ruling 7: persist dialogue position: world.dialogueProgress = { [scene.id]: nodeId }, updated after each enterNode, cleared when the scene goes to finishedDialogues; on (re)entry with progress the scene resumes at that node WITHOUT re-running its entry actions; save v4 schema gets optional object-of-strings field (migration/createNewState default {}) — keeps failed checks failed (no re-roll) — cost if wrong: a loaded save resumes mid-talk instead of from the start.
Ruling 8: final fix wave = Ruling 7 + Ruling 4 + typos (doliczę, ścisza) + skip zero-amount money/item events + demo hub node (short return text) + move conditionOpts into engine/conditions.js (removes data↔dialogue cycle). Deferred to later: rest.summary net healing, status bar width >80 with many effects, chanceMax ≤100 check, other test-only gaps — cost if wrong: small polish later.
Final fix wave: dispatched (FIX_BASE b57f9e2)
Final fix wave: 6/6 addressed, re-review clean (commits b57f9e2..e693970); npm test 392/392, --validate clean
Deferred to later cycles (from final review): failedChecks keyed per node — the same check re-offered from another node can be retried (engine-wide; demo works around it with *_oblany flags) — consider keying by dialogue+option id; rest.summary reports gross healing while poisoned; status bar may exceed 80 cols with 3+ effects; rules.dialogue.chanceMax has no ≤100 check
