# Cykl C2b – rozszerzenia walki (projekt)

> Data: 2026-10-21 · Źródło: `docs/koncepcja-gry.md` (rozdz. 4 „Biegłość w broni”, 5.1, 7, 8) i ustalenia z brainstormingu.
> Poprzedni cykl: `2026-10-21-cykl-c2a-walka-rdzen-design.md` (scalony do `master`), ledger `../plans/2026-10-21-cykl-c2a-ledger.md`.
> Następny: **D** – artefakty, zjawiska, podróże.
> Status: zatwierdzony w rozmowie, czeka na przegląd pliku.

## Cel

Po C2b gracz w demo walczy parą włóczni (podwójny atak, uderzenie z zasłoną, rzut włócznią i jej podniesienie, darmowe pchnięcie, gdy wróg wchodzi w zwarcie) albo mieczem ze sztyletem kupionym u kwatermistrza (te same akcje dwiema brońmi poza darmowym pchnięciem). Każdą bronią może wykonać atak celowany w głowę, tułów albo nogi. Po wygranej rośnie biegłość w rodzaju broni, widoczna na karcie postaci i dająca premie. Broń palna (niewypał, rozerwanie lufy, strach, hałas z posiłkami, dym) i upiór (`leap`, odporności, wycie) działają w silniku i danych, ale bez scen w demo. Odłożone z C2a: wróg strzela też w zwarciu z karą, pełny przewijany dziennik, znacznik pominiętych wpisów, testy przejścia niezależne od ścieżki RNG.

**Poza zakresem:** sceny z bronią palną i upiorem w demo (treść E), artefakty (D), poddawanie się wrogów, towarzysze.

## Decyzje

| Decyzja | Wybór | Powód |
|---|---|---|
| Cechy broni | Pola danych (`pair`, `offhand`, `reach`, pola broni palnej, `masteryType`), silnik sprawdza cechy, nie `id` | Koncepcja: „charakter broni ma wynikać z danych, nie z wyjątków w kodzie”. |
| Włócznie | Wszystkie cztery: atak obiema, uderz i zasłoń, rzut + podniesienie, darmowe pchnięcie (`reach`) | Decyzja użytkownika. |
| Miecz + sztylet | Druga ręka (`bron_druga`) z bronią `offhand`; te same akcje dwiema brońmi co para włóczni, bez `reach`; klasa miecza zaczyna z samym mieczem, sztylet w kramie (25 gr) | Decyzja użytkownika. |
| Biegłość | Rośnie po wygranej za pokonanych wrogów, malejąco (`xp/20 × (1 − b/100)²`), nie słabnie; per rodzaj broni ciosu kończącego | Decyzja użytkownika (koncepcja: wolno, bez farmienia). |
| Demo | Bez nowych scen; włócznie, miecz+sztylet, celowanie i biegłość w obecnych walkach; jedyna zmiana danych demo: sztylet w kramie | Decyzja użytkownika. |
| Broń palna i upiór | W danych i testach, bez scen i towaru | Decyzja użytkownika; treść w E. |
| Lista akcji | Nowe akcje w podmenu „[T] Techniki”; główna lista zostaje przy 10 pozycjach | Ekran 80×24: 11 linii góry + 10 akcji + opis ≤ 22. |

## Dane

### `data/items.json`

- `weapon` – nowe pola opcjonalne: `pair: true` (para – druga broń w tym samym przedmiocie), `offhand: true` (może iść do drugiej ręki), `reach: true` (darmowe pchnięcie), `masteryType` (wymagane dla broni poza `hidden`: `miecz` | `wlocznie` | `luk` | `kusza` | `palna` | `rzucana`; pięści – bez biegłości), pola broni palnej `misfireChance` (0–100), `burstChance` (0–100), `burstDamage` `[min, max]`, `noise` (0–100), `fear` (≥ 0), `smoke` (0–100). `pair` i `offhand` wykluczają się; `pair` tylko przy `range: "melee"`.
- Zmiany: `para_wloczni` → `pair: true`, `reach: true`, `masteryType: "wlocznie"`; `miecz_krotki` → `masteryType: "miecz"`; `luk_mysliwski` → `luk`; `kusza_lekka` → `kusza`.
- Nowe: `sztylet` (weapon, `sieczna`, kłute 2–4, 2 PA, melee, min. siła 1, `offhand: true`, `masteryType: "miecz"`, waga 0.5, wartość 25); `pistolet_skalkowy` (weapon, `proch`, palne 10–18, 4 PA, `far`, przebicie 4, `reload: { apCost: 5, ammo: "kula_z_prochem", capacity: 1 }`, `minStrength` 3, `misfireChance` 15, `burstChance` 2, `burstDamage` [4, 8], `noise` 3, `fear` 20, `smoke` 30, `masteryType: "palna"`, waga 1.5, wartość 120); `kula_z_prochem` (ammo, waga 0.05, wartość 6).
- Rzucane (`throwable`) – biegłość `rzucana` (bez pola; z typu przedmiotu).

