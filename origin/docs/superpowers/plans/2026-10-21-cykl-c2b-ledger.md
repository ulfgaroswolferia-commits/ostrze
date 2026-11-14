# SDD ledger — plan: docs/superpowers/plans/2026-10-21-cykl-c2b-walka-rozszerzenia.md

Branch: cykl-c2b (from master da86955). Spec: docs/superpowers/specs/2026-10-21-cykl-c2b-walka-rozszerzenia-design.md (binding).

## Pre-flight scan

| Rows | Produces → consumes | Finding |
|---|---|---|
| T1→T2 | MASTERY_TYPES, offhand field, ui slot.bron_druga → slotAccepts/screen | ok |
| T1→T3 | mastery rules, classes.masteryStart, ui mastery.<rodzaj> → mastery.js, card | ok |
| T1→T4/T5/T6 | dual/aimed rules, spowolnienie noMove, leap, firearm fields, reinforcements → engine | ok |
| T2→T4 | bron_druga slot → dualState second weapon | ok |
| T3→T4 | killedBy / mastery bonuses in strike path → strike() extraction must keep them | ok, T4 must preserve T3 hooks in strike |
| T4→T5 | strike() → reach free hit | ok (T5 depends on T4 export) |
| T4→T6 | strike/attack path → fireWeapon wrapping ranged shot | ok |
| T2→T6 | inventory.js shared; destroyEquipped new | ok, sequential |
| T3/T4/T5/T6 share actions.js, formulas.js, turn.js | sequential edits | ok |
| T4/T5/T6/T3 → T7 | events (bieglosc, reaction atak, leap ruch, niewypal, rozerwanie, strach_bronia, posilki, rzut, podniesienie) → texts | T7 must check event shapes actually emitted |
| T7→T8 | Techniki menu inputs → adaptive driver | ok |
| T1 self | tests for each message listed; data present | ok |
| T2 self | ok |
| T3 self | spec event `bieglosc { type, before, after }` vs plan `{ type:"bieglosc", masteryType, before, after }` | Ruling 1 |
| T3 self | masteryGain(15,40)=16.4, (80,40)=80.1 consistent with formula | ok |
| T4 self | para apCost 3 → dual 5, guard 4; miecz 3 → aimed 4 (T7) | ok (verified data) |
| T5 self | rangedInMeleePenalty already in rules (20) — reuse for enemies | ok |
| T6 self | misfire 15−5−2=8; morale 60→40 (fear 20) | ok |
| T7 self | 10 actions, ≤22 lines; pickers ≤23 at 24 rows (same as C2a) | ok |
| T8 self | e2e 3 seeds | ok |

Ruling 1: mastery event uses `{ type: "bieglosc", masteryType, before, after }` (plan) rather than spec's `{ type, before, after }` — `type` is already the event discriminator; spec intent is identical — cost if wrong: rename one field.

