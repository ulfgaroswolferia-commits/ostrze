# Cykl B2 – ekwipunek, sklep, menu obozowe (projekt)

> Data: 2026-10-21 · Źródło: `docs/koncepcja-gry.md` (rozdziały 4, 5, 13, 14, 15, 16 – etap 6) i ustalenia z brainstormingu.
> Poprzedni cykl: `2026-10-20-cykl-b1-postac-czas-design.md` (scalony do `master`), ledger `../plans/2026-10-20-cykl-b1-ledger.md`.
> Inspiracje fabularne (nie wytyczne): `docs/koncepcja_fabu_y_i_podzia_na_akty.md`, `docs/koncepcja_dialogi_narracja_i_przyk_ady.md`, `docs/koncepcja-dialogowa.md`.
> Status: zatwierdzony w rozmowie, czeka na przegląd pliku.

## Cel

Po B2 gracz w demo: dostaje startowy ekwipunek klasy, w nagrodzie zdobywa przedmiot i pieniądze, w menu obozowym zakłada sprzęt i widzi jego wpływ na karcie postaci, przypina rzeczy do pasa, używa opatrunku, kupuje i sprzedaje u kramarza, zapisuje grę w slocie 1–3 i po wczytaniu ma wszystko na miejscu. Waga jest liczona, przeciążenie pokazane, a 150% udźwigu jest twardym limitem.

**Poza zakresem:** walka i wszystko, co z niej wynika – ataki, przeładowanie i `inventory.loaded`, użycie przedmiotów w walce, kary przeciążenia (−2 PA, brak ucieczki), kara `minStrength` do trafienia, rzucanie (C); efekty statusu i ich usuwanie przez `removes` (C); biegłość w broni (C); artefakty, ładunek, talizmany-artefakty (D); rzemiosło (poza MVP).

## Decyzje

| Decyzja | Wybór | Powód |
|---|---|---|
| Architektura | Czyste systemy `inventory.js` i `shop.js`; sprzęt jako nowe źródło w `STAT_SOURCES`; menu obozowe jako funkcja UI wołana przez sceny | Zgodne z cyklami A/B1 (czyste systemy, sceny z `ctx.io`), łatwe testy, scena sama rysuje się po powrocie z ekranów. Odrzucone: obóz jako hook po scenie (menu na pustym ekranie), obóz jako typ sceny (uciążliwe dla treści). |
| Menu obozowe | Lista w widżecie (Dalej / Postać / Ekwipunek / Zapisz / Menu główne) **i** litery P/E/Z/M jako skróty | Decyzja użytkownika: strzałki wszędzie + szybkie klawisze. |
| Sklep | Ograniczony towar zapamiętywany w zapisie; sprzedane rzeczy trafiają do towaru; kupiec ma nieograniczone pieniądze; kupuje tylko typy z `buys` | Decyzja użytkownika. Brak sakiewki kupca = mniej stanu i balansu. |
| Waga | Liczona i pokazywana; > 100% „przeciążony” (kary w C); 150% to twardy limit podnoszenia (nagroda, zakup) | Decyzja użytkownika; zgodne z rozdz. 4 spec. głównej. |
| Pieniądze | `character.money` w groszach (liczba całkowita), skrót waluty w `ui.json` (`currency.short` = „gr”) | Spec. główna; nazwa waluty świata do ustalenia w cyklu E. |
| Model przedmiotów | Stosy `{ id, qty }` bez egzemplarzy; `equipped` wskazuje `id` | Brak zużycia i unikatowych cech w MVP; artefakty (D) mają własny stan. |

## Dane

### `data/items.json` (nowy)

Tablica przedmiotów. Pola wspólne: `id`, `name`, `type`, `weight` (kg, liczba ≥ 0, dopuszczalne ułamki), `value` (grosze, całkowita ≥ 0), `description`, opcjonalnie `hidden: true` (nie pokazywany, nie do sprzedaży, nie do wyrzucenia). Typy:

