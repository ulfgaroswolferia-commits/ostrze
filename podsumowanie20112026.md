# Podsumowanie Code Review i Stan Projektu — 20.11.2026

> **Kontekst:** Stan projektu `ostrze` (`2ebf25d`) oraz submodułu silnika `Ulf-cRPG-Engine` (`aa8f4fa`) po wdrożeniu zunifikowanego HUD-a (Podejście A), szlifach Prologu i Aktu I oraz przebudowaniu paczki `/dist/`.
> **Testy na dzień 20.11.2026:** Silnik `27/27` plików (`141/141` testów OK), Gra `17/17` plików (`60/60` testów OK), `tsc --noEmit && vite build` OK.

---

## 1. Błędy i kruche miejsca (Priorytet WYSOKI)

- [x] **Konflikt skrótu klawiszowego `[C]` w silniku**
  - **Gdzie:** `engine/src/renderer/isoSceneView.ts` (ok. L1279: `c` → `centerCameraOnPlayer()`) vs `engine/src/ui/hudOverlay.ts` (ok. L314: `c` → `toggleStealth()`).
  - **Problem:** Włączenie/wyłączenie Skradania `[C]` jednocześnie gwałtownie przeskakuje kamerą na bohatera.
  - **Rozwiązanie:** Przenieść centrowanie kamery na `[Home]` lub `[F]` (opcjonalnie dwuklik portretu), zostawiając `[C]` wyłącznie dla Skradania.

- [x] **Kruche patche silnika oparte na `String.replace()` w `vite.config.ts`**
  - **Gdzie:** `vite.config.ts` (L4–L62, `ostrzeEnginePatchesPlugin()`).
  - **Problem:** Wstrzykiwanie `beastSprites.ts` i `buildingScaling.ts` do `characterBakery.ts` i `isoSceneView.ts` przez `code.replace(...)` może po cichu przestać działać przy drobnej zmianie kodu w silniku bez żadnego błędu kompilacji.
  - **Rozwiązanie:** Zastąpić string-replace oficjalnymi punktami rozszerzeń w silniku (np. `registerCustomCharacterBaker(...)` oraz `registerPropVisualTransform(...)`).

- [x] **Brak metod `destroy()` w nakładkach UI gry**
  - **Gdzie:** `src/game/ui/OstrzeModalUi.ts` (L140–L168 — 3 elementy w `document.body` + `window.addEventListener('keydown', ...)`) oraz `src/game/ui/combatTargetOverlay.ts` (L32–L35).
  - **Problem:** Przy HMR w `npm run dev` lub wielokrotnym tworzeniu instancji w testach mogą narastać duplikaty listenerów i węzłów DOM.
  - **Rozwiązanie:** Dodać `destroy()` z `AbortController` dla listenerów i usuwaniem utworzonych rootów z DOM.

---

## 2. Architektura i skalowalność przed Aktem II (Priorytet ŚREDNI)

- [x] **Refaktoryzacja plików-monolitów (1500–2600+ linii)**
  - Największe pliki obecnie:
    - `src/game/maps/chapter1Maps.ts` — 2647 linii (6 lokacji)
    - `src/game/ui/OstrzeModalUi.ts` — 2034 linie (wszystkie modale i widoki)
    - `src/game/scenes/Chapter1Director.ts` — 1827 linii
    - `src/game/maps/prologueMaps.ts` — 1748 linii
    - `src/game/styles/ostrze.css` — 1518 linii
  - **Rozwiązanie przed Aktem II:**
    - Podzielić `OstrzeModalUi.ts` na mniejsze widoki (`CharacterCreatorView`, `CharacterSheetView`, `DialogueView`, `CampfireView`, `PauseMenuView`).
    - Mapy nowych aktów tworzyć jako osobne pliki per lokacja (np. `src/game/maps/chapter2/...`).

- [x] **Wspólny typ `ChapterId` dla zapisów, `main.ts` i selektora `dev`**
  - **Gdzie:** `src/game/state/saveManager.ts` (L8, L53 — twarde `'prologue' | 'chapter1'`).
  - **Rozwiązanie:** Wyekstrahować jeden typ `ChapterId` i listę `VALID_CHAPTER_IDS` współdzieloną między `saveManager.ts`, `main.ts` i selektorem `dev` na górnej belce.

- [x] **Wyeliminowanie zbędnego `super.loadMap('forest_clearing')` przy przełączaniu scen**
  - **Gdzie:** `src/engine-bridge/OstrzeEngineState.ts` (L224).
  - **Problem:** Każde załadowanie sceny `ostrze` najpierw buduje pełną domyślną mapę silnika `'forest_clearing'` tylko po to, by zresetować stan wewnętrzny, a potem nadpisuje `this.map` i czyści kronikę.
  - **Rozwiązanie:** Dodać w silniku `protected resetRuntimeStateForCustomMap()`.

---

## 3. Wydajność i bundlowanie

- [x] **Podział paczki JS (obecnie główny chunk ma ~2.0 MB / ~517 kB gzip)**
  - **Gdzie:** `vite.config.ts`.
  - **Rozwiązanie:** Dodać `build.rollupOptions.output.manualChunks` (wydzielenie `pixi.js` do `vendor-pixi`) oraz lazy-loading przyszłych aktów (`import('./scenes/Chapter2Director')`).

- [x] **Optymalizacja `hasOstrzeSave()`**
  - **Gdzie:** `src/game/state/saveManager.ts` (L127–L129).
  - **Problem:** Wywołuje pełne `JSON.parse()` + `normalizeSavePayload()` przy każdym renderze HUD-a.
  - **Rozwiązanie:** Szybkie sprawdzenie `Boolean(storage?.getItem(OSTRZE_SAVE_KEY))` lub cachowana flaga aktualizowana w `saveOstrzeGame` / `clearOstrzeSave`.

