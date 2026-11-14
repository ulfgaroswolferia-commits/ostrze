# Cykl B1 – postać, zmienne, czas, widżet wyboru (projekt)

> Data: 2026-10-20 · Źródło: `docs/koncepcja-gry.md` (rozdziały 4, 9, 14, 15, 16) i ustalenia z brainstormingu.
> Poprzedni cykl: `2026-10-20-cykl-a-rdzen-silnika-design.md` (scalony do `master`).
> Status: zatwierdzony w rozmowie, czeka na przegląd pliku.

## Cel

Po B1 gracz w demo: tworzy postać (imię, klasa miecza/włóczni, atrybuty, umiejętności wiodące) sterując strzałkami, dostaje XP i awansuje (punkty umiejętności, perk), odpoczywa i widzi upływ pory doby, a decyzje fabularne zmieniają ukryte `wola` / `dlug`. Ekran postaci pokazuje wartości z rozbiciem na źródła.

**Poza zakresem (B2 i dalej):** przedmioty, ekwipunek, sloty, pas, amunicja, pieniądze, sklep, pełne menu obozowe (E/Z/M), ręczny zapis do slotów 1–3; efekty statusu, dialogi, walka (C); zjawiska, artefakty, podróże (D).

## Decyzje

| Decyzja | Wybór | Powód |
|---|---|---|
| Podział cyklu B | B1 (postać + zmienne + czas + widżet) / B2 (ekwipunek, sklep, menu obozowe) | Dwa mniejsze cykle, każdy z grywalnym demo. |
| Intelekt bohatera | Rozum startuje od 6 (dar, poza pulą 5 punktów) | Zgodność z fabułą przy zachowaniu swobody buildu. |
| Sterowanie | Jeden widżet wyboru ze strzałkami w całej grze; cyfra jako skrót; suwaki ←→ | Spójność (menu, dialogi, lokacje, walka). Bez TTY – „numer + Enter” i skróty `1+`/`3-`. |
| Statystyki | `getStats` jako czysta funkcja nad rejestrem źródeł modyfikatorów | Brak cache i niespójności; rozbicie na źródła za darmo; kolejne cykle dopisują źródło. |
| Perki | Pula 17 w 7 kierunkach, maksymalnie 6 na postać, perk co 2 poziomy | Różne buildy. |
| Tempo rozwoju | Progi `150 × L × (L+1) / 2`, punkty umiejętności `3 + floor(rozum / 2)` | Wolny rozwój; do 3.–4. poziomu potrzebne zadania poboczne (budżet XP w spec. głównej). |

## Dane

### `data/attributes.json`
Tablica 7 obiektów `{ id, name, description }` w kolejności: `sila`, `zrecznosc`, `krzepa`, `bystrosc`, `rozum`, `oglada`, `fart` (nazwy i opisy z rozdziału 4 specyfikacji głównej).

### `data/skills.json`
Tablica 11 obiektów `{ id, name, primary, secondary }` – dokładnie tabela „Umiejętności” z rozdziału 4.

### `data/classes.json`
```json
[
  { "id": "miecz", "name": "Klasa miecza", "description": "…", "taggedSkill": "sieczna" },
  { "id": "wlocznia", "name": "Klasa włóczni", "description": "…", "taggedSkill": "drzewcowa" }
]
```
Opcjonalne `modifiers` (katalog 4.1) – na MVP brak. Broń startowa: pole `startingItems` dochodzi w B2.

### `data/perks.json`
Tablica `{ id, name, description, requires: { level?, attributes?: {id: min}, skills?: {id: min} }, modifiers?: {...}, unlocks?: [id] }`. Zawartość MVP (17):