- **`weapon`**: `skill` (id umiejętności), `damageType` (z `DAMAGE_TYPES`), `damage` `[min, max]` całkowite, `apCost` ≥ 1, `range` (`melee` | `far` | `thrown`), `minStrength` ≥ 0, opcjonalnie `reload` `{ apCost, ammo, capacity }` (`ammo` wskazuje przedmiot typu `ammo`), `armorPierce`, `misfireChance`, `burstChance`, `noise`, `fear` (liczby całkowite ≥ 0), `modifiers`. Pola walki są walidowane już teraz, używane w C. Inne pola niż wymienione = błąd (cykl C dopisze nowe, np. `reach`).
- **`armor`**: `slot` (z listy slotów poza `bron`/`bron_zapas`), opcjonalnie `armor` (całkowita ≥ 0, domyślnie 0), `reduction` (mapa typ obrażeń → 0–75), `modifiers`, `quickSlots` (całkowita ≥ 0, **wymagane** dla `slot: "pas"`, zabronione dla innych slotów).
- **`ammo`**: tylko pola wspólne.
- **`throwable`**: `skill`, `apCost`, `target` (`single` | `single_splash` | `all_enemies` | `battlefield`), `effects` `[{ id, chance }]` (id w formacie identyfikatora, `chance` 1–100; istnienie efektu sprawdzi C).
- **`consumable`**: `target: "self"`, `apCost`, opcjonalnie `heal` `[min, max]`, `healSkill` (id umiejętności), `removes` (lista id efektów; w B2 bez działania).

**Sloty** (stała w kodzie, nazwy w `ui.json` jako `slot.<id>`): `bron`, `bron_zapas`, `glowa`, `tulow`, `rece`, `nogi`, `plaszcz`, `talizman`, `pas`.

**Zestaw na B2** (liczby to punkt startowy balansu, poprawiane w E):

| id | Typ | Slot / umiejętność | Najważniejsze | Waga | Wartość |
|---|---|---|---|---|---|
| `piesci` | weapon (hidden) | `wrecz` | obuchowe 1–3, 2 PA | 0 | 0 |
| `miecz_krotki` | weapon | `sieczna` | sieczne 4–8, 3 PA, melee, min. siła 3 | 2 | 40 |
| `para_wloczni` | weapon | `drzewcowa` | kłute 3–7, 3 PA, melee, min. siła 3 | 3 | 40 |
| `luk_mysliwski` | weapon | `strzelecka` | kłute 3–7, 4 PA, far, przeładowanie 1 PA strzałą | 1.5 | 35 |
| `kusza_lekka` | weapon | `strzelecka` | jak w spec. głównej 5.1 | 4 | 60 |
| `strzala` | ammo | – | – | 0.05 | 1 |
| `belt` | ammo | – | – | 0.1 | 2 |
| `kaftan_przeszywany` | armor | `tulow` | jak w spec. 5.2 | 5 | 40 |
| `kolczuga` | armor | `tulow` | armor 2, sieczne 30, kłute 10; `ap` −1, `skradanie` −20 | 12 | 150 |
| `kaptur_mysliwego` | armor | `glowa` | `bystrosc` +1, `resist_oslepienie` +20 | 0.5 | 30 |
| `rekawice_lucznicze` | armor | `rece` | `strzelecka` +10 | 0.3 | 25 |
| `buty_podkute` | armor | `nogi` | armor 1, `skradanie` −5 | 1.5 | 20 |
| `plaszcz_wedrowca` | armor | `plaszcz` | `skradanie` +5 | 1.5 | 15 |
| `pas_zwykly` | armor | `pas` | `quickSlots` 2 | 0.3 | 5 |
| `pas_ladownice` | armor | `pas` | `quickSlots` 4 | 0.8 | 30 |
| `opatrunek` | consumable | `medycyna` | leczy 3–6, usuwa krwawienie | 0.2 | 8 |
| `napar_ziol` | consumable | `medycyna` | leczy 6–10 | 0.3 | 15 |
| `garniec_wapno`, `swieca_dymna`, `puszka_szerszeni` | throwable | `miotanie` | jak w spec. 5.3 | 1 | 15–25 |

