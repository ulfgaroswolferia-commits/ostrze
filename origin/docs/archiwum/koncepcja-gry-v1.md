# Koncepcja gry: tekstowe RPG w terminalu (robocza nazwa: `nazwa-gry`)

> Dokument dla Claude Code. Opisuje koncepcję, architekturę, formaty danych i kolejność implementacji.
> Nazwa gry jest robocza. Wszędzie, gdzie występuje `nazwa-gry`, użyj jednej stałej/konfiguracji, żeby łatwo ją zmienić.

---

## 1. Założenia ogólne

- **Gatunek:** tekstowe RPG z mechaniką w stylu klasycznych Falloutów (atrybuty, umiejętności, perki, walka turowa z punktami akcji, dialogi z testami umiejętności).
- **Platforma:** terminal. Gra instalowana jako pakiet npm (`npm install -g nazwa-gry`) i uruchamiana poleceniem `nazwa-gry`.
- **Prezentacja:** tekstowa (opisy + wybór numerowanych opcji). Podczas walki wyświetlana prosta grafika ASCII przeciwnika z paskami stanu.
- **Fabuła MVP:** krótka, liniowa historia (prolog + 3 akty), której celem jest przetestowanie i dopracowanie wszystkich mechanik.
- **Zasada nadrzędna:** treść gry oddzielona od silnika. Przedmioty, przeciwnicy, efekty, dialogi, zjawiska i fabuła są w plikach JSON w `data/`. Silnik tylko je interpretuje. Rozbudowa gry = dopisywanie danych, nie kodu.

### Świat

Własny, oryginalny świat (inspirowany klimatem polskiej fantastyki, ale **bez imion, miejsc, postaci i wątków z istniejących książek**):

- surowe, późne średniowiecze; dominuje miecz, włócznia, łuk i kusza,
- stopniowo wchodzi prymitywna broń palna (rusznice, pistolety skałkowe): potężna, ale zawodna i rzadka,
- historia przesycona mistycyzmem i fantastyką naukową,
- **upiory**: istoty uznawane za demony, w rzeczywistości obcy o technologicznym pochodzeniu. Łamią zwykłe zasady walki (odporności, słabości, nietypowe zdolności),
- **artefakty** czerpiące „energię świata”, ładowane z upływem czasu i podczas zjawisk naturalnych.

---

## 2. Stos technologiczny

- **Node.js 18+**, czysty **JavaScript, moduły ES** (`"type": "module"`), typy opisane w **JSDoc** (bez TypeScriptu i bez kroku kompilacji).
- Zależności ograniczone do minimum:
  - `chalk` – kolory w terminalu,
  - wbudowany `readline` – wejście z klawiatury.
- Brak frameworków TUI na etapie MVP.
- Zapisy gry: JSON w katalogu użytkownika `~/.nazwa-gry/saves/` (użyj `os.homedir()`, działa na Windows/macOS/Linux).
- Testy: wbudowany `node:test` (bez dodatkowych bibliotek).

---

## 3. Struktura projektu

```
nazwa-gry/
├─ package.json          # "type": "module", "bin": { "nazwa-gry": "bin/game.js" }, "engines": { "node": ">=18" }
├─ README.md
├─ bin/
│  └─ game.js            # punkt wejścia (#!/usr/bin/env node), menu główne
├─ src/
│  ├─ config.js          # nazwa gry, ścieżki, wersja formatu zapisu
│  ├─ engine/
│  │  ├─ state.js        # tworzenie i struktura stanu gry
│  │  ├─ loop.js         # główna pętla scen
│  │  ├─ dice.js         # RNG z ziarnem, testy procentowe, losowanie z zakresu
│  │  ├─ time.js         # zegar świata, advanceTime(), pora doby
│  │  ├─ events.js       # prosta szyna zdarzeń (silnik → UI)
│  │  ├─ data.js         # ładowanie i walidacja plików z data/
│  │  └─ save.js         # zapis/odczyt, wersjonowanie formatu
│  ├─ systems/
│  │  ├─ character.js    # kreator postaci, getStats(), awans, perki
│  │  ├─ checks.js       # testy umiejętności i atrybutów
│  │  ├─ combat.js       # walka turowa z PA
│  │  ├─ effects.js      # efekty statusu (nakładanie, tyknięcia, wygasanie)
│  │  ├─ inventory.js    # ekwipunek, waga, sloty, pas szybkiego dostępu
│  │  ├─ artifacts.js    # ładunek, regeneracja, zdolności artefaktów
│  │  ├─ phenomena.js    # zjawiska naturalne (zapowiedź, przebieg, koniec)
│  │  └─ dialogue.js     # drzewka dialogów z warunkami i testami
│  └─ ui/
│     ├─ screen.js       # czyszczenie ekranu, ramki, paski, pasek stanu
│     ├─ prompt.js       # wybór numerowanej opcji, potwierdzenia
│     ├─ ascii.js        # wczytywanie i kolorowanie grafik ASCII
│     └─ text.js         # zawijanie tekstu do szerokości terminala
├─ data/
│  ├─ rules.json         # stałe i parametry formuł
│  ├─ attributes.json
│  ├─ skills.json
│  ├─ perks.json
│  ├─ effects.json
│  ├─ items.json         # broń, pancerz, przedmioty do rzucania, mikstury, artefakty
│  ├─ enemies.json
│  ├─ phenomena.json
│  ├─ story.json         # liniowa lista scen
│  ├─ dialogues/         # jeden plik JSON na rozmowę
│  └─ art/               # grafiki ASCII przeciwników (.txt)
└─ test/
```