| id | Nazwa | requires | Daje |
|---|---|---|---|
| `szkola_miecza` | Szkoła miecza | skills.sieczna 40 | `sieczna` +15, `meleeHitChance` +5 |
| `szkola_wloczni` | Szkoła włóczni | skills.drzewcowa 40 | `drzewcowa` +15, `defense` +5 |
| `twarda_reka` | Twarda ręka | attributes.sila 7 | `damage` +2 |
| `lekki_krok` | Lekki krok | attributes.zrecznosc 6 | `ap` +1 |
| `twarda_skora` | Twarda skóra | attributes.krzepa 6 | `hpMax` +10 |
| `nieugiety` | Nieugięty | attributes.krzepa 7, level 4 | `resist_ogluszenie` +25, `resist_strach` +25 |
| `sokole_oko` | Sokole oko | attributes.bystrosc 6 | `rangedHitChance` +10 |
| `pewna_reka` | Pewna ręka | attributes.zrecznosc 6, skills.strzelecka 40 | `strzelecka` +10, `miotanie` +10 |
| `czytanie_walki` | Czytanie walki | attributes.rozum 7 | `critChance` +5, `defense` +5 |
| `chlodna_glowa` | Chłodna głowa | attributes.rozum 6, attributes.bystrosc 6 | `initiative` +3, `resist_rozkojarzenie` +25 |
| `finta` | Mistrz finty | attributes.rozum 8, level 4 | `unlocks: ["finta"]` (działa od cyklu C) |
| `gadane` | Gadane | attributes.oglada 6 | `wymowa` +10, `handel` +10 |
| `kupiecka_zylka` | Kupiecka żyłka | attributes.oglada 6, skills.handel 40 | `handel` +20 |
| `czuly_na_swiat` | Czuły na świat | attributes.rozum 6, skills.wiedza_tajemna 30 | `wiedza_tajemna` +15 |
| `cyrulik` | Cyrulik | skills.medycyna 40 | `medycyna` +15 |
| `szczesciarz` | Szczęściarz | level 4 | `fart` +1 |
| `kocie_zycie` | Kocie życie | attributes.fart 7 | `critChance` +5, `fleeChance` +15 |

Wymagania atrybutów i umiejętności porównuje się z **bazą postaci + perki** (bez pory doby i – od B2 – bez wyposażenia), żeby perk nie „znikał” po zdjęciu przedmiotu.

### `data/rules.json` (rozszerzenie)
```json
{
  "startHour": 6,
  "creator": { "attributeStart": 5, "attributeMin": 2, "attributeMax": 10, "points": 5,
               "gifts": { "rozum": 1 }, "taggedCount": 3, "taggedBonus": 20,
               "nameMin": 2, "nameMax": 20 },
  "skills": { "primaryMult": 2, "secondaryMult": 1, "max": 100, "taggedPointValue": 2 },
  "derived": { "hpBase": 20, "hpPerKrzepa": 3, "hpPerLevelBase": 2, "hpPerLevelKrzepaDiv": 2,
               "apBase": 5, "apZrecznoscDiv": 2, "carryBase": 25, "carryPerSila": 10,
               "defensePerZrecznosc": 2 },
  "leveling": { "xpStep": 150, "skillPointsBase": 3, "skillPointsRozumDiv": 2,
                "perkEveryLevels": 2, "maxPerks": 6 },
  "timeOfDay": [
    { "id": "swit", "from": 5, "to": 7, "modifiers": {} },
    { "id": "dzien", "from": 7, "to": 18, "modifiers": {} },
    { "id": "zmierzch", "from": 18, "to": 20, "modifiers": {} },
    { "id": "noc", "from": 20, "to": 5, "modifiers": { "rangedHitChance": -15, "skradanie": 10 }, "bystroscSkillPenalty": -15 }
  ],
  "rest": { "minHours": 1, "maxHours": 8, "healBase": 2, "healKrzepaDiv": 3 },
  "vars": ["wola", "dlug"],
  "unlocks": ["finta"]
}
```
- `bystroscSkillPenalty`: dodawane do każdej umiejętności, której `primary` lub `secondary` to `bystrosc` (noc bez światła; źródło światła – B2).
- Nazwy pór doby w `ui.json` (`time.swit` … `time.noc`), komunikaty zmian (`time.change.zmierzch` = „Zapada zmierzch.” itd.).

## Wzory (wszystkie współczynniki z `rules.json`)