### `data/shops.json` (nowy)

`[{ "id", "name", "stock": [{ "id", "qty" }], "buys": ["weapon", "armor", "ammo", "throwable", "consumable"] }]`. Demo: `kramarz_szkolny` (opatrunki, napar, kaptur, rękawice, pas z ładownicami, łuk, strzały, garniec z wapnem; kupuje broń, pancerz i środki).

### `data/classes.json` (rozszerzenie)

Każda klasa: `startItems: [{ id, qty }]`, `startEquipped: { slot: id }`, `startMoney` (grosze). Miecz: `miecz_krotki`, `kaftan_przeszywany`, `pas_zwykly`, 2× `opatrunek`, wszystko poza opatrunkami założone, 30 gr. Włócznia: to samo z `para_wloczni`.

### `data/rules.json` (rozszerzenie)

```json
"inventory": { "hardLimitPercent": 150, "useMinutes": 10, "maxReductionPercent": 75 },
"shop": { "buyBase": 1.5, "buyHandelDiv": 200, "sellBase": 0.3, "sellHandelDiv": 400, "minPrice": 1 }
```

### `data/story.json` – nowe pola scen

- `reward`: obok `xp` (teraz opcjonalnego) – `money` (całkowita ≥ 0) i `items` (`[{ id, qty }]` lub skrót `"id"` = 1 sztuka). Co najmniej jedno z `xp`, `money`, `items`.
- `shop`: `{ "type": "shop", "shop": "<id sklepu>" }` + pola wspólne.

## Wzory

- **Waga niesiona:** suma `weight × qty` wszystkich przedmiotów (założone też ważą), zaokrąglana do 0.1 tylko przy wyświetlaniu.
- **Udźwig:** `getStats().derived.carry` (już istnieje). Przeciążenie: waga > udźwig. Twardy limit: waga po zmianie > `udźwig × hardLimitPercent / 100` → zmiana zablokowana.
- **Cena kupna:** `max(minPrice, round(value × (buyBase − handel / buyHandelDiv)))`; **sprzedaży:** `max(minPrice, round(value × (sellBase + handel / sellHandelDiv)))`, przy czym sprzedaż nigdy nie przekracza kupna (`min(sell, buy)`). `handel` = końcowa wartość z `getStats`. Przedmiot o `value: 0` nie jest kupowany przez kupca.
- **Leczenie poza walką:** `floor(rng.int(heal) × (1 + skill / 100))`, gdzie `skill` = wartość `healSkill` (brak = 0), obcięte do `hpMax`; użycie przesuwa czas o `useMinutes` (z powiadomieniami o zmianie pory jak w pętli).
- **Modyfikatory sprzętu:** sumowane ze wszystkich założonych slotów **poza `bron_zapas`** (broń na plecach nie działa). `reduction` sumuje się per typ i obcina do `maxReductionPercent` – liczone w `getStats` jako `derived.reduction` i `derived.armor` (do użycia w C, pokazane na karcie).

## Moduły