### Zasady architektury

1. **Silnik nie wypisuje nic bezpośrednio na ekran.** Systemy zwracają wyniki / emitują zdarzenia, a warstwa `ui/` je prezentuje. Dzięki temu logikę da się testować bez terminala.
2. **Atrybuty bazowe postaci nigdy nie są nadpisywane.** Funkcja `getStats(character, state)` zawsze składa wynik na bieżąco: baza + wyposażenie + aktywne efekty + pasywne efekty artefaktów + pora doby / zjawiska.
3. **Cała losowość przez `dice.js`** z generatorem z ziarnem (np. mulberry32). Ziarno i stan generatora są częścią zapisu gry.
4. **Walidacja danych przy starcie:** `data.js` sprawdza, czy wszystkie odwołania (`id` przedmiotów, efektów, węzłów dialogu, grafik) istnieją. Błąd danych = czytelny komunikat z nazwą pliku i `id`.
5. **Zapis gry ma pole `version`**, żeby w przyszłości móc migrować stare zapisy.

---

## 4. Postać

### Atrybuty (1–10, w kreatorze pula punktów do rozdzielenia, start po 5)

| id | Atrybut | Wpływ |
|---|---|---|
| `sila` | Siła | obrażenia w zwarciu, udźwig, napinanie kuszy |
| `zrecznosc` | Zręczność | trafienie, uniki, punkty akcji, miotanie |
| `krzepa` | Krzepa | punkty życia, odporność na rany, trucizny, ogłuszenie |
| `bystrosc` | Bystrość | celność na dystans, wykrywanie zasadzek, odporność na rozkojarzenie |
| `rozum` | Rozum | punkty umiejętności przy awansie, wiedza, rzemiosło |
| `oglada` | Ogłada | dialogi, handel, przekonywanie |
| `fart` | Fart | trafienia krytyczne, niewypały (swoje i wroga) |

### Umiejętności (0–100%)

| id | Umiejętność | Atrybut główny + pomocniczy |
|---|---|---|
| `sieczna` | Broń sieczna | sila + zrecznosc |
| `drzewcowa` | Broń drzewcowa | sila + zrecznosc |
| `strzelecka` | Łuk i kusza | bystrosc + zrecznosc |
| `proch` | Broń palna | bystrosc + rozum |
| `wrecz` | Walka wręcz | sila + krzepa |
| `miotanie` | Miotanie | zrecznosc + bystrosc |
| `medycyna` | Medycyna | rozum + bystrosc |
| `skradanie` | Skradanie | zrecznosc + bystrosc |
| `wymowa` | Wymowa | oglada + rozum |
| `handel` | Handel | oglada + rozum |
| `wiedza_tajemna` | Wiedza tajemna | rozum + fart |

- Wartość bazowa: `2 × atrybut główny + atrybut pomocniczy`.
- W kreatorze gracz wybiera 2–3 **umiejętności wiodące** (np. +20% i szybszy rozwój).
- Przy awansie: punkty umiejętności `= 5 + 2 × rozum`.

### Pochodne

- Punkty życia: `20 + 3 × krzepa + 2 × poziom × krzepa / 5` (do dostrojenia w `rules.json`).
- Punkty akcji (PA): `5 + floor(zrecznosc / 2)`.
- Udźwig: `25 + 10 × sila` (kg).
- Obrona bazowa: `zrecznosc × 2`.