- [x] **Memoizacja / wczesny `return` w `CombatTargetOverlay.sync()`**
  - **Gdzie:** `src/game/ui/combatTargetOverlay.ts` (L45+).
  - **Rozwiązanie:** Zapisywać klucz stanu celu (`id|hp|ap|statuses`) i pomijać przebudowę `innerHTML`, gdy stan się nie zmienił.

---

## 4. Jakość kodu i bezpieczeństwo (mocne strony + drobiazgi)

- **Mocne strony do utrzymania:**
  - `0` wystąpień `as any` i `@ts-ignore` w `src/`.
  - Spójne escapowanie tekstów przed wstrzyknięciem do DOM (`escape()`).
  - Solidna, defensywna normalizacja starszych zapisów (`normalizeSavePayload`).
  - Bardzo dobre pokrycie testami jednostkowymi w obu repozytoriach.
- [x] **Drobiazg:** Ujednolicić `escape()` w `OstrzeModalUi.ts` i `CombatTargetOverlay.ts` (w `CombatTargetOverlay` brakuje encji `'`) do jednego wspólnego helpera `escapeHtml`.

---

## Sugerowana kolejność „Quick Wins” przed startem Aktu II

1. Naprawić konflikt klawisza `[C]` (Skradanie vs Kamera) w silniku.
2. Zastąpić kruche string-patche w `vite.config.ts` czystymi hookami w silniku.
3. Zoptymalizować `hasOstrzeSave()`, dodać wczesny `return` w `CombatTargetOverlay.sync()` i skonfigurować `manualChunks` (`vendor-pixi`) w `vite.config.ts`.
4. Wydzielić wspólny typ `ChapterId` i przygotować strukturę pod Akt II.


---

## Raport z realizacji — 21.11.2026

Zrobione wszystkie 10 punktów z listy. Każdy etap był sprawdzany przez `tsc --noEmit` i testy obu repozytoriów.

### Silnik (`engine/`)
| Zadanie | Zmiana |
|---|---|
| 1.1 | Centrowanie kamery przeniesione z `[C]` na `[F]` / `[Home]` + dwuklik portretu (`isoSceneView.ts`, `hudOverlay.ts`). `[C]` służy już tylko do Skradania. Dodany test. |
| 1.2 | Nowe punkty rozszerzeń: `registerCustomCharacterBaker()` (`characterBakery.ts`) i `registerPropVisualTransform()` / `resolvePropVisualTransform()` (`isoSceneView.ts`). Selektor blokady edge-panu dla zwiniętej Kroniki ustawiony bezpośrednio w silniku. |
| 2.3 | `protected resetRuntimeStateForCustomMap()` w `gameLoop.ts` (używane też przez `loadMap`). |

### Gra (`ostrze`)
| Zadanie | Zmiana |
|---|---|
| 1.2 | Usunięty plugin `ostrzeEnginePatchesPlugin()` z `vite.config.ts`. Rozszerzenia (wilki, skalowanie budynków) rejestruje `ensureOstrzeEngineExtensionsRegistered()` w `OstrzeEngineState`. |
| 1.3 | `destroy()` z `AbortController` i usuwaniem rootów DOM w `OstrzeModalUi` i `CombatTargetOverlay`. Przy HMR usuwane są osierocone rooty. |
| 2.1 | `OstrzeModalUi.ts` zmniejszony z 2052 do ~1030 linii. Wydzielone widoki w `src/game/ui/views/`: `CharacterCreatorView`, `CharacterSheetView`, `DialogueView`, `CampfireView`, `PauseMenuView`. Publiczne API bez zmian. |
| 2.2 | `ChapterId`, `VALID_CHAPTER_IDS`, `isValidChapterId()`, `CHAPTER_DEV_SCENES` w `saveManager.ts`, podpięte w `main.ts` i selektorze `dev`. |
| 2.3 | `loadCustomScene()` nie buduje już mapy `forest_clearing` i nie czyści Kroniki pętlami `shift()`. |
| 3.1 | `manualChunks` → `vendor-pixi` (570.80 kB / 164.84 kB gzip). Główny chunk: ~2.0 MB → 1.72 MB (427 kB gzip). `__dirname` zastąpione `import.meta.url`. |
| 3.2 | `hasOstrzeSave()` korzysta z flagi w cache (bez `JSON.parse` przy każdym renderze HUD-a). |
| 3.3 | Memoizacja `CombatTargetOverlay.sync()` kluczem stanu celu, więc `innerHTML` nie jest przebudowywany bez potrzeby. |
| 4.1 | Wspólny `escapeHtml()` (`src/game/ui/escapeHtml.ts`) z obsługą `'` → `&#39;`. |

### Weryfikacja końcowa
- `npm run build` (`tsc --noEmit && vite build`): OK
- Silnik: **27/27 plików, 142/142 testów OK** (było 141)
- Gra: **17/17 plików, 64/64 testów OK** (było 60)

### Do rozważenia później
- Główny chunk nadal ma >500 kB. Następny krok to lazy-loading aktów (`import('./scenes/Chapter2Director')`) przy starcie Aktu II.
- Mapy Aktu II trzymać w osobnych plikach per lokacja (`src/game/maps/chapter2/...`).
- W sandboksie Windows `vitest`/`vite build` nie mogą zapisać plików tymczasowych configu (EPERM). Lokalnie wszystko działa normalnie.