| Plik | Odpowiedzialność |
|---|---|
| `src/systems/inventory.js` (nowy) | Czyste funkcje na `state` + `data`: `itemById`, `countOf`, `addItem`, `removeItem`, `freeCount` (sztuki niezałożone), `equip(state, data, itemId, slot)`, `unequip`, `swapWeapons`, `assignQuick`, `unassignQuick`, `quickCapacity`, `carriedWeight`, `canAdd(state, data, itemId, qty)`, `useConsumable(state, data, itemId, rng)`, `grantStartKit(state, data, classId)`. Operacje zmieniające zwracają `{ ok: true, ... }` lub `{ ok: false, reason }` (`reason` = klucz z `ui.json`, np. `inv.noFreeCopy`) i nie zmieniają stanu przy niepowodzeniu. |
| `src/systems/shop.js` (nowy) | `buyPrice`, `sellPrice`, `shopStock(state, data, shopId)` (z `world.shops` albo kopia z `shops.json`), `buy(state, data, shopId, itemId, qty)`, `sell(...)`, `sellable(state, data, shopId)`. Ten sam kontrakt `{ ok, reason }`. |
| `src/systems/stats.js` | Nowe źródło `equipmentSource` (`kind: "item"`, `id` przedmiotu, `permanent: false`) i pola `derived.armor`, `derived.reduction`. |
| `src/ui/menu.js` | Opcjonalne `hotkey` (jedna litera) przy pozycji `select`: litera (bez względu na wielkość) wybiera pozycję od razu, w trybie liniowym odpowiedź literą też działa; wyświetlane jako `[P] Postać`. Przewijanie: gdy pozycji jest więcej niż `io.rows − 4` (nowy getter w `io.js` jak `columns`: `output.rows || 24`; w skryptowym IO 24), widżet pokazuje okno wokół kursora ze znacznikami `↑ …` / `↓ …` (dotyczy też `multiSelect` i `sliders`). |
| `src/ui/camp.js` (nowy) | `campMenu(ctx, render)` – pętla obozu: Dalej / Postać / Ekwipunek / Zapisz / Menu główne; po każdym ekranie woła `render()` i pokazuje menu ponownie. Bez postaci – samo „Dalej” (jak dziś `pressEnter`). |
| `src/ui/inventory_screen.js` (nowy) | `showInventory(ctx)` – nagłówek (waga, pieniądze, przeciążenie), lista slotów, lista przedmiotów z dopiskami, podmenu akcji, karta przedmiotu, suwak ilości przy wyrzucaniu. |
| `src/ui/save_screen.js` (nowy) | `saveToSlot(ctx)` – wybór slotu 1–3 (z opisem zajętych slotów jak w „Wczytaj”), nadpisanie zajętego po potwierdzeniu, komunikat. |
| `src/scenes/shop.js` (nowy) | Scena `shop`. |
| `src/scenes/narration.js`, `reward.js`, `rest.js` | `pressEnter({ onCharacter })` zastąpione przez `campMenu`. `reward` przyznaje przedmioty i pieniądze. |
| `src/scenes/character_creation.js` | Po zatwierdzeniu postaci `grantStartKit`. |
| `src/scenes/errors.js` | `QuitToMenuError` – rzucany z obozu („Menu główne”), łapany w `play()` → powrót do menu. |
| `src/engine/state.js`, `save.js` | Stan i zapis v3, migracja, walidacja i czyszczenie przy wczytaniu. |
| `src/engine/data.js` | Ładowanie i walidacja `items.json`, `shops.json`, nowych pól klas, reguł i scen. |
| `src/ui/character_screen.js` | Linie „Pancerz / redukcje” i „Waga / udźwig”; źródło `item` w rozbiciu pokazuje nazwę przedmiotu. |

## Stan i zapis v3

```js
character: { ..., money: 30 },
inventory: {
  items: [{ id: "miecz_krotki", qty: 1 }, { id: "opatrunek", qty: 2 }], // torba, także założone
  equipped: { bron: "miecz_krotki", tulow: "kaftan_przeszywany", pas: "pas_zwykly" },
  quickSlots: ["opatrunek"]       // id przedmiotów; długość ≤ pojemność pasa; bez duplikatów
},
world: { ..., shops: { kramarz_szkolny: [{ id: "opatrunek", qty: 2 }] }, claimedRewards: ["demo_nagroda"] }
```