### Perki

Co 3 poziomy wybór jednego perka z listy w `perks.json` (z wymaganiami atrybutów/umiejętności). Perk to zestaw modyfikatorów lub flaga odblokowująca akcję. Na MVP wystarczy 5–8 perków.

---

## 5. Przedmioty

Wspólne pola: `id`, `name`, `type`, `weight`, `value`, `description`.

### 5.1 Broń

Typy obrażeń: `sieczne`, `klute`, `obuchowe`, `ogien`, `proch`.

```json
{
  "id": "kusza_lekka",
  "name": "Lekka kusza",
  "type": "weapon",
  "skill": "strzelecka",
  "damageType": "klute",
  "damage": [8, 14],
  "apCost": 5,
  "reload": { "apCost": 4, "ammo": "belt" },
  "armorPierce": 3,
  "range": "far",
  "minStrength": 4,
  "weight": 4,
  "value": 60
}
```

Charakter broni (ma wynikać z danych, nie z wyjątków w kodzie):

- **Miecz:** szybki (2–3 PA), niezawodny, tylko zwarcie.
- **Włócznia:** zasięg; darmowy atak na wroga, który się zbliża (`"reach": true`); kara w ciasnych miejscach.
- **Kusza:** duże obrażenia i przebicie, przeładowanie prawie na całą turę.
- **Broń palna:** bardzo duże obrażenia i przebicie, dodatkowe pola:
  ```json
  { "misfireChance": 15, "burstChance": 2, "noise": 3, "fear": 20 }
  ```
  `misfireChance` – niewypał (zmniejszany przez `fart` i umiejętność), `burstChance` – rozerwanie lufy, `noise` – szansa ściągnięcia posiłków, `fear` – spadek morale wroga. Proch jest rzadki i drogi.

### 5.2 Pancerz i wyposażenie

**Sloty:** `glowa`, `tulow`, `rece`, `nogi`, `plaszcz`, `talizman`, `pas`.

```json
{
  "id": "kaftan_przeszywany",
  "name": "Kaftan przeszywany",
  "type": "armor",
  "slot": "tulow",
  "armor": 2,
  "reduction": { "sieczne": 15, "obuchowe": 20, "klute": 5 },
  "modifiers": { "skradanie": -5 },
  "weight": 5,
  "value": 40
}
```

- `armor` – płaska redukcja obrażeń,
- `reduction` – procentowa redukcja per typ obrażeń (sumowana ze wszystkich slotów, **maksymalnie 75%**),
- `modifiers` – dowolne modyfikatory atrybutów, umiejętności, PA, obrony, odporności na efekty (`"resist_oslepienie": 20`),
- **pas** określa liczbę miejsc szybkiego dostępu (`"quickSlots": 2`). W walce można użyć tylko przedmiotów z pasa; sięgnięcie do torby kosztuje dodatkowe PA.

Przykłady na MVP:

| Przedmiot | Slot | Działanie |
|---|---|---|
| Kaftan przeszywany | tułów | −15% siecznych, −20% obuchowych, −5 skradanie |
| Kolczuga | tułów | −30% siecznych, −10% kłutych, −1 PA, −20 skradanie |
| Rękawice łucznicze | ręce | +10 strzelecka |
| Kaptur myśliwego | głowa | +1 bystrosc, odporność na oślepienie +20 |
| Pas z ładownicami | pas | 4 miejsca szybkiego dostępu (zwykły pas: 2) |
| Talizman z odłamka | talizman | −30% czasu efektu strachu od upiorów |

### 5.3 Przedmioty do rzucania (`throwable`)

```json
{
  "id": "puszka_szerszeni",
  "name": "Puszka z szerszeniami",
  "type": "throwable",
  "skill": "miotanie",
  "apCost": 3,
  "target": "single",
  "effects": [{ "id": "rozkojarzenie", "chance": 90 }],
  "weight": 1,
  "value": 15,
  "description": "Gliniana puszka zatkana szmatą. Lepiej nie potrząsać."
}
```

`target`: `single`, `single_splash` (cel + sąsiedzi), `all_enemies`, `battlefield`.

Chybienie: efekt działa słabiej (krótszy czas / mniejsza szansa) albo wcale. Krytyczna porażka (rzut ≥ 96): efekt trafia rzucającego.

Zestaw na MVP:

