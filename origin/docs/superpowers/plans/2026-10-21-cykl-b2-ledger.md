# SDD ledger — plan: docs/superpowers/plans/2026-10-21-cykl-b2-ekwipunek-sklep.md

Branch: cykl-b2 (from master e641011). Spec: docs/superpowers/specs/2026-10-21-cykl-b2-ekwipunek-sklep-design.md (binding).

## Pre-flight scan

| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1→T2 | items.js (itemById, SLOTS, ITEM_TYPES), helpers minimalData shops:[] → T2 fills shops | OK |
| T1→T3 | itemById/SLOTS → equipmentSource | OK; kolczuga `ap` −1, kaptur `resist_oslepienie` are valid modifier keys (modifiers.js) |
| T2→T4 | slotAccepts, startItems/startEquipped/startMoney → grantStartKit | OK |
| T3→T4 | getStats.derived.carry/hpMax → canAdd, unequip hp clamp | OK; carry = 25+10·siła (siła 5 → 75, matches T4 test) |
| T4→T5 | removeItem/freeCount/canAdd → useConsumable, buy/sell | OK |
| T4→T6 | createNewState inventory (T4) vs version/world fields (T6) | OK, T4 explicitly defers version |
| T1–4→T6 | itemById/slotAccepts/quickCapacity → repairInventory | OK; save.js (engine) importing systems is allowed (not ui) |
| T7→T8 | select hotkey/emptyPicksInitial → campMenu | OK |
| T8→T9 | camp.js greyed Ekwipunek → T9 wires showInventory | OK |
| T8→T10 | reward.js campMenu (T8) → reward items/money (T10) | OK, sequential edits |
| T4/T5→T9 | inventory API → inventory_screen | OK |
| T5→T11 | shop.js → shop scene; sliders `note` = suma | Ruling 1 |
| T8/T10/T11→T12 | camp, reward, shop scene → demo + e2e | OK |
| T8 test vs T8 text | "z,1,n,4,''" implies declined overwrite returns to slot list | Ruling 2 |
| T9 self | header "Waga 12.2/": miecz kit 7.7 + kaptur 0.5 + kusza 4 = 12.2; kusza minStrength 4 > siła 3 → "za ciężka" | OK |
| T10 self | overload test siła 2 → carry 45, limit 67.5; 70 kg bag already over → kolczuga refused | OK |
| T11 self | `1,1,1+,2,t,3`: slider starts 1, `1+`→2, `2`=Gotowe | OK (sliders line syntax `N+`) |
| T1,T2,T3,T5,T6,T7,T12 self | tests vs code consistent | OK |

Ruling 1: Task 11 may extend `sliders` so a row's `note` can be a function `(value) => string` (live sum preview) — spec asks for "podgląd sumy" and current `note` is static — cost if wrong: small widget API addition, easy to revert.
Ruling 2: In saveToSlot, answering "n" to overwrite confirm returns to the slot list (not out of the screen) — the plan's own test sequence requires it — cost if wrong: one-line flow change.