- `createNewState`: `inventory: { items: [], equipped: {}, quickSlots: [] }`, `world.shops: {}`, `world.claimedRewards: []`, `version: 3`.
- `SAVE_FORMAT_VERSION` = 3; `migrations[2]`: `inventory` jak wyżej (gdy `null`), `world.shops` i `world.claimedRewards` puste, `character.money = 0` gdy jest postać.
- Wczytanie – walidacja kształtu (`inventory`, `money` całkowite ≥ 0) jak dla postaci, błąd kształtu = `LoadError`. Potem **naprawa z ostrzeżeniem** (notice na następnym ekranie): nieznany przedmiot w torbie/slocie/pasie/sklepie usunięty; założony przedmiot bez wolnej sztuki w torbie lub w złym slocie zdjęty; `quickSlots` bez pokrycia w torbie albo ponad pojemność pasa przycięte; nieznany sklep w `world.shops` usunięty.

## Reguły ekwipunku

- Zakładanie: przedmiot musi być w torbie, mieć wolną (niezałożoną) sztukę i pasować do slotu (`weapon` → `bron` lub `bron_zapas`, `armor` → swój `slot`). Zajęty slot: poprzedni przedmiot wraca do torby (jest w niej cały czas – zdejmowane jest tylko przypisanie). Ta sama broń w obu slotach wymaga 2 sztuk.
- `swapWeapons` zamienia `bron` ↔ `bron_zapas` (także gdy jeden jest pusty).
- Pas: `quickSlots` przyjmuje `throwable` i `consumable` posiadane w torbie, każdy `id` raz (stos jest na pasie w całości), do `quickCapacity` (= `quickSlots` założonego pasa, bez pasa 0). Zmiana/zdjęcie pasa przycina listę od końca; przycięte pozycje to notice.
- Usunięcie ostatniej sztuki przedmiotu (użycie, sprzedaż, wyrzucenie) zdejmuje go z pasa. Sprzedać i wyrzucić można tylko sztuki niezałożone; `hidden` – nigdy.
- Zdjęcie przedmiotu zmniejszającego `hpMax` obcina `hp` do nowego maksimum (nigdy poniżej 1); założenie nie leczy.
- Za mała siła (`minStrength` > siła końcowa) – wolno założyć, karta i lista pokazują ostrzeżenie „za ciężka: −10 do trafienia za brakujący punkt” (kara działa w C).
- Brak broni w `bron` – karta pokazuje „Pięści”.

## Przepływ

### Menu obozowe

Sceny `narration`, `reward`, `rest` rysują swój ekran, potem `campMenu(ctx, render)`:

- **Dalej** (domyślnie pod kursorem, Enter) – koniec sceny.
- **[P] Postać** – `showCharacter`; **[E] Ekwipunek** – `showInventory`; po powrocie `render()` i znów menu.
- **[Z] Zapisz grę** – `saveToSlot`; zapis wskazuje bieżącą scenę (wczytanie zaczyna ją od początku – spec. główna, rozdz. 14).
- **[M] Menu główne** – „Zapisać przed wyjściem? (t/n)” → ewentualny zapis do `auto` → `QuitToMenuError`.
- Bez postaci (scena przed kreatorem): tylko „Dalej”, w trybie liniowym zwykłe „Enter”.

Powtórka sceny `reward` po wczytaniu nie przyznaje nagrody drugi raz: `reward` dopisuje `scene.id` do `world.claimedRewards` i przy kolejnym wejściu tylko pokazuje ekran (z dopiskiem „już odebrane”). `rest` po wczytaniu może zostać powtórzony – akceptowane (kosztuje czas świata).

### Ekran ekwipunku

```
Ekwipunek                       Waga 14.6/75 kg · 34 gr
W ręku: Miecz krótki   Plecy: –   Tułów: Kaftan przeszywany   Pas: Pas zwykły (1/2)
▶ Miecz krótki              [w ręku]
  Kaftan przeszywany        [tułów]
  Opatrunek ×2              [pas]
  Lekka kusza               za ciężka
  Wróć
```

Wybór przedmiotu → podmenu (tylko akcje możliwe dla typu; niemożliwe wyszarzone z powodem w `hint`): Załóż (dla broni: „do ręki” / „na plecy”), Zdejmij, Zamień broń, Na pas, Z pasa, Użyj, Wyrzuć (suwak ilości, gdy > 1; potwierdzenie), Opis (karta przedmiotu: typ, waga, wartość, obrażenia/PA/zasięg albo pancerz/redukcje/modyfikatory, opis), Wróć. Komunikaty `reason` jako notice.

