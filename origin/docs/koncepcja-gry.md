# Koncepcja gry: Ostrze Gwiazd – tekstowe RPG w terminalu

> Dokument dla Claude Code. Opisuje koncepcję, architekturę, formaty danych i kolejność implementacji.
> Tytuł koncepcyjny: **Ostrze Gwiazd** – bohater jest ostrzem (narzędziem) w rękach istot z gwiazd, a sam włada ostrzem: mieczem albo parą włóczni. Nazwa techniczna (pakiet, polecenie, katalog zapisów) pozostaje `ostrze` do publikacji. Wszędzie, gdzie w tym dokumencie występuje `nazwa-gry`, chodzi o jedną stałą w `src/config.js`, żeby łatwo ją zmienić.
> Wersja dokumentu: **2** (poprzednia w `docs/archiwum/koncepcja-gry-v1.md`, lista zmian w rozdziale 19).

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

### Styl i ton

- **Dialogi w stylu słowiańskim:** rubaszne, dosadne, często okraszone **żartem – zazwyczaj prostackim** (docinki, przytyki, sprośności karczemne, złośliwości o wyglądzie, gębie i rozumie rozmówcy). Humor ma rozładowywać ponury świat, a nie go zastępować – im groźniej, tym krócej żartują.
- Każda postać mówi „po swojemu”: instruktor w szkole ostrza – szorstko i wojskowo, kramarz – przymilnie i chytrze, pielgrzym – przysłowiami, możni – wyniośle (i łatwo ich ośmieszyć).
- Archaizacja lekka, bez przesady: pojedyncze słowa i zwroty dla klimatu (*waść, ninie, juści, bywaj*), składnia współczesna – tekst ma się czytać szybko w terminalu.
- **Nazewnictwo:** połączenie **nordyckiego i słowiańskiego** – imiona i nazwy miejsc łączą człony z obu tradycji (np. nordycki rdzeń + słowiańska końcówka: *Thorgniew, Ragnosław, Hjalmirad*, miejsca: *Ulfgród, Skjeldowo*). Przykłady są tylko ilustracją stylu – ostateczne nazwy ustala cykl E. Nadal obowiązuje zakaz imion, miejsc i postaci z istniejących książek.
- Identyfikatory w danych (`id`) pozostają po polsku bez diakrytyków; nazwy własne w nich zapisujemy uproszczonym zapisem (`thorgniew`, `ulfgrod`).

---

## 2. Stos technologiczny

- **Node.js 22+** (Node 18 i 20 nie są już wspierane), czysty **JavaScript, moduły ES** (`"type": "module"`), typy opisane w **JSDoc** (bez TypeScriptu i bez kroku kompilacji).
- **Zero zależności runtime:**
  - kolory: wbudowany `util.styleText` (respektuje `NO_COLOR` i brak TTY), opakowany w `src/ui/colors.js`, żeby dało się go podmienić,
  - wejście: wbudowany `node:readline/promises`.
