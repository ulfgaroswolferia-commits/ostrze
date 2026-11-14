# Cykl A – rdzeń silnika (projekt)

> Data: 2026-10-20 · Źródło wymagań: `docs/koncepcja-gry.md` (v2), etapy 1–3 rozdziału 16.
> Status: zatwierdzony w rozmowie, czeka na przegląd pliku.

## Cel

Działający szkielet gry `ostrze`: pakiet npm z poleceniem `ostrze`, ładowanie i walidacja danych, deterministyczny RNG, pętla scen sterowana `id`, zapis/odczyt oraz testowalne wejście/wyjście. Po cyklu A da się przejść krótkie demo fabularne, zapisać je w połowie i dokończyć po wczytaniu.

Cykl A **nie** zawiera mechanik RPG (postać, ekwipunek, walka, dialogi, czas z tyknięciami, artefakty, podróże). Zostawia na nie punkty zaczepienia.

## Decyzje

| Decyzja | Wybór | Powód |
|---|---|---|
| Granica silnik–UI | Async handlery scen z wstrzykniętym `io` (podejście A) | Najprostsze; czyste systemy testowane jednostkowo, sceny i fabuła przez skryptowe `io`. Generator żądań widoku (B) i szyna zdarzeń jako główny kanał (C) odrzucone – ceremonia bez zysku (YAGNI). |
| Środowisko | Node 22+, ESM, JSDoc, zero zależności runtime | Kolory przez `util.styleText`, wejście `node:readline/promises`. |
| Identyfikacja scen | Stabilne `id`, zapis pamięta `scene.id` | Dopisanie sceny w środku `story.json` nie psuje zapisów. |
| Podróże (cykl D) | Pętla wykonuje dowolną listę scen; stan rezerwuje miejsce | Spotkania i zadania to listy scen; brak migracji zapisu w cyklu D. |
| Repozytorium | Lokalny git, małe commity | Uzgodnione z użytkownikiem. |

## Moduły

```
package.json           "type": "module", "bin": { "ostrze": "bin/game.js" }, "engines": { "node": ">=22" }, "scripts": { "test": "node --test" }
bin/game.js            #!/usr/bin/env node; parsuje flagi, tworzy terminalowe io, uruchamia app
src/config.js          GAME_NAME = "ostrze", GAME_VERSION (z package.json), SAVE_FORMAT_VERSION = 1,
                       homeDir() = OSTRZE_HOME || ~/.ostrze, savesDir() = homeDir()/saves,
                       dataDir() = OSTRZE_DATA || <katalog pakietu>/data
src/app.js             runApp(ctx0): menu główne (Nowa gra / Wczytaj / Wyjście), obsługa przerwania
src/engine/
  dice.js              createRng(seed) → { next(), int(min, max), percent(chance), getState(), setState(s) }
                       mulberry32; percent zwraca { roll: 1–100, success: roll <= chance }
  schema.js            check(value, schema, path) → string[]; schematy: required, type, enum, items, fields
  data.js              loadData(dir) → zamrożone dane; validateData(data) → string[]
  conditions.js        evaluate(cond, state) – klucze: flag, notFlag, all, any (reszta w cyklach B–C)
  state.js             createNewState({ seed, startScene }) → GameState
  save.js              listSaves(), saveGame(slot, state), loadGame(slot), migracje
  loop.js              runScenes(ctx, list, startId, { trackScene }), runStory(ctx)
src/scenes/
  index.js             rejestr: type → handler
  narration.js, flag.js, save_point.js, ending.js
src/ui/
  io.js                createTerminalIO(), createScriptedIO(inputs) → { write(text), ask(question), output }
  colors.js            paint(role, text); role: title, dim, damage, heal, check, mystic, warn
  text.js              wrap(text, width)
  screen.js            clear(io), statusBar(state, ui), sceneHeader(title)
  prompt.js            choose(io, ui, options) → indeks; pressEnter(io, ui); confirm(io, ui, question)
data/
  ui.json              teksty interfejsu
  rules.json           { "startHour": 6 } (szkielet; rośnie w kolejnych cyklach)
  story.json           demo: 5–6 scen
test/                  testy (niżej)
```