- Umiejętność bazowa = `primaryMult × atrybut_główny + secondaryMult × atrybut_pomocniczy` (atrybuty **bazowe + perki + klasa**, bez pory doby), + `taggedBonus` jeśli wiodąca, + `skillPoints[id] × (taggedPointValue jeśli wiodąca, inaczej 1)`; potem modyfikatory umiejętności ze wszystkich źródeł; wynik ograniczony do `0…max`.
- `hpMax` = `hpBase + hpPerKrzepa × krzepa + (level − 1) × (hpPerLevelBase + floor(krzepa / hpPerLevelKrzepaDiv))` + modyfikator `hpMax`. Krzepa 5, poz. 1 → 35; +4 na poziom.
- `ap` = `apBase + floor(zrecznosc / apZrecznoscDiv)` + `ap`. `carry` = `carryBase + carryPerSila × sila` + `carry`. `defense` = `defensePerZrecznosc × zrecznosc` + `defense`. `initiative` = `zrecznosc + bystrosc` + `initiative`.
- Pochodne liczone z atrybutów **końcowych** (z modyfikatorami wszystkich źródeł).
- Pozostałe klucze katalogu (`hitChance`, `meleeHitChance`, `rangedHitChance`, `damage`, `critChance` (+ `fart` jako baza), `fleeChance`, `resist_*`, `effectDuration_*`, `extraDamage`, `damageTaken`) – sumowane i zwracane w `derived` / `combat` do użycia w cyklu C.
- XP do poziomu `L + 1`: `xpStep × L × (L + 1) / 2`. Punkty umiejętności na awans: `skillPointsBase + floor(rozum_bazowy / skillPointsRozumDiv)`. Perk przy awansie na poziom podzielny przez `perkEveryLevels`, o ile `perks.length < maxPerks`.

## Moduły

```
src/systems/modifiers.js    MODIFIER_KEYS (z attributes/skills + stałe), isModifierKey(key, data),
                            validateModifiers(obj, path, data) → string[], addModifiers(acc, mods)
src/systems/stats.js        STAT_SOURCES (tablica funkcji (state, data) → {source, modifiers} | null),
                            getStats(state, data) → Stats
src/systems/character.js    createCharacter(choices, data) → Character; validateCreatorChoices → string[];
                            xpForLevel(level, rules); addXp(character, amount, data) → { levelsGained };
                            availablePerks(character, data) → [{ perk, ok, missing }];
                            applyLevelUp(character, { skillPoints, perk }, data); skillPointsPerLevel(...)
src/systems/vars.js         addVar(state, changes, rules)
src/engine/conditions.js    + warunek { var, gte|lte|eq } (evaluate + validateCondition z listą rules.vars)
src/engine/time.js          + timeOfDay(minutes, rules) → id; HOURLY_HOOKS (pusta tablica);
                            advanceTime(state, minutes, data) → Event[]
src/engine/loop.js          scene.time → advanceTime (zdarzenia → ctx.events); po scenie: afterScene hooks
src/engine/save.js          SAVE_FORMAT_VERSION = 2; migrations[1] dopisuje vars: {}; schemat character/vars;
                            sprawdzenie klasy i perków w danych
src/engine/state.js         + vars: {}
src/ui/io.js                + readKey(): Promise<Key>; Key = { name: "up"|"down"|"left"|"right"|"enter"|"escape"|"backspace"|"char", char? };
                            terminal: tryb surowy tylko na czas readKey, zawsze przywracany; scripted: tokeny
src/ui/menu.js              select(io, ui, { title?, items: [{ label, hint?, disabled?, description? }], initial? }) → index
                            sliders(io, ui, { title, rows: [{ label, value, min, max, note? }], budget?, canFinish(rows) }) → values
                            textInput(io, ui, { prompt, min, max, pattern }) → string
src/ui/character_screen.js  renderCharacter(state, data, ui) → string (baza + źródła + pochodne + XP + perki)
src/scenes/                 character_creation.js, var.js, rest.js, reward.js (+ schematy w schemas.js)
src/scenes/after.js         afterScene hooks: level-up screen gdy character.pendingLevelUp
src/ui/prompt.js            pressEnter → „[Enter] dalej · [P] postać” (P pokazuje ekran postaci, wraca do monitu)
```