### `data/enemies.json`

- Nowe pole wroga `leap: true` (wejście w zwarcie za 0 PA, raz na turę).
- Nowy wróg `upior_zwiadowca` (z koncepcji rozdz. 8): HP 45, PA 6, inicjatywa 8, obrona 20, pancerz 6, `damageTaken: { sieczne: 0.5, klute: 0.5, ogien: 2.0 }`, `immune: ["oslepienie", "rozkojarzenie"]`, `effectResist: { strach: 100, ogluszenie: 20 }`, `tags: ["upior"]`, `morale: null`, `ai: "aggressive"`, `leap: true`, ataki: „Szpon” 6–10 sieczne, 3 PA, hit 65, `effects: [{ krwawienie, 30 }]`; „Wycie” 4 PA, `effects: [{ strach, 60 }]`; `xp` 150, bez łupu (odłamek artefaktu dojdzie w cyklu D), grafika `data/art/upior_zwiadowca.txt`.

### `data/effects.json`

- Nowy `spowolnienie` (Spowolniony): `turn`, 2, `modifiers: { ap: -2 }`, nowe pole `noMove: true` (nie może „Zbliż się / Odskocz” ani `leap`; dozwolone tylko przy `turn`), `refresh`.

### `data/rules.json › combat` (rozszerzenie)

```json
"dual": { "extraAp": 2, "secondHitPenalty": 10, "guardExtraAp": 1, "guardBonus": 10, "oneLeftPenalty": 10, "pickUpAp": 2 },
"aimed": {
  "glowa":  { "ap": 1, "penalty": 25, "critBonus": 20, "effect": "ogluszenie", "chance": 25 },
  "tulow":  { "ap": 1, "penalty": 10, "damagePercent": 25 },
  "nogi":   { "ap": 1, "penalty": 15, "effect": "spowolnienie", "chance": 40 }
},
"mastery": { "xpDiv": 20, "max": 100, "hitAt100": 15, "damagePercentAt100": 20, "defenseAt100": 10, "classStart": 15 },
"firearm": { "misfirePerProch": 10 }
```

### `data/classes.json`

- Nowe pole klasy `masteryStart: { <rodzaj>: liczba }` – miecz: `{ "miecz": 15 }`, włócznia: `{ "wlocznie": 15 }`.

### `data/story.json` – scena `combat`

- Nowe pole opcjonalne `reinforcements: [{ id, count }]` (wrogowie dołączający po hałasie broni palnej; najwyżej raz na walkę; startują na dystansie).

### `data/shops.json`

- `kramarz_szkolny`: `sztylet` ×1 (jedyna zmiana danych demo).

## Sloty i ekwipunek

- `SLOTS` + `bron_druga` (nazwa w `ui.json`: „Druga ręka”). `slotAccepts`: broń z `offhand: true` → `bron`, `bron_zapas`, `bron_druga`; pozostała broń bez zmian (nie do `bron_druga`).
- Ekran ekwipunku: dla broni `offhand` akcja „Załóż do drugiej ręki” (`inv.equipOffhand`). „Zamień broń” zamienia tylko `bron` ↔ `bron_zapas` (druga ręka zostaje).
- Linia slotów pokazuje drugą rękę, gdy coś w niej jest. Sztylet w drugiej ręce nie daje modyfikatorów (jak broń na plecach) – liczy się tylko w walce.
- Zapis: `equipped.bron_druga` jak inne sloty (naprawa: zła broń w slocie → zdjęta z ostrzeżeniem).

## Walka

### Dwie bronie