## Tasks
Task 1: dispatched (BASE e641011, implementer a0232193b2b503320, sonnet)
Task 1: minor (deferred): items.js MAX_REDUCTION=75 hardcoded, duplicates rules.inventory.maxReductionPercent
Task 1: minor (deferred): tests missing ammo/throwable required-field, negative/unknown reduction key, chance 0
Task 1: note: invented values luk_mysliwski minStrength 2, consumable/throwable apCost 3
Task 1: complete (commits e641011..67d6273, review clean)
Task 2: dispatched (BASE 67d6273)
Task 2: minor (deferred): validateStartKit allows same item equipped in 2 slots with qty 1, and duplicate startItems ids
Task 2: minor (deferred): data.test.js:325 redundant deepEqual; :344 substring-only assertion
Task 2: complete (commits 67d6273..1f449ad, review clean)
Task 3: dispatched (BASE 1f449ad)
Task 3: note: implementer skipped RED step (tests written after code)
Task 3: ⚠️ resolved by controller: items exist in real data (Task 1); weight card line is Task 4
Task 3: minor (deferred): card test in prompt.test.js coupled to demo data; "Broń: " empty if stale id and no piesci
Task 3: complete (commits 1f449ad..62c2a8a, review clean)
Task 4: dispatched (BASE 62c2a8a)
Task 4: ⚠️ resolved by controller: Task 2 validates startEquipped slot+presence in startItems; real data consistent (dup-equip gap already a T2 minor)
Task 4: minor (deferred): grantStartKit ignores equip/assignQuick failures (equip failure should throw); `??=` dead code; double call duplicates kit
Task 4: minor (deferred): addItem/removeItem don't validate qty (negative/fractional; removeItem qty 0 on unowned crashes)
Task 4: minor (deferred): tests missing clampHp after equip, re-equip same slot, remove 1 of 2 pinned; canAdd test uses fractional qty
Task 4: note for T6: carriedWeight throws on unknown item id — repair must run before any weight calc
Task 4: complete (commits 62c2a8a..816f274, review clean)
Task 5: dispatched (BASE 816f274)
Task 5: ⚠️ resolved by controller: removeItem quickSlots drop verified in T4 review; piesci is hidden+value 0 in data
Task 5: minor (deferred): buy/sell don't validate qty (negative qty in buy → negative cost adds money); buy doesn't call shopDef for unknown shopId when world.shops has it
Task 5: minor (deferred): tests missing useConsumable hpMax clamp overflow, sell notOwned/hidden/value 0/stock merge
Task 5: complete (commits 816f274..44fab40, review clean)
Task 6: dispatched (BASE 44fab40)
Task 6: ⚠️ resolved by controller: e2e of load flow comes in Task 12; notices flushed by scenes (reviewer checked)
Task 6: minor (deferred): repairInventory runs before unknown-scene check (warnings for failed load); local `fill` prints "undefined" if ui key missing
Task 6: minor (deferred): tests missing two-slots-one-copy repair, exact belt warning, app-level notice display
Task 6: note: buildCharacter now sets money 0; engine uses local `fill` instead of ui `t` (layering)
Task 6: complete (commits 44fab40..af9ae96, review clean)
Task 7: dispatched (BASE af9ae96)
Ruling 3: Tasks 9 and 11 show the reason of a disabled entry in its `hint` (spec "Ekran ekwipunku": "wyszarzone z powodem w hint"), not only `description` — select skips disabled rows with the cursor in key mode, so a description would never be visible — cost if wrong: label text change only.
Task 7: ⚠️ resolved by controller: titles are written outside the redraw block, so they don't break cursor-up; total height overflow with tall titles just scrolls terminal — acceptable
Task 7: minor (deferred): loose height assertions in scroll tests; no test for scrolling back up, disabled hotkey in line mode, rows ≤ 6
Task 7: complete (commits af9ae96..b1baece, review clean)
Task 8: dispatched (BASE b1baece)
Task 8: ⚠️ resolved by controller: runApp test exercises real QuitToMenuError path; B1 e2e pass per implementer's full run
Task 8: minor (deferred): duplicated auto-save+SaveError handling in app.js InputClosedError branch and camp.js; mid-file dynamic imports in scenes.test.js
Task 8: note for T10: camp save on reward scene stores scene.id → claimedRewards must prevent replay (Review Focus 1)
Task 8: fix round 1/5 dispatched (vacuous overwrite-t test, dead input in n test, greyed Ekwipunek test) — FIX_BASE 8888fe0
Task 8: fix round 1/5 (2 addressed, 0 open — Minor greyed-Ekwipunek test partially; moot since Task 9 removes the disabled state; commits 8888fe0..10c50b8)
Task 8: complete (commits b1baece..10c50b8, review clean)
Task 9: dispatched (BASE 10c50b8)
Task 9: named risks checked by reviewer: dry-runs side-effect-free (useConsumable never dry-run); pushTimeNotices refactor behaviour-preserving
Task 9: minor (deferred): Zdejmij only acts on first worn slot (same weapon in both hand+back); Zamień broń shown for non-worn weapons; Wróć hotkey "w" untested
Task 9: fix round 1/5 dispatched (Opis erased on TTY; belt count in slot line; loose regex) — FIX_BASE cf268a1
Task 9: fix round 1/5 (3 addressed, 0 open; commits cf268a1..184f829)
Task 9: complete (commits 10c50b8..184f829, review clean)
Task 10: dispatched (BASE 184f829)
Ruling 4: reward appends scene.id to world.claimedRewards right after granting (before campMenu), not after the camp — otherwise a save made in that camp (which stores the current scene) would replay the reward on load (Review Focus 1) — cost if wrong: none functionally; ordering only.
Task 10: ⚠️ resolved by controller: migrations[2] adds world.claimedRewards for v2 saves (T6 review); creator re-entry only via a second character_creation scene (minor below)
Task 10: minor (deferred): grantStartKit not idempotent — a goto back to a character_creation scene would double the kit
Task 10: minor (deferred): leaving all items shows no summary; xp-only reward keeps legacy "Zdobywasz N PD." vs reward.summary (inconsistent); overload test uses 400 kg test item; stray blank line in ui.json
Task 10: complete (commits 184f829..542d6ae, review clean)
Task 11: dispatched (BASE 542d6ae)
Task 11: note: commit 6bd7675 trailer says Sonnet 5.5 (subagent's own reminder) vs Opus 5.5 elsewhere — left as is
Task 11: ⚠️ resolved by controller: systems/shop.buy returns inv.tooHeavy via canAdd (T5 brief/review); disabled-row select behaviour from T7/T9
Task 11: minor (deferred): no tests for weight-cap grey-out, affordability cap on slider max, max-1 shortcut, multi-qty sell, TTY shop; hint+description duplicated
Task 11: complete (commits 542d6ae..6bd7675, review clean)
Task 12: dispatched (BASE 6bd7675)
Task 12: minor (deferred): spear e2e title says empty answers in kram but uses "3"; sell path has no e2e (spec e2e bullet says "zakup i sprzedaż"); no-op slice(0,-1)+"3"; field-wise inventory compare; narration ~4 sentences vs 2–3
Task 12: complete (commits 6bd7675..08ee3cd, review clean)
Final review: dispatched (MERGE_BASE e641011, HEAD 08ee3cd)
Final review: With fixes — Important: interrupted reward (too-heavy prompt / inventory screen) saved to auto/crash before claimedRewards push → replay grants XP+money twice
Ruling 5: mark reward claimed (push scene.id) right after XP+money, before the first await; items still pending when the game is interrupted are forfeited (same as "Zostaw") — simplest way to keep Review Focus 1 airtight — cost if wrong: player loses a pending item on Ctrl+C/crash mid-reward (rare: needs >150% carry).
Ruling 6: final fix wave = Important 1 + qty guards (throw on non-positive/non-integer qty in addItem/removeItem/buy/sell) + sell step in sword e2e + grantStartKit throws on failed equip + {currency} in ui strings + no duplicated slot list on TTY after "n" + shopStock drops qty-0 entries. Deferred to later cycles: header-aware scroll height, hand↔back move, repairInventory gaps, reward summary wording — cost if wrong: small UX polish later.
Final fix wave: dispatched (FIX_BASE 08ee3cd)
Final fix wave: 7/7 addressed, re-review clean (commits 08ee3cd..e4bee0d); npm test 285/285, --validate clean
Deferred to later cycles (from final review): header-aware scroll height (headers can scroll off for 20+ row lists); "Załóż do ręki" for a weapon on the back (move between weapon slots); repairInventory gaps (keep bron on double-wear, hp clamp after unequip, belt type recheck, merge duplicate stacks); reward summary wording (all items left → empty screen, "×1" for single item, xp-only legacy line)