Zasada z cyklu A obowiązuje: `src/engine/*` (poza `loop.js`) i `src/systems/*` nie importują `src/ui/`.

### Typy

```js
/** Character */ { name, classId, level: 1, xp: 0, attributes: { sila: 5, …, rozum: 6, … },
                   skillPoints: {}, tagged: ["sieczna", "wymowa", "medycyna"], perks: [],
                   pendingLevelUp: null | { skillPoints: number, perks: number }, hp }
/** Stats */     { attributes: {id: number}, skills: {id: number}, derived: { hpMax, ap, carry, defense, initiative,
                   critChance, hitChance, meleeHitChance, rangedHitChance, damage, fleeChance },
                   other: { [klucz]: wartość },   // resist_*, effectDuration_*, extraDamage, damageTaken
                   breakdown: { [klucz]: [{ source: string, value: number }] }, timeOfDay: id }
/** Event */     { type: "zmiana_pory", to: "zmierzch", at: minutes }
```
`pendingLevelUp.perks` – liczba perków do wybrania (kilka awansów naraz sumuje punkty i perki).

## Przepływ

### Kreator (`character_creation`)
1. `textInput` – imię (`nameMin`–`nameMax`, litery w tym polskie, spacja, myślnik); puste → `ui["creator.defaultName"]`.
2. `select` – klasa, opis podświetlonej klasy pod listą.
3. `sliders` – atrybuty: start `attributeStart` + `gifts`, pula `points`, zakres `attributeMin`–`attributeMax` (dar wlicza się w zakres, nie w pulę), „Gotowe” aktywne przy pustej puli.
4. `select` (wielokrotny przez przełączanie, Enter na pozycji przełącza zaznaczenie, „Gotowe” aktywne przy 2 zaznaczonych) – umiejętności wiodące; narzucona przez klasę pokazana jako zaznaczona i zablokowana; obok wartości bazowe.
5. Podsumowanie `renderCharacter` + `select` [Zatwierdź] / [Zacznij od nowa]. Zatwierdzenie → `state.character = createCharacter(...)`, `hp = hpMax`.

### Awans
- `reward` (pole `xp`, liczba ≥ 0) → `addXp` → przy przekroczeniu progów ustawia/sumuje `pendingLevelUp`, podnosi `level`.
- `runScenes` po każdej **wykonanej** scenie (nie po pominiętej przez `if`) woła `afterScene` hooki z `src/scenes/after.js` (rejestr przekazywany jak `handlers`: `ctx.afterScene ?? defaultAfterScene`).
- Ekran awansu: `sliders` po umiejętnościach (budżet = `pendingLevelUp.skillPoints`, wiodące +2 za punkt, limit `max`, „Gotowe” przy wydanym budżecie), potem `select` perka × `pendingLevelUp.perks` (niedostępne wyszarzone z opisem braków; gdy brak dostępnych – perk przepada z komunikatem), na końcu `applyLevelUp`, pełne leczenie, `pendingLevelUp = null`.
- Przerwanie w trakcie awansu: `pendingLevelUp` zostaje w zapisie; po wczytaniu `runStory` przed pierwszą sceną woła `afterScene`.

### Czas
- `advanceTime(state, minutes, data)`: dzieli na odcinki kończące się na pełnych godzinach; na każdej pełnej godzinie: porównuje `timeOfDay` przed/po → zdarzenie `zmiana_pory`; woła `HOURLY_HOOKS` (puste w B1). Zwraca zdarzenia w kolejności.
- `loop.js`: `scene.time` → `advanceTime`; zdarzenia → `pushNotice(ctx, t(ui, "time.change.<to>"))`. (`loop.js` może importować UI – wyjątek z cyklu A.)

### Odpoczynek (`rest`)
- `sliders` z jednym wierszem (godziny `minHours`–`maxHours`), potem dla każdej godziny `advanceTime(60)` + leczenie `healBase + floor(krzepa / healKrzepaDiv)` do `hpMax`.
- Podsumowanie: „Odpoczywasz {h} godz. Odzyskujesz {hp} ŻYC.” + zdarzenia; `pressEnter`.
- Pole `allowExposure` (boolean) w schemacie – ignorowane do cyklu D.