- Brak frameworków TUI na etapie MVP.
- Zapisy gry: JSON w katalogu użytkownika `~/.nazwa-gry/saves/` (użyj `os.homedir()`, działa na Windows/macOS/Linux). Katalog można nadpisać zmienną `NAZWA_GRY_HOME` (testy, wiele profili).
- Testy: wbudowany `node:test` (bez dodatkowych bibliotek), uruchamiane `npm test`.
- **Wejście/wyjście za interfejsem `io`** (`{ write(text), ask(question) }`). Gra produkcyjnie używa terminala, testy podają skrypt odpowiedzi (`createScriptedIO(["1", "2", ...])`) i sprawdzają wyjście. Dzięki temu da się testować całe sceny i fabułę end-to-end.
- Flagi uruchomienia (do testowania treści): `--seed <n>`, `--scene <id>` (start od wskazanej sceny), `--debug` (pokazuje rzuty kośćmi i szanse), `--validate` (tylko sprawdza dane i kończy).

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
│  │  ├─ conditions.js   # wspólne warunki (if w scenach, requires w dialogach)
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
│     ├─ colors.js       # opakowanie util.styleText, semantyczne kolory (damage, heal, check...)
│     ├─ io.js           # terminalowe i skryptowe (testowe) wejście/wyjście
│     └─ text.js         # zawijanie tekstu do szerokości terminala
├─ data/
│  ├─ ui.json            # wszystkie teksty interfejsu (menu, komunikaty, etykiety)
│  ├─ rules.json         # stałe i parametry formuł
│  ├─ attributes.json
│  ├─ skills.json
│  ├─ perks.json
│  ├─ effects.json
│  ├─ items.json         # broń, pancerz, przedmioty do rzucania, mikstury, artefakty
│  ├─ enemies.json
│  ├─ phenomena.json
│  ├─ shops.json
│  ├─ story.json         # liniowa lista scen
│  ├─ dialogues/         # jeden plik JSON na rozmowę
│  └─ art/               # grafiki ASCII przeciwników (.txt)
└─ test/
```

### Zasady architektury

1. **Silnik nie wypisuje nic bezpośrednio na ekran.** Systemy zwracają wyniki / emitują zdarzenia, a warstwa `ui/` je prezentuje. Dzięki temu logikę da się testować bez terminala.
2. **Atrybuty bazowe postaci nigdy nie są nadpisywane.** Funkcja `getStats(character, state)` zawsze składa wynik na bieżąco: baza + wyposażenie + aktywne efekty + pasywne efekty artefaktów + pora doby / zjawiska.
3. **Cała losowość przez `dice.js`** z generatorem z ziarnem (np. mulberry32). Ziarno i stan generatora są częścią zapisu gry.
4. **Walidacja danych przy starcie:** `data.js` sprawdza (a) kształt rekordów – wymagane pola i typy, prosty ręczny walidator bez bibliotek, (b) wszystkie odwołania (`id` przedmiotów, efektów, scen, węzłów dialogu, grafik), (c) **klucze modyfikatorów** – tylko z katalogu w rozdziale 4.1 (literówka `"bystrsoc"` ma być błędem, a nie cichym zerem). Zbiera wszystkie błędy naraz i wypisuje je czytelnie (`plik › id › pole: opis`).
5. **Zapis gry ma pole `version`**, żeby w przyszłości móc migrować stare zapisy. Zapis odwołuje się do scen, węzłów i opcji przez **stabilne `id`**, nigdy przez indeksy w tablicach – dopisanie sceny w środku `story.json` nie może psuć istniejących zapisów.

---

## 4. Postać

### Atrybuty (1–10, w kreatorze pula punktów do rozdzielenia, start po 5)

Kreator: wszystkie atrybuty startują od 5, a **Rozum od 6** (wrodzony dar bohatera – „ma intelekt”, poza pulą). Gracz ma **5 wolnych punktów**; może obniżyć atrybut (minimum 2), żeby odzyskać punkt. Maksimum w kreatorze 10. Pula i limity w `rules.json`.

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

- Wartość bazowa: `2 × atrybut główny + atrybut pomocniczy` (przy 5/5 → 15%).
- W kreatorze gracz wybiera **dokładnie 3 umiejętności wiodące** – jedną narzuca klasa (miecz → `sieczna`, włócznia → `drzewcowa`), dwie wybiera sam: +20% od razu, a każdy punkt rozdany przy awansie daje im +2% zamiast +1%.
- Przy awansie: punkty umiejętności `= 3 + floor(rozum / 2)` (przy Rozumie 6 – 6 punktów). **Celowo skąpo** – postać się specjalizuje, nie rozwija wszystkiego. Limit umiejętności 100%.
- Bazowe wartości umiejętności przeliczają się, gdy zmieni się atrybut **bazowy** (np. perk), ale nie od chwilowych modyfikatorów – w stanie przechowujemy tylko **rozdane punkty** (`skillPoints`), a wartość liczy `getStats()`.

### Pochodne

- Punkty życia: `20 + 3 × krzepa + (poziom − 1) × (2 + floor(krzepa / 2))` (przy krzepie 5: 35 na 1. poziomie, +4 co poziom).
- Punkty akcji (PA): `5 + floor(zrecznosc / 2)`.
- Udźwig: `25 + 10 × sila` (kg). Przeciążenie: −2 PA i brak możliwości ucieczki; powyżej 150% udźwigu nie można podnosić przedmiotów.
- Obrona bazowa: `zrecznosc × 2`.
- Inicjatywa: `zrecznosc + bystrosc`.
- Pieniądze: `character.money` w groszach (nazwa waluty w `ui.json`).

Wszystkie współczynniki powyższych wzorów są w `rules.json`.

### Doświadczenie i awans

- Próg poziomu `L + 1`: `150 × L × (L + 1) / 2` łącznego XP (2. poz. – 150, 3. – 450, 4. – 900, 5. – 1500).
- **Wolny rozwój – budżet XP MVP:** fabuła główna daje łącznie ok. **500 XP** (2. poziom, blisko 3.). Zadania poboczne, eskorty i spotkania w podróży – razem ok. **450 XP**; dopiero z nimi postać dochodzi do 4. poziomu. Zadania poboczne mają więc realną wartość, a nie są tylko ozdobą. Budżet pilnuje się przy pisaniu treści (cykl E): suma XP fabuły głównej nie może przekroczyć progu 3. poziomu.
- Awans: pełne leczenie, punkty umiejętności, ewentualnie perk. Awans rozpatrywany po zakończeniu sceny (nie w trakcie walki).

### Biegłość w broni (szkic – do zaprojektowania w cyklu C)

Obok umiejętności (wyszkolenie, punkty przy awansie) – **biegłość** (`mastery`) w typie broni: miecz, włócznie, łuk, kusza, broń palna, broń rzucana. Doświadczenie z walki zamiast punktów.
- Skala 0–100, **bez poziomów**; rośnie **powoli** z walki daną bronią – zależnie od **liczby i siły** pokonanych przeciwników (słabi przeciwnicy przy wysokiej biegłości dają prawie nic – brak farmienia).
- Daje umiarkowane premie z tą bronią w ręku (szkic: przy 100 → +15 trafienia, +20% obrażeń, +10 obrony) – mniejsze niż umiejętność, żeby liczyły się obie warstwy.
- **Maksimum nie gwarantuje sukcesu** – nadal obowiązuje limit szansy trafienia 95%; biegłość tylko zwiększa prawdopodobieństwo trafienia, obrażenia i skuteczność obrony.
- Klasa daje start biegłości (np. klasa włóczni: włócznie 15, klasa miecza: miecz 15).
- Do ustalenia w cyklu C: krzywa przyrostu, dokładne premie, czy biegłość słabnie bez używania. Stan: `character.mastery` (format zapisu v3, migracja z v2).

### Perki

Wybór jednego perka co `perkEveryLevels` poziomów (`rules.json`, wartość **2** – perk na 2., 4., 6. … poziomie). **Maksymalnie 6 perków** na postać (`maxPerks: 6`) z **większej puli** (MVP: 17 w 7 kierunkach – zwarcie, przetrwanie, dystans, głowa, mowa, wiedza, fart), żeby dało się budować różne postacie. Przy wolnym rozwoju MVP daje zwykle 1 perk, 2 – z zadaniami pobocznymi. Lista w `perks.json` z wymaganiami (`requires`: atrybuty, umiejętności, poziom). Perk to zestaw `modifiers` (katalog niżej) i/lub odblokowań akcji (`unlocks`, zamknięta lista w `rules.json`, np. `finta`). Nowe perki to same dane.

### 4.1 Katalog modyfikatorów

Jedno słownictwo dla wyposażenia, efektów, perków, artefaktów, pory doby i zjawisk. `getStats()` sumuje wartości z tymi samymi kluczami. Inne klucze = błąd walidacji.

| Klucz | Znaczenie |
|---|---|
| `sila` … `fart` | atrybut (punkty) |
| `sieczna` … `wiedza_tajemna` | umiejętność (punkty %) |
| `hpMax`, `ap`, `defense`, `initiative`, `carry` | pochodne |
| `hitChance`, `meleeHitChance`, `rangedHitChance` | szansa trafienia (wszystkie / zwarcie / dystans) |
| `damage` | płaski bonus do obrażeń zadawanych |
| `extraDamage` | `{ "type": "ogien", "amount": [2, 4] }` – dodatkowe obrażenia innego typu (np. `ostrze_ognia`) |
| `damageTaken` | `{ "<typ obrażeń>": mnożnik }` – mnożniki otrzymywanych obrażeń (np. `zaslona`) |
| `critChance`, `fleeChance` | punkty % |
| `resist_<idEfektu>` | odporność na efekt (punkty % do testu odporności) |
| `effectDuration_<idEfektu>` | zmiana czasu trwania efektu w % (np. `-30` dla talizmanu przeciw strachowi) |

---

## 5. Przedmioty

Wspólne pola: `id`, `name`, `type`, `weight`, `value`, `description`.

### 5.1 Broń

Typy obrażeń: `sieczne`, `klute`, `obuchowe`, `ogien`, `palne`. (W v1 typ broni palnej nazywał się `proch`, co kolidowało z `id` umiejętności.)

```json
{
  "id": "kusza_lekka",
  "name": "Lekka kusza",
  "type": "weapon",
  "skill": "strzelecka",
  "damageType": "klute",
  "damage": [8, 14],
  "apCost": 5,
  "reload": { "apCost": 4, "ammo": "belt", "capacity": 1 },
  "armorPierce": 3,
  "range": "far",
  "minStrength": 4,
  "weight": 4,
  "value": 60
}
```

- **Sloty broni:** `bron` (w ręku) i `bron_zapas` (na plecach). Akcja „Zmiana broni” zamienia je miejscami.
- `range`: `melee` (tylko w zwarciu), `far` (strzelanie; w zwarciu kara `rangedInMeleePenalty` z `rules.json`), `thrown`.
- **Amunicja to zwykłe przedmioty** (`belt`, `kula_z_prochem`) z `type: "ammo"`. Stan naładowania broni trzyma `inventory.loaded` (`{ "kusza_lekka": 1 }`), więc przetrwa zapis i zmianę broni.
- `minStrength`: za każdy brakujący punkt siły −10 do trafienia.
- Bez broni gracz walczy pięściami (`piesci`, wpis w `items.json` z `"hidden": true`, umiejętność `wrecz`).

**Broń w tym świecie (inspiracja autora, do przełożenia na dane w cyklu C):**
- **Miecz** – niezbyt długi, raczej jak krótki miecz legionisty: szybki, do zwarcia, cięcie i pchnięcie, dobra obrona.
- **Włócznie** – **zawsze para**, krótkie, z wydłużonymi ostrzami jak sztylety; służą do pchnięć **i** cięć. Walka dwiema brońmi (np. tańszy podwójny atak albo atak + parowanie). Propozycja: jedną z pary można **rzucić** (atak na dystans; potem trzeba ją podnieść). Zastępuje to długi „reach” z wcześniejszej wersji – rola `reach` do ponownego przemyślenia w cyklu C.
- **Broń palna** – pochodzi z **wyspy rzemieślników**, którzy wywodzą się z nieznanego ludu przybyłego z gwiazd (wątek do powiązania z upiorami / istotą). Stosunkowo prymitywna, zawodna. Po wystrzale może **zadymić** miejsce walki (efekt `zadymienie`), przez co przeciwnik ma mniejsze szanse na trafienie bohatera.
- **Łuk** – szybszy (mniej PA, szybkie przeładowanie), ale mniej celny. **Kusza** – wolniejsza, ale celniejsza i z większym przebiciem.

Charakter broni (ma wynikać z danych, nie z wyjątków w kodzie):

- **Miecz:** szybki (2–3 PA), niezawodny, tylko zwarcie.
- **Włócznia:** zasięg; darmowy atak na wroga, który wchodzi w zwarcie (`"reach": true`); kara w ciasnych miejscach (`"crampedPenalty": 20`, gdy scena walki ma `"cramped": true`).
- **Kusza:** duże obrażenia i przebicie, przeładowanie prawie na całą turę.
- **Broń palna:** bardzo duże obrażenia i przebicie, dodatkowe pola:
  ```json
  { "misfireChance": 15, "burstChance": 2, "noise": 3, "fear": 20 }
  ```
  - `misfireChance` – niewypał: `max(1, misfireChance − fart − floor(proch / 10))`; niewypał zużywa PA i ładunek,
  - `burstChance` – rozerwanie lufy (przy niewypale; broń niszczeje, rzucający dostaje obrażenia `burstDamage`),
  - `noise` – % szansy na turę, że strzał ściągnie posiłki (lista `reinforcements` w scenie walki; brak listy = brak posiłków),
  - `fear` – spadek morale każdego wroga z morale.
  Proch jest rzadki i drogi.

### 5.2 Pancerz i wyposażenie

**Sloty:** `glowa`, `tulow`, `rece`, `nogi`, `plaszcz`, `talizman`, `pas` (+ sloty broni `bron`, `bron_zapas`).

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
- `modifiers` – klucze z katalogu 4.1 (atrybuty, umiejętności, PA, obrona, odporności na efekty, np. `"resist_oslepienie": 20`),
- **pas** określa liczbę miejsc szybkiego dostępu (`"quickSlots": 2`). W walce przedmioty z pasa kosztują swoje PA, z torby – o 2 PA więcej. Bez pasa: 0 miejsc. Zdjęcie pasa na mniejszy przenosi nadmiarowe przedmioty do torby.

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

Trafienie testuje się jak atak dystansowy (`miotanie`). Chybienie: szansa każdego efektu × `missEffectMultiplier` (domyślnie 0.5) i czas −1. Krytyczna porażka (rzut ≥ `fumbleRoll`, domyślnie 99, przy farcie ≥ 8 – tylko 100): efekt trafia rzucającego. Przy limicie trafienia 95% rzuty 96–98 to zwykłe chybienia – w v1 próg 96 oznaczał, że *każdy* rzut miał stałe 5% szansy na autodestrukcję, co było zbyt karzące. Przedmiot `battlefield` nie wymaga testu trafienia.

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

Leczenie, opatrunki (zatrzymują krwawienie), odtrutki. Format jak `throwable`, z `target: "self"` i polami:

```json
{ "id": "opatrunek", "type": "consumable", "target": "self", "apCost": 3,
  "heal": [3, 6], "healSkill": "medycyna", "removes": ["krwawienie"], "weight": 0.2, "value": 8 }