Zasada: `src/engine/` (poza `loop.js`) i przyszłe `src/systems/` nie importują `src/ui/`. Pliki `src/scenes/` łączą systemy z UI.

## Format danych w cyklu A

### `story.json`

```json
{
  "start": "demo_start",
  "scenes": [
    { "id": "demo_start", "type": "narration", "title": "Prolog", "text": "…", "time": 30 },
    { "id": "demo_flaga", "type": "flag", "set": { "demo_widzial_ogien": true } },
    { "id": "demo_warunek", "type": "narration", "if": { "flag": "demo_widzial_ogien" }, "text": "…" },
    { "id": "demo_zapis", "type": "save_point" },
    { "id": "demo_pominieta", "type": "narration", "if": { "notFlag": "demo_widzial_ogien" }, "text": "…" },
    { "id": "demo_koniec", "type": "ending", "text": "…" }
  ]
}
```

Pola wspólne scen: `id` (wymagane, unikalne, `[a-z0-9_]+`), `type` (wymagane, z rejestru), `if`, `goto`, `time` (liczba minut ≥ 0), `tags` (tablica stringów).

Pola typów:
- `narration`: `text` (wymagane), `title`.
- `flag`: `set` (obiekt `flaga → boolean`, wymagany).
- `save_point`: brak.
- `ending`: `text` (wymagane).

### Warunki (`conditions.js`)

```
{ "flag": "x" }              flaga x ustawiona na true
{ "notFlag": "x" }           flaga x nieustawiona lub false
{ "all": [cond, …] }         wszystkie
{ "any": [cond, …] }         dowolny
```
Obiekt z kilkoma kluczami = wszystkie muszą być spełnione. Nieznany klucz – błąd walidacji danych (nie cichy `false`).

### `ui.json`

Płaski słownik `klucz → tekst` z prostymi zmiennymi `{name}`. Funkcja `t(ui, key, vars)`. Brakujący klucz w trakcie gry: zwraca `[[klucz]]` (widoczne, ale nie wywraca gry); test pilnuje, że wszystkie klucze używane w kodzie istnieją.

## Stan gry (cykl A)

```js
{
  version: 1, gameVersion: "0.1.0", savedAt: null,
  seed, rngState,
  time: { minutes: 360 },
  scene: { id: "demo_start" },
  context: "story",
  flags: {},
  character: null,                        // cykl B
  inventory: null,                        // cykl B
  world: { location: null, locations: {}, failedChecks: [] },
  quests: {}
}
```

## Przepływ

1. `bin/game.js`: flagi `--seed <n>`, `--scene <id>`, `--debug`, `--validate`, `--help`. Nieznana flaga → komunikat i kod 1.
2. `loadData` + `validateData`. Błędy → wypisz wszystkie (format `plik › id › pole: opis`), kod 1. `--validate` kończy tu (kod 0 przy braku błędów).
3. `runApp`: menu główne.
   - **Nowa gra:** ziarno (`--seed` lub `Date.now() >>> 0`), `createNewState`, `--scene` musi istnieć, autozapis `auto`, `runStory`.
   - **Wczytaj:** `listSaves()` → lista slotów (imię/scena/data; uszkodzone z powodem, niewybieralne), `loadGame`, `rng.setState(state.rngState)`, `runStory` od `state.scene.id`.
   - **Wyjście.**
4. `runScenes(ctx, list, startId, { trackScene })`:
   ```
   id = startId
   while id:
     scene = index.get(id)
     if trackScene: state.scene.id = id
     if scene.if && !evaluate(scene.if, state): id = nextId(id); continue
     result = await handlers[scene.type](ctx, scene) ?? {}
     if scene.time: state.time.minutes += scene.time      # cykl B: advanceTime
     if result.end: return result
     id = result.goto ?? scene.goto ?? nextId(id)
   return { end: true }
   ```
   `state.rngState` nie jest aktualizowany w pętli – `saveGame` pobiera go z `ctx.rng.getState()` w chwili zapisu, więc zapis zawsze odzwierciedla bieżący RNG. Zapis w trakcie sceny (Ctrl+C) pamięta jej `id`; po wczytaniu scena zaczyna się od nowa.