| id | Przedmiot | Cel | Efekt |
|---|---|---|---|
| `garniec_wapno` | Garniec z wapnem | single | oślepienie 2 tury |
| `proch_blyskowy` | Proch błyskowy | all_enemies | oślepienie 1 tura (rzadki) |
| `garnek_huku` | Garnek huku | single_splash | ogłuszenie 1 tura, hałas |
| `swieca_dymna` | Świeca dymna | battlefield | zadymienie 3 tury |
| `puszka_szerszeni` | Puszka z szerszeniami | single | rozkojarzenie 3 tury |
| `flasza_olej` | Flasza z olejem | single | podpalenie |

### 5.4 Mikstury i środki (`consumable`)

Leczenie, opatrunki (zatrzymują krwawienie), odtrutki. Format jak `throwable`, z `target: "self"` i polem `heal`.

---

## 6. Efekty statusu (`data/effects.json`)

Każdy efekt zdefiniowany raz; przedmioty, ataki i zjawiska odwołują się do niego przez `id`.

```json
{
  "oslepienie": {
    "name": "Oślepiony",
    "duration": 2,
    "unit": "turn",
    "modifiers": { "hitChance": -40, "defense": -10 },
    "resist": "krzepa",
    "stack": "refresh"
  },
  "ogluszenie": {
    "name": "Ogłuszony",
    "duration": 1,
    "unit": "turn",
    "modifiers": { "ap": -4 },
    "resist": "krzepa",
    "stack": "refresh"
  },
  "rozkojarzenie": {
    "name": "Rozkojarzony",
    "duration": 3,
    "unit": "turn",
    "modifiers": { "hitChance": -20, "defense": -15 },
    "tick": { "loseApChance": 30, "loseAp": 2 },
    "resist": "bystrosc",
    "stack": "extend"
  },
  "zadymienie": {
    "name": "W dymie",
    "duration": 3,
    "unit": "turn",
    "scope": "battlefield",
    "modifiers": { "rangedHitChance": -35, "fleeChance": 40 }
  },
  "podpalenie": {
    "name": "Płonie",
    "duration": 2,
    "unit": "turn",
    "tick": { "damage": [3, 6], "damageType": "ogien" },
    "stack": "refresh"
  },
  "krwawienie": {
    "name": "Krwawi",
    "duration": 3,
    "unit": "turn",
    "tick": { "damage": [1, 3] },
    "stack": "stack"
  },
  "strach": {
    "name": "Przerażony",
    "duration": 2,
    "unit": "turn",
    "modifiers": { "hitChance": -15, "ap": -1 },
    "resist": "krzepa",
    "stack": "refresh"
  }
}
```

- `unit`: `turn` (walka) albo `hour` (poza walką, np. trucizna, zmęczenie).
- `resist`: przy nałożeniu cel wykonuje test atrybutu (`atrybut × 5 + odporność z wyposażenia`). Sukces anuluje efekt albo skraca go o 1 jednostkę (do ustalenia w `rules.json`).
- `stack`: `refresh` (odnów czas), `extend` (+1 jednostka), `stack` (kumuluj siłę, limit w `maxStacks`).
- `tick`: działanie na początku tury/godziny celu.
- `scope: "battlefield"`: działa na **wszystkich** uczestników walki (dym utrudnia strzelanie także graczowi).
- Przeciwnicy mogą mieć `immune: ["oslepienie"]` (np. upiory nie widzą oczami) i zwiększoną podatność na inne efekty.

---

## 7. Walka

Turowa, z punktami akcji.

### Przebieg

1. Inicjatywa: `zrecznosc + bystrosc + k10` – kolejność na całą walkę.
2. Tura uczestnika: odnowienie PA → tyknięcie efektów → akcje, dopóki starcza PA lub gracz kończy turę.
3. Koniec walki: wszyscy wrogowie pokonani / ucieczka udana / gracz pokonany (ekran porażki, powrót do ostatniego zapisu).

### Akcje gracza

| Akcja | Koszt PA |
|---|---|
| Atak bronią | z danych broni |
| Celowany atak (głowa / tułów / kończyny) | koszt broni + 1, kara do trafienia, bonusy (głowa: krytyk i szansa ogłuszenia; nogi: spowolnienie) |
| Przeładowanie | z danych broni |
| Użycie przedmiotu z pasa | z danych przedmiotu |
| Użycie przedmiotu z torby | koszt przedmiotu + 2 |
| Zdolność artefaktu | z danych zdolności |
| Zmiana broni | 2 |
| Obrona (do następnej tury +obrona) | pozostałe PA, min. 2 |
| Ucieczka | 4, test zależny od Zręczności i efektów (`fleeChance`) |