## Tasks
Task 1: dispatched (BASE da86955, implementer ae2cb9c0f4053939f, sonnet)
Task 1: implemented b9e9d86 (DONE_WITH_CONCERNS minor: Wycie hit 90; SLOTS deferred to T2; scenes test shop index 11→12; extra aimed.effect check). Review dispatched abd49fab789facdd4
Ruling 2: upiór "Wycie" gets `hit: 90` (spec lists none; validator requires hit for single-target attacks) — keeps validation uniform — cost if wrong: retune one number.
Task 1: minor (deferred): masteryStart >100 check hard-codes 100 instead of rules.mastery.max; aimed.*.chance no upper bound 100; no test pins throwable→rzucana
Task 1: complete (commits da86955..b9e9d86, review clean)
Task 2: dispatched (BASE b9e9d86)
Task 2: implemented a40a2a8 (implementer a93b3412beaf72e35)
Task 2: minor (deferred): inventory_screen tests use hard-coded menu indices; stats test lacks positive control for bron modifiers
Task 2: complete (commits b9e9d86..a40a2a8, review clean)
Task 3: dispatched (BASE a40a2a8)
Task 3: implemented 17bc7c2 (implementer af3f6fe9883fe7bd0; concerns: e2e seed-7 sequences re-derived; throwItem no mastery bonus yet; migrations get data)
Task 3: review → Needs fixes (Important: bieglosc not shown on summary — noticeFor lacks case)
Task 3: minor (deferred): masteryGain accepts 3 rule shapes + FALLBACK numbers duplicating rules.json; 100-cap branch untested (add masteryGain(0,5000)); throwItem pseudo-weapon gets no rzucana hit bonus (carry to T4); training killedBy credit after effect tick to 1 HP; repairMastery doesn't round to 0.1
Task 3: fix round 1 dispatched (FIX_BASE 17bc7c2)
Task 3: fix round 1/5 (1 addressed, 0 open; commits 17bc7c2..42bacc3)
Task 3: complete (commits a40a2a8..42bacc3, review clean)
Ruling 3: T4 also fixes the T3 deferred minor "throwItem gets no rzucana hit bonus" (same attack path T4 unifies via strike/masteryTypeOf thrown) — spec says throwables are rzucana — cost if wrong: slightly higher throwable hit chance.
Task 4: dispatched (BASE 42bacc3)
Task 4: implemented e3d7a8a (implementer aac8b57196afc5bfd, opus). strike() in src/systems/combat/strike.js: strike(state,data,combat,{weapon,target(enemy obj),rng,hitPenalty,critBonus,damagePercent,skillOverride,thrown,effect}) → events, no AP spend.
Ruling 4: guard ("Uderz i zasłoń") requires active dual (spec lists it under "Dwie bronie"; thrown weapon → "brak akcji dwiema brońmi") — cost if wrong: guard unavailable with single weapon.
Ruling 5: torso +25% adds to mastery damage %; second dual blow skipped when first kills (no target) — natural reading — cost if wrong: small damage tuning.
Ruling 6: thrown second weapon is a ranged attack, gets rangedInMeleePenalty when target is in melee (consistent with existing throwItem; spec says only "z obu pasm") — cost if wrong: throws in melee 20 harder.
Task 4: minor (deferred): dualState.thrownOut ignores which item was thrown (swap after dagger throw blocks pair); techniques reachable/inMelee duplicate attackTargets reach rule (carry to T5); redundant zone AP recheck; no test for aimed with unloaded weapon (combat.notLoaded); doAction techniques placeholder until T7
Task 4: complete (commits 42bacc3..e3d7a8a, review clean)
Task 5: dispatched (BASE e3d7a8a)
Task 5: implemented 4491c70 (implementer a73a4e54486837649; leaper leaps only if it can afford a melee attack; replaced C2a far-only-in-melee test)
Task 5: minor (deferred): once-per-turn leap not truly tested; rewritten C2a ai test duplicates `poor` case; mixed-attack enemies may pick penalised far attack in melee by weight; reachReaction inlines skipTurn check
Task 5: complete (commits e3d7a8a..4491c70, review clean)
Task 6: dispatched (BASE 4491c70)
Task 6: implemented f78d1d1 (implementer ae6f8436b469b6724)
Ruling 7: a firearm shot that kills the last enemy may still roll noise and bring reinforcements (fight continues) — spec: win only after reinforcements are defeated; noise is caused by the shot — cost if wrong: one extra fight after a "won" shot.
Ruling 8: aimed shots with a firearm also go through fireWeapon (misfire etc.) — spec "przy strzale" covers every shot — cost if wrong: aimed shots slightly riskier.
Task 6: minor (deferred): aimed firearm path untested; uid stability under rename not asserted; addReinforcements unused rng param (eslint-disable); fireWeapon writes loaded[] without ??= {}; reinforcements on killing shot worth event text
Task 6: complete (commits 4491c70..f78d1d1, review clean)
Task 7: dispatched (BASE f78d1d1)
Task 7: implemented ffae9e0 (implementer a43b773407f6b557b, opus; labels 'Rzuć: {broń}' with colon; marker shows exact skipped count using one log row)
Task 7: minor (deferred): hpDropped heuristic weakens 2 combat_scene assertions; long log rows (posilki with 3+ names) may wrap in full log/right column — unverified select clipping (global constraint "bez zawijania" — final review should triage); reactionHit/Miss hard-code "włócznia" instead of {weapon}; greyed zone path untested via scene
Task 7: complete (commits f78d1d1..ffae9e0, review clean)
Task 8: dispatched (BASE ffae9e0)
Task 8: implemented 0008ab5 (implementer add1feb6b8378db47; driver throws once per fight; cli tests replay driver-recorded answers)
Ruling 9: spear e2e asserts throw+pickup somewhere in the run (sparing and/or road fight), not specifically in the sparing as the plan says — spec only requires the class "używa rzutu włócznią i podniesienia" — cost if wrong: sparing-specific throw path less pinned.
Task 8: minor (deferred): driver usableRow text heuristics brittle vs ui.json copy; fight ends on hp 0 at any Enter prompt; driver has no own unit tests; sword mastery check doesn't isolate dual; C2a XP check loosened to [40,60,80]; helpers readReal at import
Task 8: complete (commits ffae9e0..0008ab5, review clean)
Final review: dispatched (MERGE_BASE da86955)
Final review: With fixes — Important: spec sim missing (spear w/ pair actions + sword no dagger vs 2 bandits threshold; upiór vs lvl1 informational). Minors to fix in wave: reaction text {weapon}; mastery FALLBACK/hard-coded 100 → rules.mastery.max; cap test masteryGain(0,5000); defend uses max with guard; RF1 interrupt-after-throw test; aimed firearm test.
Ruling 10: final fix wave leaves Minor 5 (pair throw copy "Rzuć: Para włóczni") and Minor 6 (weapon line hides off-hand/thrown) for cycle E UI polish — spec silent, cosmetic — cost if wrong: mild player confusion until E.
Final fix wave: dispatched (FIX_BASE 0008ab5)
Final fix wave: 7cd0823 (625 pass; sim sword 187, spear 188, spear dual 189 /200 thr 120; upiór info sword 1, spear 4 /200)
Final re-review: all 7 addressed, no new breakage. Out-of-scope: repairMastery derefs rules.combat.mastery.max unguarded (rules always loaded); upiór sim 1–4/200 (informational, balance look in E/D).
Verification: npm test 625/625, --validate clean (controller run).