5. Ekran sceny: `clear` → pasek stanu (`Dzień 1, 06:30`) → nagłówek → tekst zawinięty do `min(process.stdout.columns || 80, 100)` → `[Enter] dalej`.
6. `ending` zwraca `{ end: true }`; `runApp` wraca do menu.

### Zapis

- `saveGame(slot, state, rng)`: głęboka kopia, `savedAt = new Date().toISOString()`, `rngState = rng.getState()`, zapis do `<slot>.json.tmp`, `rename` na `<slot>.json`. Katalog tworzony w razie potrzeby.
- `loadGame(slot, data)`: parse; `version > SAVE_FORMAT_VERSION` → błąd „zapis z nowszej wersji gry”; `version < …` → łańcuch `migrations`; sprawdzenie kształtu; `scene.id` musi istnieć w `story.json`.
- Sloty: `auto`, `1`, `2`, `3`, `crash`.
- `listSaves()` zwraca `{ slot, ok, summary?, error? }` dla istniejących plików.

## Obsługa błędów

- Dane: wszystkie błędy naraz, gra nie startuje.
- Wejście gracza: `choose` ponawia pytanie z podpowiedzią, nie rzuca.
- Zapis: komunikat, gra trwa; `.tmp` usuwany.
- Odczyt: slot oznaczony jako nieczytelny z powodem.
- Wyjątek w pętli: zapis do slotu `crash`, krótki komunikat (stos tylko z `--debug`), powrót do menu.
- Ctrl+C / zamknięcie wejścia: poza menu pytanie „Zapisać przed wyjściem? [t/n]” (zapis do `auto`), w menu wyjście od razu. W `createScriptedIO` wyczerpanie wejścia rzuca `InputExhaustedError` – testy wykrywają zawieszenie zamiast czekać.

## Testy (`node --test`)

| Plik | Co sprawdza |
|---|---|
| `dice.test.js` | determinizm ziarna; kontynuacja po `getState`/`setState`; zakres `int`; `percent` dla 0 i 100 |
| `schema.test.js` | wymagane pola, typy, enum, tablice, ścieżki w komunikatach |
| `data.test.js` | poprawne dane przechodzą; komunikaty dla: brak pola, zły typ, nieznany typ sceny, zduplikowane `id`, `goto` / `start` do nieistniejącej sceny, nieznany klucz warunku; prawdziwy `data/` przechodzi |
| `conditions.test.js` | `flag`, `notFlag`, `all`, `any`, wiele kluczy, zagnieżdżenia |
| `save.test.js` | (na `OSTRZE_HOME` w katalogu tymczasowym) zapis→odczyt identyczny; brak `.tmp`; uszkodzony JSON; nowsza wersja; nieznana scena; `listSaves` |
| `loop.test.js` | kolejność; `if` pomija; `goto` sceny i wyniku; `end`; `time`; `scene.id` w stanie; `trackScene: false` nie rusza `scene.id` |
| `text.test.js` | zawijanie z polskimi znakami, słowa dłuższe niż szerokość, akapity |
| `ui.test.js` | każdy klucz `t(ui, "…")` użyty w `src/` istnieje w `ui.json` |
| `e2e.test.js` | skryptowe io na prawdziwym `story.json`: nowa gra → `ending` → menu; zapis w połowie + wczytanie + dokończenie = ten sam stan końcowy (flagi, czas, rng) co przejście bez przerwy |

## Kryterium ukończenia

- `npm test` – wszystkie testy zielone.
- `npm link`, potem `ostrze` – grywalne demo z zapisem i wczytaniem.
- `ostrze --validate` – kod 0 na prawdziwych danych, kod 1 i czytelny błąd na celowo zepsutej kopii (`OSTRZE_DATA=<katalog>` nadpisuje katalog danych – na potrzeby tego testu i testów automatycznych).

## Poza zakresem cyklu A

Postać, `getStats`, czas z tyknięciami i porami doby, ekwipunek, sklep, efekty, dialogi, walka, artefakty, zjawiska, podróże, menu obozowe, właściwa treść fabuły.