### Formuły (parametry w `rules.json`)

```
szansa_trafienia = umiejętność − obrona_celu + modyfikatory   (ograniczona do 5–95%)

obrażenia = losuj(zakres broni)
            [+ bonus siły dla zwarcia]
            − max(0, pancerz_celu − przebicie_broni)
            × (1 − redukcja%_celu_dla_typu / 100)         (redukcja max 75%)
            × mnożnik odporności/słabości celu              (resist / weak)
            (minimum 1 przy trafieniu)

krytyk: szansa = fart (%) + bonusy; obrażenia × 1.5
```

Morale wroga: wartość 0–100. Spada od `fear` broni palnej, efektu `strach` i śmierci towarzyszy. Poniżej progu wróg próbuje uciec lub się poddaje (upiory mogą nie mieć morale).

### Ekran walki

```
        .-"""-.
       /  o o  \        UPIÓR
      |   ___   |       Życie: ██████████░░░░  71%   [Rozkojarzony 2] [Płonie 1]
       \  \_/  /
     /`'-----'`\
    /  |  |  |  \

  Dzień 3, zmierzch     Kamień Zmierzchu: ███████░░░ 68%
  Ty: ████████████░░ 34/40 ŻYC   PA: ●●●●●○ (5/6)   [W dymie 2]
  Broń: kusza [naładowana]
  Pas: [1] Garniec z wapnem  [2] Świeca dymna  [3] —

  [1] Strzał z kuszy (5 PA)     [4] Użyj przedmiotu
  [2] Celowany strzał (6 PA)    [5] Artefakt
  [3] Przeładuj (4 PA)          [6] Koniec tury
```

Grafiki w `data/art/<id>.txt`, maksymalna szerokość 40 znaków. Ekran walki ma się mieścić w terminalu 80×24.

---

## 8. Przeciwnicy (`data/enemies.json`)

```json
{
  "id": "upior_zwiadowca",
  "name": "Upiór",
  "art": "upior_zwiadowca.txt",
  "hp": 45,
  "ap": 6,
  "initiative": 8,
  "defense": 20,
  "armor": 6,
  "reduction": {},
  "resist": { "sieczne": 0.5, "drzewcowa": 0.5, "klute": 0.5 },
  "weak": { "ogien": 2.0 },
  "immune": ["oslepienie", "rozkojarzenie"],
  "morale": null,
  "attacks": [
    { "name": "Szpon", "damage": [6, 10], "damageType": "sieczne", "apCost": 3, "hit": 65,
      "effects": [{ "id": "krwawienie", "chance": 30 }] },
    { "name": "Wycie", "apCost": 4, "target": "all_enemies",
      "effects": [{ "id": "strach", "chance": 60 }] }
  ],
  "ai": "aggressive",
  "loot": [{ "id": "dziwny_odlamek", "chance": 1.0 }],
  "xp": 150
}
```

Proste AI na MVP (`ai`): `aggressive` (atakuj najsłabszego / najbliższego), `cautious` (ucieka przy niskim HP lub morale), `ranged` (utrzymuje dystans, przeładowuje). Wybór ataku: najlepszy, na który starcza PA, z lekką losowością.

---

## 9. Czas świata

### Zegar

- `state.time.minutes` – minuty od początku gry. Dzień, godzina i pora doby są wyliczane.
- Pory doby: `swit` (5–7), `dzien` (7–18), `zmierzch` (18–20), `noc` (20–5).
- Każda czynność przesuwa czas przez **jedną funkcję** `advanceTime(state, minutes)`:

| Czynność | Czas |
|---|---|
| Rozmowa | 5–15 min |
| Przeszukanie | 15–30 min |
| Walka (cała) | ok. 10 min |
| Podróż | wg sceny (godziny) |
| Odpoczynek / sen | wybór gracza (1–8 h), regeneracja HP |

Sceny w `story.json` mogą mieć pole `"time"` (minuty), dodawane po ich zakończeniu.

### Wpływ pory doby

- Noc: −15 do `bystrosc`-zależnych testów bez źródła światła, +10 skradanie, upiory aktywniejsze (modyfikatory w `rules.json`).
- Część zjawisk występuje tylko o określonej porze.

### `advanceTime` (pseudokod)