- **Aktywne**, gdy w `bron` jest broń `pair`, albo broń `melee` bez `pair` i w `bron_druga` jest broń `offhand`. „Druga broń” = ta sama broń (para) albo broń z `bron_druga`.
- **Atak obiema** (w podmenu Technik): tylko w zwarciu z celem; koszt `apCost` głównej + `dual.extraAp`; dwa ciosy: główną bronią, potem drugą (jej obrażeniami, typem i umiejętnością; przy parze – tą samą) z karą `secondHitPenalty`; każdy cios z osobnym rzutem i zasadami obucha/efektów.
- **Uderz i zasłoń**: zwykły atak główną bronią + obrona `guardBonus` do następnej tury gracza (`defendBonus = max(defendBonus, guardBonus)` – nie sumuje się z akcją Obrona); koszt `apCost` + `guardExtraAp`.
- **Rzut** drugą bronią (włócznią z pary albo bronią z drugiej ręki): atak z obu pasm umiejętnością `miotanie`, obrażenia i typ drugiej broni, koszt `apCost` drugiej broni; przy trafieniu i chybieniu broń leży przy celu (`combat.thrown = { uid, itemId }`). Do podniesienia: brak akcji dwiema brońmi; przy parze dodatkowo kara `oneLeftPenalty` do trafienia zwykłym atakiem.
- **Podnieś** (w Technikach, `pickUpAp`): gdy cel rzutu jest w zwarciu albo martwy/uciekł. Koniec walki – broń wraca automatycznie (przedmiot nigdy nie znika z torby; `thrown` jest tylko stanem walki).
- **`reach`** (para włóczni): wróg, który w swojej turze wchodzi w zwarcie z graczem (ruch albo `leap`), dostaje darmowy cios główną bronią gracza (raz na turę wroga), o ile gracz nie jest ogłuszony i nie rzucił włóczni.

### Atak celowany

- W Technikach dla każdej broni poza pięściami i rzucanymi; wybór celu, potem strefy (`select`: Głowa / Tułów / Nogi / Wróć) z kosztem i karą w etykiecie.
- Koszt `apCost + aimed.<strefa>.ap`, kara do trafienia `penalty`. Głowa: `critBonus` do szansy krytyka, przy trafieniu szansa `chance` na `effect`; tułów: obrażenia ×(1 + `damagePercent`/100) przed pancerzem; nogi: szansa na `spowolnienie`. Efekty przez `applyToEnemy` (odporności i `immune` działają).

### Broń palna

- **Niewypał:** przy strzale rzut `≤ max(1, misfireChance − fart − floor(proch / misfirePerProch))` → niewypał: PA i ładunek zużyte, brak trafienia; zdarzenie `niewypal`.
- **Rozerwanie:** przy niewypale rzut `≤ burstChance` → broń usunięta z torby i slotu, obrażenia `burstDamage` dla gracza (przez `dealDamage`), zdarzenie `rozerwanie`.
- **Strach:** każdy oddany strzał (nie niewypał) → morale każdego wroga z morale −`fear` (zdarzenie, gdy ktoś spadnie poniżej progu – istniejące reguły morale).
- **Hałas:** po strzale rzut `≤ noise` → gdy scena ma `reinforcements` i jeszcze nie przybyły, dołączają (na dystansie, numerowani dalej), zdarzenie `posilki`.
- **Dym:** po strzale rzut `≤ smoke` → `zadymienie` na polu walki.
- Wrogowie z bronią palną – poza zakresem (żaden wróg jej nie ma).

### Upiór i `leap`

- Wróg z `leap` na dystansie wchodzi w zwarcie za 0 PA, raz na turę (zdarzenie `ruch` z `leap: true`, tekst „{name} skacze na ciebie!”). Blokuje to `spowolnienie` (`noMove`).

### Wróg strzela z bliska

- Ataki `far` wroga dostępne w obu pasmach; w zwarciu kara `rangedInMeleePenalty` w `enemyHitChance` (zastępuje Ruling 6 z C2a). AI `ranged` nadal woli odskoczyć, gdy ma PA na odskok i strzał.

## Biegłość (`src/systems/combat/mastery.js`)

