# Wytyczne i Prompty Wdrożeniowe: *Voided: na przekór gwiazdom* (Prolog 2.5D)

Dokument przygotowany na podstawie analizy:
- gry źródłowej w `origin/` (`README.md`, `docs/*.md`, `data/*.json`, `src/`),
- silnika izometrycznego 2.5D w `../ulfRPG/` (`src/core/`, `src/renderer/`, `src/rpg/`, `src/ui/`, `docs/`).

---

## 1. Architektura odporna na aktualizacje silnika (`/ulfRPG/`)

Aby przyszłe aktualizacje w `C:\laragon\www\ulfRPG` nie nadpisywały gry *Ostrze*:

1. **Separacja katalogów w `C:\laragon\www\ostrze\`:**
   - `package.json` / `vite.config.ts` / `tsconfig.json` — niezależna konfiguracja aplikacji *Ostrze* (Vite + TypeScript + PixiJS v8).
   - `src/engine-bridge/` — cienka warstwa adapterów i rejestrów, która łączy silnik `ulfRPG` z danymi *Ostrza* (docelowo przez alias `@ulf/*` wskazujący na `../ulfRPG/src/*` lub zsynchronizowaną kopię bazową z wyraźnie oznaczonymi punktami rozszerzeń).
   - `src/game/` — 100% logiki i treści specyficznej dla *Ostrza*:
     - `src/game/rules/` — reguły `origin` (7 atrybutów, 11 umiejętności, 2 klasy, atuty, formuły rzutów, osie `wola` / `dlug`, zjawiska, głód/czas).
     - `src/game/data/` — loader/adapter czytający bezpośrednio JSON-y z `origin/data/` (`attributes.json`, `classes.json`, `skills.json`, `perks.json`, `effects.json`, `items.json`, `enemies.json`, `shops.json`, `story.json`, `dialogues/*.json`) bez duplikowania treści tekstowych.
     - `src/game/maps/` — definicje map 2.5D Prologu w formacie `IsometricWorldMap` (`worldMap.ts`).
     - `src/game/scenes/` — orkiestrator scen Prologu (narracja wstępna, kreator postaci, sparing, kurier, kram, brama, trakt z bandytami, noc upiorów i Istota, pobojowisko i rozdroże).
     - `src/game/ui/` — nakładki UI specyficzne dla *Ostrza* (ekran narracyjny z ilustracją/klimatem, kreator postaci, test umiejętności w dialogu z procentem szansy).

2. **Kontrakt rozszerzeń wobec `ulfRPG`:**
   - Unikać bezpośredniego dopisywania treści *Ostrza* do plików `ulfRPG` (`worldMap.ts`, `dialogueSystem.ts`, `characterData.ts`, `gameLoop.ts`).
   - Zamiast twardych unionów (`MapId`, `MERCHANT_ACTOR_IDS`), w warstwie pomostowej stosować rejestry dynamiczne (`registerMap`, `registerDialogueTree`, `registerMerchant`, `registerItemDef`).

---

## 2. Przekład zasad `origin/` na silnik 2.5D

| Obszar | Źródło w `origin/` | Implementacja w wersji 2.5D |
|---|---|---|
| **Atrybuty (7)** | `sila`, `zrecznosc`, `krzepa`, `bystrosc`, `rozum` (start 6), `oglada`, `fart` (`2–10`, +5 pkt) | Model `OstrzeStats` obliczany dynamicznie (`getStats`: baza + klasa + atuty + ekwipunek + efekty + pora dnia + zjawiska). |
| **Klasy (2)** | `miecz` (oznaczona `sieczna`, `miecz_krotki`) i `wlocznia` (`drzewcowa`, `para_wloczni`) | Wybór w kreatorze postaci na starcie Prologu; startowy ekwipunek widoczny na modelu 2.5D (`characterBakery.ts`). |
| **Umiejętności (11)** | `0–100%`, 3 oznaczone (`+20%`, `+2%/pkt`), wzrost co poziom (`3 + floor(rozum/2)`) | Wyświetlane w karcie postaci i używane w testach dialogowych oraz walce. |
| **Dialogi i testy** | `chance = clamp(skillOrAttr10 - difficulty + 50, 5, 95)`, blokada powtórek (`failedChecks`), retorty | Rozszerzenie wyboru dialogowego o test `%`, podgląd szansy, obsługę flag (`rozkaz_danina`, `rozkaz_bez_powrotu`, `tow_*`) i osi `wola`/`dlug`. |
| **Walka** | 2 pasy (`melee`/`far`), AP `5 + floor(zrecznosc/2)`, ataki celowane, `nonLethal`, `onDefeat` | Wykorzystanie turowej walki izometrycznej `ulfRPG` (`combatSystem.ts` ma już `aimed_head`, `aimed_torso`, `aimed_legs`) + obsługa trybu treningowego (sparing) i skryptowanej porażki (Upiory Nocy). |
| **Czas, głód, zjawiska** | Pory dnia (`swit`, `dzien`, `zmierzch`, `noc`), głód, `burza_iskier` | Zegar gry sprzężony z oświetleniem `deferredPipeline.ts` (świt, południe, zmierzch, nocna burza iskier). |

---

## 3. Zakres Prologu 2.5D (Mapa przejścia)

1. **Wstęp i Kreator (`prolog_wstep` → `prolog_wstep_wies` → `demo_swit` → `demo_kreator`):**
   - Plansze narracyjne wprowadzające Cesarstwo, spadające gwiazdy i Brzezinę, następnie kreator postaci przed obliczem Mistrza Gnieworad.
2. **Lokacja 1 — `brzezina_dziedziniec` (Szkoła Ostrzy w Brzezinie):**
   - **Sparing:** walka treningowa (`nonLethal: true`) z Instruktorem Radogostem; wygrana/przegrana + postawa (`wola`/`dlug`) + nagroda (`+160 XP` → awans na 2. poziom i wybór atutu, `15 gr`, `kaptur_mysliwego`).
   - **Południe:** przybycie Kuriera Cesarskiego (testy `Wymowa 40` / `Skradanie 35`, wybór postawy).
   - **Delegacja:** Gnieworad wyznacza 4 adeptów (Gracz, Skarimir, Ragnosława, Wojmir Cienki).
   - **Kram:** Kwatermistrz Dobrogost (testy `Handel 35`, `Wymowa 40`, handel za grosze).
   - **Brama:** rozmowy z towarzyszami i wymarsz o świcie.
3. **Lokacja 2 — `trakt_zasadzka` (Dzień 1 na trakcie do Wilczego Brodu):**
   - Zasadzka 2× `bandyta` (łup: artefakt `kamien_zmierzchu`) + scena przy ognisku z towarzyszami.
4. **Lokacja 3 — `uroczysko_noc` (Dzień 2: Burza Iskier i Noc Upiorów):**
   - Zjawisko `burza_iskier`, atak 2× `upior_nocy` (90% redukcji obrażeń ciętych/kłutych, `onDefeat` → omdlenie), śmierć towarzyszy i spotkanie z **Istotą** (pełne uleczenie, `dlug_istoty`, wybór `wola`/`dlug`).
5. **Lokacja 4 — `pobojowisko_swit` (Świt i Rozdroże):**
   - Przeszukanie ciał (Skarimir, Ragnosława, Wojmir) i plecaka przewodnika (`mapa_przewodnika`), ukrycie insygniów szkoły, decyzja na rozdrożu (`odrzucil_stolice` / `waha_sie`) i zejście ku Wilczemu Brodowi (koniec Prologu).

---

## 4. Gotowe prompty robocze (kolejność etapów)

### Etap 1 — Szkielet projektu i most do `ulfRPG`
> „Zainicjuj projekt Vite + TypeScript w `C:\laragon\www\ostrze` z osobnym katalogiem `src/game/` i warstwą `src/engine-bridge/` korzystającą z silnika `../ulfRPG/src` (bez modyfikowania treści w `../ulfRPG`). Uruchom pustą scenę testową 2.5D z działającym buildem i testami.”

### Etap 2 — Rdzeń zasad `origin` i adapter danych JSON
> „W `src/game/rules/` i `src/game/data/` zaimplementuj adapter ładujący JSON-y z `origin/data/` oraz silnik reguł *Ostrza*: 7 atrybutów, 11 umiejętności, 2 klasy (`miecz`, `wlocznia`), `getStats`, rzuty kością z seedem (`dice.js`), sprawdzanie warunków (`if`), flagi i osie `wola`/`dlug`.”

### Etap 3 — Kreator postaci, ekran narracji i dialogi z testami %
> „Zbuduj UI kreatora postaci (klasa, atrybuty, 3 oznaczone umiejętności), modal/ekran narracji dla scen `story.json` oraz rozszerz system dialogów o procentowe testy umiejętności z blokadą ponownych prób (`failedChecks`) i obsługą handlu z Kwatermistrzem.”

### Etap 4 — Mapy 2.5D i pełna sekwencja Prologu
> „Utwórz 4 mapy 2.5D (`brzezina_dziedziniec`, `trakt_zasadzka`, `uroczysko_noc`, `pobojowisko_swit`) z NPC, światłem i porami dnia, a następnie zepnij całą sekwencję Prologu od `prolog_wstep` do `noc_bezdroza` (sparing non-lethal, awans na 2. poziom, kurier, kram, brama, bandyci, ognisko, Upiory Nocy z `onDefeat`, Istota, pobojowisko i rozdroże).”

### Etap 5 — Weryfikacja i testy E2E Prologu
> „Przetestuj całą ścieżkę Prologu (obie klasy, wygrana i przegrana sparingu, testy dialogowe, walka z bandytami i upiorami, zapis/odczyt stanu) oraz uruchom `tsc --noEmit` i `vitest`.”
