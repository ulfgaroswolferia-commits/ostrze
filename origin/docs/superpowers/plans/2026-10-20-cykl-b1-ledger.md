# SDD ledger — plan: docs/superpowers/plans/2026-10-20-cykl-b1-postac-czas.md

Spec: docs/superpowers/specs/2026-10-20-cykl-b1-postac-czas-design.md (reachable)
Branch: cykl-b1 (from master 21b735d)

## Pre-flight scan

| Tasks | Shared file/interface | Finding |
|---|---|---|
| 1↔2..12 | loadData shape, minimalData includes new files | consistent |
| 1↔3 | rules.vars used by validateCondition opts | consistent |
| 2↔5 | emptyTotals/addModifiers | consistent |
| 3↔A loop/save tests | version 1 → 2 expectations | T3 updates them (stated) |
| 4↔A loop tests | loop now calls advanceTime(state, minutes, data) — cycle-A loop tests build ctx without data | RULING 1 |
| 4↔5 | timeOfDay used by stats | consistent |
| 5↔6 | getStats(state, data, {permanentOnly}); createCharacter needs hp without a state | RULING 2 |
| 7 self | test expects raw mode false right after Ctrl+C, but readline terminal:true keeps raw on for the interface lifetime | RULING 3 |
| 7↔8 | readKey/isTTY/scripted {tty} | consistent |
| 8 self | multiSelect digit on "Gotowe" row semantics unspecified | RULING 4 |
| 8↔10 | creator key sequences (TTY + linear) verified against sliders/multiSelect rules | consistent |
| 9↔10,11 | statusBar(state, data, opts), pressEnter(io, ui, {onCharacter}) | consistent |
| 10↔11 | data rule mentions `rest` type before T11 adds it (string check only) | consistent |
| 11↔A loop tests | afterScene default hook no-ops without character | consistent |
| 12↔A e2e | cycle-A e2e tests rewritten for new demo | stated in T12 |
| T1..T12 self | tests vs interfaces | agree (verified arithmetic: stats 15/35/36/45/20/100, hp 35/39/41, xp 150/450/900/1500, sliders [7,5],[100],[8,4], creator sequences) |

Ruling 1: loop.js calls advanceTime only when scene.time is truthy and uses ctx.data; cycle-A loop tests whose scenes have `time` get ctx.data = minimalData() (T4 updates them) — cost if wrong: test-only churn.
Ruling 2: createCharacter computes hp from getStats({ character, time: { minutes: rules.startHour * 60 } }, data, { permanentOnly: true }).derived.hpMax — cost if wrong: hp off when a time-of-day hpMax modifier exists (none in MVP).
Ruling 3: T7 Ctrl+C test asserts InterruptError, that a later readKey/ask still works, and that after io.close() the last setRawMode call is false (readline owns raw mode while the interface is open; the app always closes io on exit) — cost if wrong: raw mode stays on between keys (invisible to the user).
Ruling 4: in multiSelect a digit pointing at the "Gotowe" row finishes when enabled (else ignored), like Enter on it — cost if wrong: trivial.