### Sklep (`shop`)

Ekran: nazwa kupca, „Twoje pieniądze: 34 gr”, waga. Menu: Kupuj / Sprzedawaj / Odejdź.
- **Kupuj:** lista `nazwa · cena gr · ×ilość` z towaru (pozycje z `qty` 0 znikają; za drogie i ponad limit wagi wyszarzone z powodem). Wybór → suwak ilości (1 … min(towar, stać, limit wagi)) z podglądem sumy → potwierdzenie → `buy`.
- **Sprzedawaj:** wolne sztuki typów z `buys`, bez `hidden` i `value: 0`, z ceną sprzedaży. Suwak ilości → `sell`; sprzedane trafiają do towaru kupca.
- Pierwsza transakcja zapisuje towar do `world.shops[id]`. Sklep nie przesuwa czasu (poza wspólnym polem `time`).

### Nagroda (`reward`)

Ekran: `+160 PD · +20 gr · Lekka kusza, Belt ×10`, ewentualny awans. Przedmioty dodawane po kolei; gdy przedmiot przekroczyłby twardy limit wagi: „Lekka kusza się nie mieści” → Wyrzuć coś (ekran ekwipunku, potem ponowna próba) / Zostaw przedmiot. Potem menu obozowe.

### Kreator

Po zatwierdzeniu postaci `grantStartKit`: przedmioty, `startEquipped`, `startMoney`; opatrunki od razu na pasie (do pojemności).

## Walidacja danych (dopisana do `validateData`)

- `items.json`: unikalne `id`; znany `type`; pola wymagane i dozwolone per typ; `slot` z listy; `skill` / `healSkill` istnieją; `damage` / `heal` `[min, max]` z min ≤ max; `reload.ammo` → przedmiot `ammo`; `modifiers` przez `validateModifiers`; `reduction` klucze z `DAMAGE_TYPES`, wartości 0–75; `quickSlots` tylko i obowiązkowo przy pasie; istnieje dokładnie jeden przedmiot `piesci` (`weapon`, `hidden`).
- `shops.json`: unikalne `id`; `stock` → istniejące, nieukryte przedmioty, `qty` ≥ 1, bez powtórzeń; `buys` – znane typy.
- `classes.json`: `startItems` istnieją, `qty` ≥ 1; `startEquipped` – slot i przedmiot zgodne z regułami zakładania i obecne w `startItems`; `startMoney` ≥ 0.
- `rules.json`: nowe sekcje `inventory` i `shop` (liczby, `minPrice` ≥ 1, `buyBase` > 0).
- `story.json`: scena `shop` → istniejący sklep; `reward` → co najmniej jedno z `xp`/`money`/`items`, przedmioty istnieją i nie są `hidden`, `qty` ≥ 1.

## Obsługa błędów

- Operacje systemów nigdy nie rzucają przy błędzie gracza – `{ ok: false, reason }`; UI pokazuje tekst `reason` z `ui.json`. Rzucają tylko przy błędzie programisty (nieznany `id` z kodu).
- Pieniądze i ilości nigdy nie spadają poniżej zera; nieudana operacja nie zmienia stanu (testowane).
- Błąd zapisu w „Zapisz grę” → notice `save.failed`, gra toczy się dalej.
- `QuitToMenuError` nie jest awarią – brak zapisu `crash`.

## Testy

