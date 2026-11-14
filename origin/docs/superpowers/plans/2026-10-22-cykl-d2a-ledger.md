# SDD ledger — plan: docs/superpowers/plans/2026-10-22-cykl-d2a-podroze.md
Spec: docs/superpowers/specs/2026-10-22-cykl-d2a-podroze-design.md
Plan rulings R1–R3 in plan header (food.js; goto "koniec"; shared validateScenes).
Pre-flight:
- T1→T2: food field / glod effect (noExpire, restHealMultiplier) — consistent.
- T1→T3: data.travel, rules.travel, routeById/locationById/eventById — consistent.
- T2→T4: eatMeal, mealsLeft — consistent.
- T3→T4: startTravel/rollStageEvent/marchHour/finishStage/forage/markEventSeen/endTravel — consistent; spec puts forage + `foraged` flag in world.travel; startTravel must init `foraged:false` (T3).
- T2/T3→T5: eatItem, world.location/travel, locationById — consistent.
- T1 bandit event scenes use new ids; T6 removes story copies — consistent.
Task 1: Ruling: validation messages use the existing `plik › sekcja › id › pole: opis` convention (spec examples used `travel.json: routes[0].from`) — consistency with every other file — cost if wrong: string edits.
Task 1: Ruling: locations get a required `short` name (status bar shows "Brzezina"/"Wilczy Bród") — spec asks for a short location name on the bar — cost: one field.
Task 1: Ruling: grantStartKit never pins food on the quick belt — belt is for combat consumables; start provisions otherwise took a belt slot — cost: player pins manually.
Task 1: Ruling: food without `heal` is excluded from combat useOptions (not greyed with "Nie czas na jedzenie") and this moved from Task 2 to Task 1 — the combat item picker has no per-item disabled state and start provisions broke combat tests — cost: small UX difference vs spec.
Task 1: Ruling: `prowiant` appended at the end of kramarz stock; inventory_screen fixture drops start provisions; e2e/shop row inputs shifted — keeps tests' row numbering stable — cost: none.
Task 1: Ruling: bandit event gets a win narration `bandyci_po_walce` (goto "koniec") before the flee narration — R2 needs a scene to end the event after a win — cost: one text.
Task 1: complete (commits 7e9a900..7b5411c, tests: npm test → ℹ duration_ms 6804.1566)
Task 2: Ruling: getStats clamps every attribute at ≥ 0 (Review Focus 3) — hunger −3 on a low Siła went negative — cost: none expected (no attribute below 0 was ever meaningful).
Task 2: Ruling: hunger also lowers Krzepa, so sleep healing while hungry is floor((base + floor(krzepa−stacks)/div) × 0.5), not floor(normal × 0.5) — both effects come from the spec's glod — cost: hungry heal is lower than a reader might expect.
Task 2: Ruling: poisoning from food goes through applyEffect with resistance (Krzepa roll after the risk roll) — natural poison is resistible like any other — cost: one extra rng roll.
Task 2: complete (commits 7b5411c..c214340, tests: npm test → ℹ duration_ms 6939.0493)
Task 3: Ruling: `delayed` resets at every new stage (nextDay), so the +1 day applies at most once per stage — the spec's decision table says "raz na etap" while its scene text said "delayed bez zmian"; the approved decision wins — cost: a multi-day downpour can delay several stages.
Task 3: Ruling: a march hour counts as slow when the slow phenomenon is active at the hour's start (spec said after the step) — phenomena start/end on full hours, so "after" missed the last rainy hour — cost: an off-hour clock after event scenes shifts the count by ≤ 1 h.
Task 3: Ruling: world.travel also keeps `slowBy` (id for the delay message) — finishStage must name the phenomenon — cost: one field.
Task 3: Ruling: rollStageEvent rolls the chance before building the pool (spec order: chance → pick → hour; an empty pool after a passing chance roll → null without pick/hour rolls) — matches the spec's roll order — cost: none.
Task 3: Ruling: unknown route in a loaded trip → world.travel = null (spec said restart departure, impossible without a route); a null location is filled silently, an unknown one warns — cost: the travel scene restarts the trip from the current location.
Task 3: Ruling: system tests live in test/travel_system.test.js (plan named travel.test.js) — the bash heredoc append failed; a separate file keeps imports at the top — cost: none.
Task 3: complete (commits c214340..f05f4f0, tests: npm test → ℹ duration_ms 6910.5388)
Task 4: Ruling: campMenu gets `{ continueLabel, extra }` (extra items return their id) instead of the plan's campItems/handleCampPick exports — one function serves departure, camp and every old caller unchanged — cost: none.
Task 4: Ruling: rest(ctx, scene, { afterSleep }) — the camp moves to the next day right after the sleep, before the rest's camp menu, and the meal is eaten under phase "sleep"; so a save in that menu never repeats the meal or the sleep (Review Focus 1) — cost: one optional parameter.
Task 4: Ruling: a fresh start of an event clears its scenes' finishedCombats / claimedRewards / finishedDialogues / dialogueProgress — otherwise a repeatable event (wilki) would skip its fight the second time — cost: none for `once` events.
Task 4: Ruling: arrival happens at the dawn after the last camp (waitForDawn before endTravel), like every stage start — otherwise the hero "arrived" at whatever hour the last sleep ended — cost: the story resumes at 6:00.
Task 4: Ruling: event-related food notices (posilek, glod, glod_mniej, zatrucie_jedzeniem) and the travel texts were added in Task 4 (plan put events.js in Task 5) — the camp tests read them — cost: none.
Task 4: Ruling: summary screen sets phase "camp" before it is shown — a save there resumes at the camp (the summary is informational) — cost: the summary is not shown again after loading.
Task 4: complete (commits f05f4f0..aedc7cd, tests: npm test → ℹ duration_ms 7296.1973)
Task 5: Ruling: status bar order of giving way = mystic full→short, then the place goes, then the mystic tags are cut; HP never — literal "lokacja przed mistyką" left the omen as "⚡ I…" at 80 columns — cost: in tight bars the place is hidden while an omen shows.
Task 5: Ruling: food without heal has no "Na pas"/"Z pasa" actions (and "Użyj" reads "Zjedz") — it is never usable in a fight (Task 1 ruling) — cost: none.
Task 5: Ruling: no `pozywienie`/`opoznienie`/`dotarcie` event types — the travel scene pushes those notices directly (Task 4) — cost: none.
Task 5: complete (commits aedc7cd..eb57116, tests: npm test → ℹ duration_ms 8009.2032)
Task 6: Ruling: demo texts rewritten around the trip (demo_droga = setting out with Gnieworad's letter; demo_kurier/demo_koniec now happen in Wilczy Bród; "Komendant" instead of the master at the end) — the old texts described a short errand at the school — cost: copy only.
Task 6: Ruling: the `{ trip }` driver step answers by screen content (digits work in both line and TTY mode); the hungry wanderer is always refused, so `wola` stays 0 in the demo assertions — cost: the charity branch is covered only by data validation, not e2e.
Task 6: Ruling: the CLI "resume from day-2 autosave" check lives in e2e (runApp, ^C on the day-2 departure, load slot) instead of test/cli.test.js — same code path, deterministic seed — cost: none.
Task 6: Ruling: new D2a e2e tests were written after the story change in this task and passed on first run (the behaviour they pin was built in Tasks 2–4) — cost: they never showed RED.
Task 6: NOTE for user: giving food to the hungry wanderer adds `wola +1` (spec), and the demo's evening scene `demo_przekora` (if wola ≥ 1) says the hero mouthed off to the master — the two meanings of `wola` clash; needs a content decision (E or now).
Task 6: complete (commits eb57116..a181eef, tests: npm test → ℹ duration_ms 8451.6313)
User decision 2026-10-22: the `wola` clash (wanderer charity vs demo_przekora) is deferred to cycle E.
Final review: fresh reviewer (opus). No Critical.
Final: fixed hunger lowers max HP so sleeping hungry clamped HP down — eatMeal clamps HP when hunger is applied, rest never lowers HP — test "final: głód obniża maks. HP…" RED→GREEN, suite 741/741.
Final: fixed {trip} test driver looped forever on an unexpected screen — answer cap 500 + crash screens throw — test "final: sterownik { trip } nie zapętla się…" RED (hang)→GREEN, suite 741/741.
Final: fixed (re-graded Minor→Important, visible every trip) "W drodze 3/2" after the last camp — day shown capped at daysTotal — test "final: po ostatnim obozie pasek…" RED→GREEN, suite 741/741.
Final: fixed (re-graded Minor→Important, visible in the load menu) raw id "demo_podroz" for trip saves — travel scene accepts `title`, demo gets "Podróż do Wilczego Brodu" — tests "final: scena travel może mieć tytuł", "final: demo_podroz ma tytuł" RED→GREEN, suite 741/741.
Final: minor (deferred): v7→v8 migration does not remap saves sitting at the removed demo_droga_bandyci/ucieczka scenes (LoadError) nor set location for saves past demo_kurier — old demo saves only.
Final: minor (deferred): travel handler is not idempotent when the trip is over but the scene is still current (startTravel throws) — no path reaches it today.
Final: minor (deferred): an event scene id "koniec" is not rejected (it would be unreachable).
Final: minor (deferred): forgetScenes does not clear failedChecks of dialogues in repeatable events.
Final: minor (deferred): scene-level resume tests use structuredClone, not a real save/load round-trip (only e2e day-2 departure does).
Final: Ruling: delayed resets per stage, so a trip can grow by more than one day — matches the approved "raz na etap"; user then fixed the standard maximum at 4 days plus weather delays — cost: long rainy streaks stretch a trip.
Final: Ruling: sleep slider default 1 h, fixed bandit event not `once`, ^C after "expose: yes", per-hour notice cap — pre-existing or D2b scope, no change — cost: none now.
User decision 2026-10-22: a route lasts at most 4 days as written (rules.travel.maxRouteDays = 4, validated); weather delays come on top, no cap on them. Implemented with test "limit trasy…" RED→GREEN, suite 742/742.