```

Leczenie: `losuj(heal) × (1 + medycyna / 100)`. Poza walką użycie kosztuje 10 minut czasu świata.

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

- `unit`: `turn` (walka) albo `hour` (poza walką, np. trucizna, zmęczenie). Efekty `turn` znikają po końcu walki.
- **Czas trwania:** `remaining` zmniejsza się o 1 **na końcu tury celu**. Efekt nałożony w turze wroga z `duration: 1` działa więc przez całą najbliższą turę gracza (inaczej ogłuszenie na 1 turę nic by nie robiło). Efekty `battlefield` odliczają się na końcu pełnej rundy.
- `resist`: przy nałożeniu cel wykonuje test: gracz `atrybut × 5 + resist_<id>`, przeciwnik – wartość z jego pola `effectResist` (`{ "strach": 30 }`, domyślnie 0). Sukces **anuluje** efekt (`resistOutcome` w `rules.json`: `cancel` albo `shorten`).
- `stack`: `refresh` (odnów czas), `extend` (+1 jednostka), `stack` (kumuluj siłę – `tick` i `modifiers` × liczba stosów, limit `maxStacks`, domyślnie 3).
- `tick`: działanie na początku tury/godziny celu (przed akcjami, po odnowieniu PA – więc `ap: -4` z ogłuszenia odejmuje się od świeżo odnowionej puli).
- `scope: "battlefield"`: działa na **wszystkich** uczestników walki (dym utrudnia strzelanie także graczowi).
- Przeciwnicy mogą mieć `immune: ["oslepienie"]` (np. upiory nie widzą oczami).
- Brakujące w przykładzie efekty MVP (`ostrze_ognia`, `zaslona`, `spowolnienie`, `trucizna` z `unit: "hour"`) są w `effects.json`; `ostrze_ognia` używa `extraDamage`, `zaslona` – `damageTaken`.

---

## 7. Walka

Turowa, z punktami akcji.

### Przebieg

1. Inicjatywa: `initiative + k10` (gracz: `zrecznosc + bystrosc`, wróg: pole `initiative`) – kolejność na całą walkę, remis wygrywa gracz.
2. Tura uczestnika: odnowienie PA → tyknięcie efektów → akcje, dopóki starcza PA lub gracz kończy turę → odliczenie czasu efektów. Niewykorzystane PA przepadają.
3. Koniec walki: wszyscy wrogowie pokonani lub uciekli / ucieczka gracza udana / gracz pokonany.
   - Porażka: ekran porażki i powrót do ostatniego zapisu (autozapis jest robiony zawsze na starcie nowej gry, więc zawsze istnieje). Scena może zamiast tego mieć `"onDefeat": "<idSceny>"` (porażka fabularna, np. niewola) – wtedy gracz budzi się z 1 HP.
   - Ucieczka: scena walki ma `"canFlee"` (domyślnie `true`) i `"onFlee": "<idSceny>"` lub `"retry"` (powrót przed walkę po odpoczynku). Walka z bossem aktu III ma `canFlee: false`.
4. Po walce: XP za pokonanych (uciekający / poddani wrogowie – połowa), łup, czas świata +`combatMinutes` (domyślnie 10).

### Dystans

Prosty model dwóch pasm zamiast siatki: każdy wróg jest **w zwarciu** albo **na dystansie** względem gracza (pole `"start": "far" | "melee"` w scenie, domyślnie `far`).

- Broń `melee` atakuje tylko w zwarciu, broń `far` z obu pasm (w zwarciu z karą), rzucane przedmioty – z obu.
- Akcja „Zbliż się” / „Odskocz” (2 PA) zmienia pasmo wobec jednego wroga. Odskoczenie od wroga w zwarciu daje mu darmowy atak, jeżeli ma broń zwarcia.
- Wróg wchodzący w zwarcie z graczem trzymającym broń z `reach` dostaje darmowy atak (raz na turę wroga).
- AI `ranged` odskakuje, AI `aggressive` się zbliża. Upiory mogą mieć `"leap": true` (wejście w zwarcie za 0 PA).

### Wielu przeciwników

Instancje dostają numery (`Bandyta 1`, `Bandyta 2`). Akcja ataku pyta o cel, gdy jest więcej niż jeden żywy wróg. Ekran walki pokazuje grafikę **aktualnie wybranego celu** i listę wszystkich wrogów z paskiem życia, pasmem dystansu i efektami.

### Akcje gracza

| Akcja | Koszt PA |
|---|---|
| Atak bronią | z danych broni |
| Ciosy celowane (głowa / tułów / nogi / Ogłusz) – akcje na głównej liście, bez dodatkowych PA | głowa: −30 do trafienia, +50% obrażeń, krytyk +20; tułów: +10 do trafienia, −15% obrażeń; nogi: −15, spowolnienie 40%; Ogłusz: −20, bez obrażeń, ogłuszenie 40% (+20 bronią obuchową; także pięściami) |
| Przeładowanie | z danych broni |
| Użycie przedmiotu z pasa | z danych przedmiotu |
| Użycie przedmiotu z torby | koszt przedmiotu + 2 |
| Zdolność artefaktu | z danych zdolności |
| Zmiana broni | 2 |
| Zbliż się / Odskocz | 2 |
| Obrona (do następnej tury +5 obrony za każdy wydany PA) | pozostałe PA, min. 2 |
| Ucieczka | 4, szansa `30 + 3 × zrecznosc + fleeChance − 10 × liczba wrogów w zwarciu` (5–95%) |

### Formuły (parametry w `rules.json`)

```
szansa_trafienia = hitBase (30) + umiejętność − obrona_celu + modyfikatory   (ograniczona do 5–95%)
  # przeciwnik: zamiast hitBase + umiejętność używa pola "hit" ataku