```
advanceTime(state, minutes):
  przetwarzaj po jednej pełnej godzinie (reszta minut na końcu):
    phenomena.update(state)          # zapowiedź / start / koniec zjawisk
    artifacts.regenerate(state, 1h)  # bazowo × warunki × zjawisko
    effects.tickHourly(state)        # efekty z unit: "hour"
  zaktualizuj porę doby
  emituj zdarzenia: "zmiana_pory", "zapowiedz_zjawiska", "artefakt_naladowany" itd.
```

Przetwarzanie godzina po godzinie jest wymagane, żeby np. 8-godzinny sen poprawnie „przeżył” burzę w środku nocy.

---

## 10. Artefakty

```json
{
  "id": "kamien_zmierzchu",
  "name": "Kamień Zmierzchu",
  "type": "artifact",
  "slot": "talizman",
  "charge": { "max": 100, "start": 40 },
  "regen": {
    "perHour": 4,
    "conditions": [
      { "when": "night", "multiplier": 2 },
      { "when": "near_upior", "multiplier": 0 }
    ],
    "requiresExposure": false
  },
  "passive": [
    { "minCharge": 75, "modifiers": { "bystrosc": 1 } }
  ],
  "abilities": [
    {
      "name": "Płonące ostrze",
      "cost": { "type": "percent", "value": 50 },
      "apCost": 2,
      "effect": { "id": "ostrze_ognia", "target": "self", "duration": 3 }
    },
    {
      "name": "Zasłona Zmierzchu",
      "cost": { "type": "all" },
      "requiresFull": true,
      "apCost": 4,
      "effect": { "id": "zaslona", "target": "self", "duration": 3 }
    }
  ],
  "whenEmpty": { "usable": true, "costHp": 10, "text": "Kamień pije z ciebie." }
}
```

- **Koszt zdolności:** `fixed` (stała wartość), `percent` (procent maksimum, np. połowa), `all` (całość). `requiresFull` – zdolność dostępna tylko przy pełnym ładunku.
- **Pasywne efekty** zależne od poziomu ładunku – gracz musi decydować, czy zużyć artefakt, czy utrzymać bonus.
- **Warunki regeneracji** (`when`): `night`, `day`, `near_upior`, `phenomenon:<id>`, `in_combat` itd. Mnożniki się mnożą.
- **`requiresExposure`**: artefakt ładuje się tylko wystawiony (nie w sakwie).
- **Użycie na pusto** (`whenEmpty`): możliwe kosztem HP lub innego zasobu.
- Ładunek przechowywany w stanie jako liczba zmiennoprzecinkowa, wyświetlany jako pasek i procent.
- Potrzebne efekty `ostrze_ognia` (broń zadaje dodatkowe obrażenia typu `ogien`) i `zaslona` (redukcja obrażeń) – dodać do `effects.json`.

---

## 11. Zjawiska naturalne (`data/phenomena.json`)

```json
{
  "id": "burza_iskier",
  "name": "Iskrząca Burza",
  "omen": { "hoursBefore": 2, "text": "Powietrze gęstnieje, włosy stają dęba." },
  "duration": [2, 4],
  "timeOfDay": null,
  "frequency": { "chancePerDay": 15 },
  "onArtifacts": { "exposed": "full", "carried": { "multiplier": 3 } },
  "world": { "visibility": -20, "travel": "dangerous" }
}
```

- **Zapowiedź** (`omen`) pojawia się `hoursBefore` godzin przed startem – gracz może się przygotować.
- **Artefakty podczas zjawiska:** `exposed: "full"` – artefakt wystawiony ładuje się natychmiast do pełna; `carried` – noszony ładuje się szybciej.
- **Wystawienie artefaktów** to akcja gracza w trakcie odpoczynku; niesie ryzyko (losowe zdarzenie: istoty burzy, złodziej).
- Zjawiska losowane raz na dobę (RNG z ziarnem) albo **wymuszane przez scenę fabularną** (`{ "type": "phenomenon", "id": "burza_iskier" }`).

Zjawiska na MVP:

| id | Nazwa | Działanie |
|---|---|---|
| `burza_iskier` | Iskrząca Burza | ładuje artefakty, gorsza widoczność |
| `noc_bez_gwiazd` | Noc Bez Gwiazd | tylko w nocy; artefakty tracą ładunek, upiory silniejsze |
| `mgla_ciszy` | Mgła Ciszy | broń palna bezużyteczna (wilgotny proch), +20 skradanie |