- Stan `character.mastery: { miecz, wlocznie, luk, kusza, palna, rzucana }` (liczby 0–100, jedno miejsce po przecinku). `createCharacter` – zera + `masteryStart` klasy.
- **Rodzaj broni** w ataku: `masteryType` broni (rzucane przedmioty – `rzucana`; rzut włócznią/sztyletem – `rzucana`; pięści – brak).
- **Przyrost:** na końcu wygranej walki (także wygranego sparingu – trening też uczy) dla każdego wroga pokonanego ciosem gracza (zapamiętany `killedBy` = rodzaj broni ciosu kończącego; śmierć od efektu – brak): `+ xp_wroga / xpDiv × (1 − b/100)²`, sumowane po wrogach na bieżącej wartości po każdym wrogu, zaokrąglenie do 0.1, maks. `max`. Zdarzenie `bieglosc { type, before, after }` (komunikat w podsumowaniu, gdy przyrost ≥ 0.1).
- **Premie** (bronią danego rodzaju w ręku, w ataku tą bronią): trafienie `+ hitAt100 × b/100` (zaokr. w dół), obrażenia ×(1 + `damagePercentAt100`/100 × b/100) (przed pancerzem, w dół na końcu jak dotąd), obrona `+ defenseAt100 × b/100` (w dół; tylko gdy główna broń w ręku jest `melee`).
- Karta postaci: sekcja „Biegłość” – rodzaje > 0 jako `Miecz 16.4` (nazwy w `ui.json`).

## Dziennik i ekran

- **Lista akcji:** główna lista bez zmian (9 pozycji) + „[T] Techniki” (10). Techniki: Atak celowany, Atak obiema, Uderz i zasłoń, Rzuć {broń}, Podnieś {broń} – tylko dostępne lub wyszarzone z powodem; „Wróć”.
- **Pełny dziennik `[L]`:** przewijana lista wszystkich wpisów (widżet `select` z wierszami-wpisami, kursor startuje na ostatnim; Enter/Wróć zamyka).
- **Znacznik pominiętych:** gdy od ostatniego narysowania ekranu przybyło więcej wpisów niż `logSize`, pierwsza linia dziennika to `combat.logMore` „(+{n} wcześniej – [L])”.

## Zapis v6

- `character.mastery` (obiekt 6 liczb 0–100); `migrations[5]` – `mastery` z zerami + `masteryStart` klasy (gdy jest postać); naprawa: nieznane klucze usunięte, wartości obcięte do 0–100.
- `equipped.bron_druga` – istniejąca naprawa slotów obsługuje (po dodaniu do `SLOTS`).

## Testy

- Jednostkowe: dwie bronie (aktywność dla pary i miecz+sztylet, łuk + sztylet – nieaktywne), atak obiema (dwa rzuty, kara drugiego, broń drugiej ręki), uderz i zasłoń, rzut i podniesienie (kara `oneLeftPenalty`, powrót po walce), `reach` (raz na turę wroga, blokady), atak celowany (3 strefy, koszty, kary, efekty, `immune`), broń palna (niewypał z wzorem, rozerwanie usuwa broń, strach, posiłki raz, dym), `leap` i `spowolnienie` (`noMove`), wróg strzela z bliska z karą, biegłość (przyrost dla 15 i 80, ciosy kończące, efekt nie liczy się, premie w trafieniu/obrażeniach/obronie), migracja v5 → v6 i naprawa, `slotAccepts` dla `bron_druga`, walidacja nowych pól.
- Symulacja: włócznia z akcjami pary i miecz bez sztyletu przeciw 2 bandytom – próg wygranych jak w C2a nadal spełniony; upiór przeciw postaci 1. poziomu – zapis wyniku w raporcie (bez progu, informacyjnie).
- Ekran: z 10 akcjami + opis ≤ 22 linie przy 80×24; Techniki i pełny dziennik w 24 wierszach.
- e2e: nowy pomocnik testowy, który gra walkę adaptacyjnie (czyta ekran, wybiera atak/opatrunek/koniec tury, aż pojawi się podsumowanie) – istniejące testy przejścia demo przechodzą na niego, zamiast stałych sekwencji; klasa miecza kupuje sztylet i zakłada go do drugiej ręki, w walce z bandytami używa ataku obiema; klasa włóczni używa rzutu włócznią i podniesienia; obie po walce mają biegłość > 15.

## Kryterium ukończenia

Wszystkie testy zielone (`npm test`), `node bin/game.js --validate` bez błędów, symulacja w progu, demo przechodzi skryptem dla obu klas z nowymi akcjami, a w terminalu 80×24 Techniki i pełny dziennik mieszczą się na ekranie.