## Progress
Ruling 5 (T1, BASE 63610e5): modifiers only shape-checked in T1 (keys in T2); requires.level ≥ 2; bystroscSkillPenalty optional int — cost if wrong: trivial
Task 1: note — RED not captured
Task 1: minor (deferred): data.js startsWith("oczekiwano") separator heuristic; duplicate real-data test
Task 1: minor → carried into Task 2: validate rules.creator.gifts keys are attribute ids and attributeMin ≤ attributeMax
Task 1: complete (commits 63610e5..c4e9f8c, review clean)
Ruling 6 (T2, BASE c4e9f8c): modifier value messages/edge rules (extraDamage/damageTaken formats, from===to invalid, gifts/attributeMin checks added) — plan silent — cost if wrong: message wording
Task 2: note — RED not run
Task 2: minor → carried into Task 4: timeOfDay from/to range 0–23 not checked
Task 2: minor (deferred): addModifiers assumes validated input
Task 2: complete (commits c4e9f8c..8830a63, review clean)
Ruling 7 (T3, BASE 8830a63): var condition validation order/messages; handler exported as varScene registered as 'var' — plan silent — cost if wrong: trivial
Task 3: note — RED not run
Task 3: minor (deferred): vars.js __proto__ name unreachable via validated data
Task 3: complete (commits 8830a63..3359d80, review clean; post-migration version check verified by controller)
Ruling 8 (T4, BASE 3359d80): event order zmiana_pory before hooks at the same hour; timeOfDay from/to range 0–23 validated — cost if wrong: trivial
Task 4: note — RED not run
Task 4: minor (deferred): data.js:63 range check only > 23 (negatives already rejected by schema min 0 — verified INT_MIN0); odd test regex
Task 4: complete (commits 3359d80..10dbdc7, review clean)
Ruling 9 (T5, BASE 10dbdc7): getStats calc order (permanent attrs → skill base → all-source skill mods clamp → final attrs → derived), critChance base = final fart, night bystrosc penalty merged into timeOfDay source, breakdown only non-zero source entries — spec partially silent — cost if wrong: stat values shift slightly
Task 5: note — RED not run
Task 5: minor (deferred): timeOfDay computed twice; other.* shares refs; skill breakdown doesn't show clamp (UI note)
Task 5: complete (commits 10dbdc7..442b9d4, review clean; derived coefficient names verified by passing hp/ap/carry tests)
Ruling 10 (T6, BASE 442b9d4): creator pool exact; perk missing order attr→skill→level→owned→limit; perk on new level %2; applyLevelUp cap exception only when no skill can take another point; perks checked before applying points; character schema fields — plan partially silent — cost if wrong: level-up edge cases
Task 6: note — RED not observed; applyLevelUp perk count = min(pending, okCount) (stricter reading, accepted)
Ruling 11: loadGame accepts character absent/undefined as well as null (lenient for old saves) — cost if wrong: a malformed save without the key loads as "no character" (creator restarts)
Task 6: minor (deferred): name.length UTF-16; inert assert in cap test; throws without message checks; comment on min(pending, okCount)
Task 6: complete (commits 442b9d4..e31f47d, review clean)
Ruling 12 (T7, BASE e31f47d): readline owns raw mode; keypress listener only while pending; Enter in readKey swallows the following 'line' event and clears rl.line — cost if wrong: stray empty answer to next ask
Task 7: review Approved; controller promoted minor 'readline echoes/edits during readKey' to Important (real-terminal menu redraw corruption) → fix round 1 (FIX_BASE bac84e7)
Task 7: fix round 1/5 (1 addressed, 0 open — readline echo/history during readKey; commits bac84e7..ff9d378)
Task 7: minor (deferred): multi-key chunk tail dropped (paste); rl internals
Task 7: complete (commits e31f47d..ff9d378, review clean after 1 fix round)
Ruling 13 (T8, BASE ff9d378): menu render protocol (writeRaw block + cursor-up clear), truncation incl hint, multiSelect digit/Enter semantics, sliders line-mode syntax and help message, menu.js imports only ui modules — plan partially silent — cost if wrong: menu UX details
Task 8: minor (deferred): title not truncated; multiSelect line-mode disabled Gotowe silent; truncation tested only for select
Task 8: complete (commits ff9d378..75c29ff, review clean)
Ruling 14 (T9, BASE 75c29ff): plan gap — no task migrated main menu/load list to arrows; T9 reimplements choose() on select() (line mode byte-compatible) — spec "jeden widżet wszędzie" — cost if wrong: menu behavior change in terminal only
Ruling 15 (T9): narration re-renders its screen after [P] character screen returns — cost if wrong: cosmetic
Task 9: note — RED not run; tests placed in prompt/scenes test files instead of character_screen.test.js
Task 9: minor (deferred): signed(0) → "-0"; no test for debug flag in narration / perk-less sheet; XP threshold hardcoded in test
Task 9: complete (commits 75c29ff..1002ac7, review clean)
Ruling 16 (T10, BASE 1002ac7): creator step details (hint = untagged base via temp getStats, restart semantics), reward screen, data order rule by list position, MissingCharacterError → notice + menu — cost if wrong: creator UX details
Note: user approved weapons lore + mastery (biegłość) direction for cycle C — spec edit pending until no implementer is committing
Task 10: note — RED not run
Docs commit 740e5fb (weapons lore + mastery sketch) on top of T10 head 4e86453
Task 10: review Needs fixes — Important: createCharacter error message wiped by clear, untested → fix round 1 (FIX_BASE 740e5fb)
Task 10: minor (deferred): reward onCharacter untested; restart test only checks final name
Task 10: fix round 1/5 (1 addressed, 0 open — creator error notice; commits 740e5fb..e8dc3a3)
Task 10: complete (commits 1002ac7..e8dc3a3, review clean after 1 fix round)
Ruling 17 (T11, BASE e8dc3a3): level-up perk availability evaluated before points (matches applyLevelUp), 2nd perk recomputed with 1st as owned; hooks after advanceTime before end-check + once at runStory start; rest heals per hour with final krzepa — cost if wrong: a perk unlocked by this level's points is only offered next level
Task 11: note — RED not run; tests line-mode only
Task 11: minor (deferred): 2nd-perk silent loss without noPerk notice; no all-skills-capped scene test
Task 11: complete (commits e8dc3a3..76d2f8c, review clean)
Ruling 18 (T12, BASE 76d2f8c): demo texts/titles and temporary instructor name chosen by implementer within style rules; cycle-A e2e intents preserved — cost if wrong: demo content tweaks
Task 12: minor (deferred): spear branch untested in e2e; two demo texts ~4 sentences; masculine verb forms (hero has no gender choice — ok for now); loose regexes; cli test env redundancy
Task 12: complete (commits 76d2f8c..785f614, review clean)
Title commit 483dae6 (Ostrze Gwiazd; user chose to keep class choice)
Docs commit 37f56dd (star weapon artifact idea) — after final-review head 483dae6
Final review (opus, 21b735d..483dae6): With fixes — 2 Important (2nd-perk crash; redraw column after resize/echo) + 3 cheap minors → see final-fixes.md. PAUSED here (user usage low). Next: ONE fix dispatch with final-fixes.md, scoped re-review, then finishing (merge to master locally).
Final fix wave: complete (commits 37f56dd..a739fd4, re-review all addressed; 176/176). Ready to finish branch.