---

## 12. Dialogi (`data/dialogues/<id>.json`)

```json
{
  "id": "soltys",
  "start": "soltys_01",
  "nodes": {
    "soltys_01": {
      "speaker": "Sołtys",
      "text": "Nic tu nie widziałem i nikomu nic nie powiem.",
      "options": [
        { "text": "Rozumiem. Bywaj.", "goto": "end" },
        {
          "text": "Ludzie giną, a ty milczysz?",
          "check": { "skill": "wymowa", "difficulty": 40 },
          "success": "soltys_02_prawda",
          "failure": "soltys_02_obraza"
        },
        {
          "text": "Pokaż odłamek",
          "requires": { "item": "dziwny_odlamek" },
          "goto": "soltys_03_strach"
        }
      ]
    }
  }
}
```

- `requires`: opcja widoczna tylko, gdy warunek jest spełniony (`item`, `flag`, `notFlag`, `attribute`, `skill`, `timeOfDay`).
- `check`: test umiejętności lub atrybutu; w UI wyświetlany wprost, np. `[Wymowa 40]`. Wynik testu: `umiejętność − trudność + 50` jako szansa w %, ograniczona do 5–95 (do dostrojenia).
- Węzeł może mieć `actions`: `giveItem`, `takeItem`, `setFlag`, `xp`, `startCombat`, `time`.
- `goto: "end"` kończy rozmowę.
- Wynik testu raz nieudanego w danej opcji jest zapamiętywany (nie da się powtarzać do skutku).

---

## 13. Fabuła liniowa (`data/story.json`)

Lista scen wykonywanych po kolei przez `loop.js`.

```json
[
  { "type": "narration", "text": "Świt nad strażnicą...", "time": 0 },
  { "type": "character_creation" },
  { "type": "dialogue", "id": "dowodca_odprawa" },
  { "type": "combat", "enemies": ["bandyta", "bandyta"], "intro": "Z zarośli wyskakują dwaj ludzie." },
  { "type": "reward", "xp": 100, "items": ["kusza_lekka"] },
  { "type": "rest", "allowExposure": true },
  { "type": "phenomenon", "id": "burza_iskier" },
  { "type": "flag", "set": "akt1_ukonczony" },
  { "type": "save_point" }
]
```

Typy scen na MVP: `narration`, `character_creation`, `dialogue`, `combat`, `reward`, `shop`, `rest`, `phenomenon`, `flag`, `save_point`, `ending`.

W przyszłości (poza MVP): sceny warunkowe (`"if": { "flag": ... }`) i rozgałęzienia – format ma to umożliwiać bez przebudowy silnika.

### Zarys historii MVP

Wszystkie imiona i nazwy miejsc wymyślić od nowa (oryginalne, w klimacie słowiańsko-średniowiecznym).

1. **Prolog – strażnica przygraniczna:** gracz jako młody rekrut. Kreator postaci, odprawa u dowódcy (pierwszy dialog), wydanie ekwipunku.
2. **Akt I – patrol:** walka z bandytami (miecz, włócznia), pierwszy test umiejętności w rozmowie z pojmanym, nagroda: kusza.
3. **Akt II – spalona wieś:** ślady istoty, która nie jest człowiekiem. Rozmowa z sołtysem (testy, przedmiot odblokowujący opcję), handel, medycyna, zdobycie przedmiotów do rzucania i artefaktu (Kamień Zmierzchu). Odpoczynek z zapowiedzią burzy – okazja do naładowania artefaktu.
4. **Akt III – upiór:** walka, w której zwykła broń zawodzi (odporności); wygrywa wykorzystanie wiedzy z aktu II (ogień, artefakt, ogłuszenie). Zakończenie otwierające dalszą historię.

Cel: przetestować kreator, dialogi z testami, walkę z PA, efekty statusu, ekwipunek i sloty, artefakty, czas i zjawiska, zapis gry oraz awans.

---

## 14. Stan gry i zapis

