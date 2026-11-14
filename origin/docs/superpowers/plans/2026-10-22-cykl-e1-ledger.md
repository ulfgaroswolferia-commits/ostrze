# SDD ledger — plan: docs/superpowers/plans/2026-10-22-cykl-e1-panele.md
Spec: docs/superpowers/specs/2026-10-22-cykl-e1-panele-design.md
Plan rulings R1 (io.frame), R2 (TTY tests adapted, kept).
Pre-flight:
- T1→T2,T3,T6: composeFrame/displayWidth — consistent.
- T2→T3,T6: heroPanel(state,data,{cols,combat}) — consistent; needs placeText exported from screen.js (T2 does it).
- T3→T4,T5,T6: showScreen/drawFrame/framesOn/commandsFor — consistent.
Task 1: Ruling: scene height follows the zones exactly (80×24 with hero: 17 − choices − notices part → 16 with 1 choice, 11 with 6) — the spec's "8–13" was an estimate — cost: none.
Task 1: Ruling: with more than 2 notices the zone shows the latest one and "…i {n−1} więcej [L]" (plan said "…i 3 więcej" for 5) — two rows, one is the marker — cost: copy.
Task 1: Ruling: plain body lines are word-wrapped by the composer, painted ones (with colour codes) are cut with "…" — wrapping painted text would split escape codes — cost: callers must wrap painted prose themselves.
Task 1: Ruling: 256-colour detection = TERM contains "256color" or COLORTERM truecolor/24bit; otherwise frame=green, frame_title=bold yellow — cost: some Windows terminals with 256 colours but no such env get the fallback.
Task 1: complete (commits 634ef43..671f918, tests: npm test → ℹ duration_ms 8974.3526)
Task 2: Ruling: line 1 of the hero panel drops the place first (then the effects are cut) and line 2 drops the mystic tags (full → short → none); HP/XP and weapons stay — spec give-way order — cost: none.
Task 2: complete (commits 671f918..e1b11c8, tests: npm test → ℹ duration_ms 9435.0618)
Task 3: Ruling: widgets reach the frame through `makeScreen(io)` — when `io.frame` is set every redraw is the whole frame with the widget's rows as choices — so select/multiSelect/sliders were converted in one place; `clear(io)` drops the frame, so screens not yet migrated keep their old look — cost: none.
Task 3: Ruling: the camp commands are select items marked `hidden: true`: in a frame they leave the choice panel for the command column and answer only to their letter; in line mode they stay listed as before — cost: in a frame they cannot be reached with arrows (letters only).
Task 3: Ruling: in a frame the choice rows are numbered "[n] label" (TTY rows had no numbers before) and up to 4 short choices sit on one line — mockups showed "[1] Dalej" — cost: none.
Task 3: Ruling: `showScreen` is async (paging waits for Enter) and the camp menu awaits `render()`; a re-render after a sub-screen pages a long text again — cost: Enter again after opening the character sheet on a long screen.
Task 3: Ruling: `effect` and `phenomenon` scenes have no screen of their own (only notices) — nothing to migrate — cost: none.
Task 3: Ruling: the old TTY test "obóz: <down>, <enter> otwiera kartę" now uses the [P] letter (R2) — cost: none.
Task 3: complete (commits e1b11c8..e8980ca, tests: npm test → ℹ duration_ms 8970.0773)
Task 4: Ruling: the shop has no command column (spec listed P, E) — its menus never offered P/E; adding them is new behaviour — cost: the player leaves the shop to check gear.
Task 4: Ruling: the rest's long "expose the artifact?" question moved from the select title (cut to one line in a frame) to the scene panel (wrapped); line mode prints the same text — cost: none.
Task 4: Ruling: showScreen gained `blank` (the shop header had no empty line after the notices) and works without a state (main menu: hero null) — line mode stays byte-identical — cost: none.
Task 4: Ruling: the main menu uses a frame only when framesOn (line mode keeps its old flow without a status line); the load menu draws its list inside that frame — cost: load errors still print below the frame.
Task 4: Ruling: the creator's summary sheet is paged in a frame (Enter per page) until Task 5 lays the sheet out in two columns; TTY creator tests got the extra Enters (R2) — cost: tests change again in Task 5.
Task 4: Ruling: the test driver reads frame rows ("│ ▶ [n] label │", one-line "[1] … [2] …") and recognises the expose question by its first 30 characters — cost: none.
Task 4: complete (commits e8980ca..72325d2, tests: npm test → ℹ duration_ms 9202.7389)
Task 5: Ruling: the character sheet's frame has no hero panel (`showScreen` hero: false) — two columns (attributes, derived values, gear | skills, mastery, XP, effects, perks) fit on one page only without it, and the sheet shows the hero itself — cost: the sheet's frame differs from the others at the top.
Task 5: Ruling: in the two-column sheet each column is 37 columns at 80, so long breakdowns ("(baza 15; -5 Kaftan przeszywany)") are cut with "…" — cost: the full breakdown is only in line mode or a wider terminal.
Task 5: Ruling: the creator's summary keeps the one-column sheet (paged) — it is a different screen than [P]; left as Task 4 made it — cost: Enter per page in the creator.
Task 5: Ruling: [L] Komunikaty is added to the command column only when more than 2 notices are hidden and the menu has no own L hotkey (combat's [L] log wins) — cost: none.
Task 5: complete (commits 72325d2..45b0636, tests: npm test → ℹ duration_ms 8842.0864)
Task 6: Ruling: in a frame, items with their own hotkey are shown as "[A] Atak" (no "[n]" number in front), others as "[n] …" — the combat actions already carry letters — cost: none.
Task 6: Ruling: the combat log ([L]) and the technique/target/item pickers are drawn inside the fight's frame (choice panel, 6 rows, scrolling); a long technique list (sword: 4 weapon techniques + 2 artifact abilities) needs scrolling to reach the abilities — cost: one more key press.
Task 6: Ruling: the fight summary in a frame keeps the last fight view in the scene panel with the result line below it, and the loot notices in the notice zone; Enter is asked on the answer row — cost: none.
Task 6: Ruling: old TTY combat tests adapted (R2): the picker helper takes the whole frame between screen clears; the techniques test checks the scroll marker instead of the last ability — cost: none.
Task 6: complete (commits 45b0636..b95ddc5, tests: npm test → ℹ duration_ms 9058.6212)
Task 7: Ruling: the "Powiększ okno" notice is a dim line ahead of the status line (line-mode screens drawn by showScreen) on any TTY that is too small — spec said "w linii stanu", a separate line keeps the status line's width logic untouched — cost: one extra line on small terminals.
Task 7: Ruling: screens that do not go through showScreen (menu widgets in the load menu, the defeat screen) stay plain in a frame-capable TTY — the e2e frame test skips non-boxed screens — cost: those few screens are not framed yet.
Task 7: complete (commits b95ddc5..5baa48e, tests: npm test → ℹ duration_ms 9250.4503)
Final: fixed C1 (kursor „Gotowe” znikał w długich multiSelect/suwakach; okno wyboru liczy wiersze tytułu/opisu/budżetu) — test/frame_fixes.test.js „C1: …” ×3 RED→GREEN, suite 815/815
Final: fixed I1 (ukryte komunikaty na ekranach z Enter; [L] w pressEnter) — „I1: …” RED→GREEN, suite 815/815
Final: fixed I2 (komunikaty pisane pod ramką: „Brak zapisów.”, zbyt ciężka nagroda, pusty dziennik walki) — „I2: …” ×3 RED→GREEN, suite 815/815
Final: fixed I3 (tekst pod ramką: koniec rozmowy, karta przedmiotu, błędne t/n — `say`, notices) — „I3: …” RED→GREEN, suite 815/815
Final: fixed I4 (kolorowa długa linia ucinana zamiast zawijana) — „I4: …” RED→GREEN, suite 815/815
Final: fixed I5 (strony tekstu liczone dla panelu wyboru; wiersze nie giną przy 6 pozycjach) — „I5: …” RED→GREEN, suite 815/815
Final: Ruling: showScreen liczy strony dla panelu wyboru o `choiceRows` wierszach (domyślnie 6; narracja i ekrany kończące się Enter: 1; podsumowanie kreatora: 2) — dzięki temu strony nie skaczą, gdy widżet wypełni panel — koszt: dłuższy tekst stronicuje się wcześniej niż wymagałby tego sam tekst.
Final: Ruling: dziennik WIDTH 78→74 (opisy zawijane do WIDTH−2 + wcięcie mieszczą się w ramce 76 kol.) — koszt: tryb liniowy też ma węższy dziennik.
Final: Ruling: ekrany nadal bez ramki: lista wczytywania (rysowana przez widżet), ekran porażki, ekrany zapisu — koszt: kilka ekranów poza stylem paneli (do E3).
Final: minor (deferred): w ramce błędy wczytywania zapisu doklejane do powiadomień ramki menu głównego, nie do listy.
Final: minor (deferred): polecenia obozu osiągalne tylko literami (nie strzałkami).
Final: minor (deferred): długie rozbicia statystyk w karcie postaci ucinane „…” przy 80 kolumnach.
Final: minor (deferred): ekran porażki i zapisu bez ramki.