### Zmienne
- Scena `var`: `{ "add": { "wola": 1 } }` → `addVar` (liczby całkowite, nieznana nazwa – błąd walidacji danych).
- Warunek `{ "var": "wola", "gte": 3 }` (dokładnie jeden z `gte`/`lte`/`eq`, liczba całkowita). Brak zmiennej = 0.
- Ukryte przed graczem; z `--debug` pasek stanu dopisuje `[wola 1 · dług 0]`.

### Ekrany
- Pasek stanu: `Dzień 1, 06:30 · świt` + (gdy jest postać) ` · {imię}, poz. {level} · ŻYC {hp}/{hpMax}`.
- `pressEnter`: przyjmuje Enter (dalej) albo `p`/`P` (ekran postaci, potem ponownie monit). W trybie bez TTY: pusta linia = dalej, `p` = postać.
- Ekran postaci: atrybuty (baza → końcowa, rozbicie), umiejętności (wiodące oznaczone), pochodne, XP `{xp}/{następny próg}`, perki z opisami.

### Zapis v2
- `SAVE_FORMAT_VERSION = 2`, `createNewState` dodaje `vars: {}`.
- `migrations[1] = (s) => ({ ...s, version: 2, vars: {} })`.
- `STATE_SCHEMA`: `vars` (obiekt liczb całkowitych), `character` – `null` albo obiekt o kształcie `Character`.
- `loadGame`: `character.classId` i każdy perk muszą istnieć w danych → inaczej `LoadError` „nieznana klasa "x"” / „nieznany perk "x"”.

## Walidacja danych (dopisane do `validateData`)

- `attributes.json`, `skills.json` (primary/secondary istnieją), `classes.json` (`taggedSkill` istnieje), `perks.json` (wymagania wskazują istniejące atrybuty/umiejętności, `modifiers` z katalogu, `unlocks` z `rules.unlocks`), `rules.timeOfDay` (`modifiers` z katalogu, pokrycie 24 godzin bez dziur i nakładek), `rules.vars` (unikalne id).
- Sceny: `var.add` – klucze z `rules.vars`, wartości całkowite; `reward.xp` liczba całkowita ≥ 0; `rest.allowExposure` boolean.
- Sceny `rest` i `reward` muszą występować w `story.scenes` **po** scenie `character_creation` (prosta reguła kolejności w liście; `goto` w tył nie jest analizowane).
- Warunki `var` – nazwa z `rules.vars`, dokładnie jeden operator, liczba całkowita.

## Obsługa błędów

- Tryb surowy: dopóki interfejs readline jest otwarty, to readline zarządza trybem surowym (`readKey` tylko na czas czekania odpina jego nasłuch klawiszy i zmiany rozmiaru okna), a `close()` przywraca tryb terminala. Ctrl+C w trybie surowym → `InterruptError` (jak dotąd).
- Scena wymagająca postaci przy `character === null` (np. `--scene` za kreatorem): handler rzuca `MissingCharacterError` → `app.js` pokazuje `ui["error.noCharacter"]` i wraca do menu (bez slotu `crash`).
- Wejście tekstowe imienia: niepoprawne znaki → komunikat i ponowne pytanie.

## Testy