surowe   = losuj(zakres broni) + bonus siły (zwarcie: max(0, sila − 5)) + modyfikator "damage"
krytyk   = szansa: fart + critChance (%), surowe × 1.5 (zaokr. w dół), krytyk ignoruje pancerz płaski
po_pancerzu = max(0, surowe − max(0, pancerz_celu − przebicie_broni))
obrażenia   = floor(po_pancerzu × (1 − min(75, redukcja%_typu) / 100) × damageTaken_typu)
              minimum 1 przy trafieniu, chyba że damageTaken_typu = 0 (pełna odporność)
```

Liczenie po kolei (pancerz → procent → mnożnik) jest celowe: płaski pancerz upiora (6) ma zatrzymywać słabe ciosy, ale nie kuszę z przebiciem. W v1 wzór bez `hitBase` dawał postaci startowej ok. 15% szans na trafienie – zbyt mało, żeby walka była przyjemna. Z `hitBase` 30 umiejętność wiodąca (35%) przeciw obronie 10 daje 55%.

Morale wroga: wartość 0–100 (`null` = brak, np. upiory). Spada od `fear` broni palnej, efektu `strach` (−`moralePerFear`) i śmierci towarzysza (−20). Poniżej `moraleThreshold` (domyślnie 25): AI `cautious` ucieka (wróg znika z walki po swojej turze), pozostałe AI walczą dalej z karą −10 do trafienia. Poddanie się – poza MVP.

### Ekran walki

```
        .-"""-.
       /  o o  \        UPIÓR
      |   ___   |       Życie: ██████████░░░░  71%   [Rozkojarzony 2] [Płonie 1]
       \  \_/  /
     /`'-----'`\
    /  |  |  |  \

  Dzień 3, zmierzch     Kamień Zmierzchu: ███████░░░ 68%
  Ty: ████████████░░ 34/40 HP   PA: ●●●●●○ (5/6)   [W dymie 2]
  Broń: kusza [naładowana]
  Pas: [1] Garniec z wapnem  [2] Świeca dymna  [3] —

  [1] Strzał z kuszy (5 PA)     [4] Użyj przedmiotu
  [2] Celowany strzał (6 PA)    [5] Artefakt
  [3] Przeładuj (4 PA)          [6] Koniec tury
```

Grafiki w `data/art/<id>.pix` (E3a): pixel-art rysowany półblokami ▀▄ w palecie 256 kolorów; plik ma linię `paleta: a=236 b=94 …` (litera → numer koloru, `.` = przezroczysty) i siatkę liter o równych wierszach, parzystej wysokości. Limity (px, walidowane przy starcie wg użycia): wróg 40×16, portret 20×20, scena/etap 48×20. W trybie liniowym obraz zastępuje ASCII liczone z jasności pikseli. Podgląd: `node bin/game.js --art <id>`. Ekran walki ma się mieścić w terminalu 80×24, dlatego pod listą wrogów jest **dziennik walki – 3 ostatnie komunikaty** (np. `Bandyta 1 chybia. Trafiasz Bandytę 2 za 9 (krytyk!).`). Bez dziennika gracz nie widzi, co się stało w turach wrogów. Pełny dziennik walki dostępny opcją `[L]`.

Układ (od góry): grafika celu + nazwa i pasek życia celu (7 wierszy) · lista wrogów (do 3 wierszy) · dziennik (3) · pasek czasu/artefaktu (1) · stan gracza (2) · pas (1) · akcje (3–4) · pole wyboru (1).

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
  "damageTaken": { "sieczne": 0.5, "klute": 0.5, "ogien": 2.0 },
  "immune": ["oslepienie", "rozkojarzenie"],
  "effectResist": { "strach": 100, "ogluszenie": 20 },
  "tags": ["upior"],
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

- W v1 były dwa pola `resist` i `weak` (a w `resist` omyłkowo `drzewcowa` – nazwa umiejętności, nie typu obrażeń) oraz `resist` w efektach oznaczający coś innego. Teraz: **`damageTaken`** – jeden słownik mnożników obrażeń (ten sam klucz co w katalogu modyfikatorów), **`effectResist`** – odporność na efekty.
- `tags` – znaczniki używane przez warunki (`near_upior` w artefaktach, perki „przeciw upiorom”).
- Ataki mają opcjonalnie `"range": "melee" | "far"` (domyślnie `melee`).

Proste AI na MVP (`ai`): `aggressive` (zbliża się i atakuje), `cautious` (ucieka przy HP < 30% lub morale poniżej progu), `ranged` (utrzymuje dystans, przeładowuje). Wroga jest jeden cel – gracz – więc „atakuj najsłabszego” odpada do czasu towarzyszy. Wybór ataku: każdy atak, na który starcza PA, losowany z wagą `weight` (domyślnie 1); AI wydaje PA, dopóki ma na coś sensownego.

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

Odpoczynek: regeneracja `restHealPerHour` (domyślnie `2 + floor(krzepa / 3)`) HP na godzinę, przerwany przez zdarzenie losowe (np. przy wystawionym artefakcie) – wtedy reszta godzin przepada.

### Wpływ pory doby

- Noc: −15 do `rangedHitChance` i do testów umiejętności zależnych od Bystrości (atrybut główny lub pomocniczy) bez źródła światła, +10 skradanie. Upiory w nocy: +10 do trafienia. Wszystko jako modyfikatory z katalogu 4.1 w `rules.json` → `timeOfDay.noc.player` / `.upior`.
- Źródło światła: przedmiot z `"light": true` w slocie lub na pasie (np. latarnia) znosi karę nocy.
- Część zjawisk występuje tylko o określonej porze.

### `advanceTime` (pseudokod)

```
advanceTime(state, minutes):
  dziel czas na odcinki kończące się na każdej pełnej godzinie zegara:
    artifacts.regenerate(state, długość_odcinka)   # proporcjonalnie, bazowo × warunki × zjawisko
    gdy odcinek kończy się na pełnej godzinie:
      jeśli godzina == 0: phenomena.rollDaily(state)   # losowanie zjawiska na nową dobę
      phenomena.update(state)                          # zapowiedź / start / koniec
      effects.tickHourly(state)                        # efekty z unit: "hour"
      sprawdź zmianę pory doby
  zwróć listę zdarzeń: "zmiana_pory", "zapowiedz_zjawiska", "start_zjawiska", "koniec_zjawiska", "artefakt_naladowany"
```

Przetwarzanie godzina po godzinie jest wymagane, żeby np. 8-godzinny sen poprawnie „przeżył” burzę w środku nocy. Liczenie względem **pełnych godzin zegara** (a nie „co 60 minut od teraz”) sprawia, że 10 rozmów po 6 minut daje ten sam wynik co jedna godzina – w v1 reszta minut gubiłaby tyknięcia.

`rollDaily`: test `chancePerDay` dla każdego zjawiska (po kolei, najwyżej jedno na dobę), losowa godzina startu zgodna z `timeOfDay`, zapis do `world.pendingPhenomenon`; zapowiedź pojawia się `hoursBefore` godzin przed startem (lub od razu, gdy start jest bliżej).

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
- **Warunki regeneracji** (`when`): `night`, `day`, `in_combat`, `phenomenon:<id>`, `near:<tag>` (np. `near:upior` – w walce z wrogiem o tym tagu albo w scenie z `"tags": ["upior"]`). Lista warunków jest zamknięta i walidowana. Mnożniki się mnożą.
- **Pasywy i zdolności działają tylko z artefaktu założonego w slocie `talizman`.** Ładuje się każdy noszony artefakt (w sakwie wolniej: `carriedRegenMultiplier`, domyślnie 0.5), chyba że ma `requiresExposure`.
- Ładunek jest kluczowany `id` przedmiotu – MVP zakłada, że każdy artefakt jest unikatowy (walidacja: artefakt nie może mieć `qty > 1`).
- **`requiresExposure`**: artefakt ładuje się tylko wystawiony (nie w sakwie).
- **Użycie na pusto** (`whenEmpty`): możliwe kosztem HP lub innego zasobu.
- Ładunek przechowywany w stanie jako liczba zmiennoprzecinkowa, wyświetlany jako pasek i procent.
- Potrzebne efekty `ostrze_ognia` (broń zadaje dodatkowe obrażenia typu `ogien`) i `zaslona` (redukcja obrażeń) – dodać do `effects.json`.

**Pomysł (inspiracja autora): Miecz Gwiazd / Włócznia Gwiazd** – legendarna broń-artefakt nawiązująca do tytułu. Kierunki do rozważenia w cyklach D–E:
- **broń zależna od klasy** – miecznik dostaje Miecz Gwiazd, włócznik parę Włóczni Gwiazd (ten sam artefakt, inna forma),
- **dar istoty** – powiązany z długiem: im bliżej posłuszeństwa (`dlug`), tym silniejszy; przy wyborze wolnej drogi (`wola`) broń „milknie” albo trzeba ją od istoty odebrać,
- **przedmiot z gwiezdnego metalu** – z wyspy rzemieślników / od ludu z gwiazd, a więc i z upiorami,
- techniczna podstawa już jest: broń w slocie `bron` + mechanika artefaktów (ładunek, pasywy, zdolności – np. „Płonące ostrze”). Wymagałoby to tylko pozwolenia, żeby artefakt mógł zajmować slot broni.

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

- `requires`: opcja widoczna tylko, gdy warunek jest spełniony (`item`, `flag`, `notFlag`, `attribute`, `skill`, `timeOfDay`, `money`). Kilka kluczy = wszystkie muszą być spełnione. Ten sam format warunku jest używany w scenach (`"if"`) – jeden moduł `conditions.js`.
- `check`: test umiejętności lub atrybutu; w UI wyświetlany wprost, np. `[Wymowa 40]` (z `--debug` także szansa). Szansa: umiejętność `− trudność + 50`, atrybut `× 10 − trudność + 50`, ograniczona do 5–95 (parametry w `rules.json`).
- `actions` mogą mieć **i węzeł** (wykonywane przy wejściu), **i opcja** (wykonywane po wybraniu): `giveItem`, `takeItem`, `giveMoney`, `takeMoney`, `setFlag`, `addVar`, `xp`, `time`. `startCombat` z dialogu kończy rozmowę i zwraca wynik `combat` – scena dialogu w `story.json` może mieć `"onCombat": { "enemies": [...] }`, a pętla scen uruchamia walkę.
- `goto: "end"` kończy rozmowę. Dialog może kończyć się różnymi wynikami (`"end": "zgoda"`), które scena odczytuje jako flagę `dialog_<id>_<wynik>`.
- Opcje z `check` **muszą mieć `id`** (unikalne w obrębie węzła). Nieudany test zapamiętuje się w `world.failedChecks` jako `"<dialog>:<węzeł>:<opcja>"` – opcja jest potem pokazana jako niedostępna (nie da się powtarzać do skutku). W v1 klucz był indeksem opcji, co psułoby się po dopisaniu nowej opcji.
- Każda rozmowa przesuwa czas o `minutes` z pliku dialogu (domyślnie 10).

---

## 13. Fabuła liniowa (`data/story.json`)

Lista scen wykonywanych po kolei przez `loop.js`. **Każda scena ma unikalne `id`** – zapis gry pamięta `id` bieżącej sceny, a skoki (`onFlee`, `onDefeat`, `goto`) wskazują `id`.

```json
{
  "start": "prolog_swit",
  "scenes": [
    { "id": "prolog_swit", "type": "narration", "title": "Prolog", "text": "Świt nad strażnicą...", "time": 0 },
    { "id": "prolog_kreator", "type": "character_creation" },
    { "id": "prolog_odprawa", "type": "dialogue", "dialogue": "dowodca_odprawa" },
    { "id": "akt1_zasadzka", "type": "combat", "enemies": ["bandyta", "bandyta"], "intro": "Z zarośli wyskakują dwaj ludzie.", "canFlee": false },
    { "id": "akt1_nagroda", "type": "reward", "xp": 100, "items": ["kusza_lekka"], "money": 20 },
    { "id": "akt2_kram", "type": "shop", "shop": "kramarz_wiejski" },
    { "id": "akt2_postoj", "type": "rest", "allowExposure": true },
    { "id": "akt2_burza", "type": "phenomenon", "phenomenon": "burza_iskier", "inHours": 2 },
    { "id": "akt1_koniec", "type": "flag", "set": { "akt1_ukonczony": true } },
    { "id": "akt1_zapis", "type": "save_point" },
    { "id": "koniec", "type": "ending", "text": "Ciąg dalszy nastąpi." }
  ]
}
```

- Typy scen na MVP: `narration`, `character_creation`, `dialogue`, `combat`, `reward`, `shop`, `rest`, `phenomenon`, `flag`, `var`, `save_point`, `ending`.
- Odwołania do innych plików mają nazwę pola zgodną z typem (`dialogue`, `shop`, `phenomenon`), a nie ogólne `id` – bo `id` jest już identyfikatorem sceny.
- **Pola wspólne wszystkich scen** (silnik obsługuje je już w MVP, bo kosztują niewiele): `id`, `time`, `if` (warunek z `conditions.js`; niespełniony = scena pominięta), `goto` (po scenie skocz do sceny o `id`, zamiast do następnej), `tags`.
  Dzięki `if` + `goto` rozgałęzienia z przyszłości nie wymagają przebudowy silnika.
- Sklep: `data/shops.json` – `{ "id", "name", "stock": [{ "id", "qty" }], "buys": ["weapon", "armor", ...] }`. Ceny: kupno `value × (1.5 − handel / 200)`, sprzedaż `value × (0.3 + handel / 400)`, zaokrąglone, parametry w `rules.json`.
- Między scenami (poza walką i dialogiem) gracz ma **menu obozowe**: `[Enter] dalej · [P] postać · [E] ekwipunek · [Z] zapisz · [M] menu`. Pokazywane po scenach narracyjnych, nagrodzie i odpoczynku, żeby gracz mógł założyć zdobyty sprzęt przed następną walką.

### Zarys historii MVP

Wszystkie imiona i nazwy miejsc wymyślić od nowa (oryginalne, w klimacie słowiańsko-średniowiecznym).

> Uwagi fabularne autora to **inspiracje i kierunek, a nie sztywne wymagania** – przy pisaniu treści (cykl E) wolno je łączyć, reinterpretować i proponować warianty. Wiążące są zatwierdzone mechaniki.

**Założenie fabuły (od autora):**
- **Prowincjonalna szkoła ostrza** w małej mieścinie na mało znaczącym szlaku handlowym. Nauczyciele i instruktorzy niezbyt dobrzy – w sam raz na taką mieścinę.
- Adepci poznają różne oręża, ale szkoła dzieli się na dwie klasy: **klasę miecza** i **klasę włóczni**.
- **Bohater** nie jest wybitnym uczniem, po prostu poprawnym, ale ma **intelekt**, który pozwala mu rozstrzygać pojedynki na swoją korzyść.
- Do miasta przybywa **cesarski kurier**. Nie wiadomo, jakie rozkazy przywiózł, ale w ich wyniku ze szkoły ma zostać wysłana **delegacja uczniów do stolicy cesarstwa**. Wybrano do niej najmniej ważne osoby – najpewniej to wyprawa, z której się nie wraca, może danina z ludzi dla cesarza.
- W trakcie wyprawy następuje **atak upiorów połączony z nadprzyrodzonym zjawiskiem naturalnym**. Przy życiu zostaje tylko bohater.
- **Przebudzenie:** bohater ocyka się w środku nocy. Nad nim stoi **dziwna istota**, która sprawia, że jego rany się zasklepiają, a pogruchotane ciało znów jest całe. Istota oznajmia, że **czas spłacić dług** i **zniszczyć to, co na ziemi**.
- Prawdziwe znaczenie tych słów – **zabić cesarza i zburzyć porządek świata** – ma się okazać dopiero w dalszej fabule. Gracz na początku tego nie wie.
- **Trzy drogi, żadna czysta:** istota pcha bohatera ku spłacie długu, ale realizuje **własne cele**. Bohater może:
  - **być posłuszny** – spłacić dług i stać się narzędziem istoty,
  - **pokazać wolną wolę** – odmówić i stoczyć walkę **jednocześnie z cesarstwem i z istotą**,
  - **ocalić tylko siebie** – uciec od wielkiej gry kosztem innych.
  Żaden wybór nie jest dobry, to kwestia **mniejszego zła**.
- **Pierwsza pula przygód (rozdziałów, etapów) po przebudzeniu** – temat: **wejście w dorosłość, poznanie siebie i swoich możliwości.**
  - Prowadzi do **poznania celu wyznaczonego przez istotę** – krok po kroku, przez zadania, wskazówki i ludzi spotkanych w drodze.
  - Pozwala bohaterowi (i graczowi) **zadać pytanie**: czy muszę iść tam, gdzie mi każą, czy mogę iść własną drogą? To **tylko nuans** – zasiane w dialogach i wyborach, bez otwierania rozgałęzień. To jeszcze nie czas na przemianę bohatera; trzy drogi rozstrzygają się później.
  - Mechanicznie: wybory w tej puli przesuwają `wola` / `dlug` o małe wartości (±1) i ustawiają flagi zapamiętanych pytań, ale nie zmieniają przebiegu fabuły głównej. Finał ma wynikać z całej drogi, a nie z jednej decyzji na końcu: postawę bohatera od początku liczą ukryte zmienne `wola` (opór wobec istoty) i `dlug` (uleganie jej) – rozdział 14.
- Dalsza fabuła – do opracowania.

**Propozycja podziału na akty MVP** (do potwierdzenia w cyklu E):
1. **Prolog – szkoła ostrza:** kreator postaci z **wyborem klasy** (miecz / włócznia → broń startowa i jedna z umiejętności wiodących narzucona: `sieczna` albo `drzewcowa`). Sparingi treningowe jako samouczek walki, w których słaby instruktor tłumaczy mechanikę, a bohater może wygrać „głową” (patrz niżej). Pierwsze dialogi z testami.
2. **Akt I – kurier:** przybycie kuriera, plotki, próby dowiedzenia się czegoś o rozkazach (Wymowa, Skradanie), wybór delegacji. Bohater i kilku innych „najmniej ważnych” adeptów (towarzysze tylko fabularnie – nie walczą w MVP). Przygotowania: sklep, ekwipunek, prowiant.
3. **Akt II – droga do stolicy:** wielodniowa podróż (rozdział 13a) – pierwsze spotkania, zadanie poboczne, walka z bandytami, odpoczynki. Zapowiedzi dziwnego zjawiska.
4. **Akt III – noc upiorów:** atak upiorów podczas zjawiska. Walka, w której zwykła broń zawodzi (odporności). Porażka nie kończy gry – scena `onDefeat` prowadzi dalej; bohater przeżywa jako jedyny. Ostatnia walka (ocalenie) wygrywana wiedzą zebraną po drodze (ogień, ogłuszenie, artefakt znaleziony na pobojowisku – np. Kamień Zmierzchu) – albo przegrana, co też prowadzi dalej.
5. **Epilog – dług:** bohater budzi się nocą na pobojowisku. Dziwna istota leczy go całkowicie (pełne HP, zdjęte efekty – zdarzenie fabularne, nie mechanika leczenia) i mówi o długu do spłacenia i o zniszczeniu „tego, co na ziemi”. Ustawiona flaga `dlug_istoty`, a pełne znaczenie (cesarz, porządek świata) zostaje ukryte. Słowa istoty i reakcja bohatera zależą od zebranych wcześniej `wola` / `dlug` – zapowiedź, że wybory się liczą. Zakończenie MVP: bohater sam w drodze do stolicy, z nieznanymi rozkazami kuriera i długiem, którego jeszcze nie rozumie.

**Wpływ na mechanikę:**
- **Klasa** w kreatorze (`data/classes.json`: broń startowa, narzucona umiejętność wiodąca, ewentualny perk startowy). Cykl B.
- **„Wygrywanie głową”** – akcja walki oparta na Rozumie / Bystrości (np. *Przejrzyj przeciwnika*: test, sukces ujawnia następny atak wroga i daje premię do obrony lub trafienia; *Finta*: kosztuje PA, następny atak z premią). Do zaprojektowania w cyklu C – ma czynić intelekt realną alternatywą dla siły.
- **Towarzysze fabularni** (delegacja) – postaci w dialogach, giną w akcie III; walki z towarzyszami poza MVP.

**Status (E2a, 2026-10-23):** prolog i akt I są zrealizowane w `data/`: dwie sceny wstępu → świt w szkole → kreator → sparing → kurier (dialog z testami Wymowa/Skradanie) → delegacja → kram → pożegnanie z towarzyszami (Skarimir, Ragnosława, Wojmir) → marsz (dzień 1: bandyci i popas przy ognisku) → **noc upiorów** (stałe zdarzenie `noc_upiorow` z `endsTrip`: burza iskier, walka nie do wygrania z `onDefeat`, zagłada towarzyszy, dialog z Istotą z akcją `healFull`) → świt w Wilczym Brodzie. Dalej tymczasowy akt II (komendant, zlecenie Wilczej Nory, eskorta Ostromira), który przepisze E2b.

Cel: przetestować kreator, dialogi z testami, walkę z PA, efekty statusu, ekwipunek i sloty, artefakty, czas i zjawiska, podróże, zapis gry oraz awans.

---

## 13a. Podróże i spotkania

> Zarys koncepcji. Szczegóły (liczby, formaty plików) ustala osobny cykl projektowy (cykl D).

Fabuła główna pozostaje liniowa i dzieje się w **lokacjach**. Między lokacjami gracz **podróżuje po mapie**.

- **Mapa:** graf lokacji z odległościami w dniach. Lokacje są **stałe** (wieś, strażnica) albo **tymczasowe** – pojawiają się po przyjęciu zadania i znikają po jego wykonaniu.
- **Podróż:** minimum 1 dzień, zwykle 2–3. **Każdy dzień to etap.** Na początku etapu – autozapis.
- **W każdym etapie** może wystąpić zdarzenie losowe (tabela z wagami i warunkami: region, pora, dzień podróży, flagi):
  - **spotkanie** – ludzie drogi, pielgrzymi, kupcy. Mogą:
    - tylko opowiedzieć historię (klimat, plotki, wskazówki),
    - poprosić o jedzenie lub wodę albo sami je zaoferować,
    - opatrzyć rany,
    - okazać się kupcem (handel jak w scenie `shop`),
    - zlecić **zadanie** → na mapie pojawia się nowa lokacja z zadaniem,
    - zlecić **eskortę** do punktu na mapie → dodatkowe dni podróży tam i z powrotem; punkt może być nową lokacją,
  - **atak** – walka (bandyci, zwierzęta, upiory),
  - **zjawisko magiczne** – czasowy plus lub minus do umiejętności (efekt `unit: "hour"`), ładowanie lub rozładowanie artefaktów,
  - **zjawisko pogodowe** – opóźnia podróż (+dni) i wpływa na widoczność, walkę i zjawiska.
- **Spotkania to krótkie listy scen** (`dialogue`, `shop`, `combat`, `reward`…) uruchamiane przez tę samą pętlę scen co fabuła. Mogą zwrócić wynik (np. `zlecenie_przyjete`), który system podróży zamienia w zadanie lub lokację.
- **Nagrody za zadania i eskorty** (inspiracja autora): nie zawsze dają doświadczenie. Np. eskorta, w której po drodze nic się nie wydarzyło, kończy się samą zapłatą. XP przychodzi z tego, co się faktycznie stało (walka, test, rozwiązany problem), a nie za samo dojście do celu. Silnik już to obsługuje: `reward` może mieć same `money`, a akcja `giveMoney` działa bez `xp`.
- **Prowiant** (jedzenie, woda) staje się zasobem podróży – zużycie dzienne i skutki braku ustali cykl D.
- Zjawiska z rozdziału 11 dzielą się na **magiczne** i **pogodowe** (pole `kind`).
- W stanie gry: `world.location`, `world.locations`, `world.travel` (trasa, dzień etapu), `quests`.

---

## 14. Stan gry i zapis

```js
/** @typedef {Object} GameState */
{
  version: 1,                     // wersja FORMATU zapisu
  gameVersion: "0.1.0",           // wersja gry (informacyjnie)
  savedAt: "2026-10-20T18:00:00Z",
  seed: 123456,
  rngState: 123456,
  time: { minutes: 360 },         // gra startuje o 6:00 dnia 1
  scene: { id: "akt1_zasadzka" }, // id sceny, NIE indeks
  flags: { akt1_ukonczony: true },// tylko ustawione flagi; brak klucza = false
  vars: { wola: 0, dlug: 0 },     // zmienne liczbowe (całkowite); brak klucza = 0
  character: {
    name: "...",
    level: 1, xp: 0,
    money: 30,
    attributes: { sila: 5, ... },          // wartości bazowe – nigdy nie modyfikowane przez ekwipunek/efekty
    skillPoints: { sieczna: 10, ... },     // tylko rozdane punkty; wartość umiejętności liczy getStats()
    tagged: ["sieczna", "wymowa", "medycyna"],
    perks: [],
    pendingLevelUp: null,                  // { skillPoints, perks } gdy gracz jeszcze nie rozdał (perks = liczba perków do wyboru)
    hp: 35,
    effects: [{ id: "krwawienie", remaining: 2, stacks: 1 }]
  },
  inventory: {
    items: [{ id: "garniec_wapno", qty: 2 }],      // przedmioty w torbie, także założone (equipped wskazuje id)
    equipped: { bron: "miecz_krotki", tulow: "kaftan_przeszywany", talizman: "kamien_zmierzchu", pas: "pas_zwykly" },
    quickSlots: ["garniec_wapno", "swieca_dymna"],
    loaded: { kusza_lekka: 1 },
    artifacts: { kamien_zmierzchu: { charge: 40, exposed: false } }
  },
  world: {
    activePhenomenon: null,          // { id, endsAt }
    pendingPhenomenon: null,         // { id, startsAt, omenShown }
    failedChecks: ["soltys:soltys_01:naciskaj"]
  }
}
```

- **Zmienne liczbowe (`vars`)** – liczby całkowite, domyślnie 0. Na MVP dwie fabularne, ukryte przed graczem: `wola` (opór wobec istoty, wolna wola) i `dlug` (uleganie istocie). Później także reputacja, liczniki zadań itp. Lista dozwolonych zmiennych jest w `rules.json` (`"vars": ["wola", "dlug"]`) – odwołanie do nieznanej zmiennej to błąd walidacji.
  - Warunek: `{ "var": "wola", "gte": 3 }` (operatory `gte`, `lte`, `eq`; dokładnie jeden) – w `if` scen, `requires` opcji dialogów i warunkach spotkań.
  - Akcja: `{ "addVar": { "wola": 1, "dlug": -1 } }` w akcjach węzłów i opcji dialogów; scena `var` (`{ "type": "var", "add": { "dlug": 1 } }`), analogicznie do `flag`.
  - Wprowadzenie `vars` zmienia format zapisu na **wersję 2** – migracja v1 → v2 dopisuje `vars: {}`.
- Zapis: `~/.nazwa-gry/saves/<slot>.json`, sloty `auto` + `1`–`3`. Autozapis na scenach `save_point` i na starcie nowej gry + ręczny zapis z menu obozowego.
- Zapis jest atomowy: zapis do pliku tymczasowego i `rename`, żeby przerwanie (Ctrl+C, brak prądu) nie zniszczyło slotu.
- Odczyt: sprawdzenie `version` (starsze → łańcuch migracji `migrations[v]`, nowsze → czytelny błąd), potem walidacja odwołań względem bieżących danych (np. usunięty przedmiot → ostrzeżenie i usunięcie z ekwipunku, nieistniejąca scena → błąd).
- Walka nie jest zapisywana – zapis możliwy tylko między scenami, a wczytanie zawsze startuje od początku zapisanej sceny.
- Menu główne: Nowa gra / Wczytaj / Wyjście (Wczytaj pokazuje sloty z imieniem postaci, poziomem, nazwą sceny i datą).

---

## 15. Interfejs

- Teksty zawijane do szerokości terminala (`process.stdout.columns`, domyślnie 80).
- **Jeden widżet wyboru w całej grze** (`src/ui/menu.js`): ↑↓ podświetla opcję, Enter wybiera, cyfra wybiera od razu (skrót). Używają go wszystkie decyzje gracza – menu, kreator, awans, ekwipunek, sklep, dialogi, działania w lokacji i interakcje z otoczeniem, wybór akcji w walce (tam ←→ przełącza cel). Opcje niedostępne są wyszarzone i kursor je przeskakuje. Suwaki wartości (atrybuty, punkty umiejętności, godziny odpoczynku, ilość w sklepie): ↑↓ wybór, ←→ zmiana.
- Bez terminala (potok, testy) widżet przechodzi w tryb „numer + Enter”, a suwaki w skróty `1+` / `3-`. Tryb surowy klawiatury jest zawsze przywracany (wyjście, Ctrl+C, błąd).
- Kolory (`chalk`): obrażenia czerwone, leczenie zielone, testy umiejętności żółte, mistyczne/artefakty fioletowe, narracja domyślna.
- Pasek stanu na każdym ekranie poza menu: dzień, pora doby, godzina, ewentualna zapowiedź zjawiska, ładunek założonych artefaktów.
- Ekran postaci (statystyki pochodne z `getStats` – pokazać bazę i modyfikatory), ekran ekwipunku (zakładanie/zdejmowanie, przypisanie do pasa) – dostępne poza walką.
- **Układ ramki (E1b, tylko TTY ≥ 80×24):** panel bohatera u góry; pod nim tekst sceny po lewej i panel wyboru po prawej na całą wysokość (lista pionowa, pod nią pole opisu zaznaczonej pozycji); dwa wiersze komunikatów; stałe menu poleceń (`[P] Postać` itd.) w jednej linii na dole. **Wygląd ramki (blokowy, `src/ui/frame_style.js`):** pełne rogi `█`, krawędzie z półbloków (`▀` góra, `▄` dół, `▌ ▐` boki), wiersz tytułów z cieniowanym pasmem `░▒`, pionowa kreska między panelami `▒` (styk `▓`), poziome przegrody jako zygzak `▄▀`; kolory: ciemna zieleń, ciemniejsza zieleń dla wzoru, brąz dla tytułów. Szerokość ramki ≤ 200, wysokość = `rows − 1`. Walka: wrogowie i dziennik po lewej, akcje po prawej. Kreator: podgląd na żywo (wartości pochodne, opisy) po lewej. Klawisze wciśnięte przed pokazaniem ekranu są odrzucane (150 ms). Tryb liniowy bez zmian. **Ilustracje (E3a):** pola `art` (sceny, w tym sceny zdarzeń), `portrait` (rozmowy i węzły), `stageArt` w `travel.json` (wymarsz, marsz, obóz, zjawisko) i `enemies[].art`; ilustracja stoi na pierwszej stronie sceny obok tekstu (lewy panel ≥ 100 kolumn), nad tekstem (gdy zostaje ≥ 8 wierszy tekstu) albo jej nie ma (np. 80×24).
- Obsługa Ctrl+C: czyste wyjście z pytaniem o zapis.

---

## 16. Kolejność implementacji

Każdy etap kończy się działającą grą i testami logiki (`node:test`). Etapy są pogrupowane w **cykle** – każdy cykl ma własny projekt (`docs/superpowers/specs/`), plan i implementację.

**Cykl A – rdzeń silnika**
1. **Szkielet:** `package.json` z `bin`, `bin/game.js`, menu główne, `config.js`, `io.js`, `colors.js`, `npm link` uruchamia grę.
2. **Dane i RNG:** `data.js` (ładowanie + walidacja kształtu i odwołań, `--validate`), `dice.js` z ziarnem.
3. **Pętla scen i zapis:** `loop.js` ze wspólnymi polami scen (`if`, `goto`, `time`), sceny `narration`, `flag`, `save_point`, `ending`; `conditions.js`; `save.js` (atomowo, wersjonowanie); UI: `screen.js`, `prompt.js`, `text.js`. Zapis przesunięty tu z etapu 11, bo format `scene.id` i flagi powstają teraz, a test „wczytaj i graj dalej” chroni wszystkie kolejne etapy.

**Cykl B – postać i świat** (podzielony: **B1** – etapy 4–5 + widżet wyboru ze strzałkami; **B2** – etap 6)
4. **Postać i zmienne:** kreator, `getStats()` z katalogiem modyfikatorów, awans, perki, ekran postaci; zmienne liczbowe `vars` (`wola`, `dlug`), warunek `var`, scena `var`, migracja zapisu v1 → v2.
5. **Czas:** `time.js`, `advanceTime`, pory doby, scena `rest`, pasek stanu. Przed walką, bo walka korzysta z modyfikatorów pory doby.
6. **Ekwipunek:** sloty, modyfikatory, pas, amunicja, ekran ekwipunku, menu obozowe, sceny `reward` i `shop`.

**Cykl C – interakcje**
7. **Efekty statusu:** `effects.js` (nakładanie, odporność, kumulacja, tyknięcia).
8. **Dialogi:** drzewka, warunki, testy, akcje.
9. **Walka:** inicjatywa, PA, dystans, ataki, przeładowanie, celowanie, przedmioty do rzucania, AI, morale, ekran ASCII z dziennikiem.

**Cykl D – mistyka i podróże**
10. **Artefakty i zjawiska:** ładunek, regeneracja, zdolności, pasywy, zapowiedzi, wystawianie; podział zjawisk na magiczne i pogodowe.
11. **Podróże:** mapa lokacji, etapy dzienne, prowiant, tabela zdarzeń losowych, spotkania jako listy scen, zadania i eskorty, lokacje tymczasowe, opóźnienia pogodowe (rozdział 13a).

**Cykl E – treść i publikacja**
12. **Treść MVP:** pełny prolog i 3 akty z podróżami między lokacjami, zestaw spotkań, grafiki ASCII, balans liczb w `rules.json`, test przejścia całej fabuły skryptem (`createScriptedIO`) z ustalonym ziarnem.
13. **Publikacja:** README (instalacja, sterowanie), `files` w `package.json`, test `npm pack`.

---

## 17. Konwencje

- Kod i nazwy techniczne po angielsku, treść gry i identyfikatory danych (`id`) po polsku bez znaków diakrytycznych (`kamien_zmierzchu`).
- Teksty wyświetlane graczowi wyłącznie w `data/` (lub w jednym pliku tekstów UI), nie rozsiane po kodzie.
- Funkcje systemów czyste tam, gdzie to możliwe: przyjmują stan i zwracają wynik/zdarzenia.
- Wszystkie liczby balansu (koszty, mnożniki, limity) w `rules.json`, nie w kodzie.

---

## 18. Otwarte kwestie (do ustalenia później)

- Ostateczna nazwa gry (koncepcyjnie „Ostrze Gwiazd”; rozważany był też tytuł „Włócznia Gwiazd”) i nazwa pakietu npm (techniczna `ostrze` – ewentualna zmiana przy publikacji w cyklu E, razem z katalogiem zapisów).
- Nazwa świata, krain, frakcji i postaci (w tym mieściny ze szkołą ostrza i stolicy cesarstwa) – zgodnie ze stylem nazewnictwa nordycko-słowiańskiego (rozdział 1, „Styl i ton”).
- Dalsza fabuła po akcie III; treść rozkazów kuriera.
- Wyspa rzemieślników i lud przybyły z gwiazd (źródło broni palnej) – związek z upiorami, istotą i artefaktami.
- Kim jest istota z epilogu i skąd dług (związek z upiorami – obcymi o technologicznym pochodzeniu? z artefaktami i „energią świata”?), jak i kiedy gracz poznaje prawdziwy cel (zabić cesarza, zburzyć porządek świata), czy bohater może odmówić spłaty. Ile zakończeń (posłuszeństwo / wolna wola / ocalenie siebie) i jakie progi `wola` / `dlug` je otwierają – po MVP.
- Lista perków i ich efekty.
- System reputacji / karmy (poza MVP).
- Nieliniowa fabuła główna (poza MVP; podróże i zadania poboczne są w MVP – rozdział 13a).
- Rzemiosło (np. własnoręczne robienie bomb i prochu) – poza MVP.
- Towarzysze w walce (wtedy wraca „AI atakuje najsłabszego”).
- Poddawanie się wrogów, zapis w trakcie walki.

---

## 19. Zmiany w wersji 2 (względem v1)

**Błędy i niespójności**
- `resist` przeciwnika zawierał `drzewcowa` (umiejętność, nie typ obrażeń); `resist`/`weak` zastąpione jednym `damageTaken`, odporność na efekty – `effectResist` (przeciwnicy nie mają atrybutów, więc test odporności z v1 był dla nich nieokreślony).
- Typ obrażeń `proch` → `palne` (kolizja z `id` umiejętności).
- Wzór trafienia bez `hitBase` dawał ok. 15% szans na starcie → `hitBase` 30.
- Krytyczna porażka przy rzucie ≥ 96 dawała stałe 5% autodestrukcji → próg 99 (100 przy dużym farcie).
- Niejednoznaczna kolejność działań we wzorze obrażeń → rozpisana krok po kroku.
- Efekt na 1 turę nałożony w turze wroga nie działałby wcale → odliczanie na końcu tury celu.
- `advanceTime` gubił tyknięcia przy wielu krótkich czynnościach → liczenie do pełnych godzin zegara.

**Brakujące elementy**
- Sloty broni, amunicja jako przedmioty, stan naładowania, pięści.
- Model dystansu (zwarcie / dystans) – bez niego `reach`, `range` i AI `ranged` nie miały znaczenia.
- Wielu przeciwników na ekranie, dziennik walki, układ ekranu 80×24, limit wysokości grafik.
- Skutki ucieczki i porażki w liniowej fabule (`canFlee`, `onFlee`, `onDefeat`).
- Pieniądze, format sklepu i wzory cen; progi XP; zasady kreatora; przeciążenie; leczenie i medycyna.
- Katalog modyfikatorów walidowany przy starcie.
- Menu obozowe między scenami.

**Odporność na rozwój treści**
- Sceny mają `id`; zapis pamięta `scene.id`; wspólne pola `if` / `goto` już w MVP.
- Opcje dialogów z testem mają `id` (klucz `failedChecks`); akcje także na opcjach.
- Zapis atomowy, migracje, walidacja zapisu względem bieżących danych.

**Technika**
- Node 22+, zero zależności (`util.styleText` zamiast `chalk`).
- Interfejs `io` i skryptowe wejście dla testów end-to-end; flagi `--seed`, `--scene`, `--debug`, `--validate`.
- Teksty UI w `data/ui.json`.
- Kolejność implementacji pogrupowana w cykle; zapis przeniesiony do cyklu A, czas przed walkę.

**Nowe w v2**
- Podróże po mapie z etapami dziennymi, losowymi spotkaniami, zadaniami, eskortami, lokacjami tymczasowymi oraz zjawiskami magicznymi i pogodowymi (rozdział 13a, cykl D).