```js
/** @typedef {Object} GameState */
{
  version: 1,
  seed: 123456,
  rngState: 123456,
  time: { minutes: 0 },
  scene: { index: 0 },
  flags: { akt1_ukonczony: false },
  character: {
    name: "...",
    level: 1, xp: 0,
    attributes: { sila: 5, ... },          // wartości bazowe – nigdy nie modyfikowane przez ekwipunek/efekty
    skills: { sieczna: 15, ... },          // wartości bazowe + rozdane punkty
    tagged: ["sieczna", "wymowa"],
    perks: [],
    hp: 40,
    effects: [{ id: "krwawienie", remaining: 2, stacks: 1 }]
  },
  inventory: {
    items: [{ id: "garniec_wapno", qty: 2 }],
    equipped: { tulow: "kaftan_przeszywany", talizman: "kamien_zmierzchu", pas: "pas_zwykly" },
    quickSlots: ["garniec_wapno", "swieca_dymna"],
    artifacts: { kamien_zmierzchu: { charge: 40, exposed: false } }
  },
  world: {
    activePhenomenon: null,          // { id, endsAt }
    pendingPhenomenon: null,         // { id, startsAt }
    failedChecks: ["soltys_01:1"]
  }
}
```

- Zapis: `~/.nazwa-gry/saves/<slot>.json`. Autozapis na scenach `save_point` + ręczny zapis z menu poza walką.
- Menu główne: Nowa gra / Wczytaj / Wyjście.

---

## 15. Interfejs

- Teksty zawijane do szerokości terminala (`process.stdout.columns`, domyślnie 80).
- Wybór opcji przez wpisanie numeru i Enter (prosto i niezawodnie na wszystkich systemach, w tym Windows).
- Kolory (`chalk`): obrażenia czerwone, leczenie zielone, testy umiejętności żółte, mistyczne/artefakty fioletowe, narracja domyślna.
- Pasek stanu na każdym ekranie poza menu: dzień, pora doby, godzina, ewentualna zapowiedź zjawiska, ładunek założonych artefaktów.
- Ekran postaci (statystyki pochodne z `getStats` – pokazać bazę i modyfikatory), ekran ekwipunku (zakładanie/zdejmowanie, przypisanie do pasa) – dostępne poza walką.
- Obsługa Ctrl+C: czyste wyjście z pytaniem o zapis.

---

## 16. Kolejność implementacji

Każdy etap kończy się działającą grą i testami logiki (`node:test`).

1. **Szkielet:** `package.json` z `bin`, `bin/game.js`, menu główne, `config.js`, `npm link` uruchamia grę.
2. **Dane i RNG:** `data.js` (ładowanie + walidacja odwołań), `dice.js` z ziarnem.
3. **Pętla scen:** `loop.js`, sceny `narration`, `flag`, `ending`; UI: `screen.js`, `prompt.js`, `text.js`.
4. **Postać:** kreator, `getStats()`, ekran postaci.
5. **Ekwipunek:** sloty, modyfikatory, pas, ekran ekwipunku, scena `reward` i `shop`.
6. **Dialogi:** drzewka, warunki, testy, akcje.
7. **Efekty statusu:** `effects.js` (nakładanie, odporność, kumulacja, tyknięcia).
8. **Walka:** inicjatywa, PA, ataki, przeładowanie, celowanie, przedmioty do rzucania, AI, morale, ekran ASCII.
9. **Czas:** `time.js`, `advanceTime`, pory doby, scena `rest`, pasek stanu.
10. **Artefakty i zjawiska:** ładunek, regeneracja, zdolności, pasywy, zapowiedzi, wystawianie.
11. **Zapis/odczyt** i autozapis.
12. **Treść MVP:** pełny prolog i 3 akty, grafiki ASCII, balans liczb w `rules.json`.
13. **Publikacja:** README (instalacja, sterowanie), `files` w `package.json`, test `npm pack`.

---

## 17. Konwencje

- Kod i nazwy techniczne po angielsku, treść gry i identyfikatory danych (`id`) po polsku bez znaków diakrytycznych (`kamien_zmierzchu`).
- Teksty wyświetlane graczowi wyłącznie w `data/` (lub w jednym pliku tekstów UI), nie rozsiane po kodzie.
- Funkcje systemów czyste tam, gdzie to możliwe: przyjmują stan i zwracają wynik/zdarzenia.
- Wszystkie liczby balansu (koszty, mnożniki, limity) w `rules.json`, nie w kodzie.

---

## 18. Otwarte kwestie (do ustalenia później)

- Ostateczna nazwa gry i nazwa pakietu npm.
- Nazwa świata, krain, frakcji i postaci.
- Lista perków i ich efekty.
- System reputacji / karmy (poza MVP).
- Nieliniowa fabuła i swobodna eksploracja (poza MVP).
- Rzemiosło (np. własnoręczne robienie bomb i prochu) – poza MVP.