| Plik | Co sprawdza |
|---|---|
| `modifiers.test.js` | katalog (atrybuty, umiejętności, stałe, `resist_*`, `effectDuration_*`), błędy literówek, sumowanie, `extraDamage`/`damageTaken` |
| `stats.test.js` | umiejętność 15 przy 5/5; wiodąca 35; punkty × 2 dla wiodącej; HP 35 → 39 na 2. poz.; PA 7 przy zręczności 5; udźwig 75; obrona 10; inicjatywa 10; noc: `rangedHitChance` −15 i −15 dla umiejętności z Bystrością; perk zmienia atrybut → umiejętność przeliczona; rozbicie na źródła; limit 0–100 |
| `character.test.js` | kreator: pula 5, dar Rozumu, granice, dokładnie 3 wiodące w tym klasowa, imię; progi 150/450/900/1500; dwa awanse naraz sumują `pendingLevelUp`; punkty `3 + floor(rozum/2)`; wymagania perków (baza + perki, nie pora doby); limit 6; brak duplikatów; pełne leczenie |
| `time.test.js` | `timeOfDay` 4:59/5:00/6:59/7:00/17:59/18:00/19:59/20:00/0:00; 10 × 6 min = 60 min (te same zdarzenia); 8 h od 22:00 → `swit` o 5:00; 24 h → 4 zmiany |
| `conditions.test.js` | `var` gte/lte/eq, brak zmiennej = 0, walidacja (nieznana zmienna, dwa operatory, ułamek) |
| `menu.test.js` | ↑↓ z zawijaniem; Enter; cyfra; przeskakiwanie wyszarzonych; suwaki ←→ z granicami i budżetem; `canFinish`; tryb bez TTY (numer, `1+`, `3-`, `1++`); `textInput`; przywracanie trybu surowego (atrapa `setRawMode` – liczba włączeń = wyłączeń, także po Ctrl+C) |
| `io.test.js` | `readKey` scripted tokeny; terminal: sekwencje strzałek → nazwy klawiszy |
| `data.test.js` | nowe reguły walidacji (każda z komunikatem `plik › id › pole: opis`), prawdziwe `data/` przechodzi |
| `save.test.js` | migracja v1 → v2 (zapis z cyklu A się wczytuje, dostaje `vars: {}`); nieznana klasa / perk → `LoadError` |
| `scenes.test.js` | kreator strzałkami i skrótami; `rest` (leczenie, czas, zdarzenia); `reward` → `pendingLevelUp`; ekran awansu po scenie; `var`; `MissingCharacterError` |
| `e2e.test.js` | demo B1: kreator → nagroda z awansem i perkiem → odpoczynek przez zmierzch → scena warunkowa wg `wola` → koniec; zapis w połowie + wczytanie = ten sam stan; [P] postać; brak `[[` |

## Demo `story.json` po B1

1. `demo_swit` – narracja: poranek w szkole ostrza (rubasznie, instruktor).
2. `demo_kreator` – `character_creation`.
3. `demo_sparing` – narracja sparingu. Prawdziwy wybór postawy wymaga dialogu (cykl C), więc w B1 postawę wyznacza klasa: `demo_postawa_miecz` (`var`, `if: { flag: "klasa_miecz" }`, `dlug` +1 – posłuszny instruktorowi) i `demo_postawa_wlocznia` (`var`, `if: { flag: "klasa_wlocznia" }`, `wola` +1 – przekorny). Demonstruje `var` i warunki bez dialogów.
4. `demo_nagroda` – `reward` 160 XP → 2. poziom (perk).
5. `demo_kurier` – narracja: wieść o cesarskim kurierze.
6. `demo_odpoczynek` – `rest`.
7. `demo_przekora` – narracja z `if: { var: "wola", gte: 1 }`; `demo_posluch` – z `if: { var: "dlug", gte: 1 }`.
8. `demo_zapis` – `save_point`; `demo_koniec` – `ending`.

Kreator ustawia flagę `klasa_<classId>` (np. `klasa_miecz`) – przydatne w treści do rozgałęzień zależnych od klasy.

## Kryterium ukończenia

- `npm test` – zielone.
- Demo grywalne strzałkami w Windows Terminal (sprawdza użytkownik po `npm link`) i z potoku (`printf … | node bin/game.js --seed 7` przechodzi do końca, kod 0).
- Zapis w formacie v1 wczytuje się po migracji (test na zapisie v1 wskazującym scenę istniejącą w nowym demo). Prawdziwe zapisy z demo cyklu A, których sceny zniknęły z nowego `story.json`, dają czytelny błąd „nieznana scena” – to oczekiwane, bo demo jest treścią tymczasową.
- `reward` w B1 ma tylko wymagane pole `xp`; `items` i `money` dochodzą w B2.