- `inventory.test.js`: łączenie stosów; zakładanie (zgodność slotu, dwa sloty broni, brak drugiej sztuki, zajęty slot); `swapWeapons`; pas (typy, duplikaty, pojemność, przycięcie po zmianie pasa, usunięcie ostatniej sztuki); waga, przeciążenie, twardy limit `canAdd`; `useConsumable` (leczenie z medycyną, obcięcie do `hpMax`, zużycie sztuki; użycie przy pełnym HP dozwolone i leczy 0); obcięcie `hp` po zdjęciu przedmiotu z `hpMax`; `grantStartKit`; nieudana operacja nie zmienia stanu.
- `shop.test.js`: ceny przy `handel` 0 / 50 / 100 (kupno ≥ sprzedaż, minimum 1); `buy` / `sell` zmieniają pieniądze, towar i torbę; blokady: brak pieniędzy, brak towaru, limit wagi, typ spoza `buys`, sztuka założona, `hidden`, `value: 0`; towar zapamiętany w `world.shops`.
- `stats.test.js`: modyfikatory założonych przedmiotów w `getStats` i w rozbiciu (`kind: "item"`); broń na plecach nie działa; `reduction` sumowana i obcięta do 75; `permanentOnly` pomija sprzęt.
- `save.test.js`: migracja v2 → v3; naprawa przy wczytaniu (nieznany przedmiot, założony bez sztuki, pas ponad pojemność, nieznany sklep) z ostrzeżeniami; zły kształt `inventory` → `LoadError`; pełny cykl zapis → wczytanie z ekwipunkiem i towarem sklepu.
- `data.test.js`: każda reguła walidacji z listy wyżej ma przypadek błędny z komunikatem `plik › id › pole`.
- `menu.test.js`: `hotkey` w trybie klawiszy i liniowym; przewijanie długiej listy (okno, znaczniki, kursor zawsze widoczny).
- Sceny (skryptowe IO): obóz – litery i numery, zapis do slotu z obozu, „Menu główne” z zapisem i bez; ekran ekwipunku – załóż, zdejmij, zamiana broni, na pas, użyj opatrunku (+10 min, leczenie); sklep – kupno z suwakiem, sprzedaż, wyszarzenia; nagroda – przedmioty i pieniądze, przekroczenie limitu (wyrzuć / zostaw), brak ponownego przyznania po wczytaniu; kreator wydaje zestaw klasy.
- e2e (`createScriptedIO`): demo dla **obu klas** (zaległość z ledgera B1: gałąź włóczni) – nagroda z przedmiotem, założenie w obozie, zmiana na karcie postaci, zakup i sprzedaż u kramarza, zapis w slocie 1, wczytanie i kontrola stanu.

## Demo `story.json` po B2

Po `demo_nagroda` (teraz: XP + 15 gr + `kaptur_mysliwego`) obóz pozwala założyć kaptur (Bystrość +1 na karcie). Nowa scena `demo_kram` (`shop: kramarz_szkolny`, krótka narracja przed nią w stylu dokumentów-inspiracji – kram szkolnego kwatermistrza, który skąpi i zrzędzi) przed wieścią o kurierze. Teksty dobiera implementator w zgodzie z „Styl i ton” spec. głównej.

## Zaległości z ledgera B1 włączone do B2

- e2e gałęzi włóczni (wyżej, testy e2e).
- Menu wyższe niż ekran → przewijanie w widżecie (wyżej, `menu.js`).
- Podgląd klasy w kreatorze bez `classId` – poprawiany przy okazji zmian w `character_creation.js`, jeśli dotyczy tego samego miejsca; inaczej zostaje w ledgerze.

## Inspiracje na później (nie w B2)

- Ukrywanie pochodzenia (dokument fabularny): pancerz i broń ze szkoły mogą zdradzać bohatera przed cesarskimi zwiadowcami – np. tag przedmiotu `"marked": "szkola"` sprawdzany w dialogach i spotkaniach (C/D). Format przedmiotu w B2 nie blokuje dopisania takiego pola.
- Proch z wyspy rzemieślników jako towar „podejrzany” u kupców (dialog przykładowy) – warunki sklepu / dialogu w C.

## Kryterium ukończenia

Wszystkie testy zielone (`npm test`), `node bin/game.js --validate` bez błędów, demo przechodzi skryptem dla obu klas, a w prawdziwym terminalu obóz, ekwipunek i sklep działają strzałkami i skrótami literowymi.
