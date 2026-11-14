# SDD ledger — plan: docs/superpowers/plans/2026-10-22-cykl-d2b-zadania-eskorty.md
Spec: docs/superpowers/specs/2026-10-22-cykl-d2b-zadania-eskorty-design.md
Plan rulings R1–R3 in plan header.
Pre-flight:
- T1→T2: state.quests shape {status, acceptedAt, deadline, departed} — consistent.
- T1→T3: questById/eventById(R1)/failQuest — consistent; T3 also needs clientGen (T1 data) for the turn-back text.
- T2→T4: expireQuests/abandonHub/mapOptions — consistent.
- T3→T4: runTrip(ctx,{route,reverse,quest}) — consistent; map must compute reverse from route.from vs hub.
- T1–T5→T6: story + driver — consistent. T5 adds [D] to camp menus → shifts item numbers; T6 driver answers by label/digit for "Dalej" (1) only.
Task 1: Ruling: the "map scene forbidden in quest scenes" check is tested with an `ending` scene in Task 1 (map does not exist yet); `map` is added to the forbidden list in Task 4 — cost: none.
Task 1: Ruling: quest-scene validation messages use `quests.json › <quest> › <scene>` and `quests.json › <quest> › events › <event> › <scene>`; event ids are unique across travel.json and all quests (`id zdarzenia już zajęte`) — R1 makes eventById one namespace — cost: none.
Task 1: Ruling: the escort's road encounter (kupiec_ostromir) is appended last in travel.json, so D2a weight ranges in tests stay valid; the {trip} driver refuses Ostromir ("Nie tym razem") like the wanderer — cost: e2e never accepts the escort unless a test asks.
Task 1: Ruling: the escort's "onDefeat" goes to the same loss narration as fleeing (you survive with 1 HP, the cart is gone) — spec decision — cost: none.
Task 1: complete (commits 7bf3676..38ae5c7, tests: npm test → ℹ duration_ms 8132.9195)
Task 2: Ruling: mapOptions shows no deadline for a quest already set out (`deadlineLeft: null`) and keeps it listed — departure freezes the deadline (spec) — cost: none.
Task 2: complete (commits 38ae5c7..84f35db, tests: npm test → ℹ duration_ms 8958.666)
Task 3: Ruling: runTrip has no `onArrive` callback (spec mentioned one) — the map reads `world.location` after the trip (target reached vs back at the hub) — cost: none.
Task 3: Ruling: the return leg of a quest trip (`reverse` with a quest) rolls the plain travel table, no fixed events — only the way there uses the quest's events/chance (spec) — cost: none.
Task 3: Ruling: turn-back keeps the rest of the current march as day 1 of the way back (`daysTotal = day`, `day = 1`) — spec text — cost: the hero may camp once more before the hub.
Task 3: complete (commits 84f35db..7a24723, tests: npm test → ℹ duration_ms 9093.3749)
Task 4: Ruling: the map menu is campMenu with a new `before` option (destinations above the "dalej fabułą" row, which takes the continue slot), so Character/Equipment/Save/Menu work on the map like everywhere else; the cursor starts on the first destination — cost: none.
Task 4: Ruling: an expired escort uses its own notice text "{client} nie doczekał – zadanie przepadło." (event `zadanie_przepadlo` with `expired: true`), a plain loss uses "Zadanie przepadło: {name}." — spec copy — cost: none.
Task 4: Ruling: the map title uses the hub's short name ("Wilczy Bród – dokąd?") — spec example — cost: none.
Task 4: complete (commits 7a24723..b817950, tests: npm test → ℹ duration_ms 9696.4333)
Task 5: Ruling: the journal shows "bez terminu" for a quest already set out (its deadline is frozen) and lists finished quests in the order they were taken on, last 5 — state.quests keeps insertion order — cost: a quest finished early but taken early may drop off before a later one.
Task 5: complete (commits b817950..8c2bd82, tests: npm test → ℹ duration_ms 9528.4772)
Task 6: Ruling: no `{ map: [...] }` driver step — map, dialogue and on-site screens are scripted with plain answers (digits) and the existing `{ trip }` step (+ `accept` to take road offers); simpler and the map's rows are fixed in the demo — cost: map tests depend on row order.
Task 6: Ruling: the escort e2e sets the escort's eventChance to 0 in its data copy so the outcome is deterministic (done); the ambush/turn-back path is covered in test/trip.test.js — cost: e2e never shows the ambush.
Task 6: Ruling: the D2b e2e tests passed on first run (written after the story change in this task; the behaviour came from Tasks 1–5) — cost: they never showed RED.
Task 6: complete (commits 8c2bd82..5090515, tests: npm test → ℹ duration_ms 9062.2855)
Final review: fresh reviewer (opus). No Critical.
Final: fixed I1 a quest route defined hub-ward broke the trip (status bar, event pool, false turn-back, crash) — validation requires `route.from === hub` (spec updated) — test "final: trasa zadania musi zaczynać się w punkcie postoju" RED→GREEN, suite 775/775.
Final: fixed I2 Enter on the map sent the player on the first quest irreversibly — campMenu `initial` (default = the "Dalej"/way-on row) — test "final: Enter na mapie nie wysyła na wyprawę…" RED→GREEN, suite 775/775.
Final: fixed (re-graded Minor→Important, misleading on screen) journal showed "został 1 dzień" after the deadline — shows "termin minął" — test "final: dziennik nie pokazuje…" RED→GREEN, suite 775/775.
Final: fixed (re-graded Minor→Important, Review Focus 1 was not actually covered) the on-site-after-reward save test — new test with a real save/load at phase onsite/questScene nora_zaplata; it passed at once (behaviour was right), suite 775/775.
Final: minor (deferred): journal height not bounded/tested for 6 active quests + 5 finished (demo has ≤ 2).
Final: minor (deferred): repair gaps for saves from older data — unknown world.travel.quest crashes checkTurnBack; map phase ≠ choose with quest null; map reset leaves travel/temporary location.
Final: minor (deferred): `events`/`eventChance` allowed on kind "quest" but the turn-back text needs clientGen ("Bez undefined…").
Final: minor (deferred): the spec's "Wracasz do: {hub}." notice was not added; the arrival notice "Docierasz do: …" shows instead.
Final: minor (deferred): after a turn-back on a ≥2-day route the departure screen draws the route from a place never reached (cosmetic).
Final: minor (deferred): kupiec_ostromir has no `if`; once other routes exist (E) it could start a wilczy_brod quest after the story left that hub.
Final: minor (deferred): the Nora run e2e covers only the sword class at seed 7.
Final: Ruling: lethal 3-wolf fight without onDefeat, two dawns for a 1-day quest route, plain table on the way back, extra camp after turn-back, journal order — reviewer declined; effects acceptable and consistent with D2a — cost: balance tuning in E.
