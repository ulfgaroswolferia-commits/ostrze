# Podsumowanie stanu projektu — 22.11.2026

## Zakres zrealizowany w tej sesji

Domknięto cały pakiet prac zaplanowanych po sesji z 21.11.2026: głębię taktyczną i AI wrogów (dwuetapowo z aktualizacją silnika), mnożniki odporności/podatności, audyt Prologu, audyt Aktu I oraz weryfikację zapisu/odczytu dla wszystkich 12 lokacji.

---

## 1. Silnik `Ulf-cRPG-Engine` (`C:\laragon\www\ulfRPG` → `ostrze/engine/`)

- **Commit silnika:** `32b4379` (`feat(combat): add protected enemy AI strategy and turn-start hooks in CrpgGameState`)
- Rozszerzono `CrpgGameState` (`src/rpg/gameLoop.ts`) o 4 wstecznie kompatybilne hooki `protected`:
  - `planEnemyCombatMove(enemy, eSnap, dist)`
  - `chooseEnemyCombatAttack(enemy, eSnap, playerSnap, dist, attacksThisTurn)`
  - `onEnemyCombatTurnEnded(enemy, attacksThisTurn)`
  - `onPlayerCombatTurnStarted()`
- Ujednolicono animowaną i synchroniczną ścieżkę tury wroga oraz udostępniono `finalizeEnemyCombatTurn` i `handlePlayerDefeated` jako `protected`.
- Zaktualizowano submoduł `ostrze/engine/` do `32b4379`.
- **Weryfikacja silnika:** `npm run build` OK, **31/31 plików · 166/166 testów OK**.

---

## 2. Głębia taktyczna, AI wrogów, statusy i odporności (`ostrze`)

- **4 archetypy AI** w `src/game/rules/combatAi.ts`:
  - **Zwarciowy / Ostrożny** (`bandyta`, `rabus`, `instruktor`, `maruder`, `kieszonkowiec`) — podejście, garda przy `< 40%` HP.
  - **Drapieżny / Szarżujący** (`wilk`, `dzik`, `zmija_lesna`, `upior_zwiadowca`) — flankowanie w grupie, nakładanie statusów.
  - **Dystansowy / Kitujący** (`rabus_lucznik`, `klusownik`) — zasięg `2–5` kafli, odskok o `2–3` kafle gdy gracz podejdzie w zwarcie, słabszy atak nożem (`2–4` obr.) w narożniku.
  - **Dowódca / Boss** (`herszt_zbojcow`, `upior_nocy`) — telegrafowane ataki specjalne (`⚠️ BIERZE ZAMACH!`, `⚠️ ZBIERA SIŁY DO WYCIA!`) z cooldownem 3 tur i możliwością przerwania przez ogłuszenie (`dazed_head`).
- **Stopniowane budżety taktyczne (ochrona wczesnych starć):**
  - Sceny `brzezina_dziedziniec` i `trakt_zasadzka` mają sztywny tier `early`: max 1 atak/wroga/turę, zakaz `aimed_head`, `power` i statusów.
- **Statusy bojowe** w `src/game/rules/combatStatuses.ts`:
  - `krwawienie` (2–3 obr./turę × 2), `zatrucie` (2 obr./turę + `-10%` trafienia × 2), `strach` (`-1 AP` × 1) + 2-turowa odporność **anti-stunlock** i integracja z pasem szybkiego użycia (`combatConsumables.ts`).
- **Mnożniki odporności i podatności (`damageTaken`):**
  - Podpięte do broni gracza (`OstrzeEngineState.performPlayerCombatAttack`) oraz przedmiotów rzucanych (`flasza_oleju` → `×2` ognia w Upiora, `garnek_huku` → obuchowe), z komunikatami w logu i floating text.

---

## 3. Audyt Prologu i Aktu I + Zapis/Odczyt 12 lokacji

### Naprawione błędy w Prologu (`c09e826`):
- Nadpisano `OstrzeEngineState.handlePlayerDefeated()` dla map customowych — usunięto ryzykowny teleport na `(15, 17)` i wyciek komunikatu `ulfRPG` („Topór Kata / Kostur Runiczny”).
- Dopisano `'brzezina_dziedziniec'` do `EARLY_GUARDRAIL_SCENES`.
- Dodano czytelną wskazówkę po sparingu o awansie na 2. poziom, punktach umiejętności i wyborze Atutu (`[K]`).
- Przywracanie właściwego ambience audio w `PrologueDirector.restoreFromSave()`.
- Dodano `tests/prologueAudit.test.ts` (weryfikacja wszystkich 17 scen fabularnych i 19 dialogów Prologu).

### Naprawione błędy w Akcie I (`24197d7`):
- Usunięto błędny warunek `!this.state.flags.pobojowisko_ragnoslawa` przy odbiorze `amulet_strazniczy` w Ruinach Strażnicy (blokował zadanie `amulet_z_ruin`).
- Naprawiono softlock przy porażce w losowym starciu na trakcie (`travel_encounter`).
- Naprawiono przywracanie nocnego wariantu `stary_mlyn` w `Chapter1Director.restoreFromSave()`.
- Dopisano `markOstrzeLocationVisited()` dla wszystkich 5 lokacji satelitarnych oraz `kamienna_przelecz`.
- Oddzielono arenę losowych starć Aktu I (`trakt_podroz`) od prologowej `trakt_zasadzka`, zachowując tier AI `'mid'` w Akcie I.
- Dodano `tests/chapter1Audit.test.ts` (weryfikacja wszystkich 24 dialogów i 10 zadań Aktu I).

### Zapis/Odczyt (12 lokacji):
- `tests/saveLoadAndStability.test.ts` potwierdza pełny round-trip dla wszystkich 12 grywalnych lokacji (4 Prologu + 8 Aktu I) oraz wariantu nocnego Starego Młyna.

---

## 4. Stan weryfikacji i znane ograniczenia

- **`ostrze` build (`tsc --noEmit && vite build`):** **OK** (1036 modułów).
- **`ostrze` testy (`npx vitest run`):** **21/21 plików · 87/87 testów OK**.
- **`Ulf-cRPG-Engine` testy:** **31/31 plików · 166/166 testów OK**.

### Znane ograniczenia / kolejne kroki:
1. Chunki Vite `vendor-pixi` (~571 kB) i `engine-runtime` (~511 kB) przekraczają ostrzeżenie 500 kB (lazy loading przyszłych aktów przy planowaniu Aktu II).
2. Ręczne przejście końcowe w przeglądarce / testy Playwright E2E na żywym renderze WebGL (weryfikacja wizualna telegrafowania bossów, kitowania łuczników i nocnego młyna).
3. Rozpoczęcie prac projektowych nad **Aktem II (Głuszec)** po ewentualnym playteście Prologu i Aktu I.
