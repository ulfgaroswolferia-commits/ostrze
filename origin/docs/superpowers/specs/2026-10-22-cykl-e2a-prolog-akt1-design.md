# Cykl E2a – prolog i akt I (projekt)

> Data: 2026-10-22 · Źródło: `docs/koncepcja_fabu_y_i_podzia_na_akty.md` (Prolog: rozdz. 1–2; Akt I: rozdz. 3–4), `docs/koncepcja-gry.md` rozdz. 13 (zarys MVP), `docs/koncepcja_dialogi_narracja_i_przyk_ady.md` (styl, scena 3: nadejście Istoty) i ustalenia z brainstormingu (uwagi autora to inspiracje, nie sztywne wymagania).
> Poprzednie cykle: E1, E1b (układ paneli), C2c (ciosy celowane) i E3a (ilustracje) scalone do `master` (4bb7366); gałąź `cykl-e2a` zaktualizowana o `master` 2026-10-23.
> Cykl E: E1 panele → E1b układ → C2c ciosy → E3a ilustracje (wszystko scalone) → **E2a prolog + akt I** → E2b akt II → E2c akt III → E3b ilustracje do aktów (razem z treścią) → E3 szlif → E4 publikacja.
> Status: wykonany na gałęzi `cykl-e2a` (plan 2026-10-22-cykl-e2a-prolog-akt1.md, 8 zadań); przejrzany z użytkownikiem 2026-10-23: ilustracje do prologu i aktu I w zakresie E2a, dodany wstęp (2 sceny). Rulings: ognisko to popas w ciągu dnia 1 (bez deklarowanej pory); Istota ma bezwarunkową opcję „Słuchaj dalej” i dodatkową „Cesarz?…” przy `rozkaz_danina`.

## Cel

Gra zaczyna się prawdziwą fabułą: **szkoła ostrza → kurier z rozkazem → delegacja czterech adeptów → dwudniowy marsz → noc upiorów (zagłada towarzyszy, bohater traci przytomność) → przebudzenie z Istotą z gwiazd (dług) → świt: jedyny ocalały dociera do Wilczego Brodu**. Dalej zostają dotychczasowe sceny demo (komendant, zlecenie Wilczej nory, eskorta Ostromira) jako tymczasowy akt II, który przepisze E2b. Gra jest grywalna od początku do końca po każdym cyklu.

**Poza zakresem:** akt II i III (E2b, E2c), towarzysze w walce, wygrywalna wersja nocy upiorów, nowy balans walki (C2c), układ paneli (E1b), pełne wątki towarzyszy (tylko krótkie sceny).

## Przebieg

### Prolog – szkoła ostrza (rozdz. 1–2)
0. **Wstęp (dodany 2026-10-23, prośba użytkownika: „nie lądujemy od razu w akcji”):** dwie krótkie sceny narracji przed świtem w szkole, `story.start` = `prolog_wstep`:
   - `prolog_wstep` (tytuł „Ziemia pod gwiazdami”, ilustracja `wstep_gwiazdy`): cesarstwo, jego porządek („podatek płacisz, głowy nie podnosisz, o gwiazdach nie gadasz”), spadające gwiazdy, dziwne burze i mgły, po których we wsiach ubywa ludzi; urzędnicy zapisują to jako „klęski żywiołowe”, chłopi plują przez lewe ramię. Ton: surowa rubaszność, bez ujawniania Istoty i długu (tylko zapowiedź nieba, które „coś pamięta”).
   - `prolog_wstep_wies` (tytuł „Brzezina”, ilustracja `wstep_brzezina`): ostatnia wieś przed Pogórzem, daleko od stolicy („cesarza zna się tu z monety, a poborcę ze strachu”), szkoła ostrza na skraju, z biedaków robi się wojów, miecz albo włócznia, mistrz Gnieworad; zakończenie spinające z następną sceną („Dziś jest zwykły dzień. Tak przynajmniej wygląda od rana.”).
   - Każda scena 80–130 słów, bez testów i zmiennych; nie przesuwają zegara (`time` pominięte).
1. **Świt w szkole** → kreator (klasa miecza / włóczni) → **sparing** z Radogostem (istniejące sceny `demo_swit`, `demo_kreator`, `demo_sparing*`, lekko przycięte; postawa miecz/włócznia nadal ±1 `dlug`/`wola`).
2. **Kurier** (nowa scena narracji + dialog `kurier`): cesarski kurier w czerwonym płaszczu przy bramie czyta rozkaz Gnieworadowi. Dialog z testami: *Wymowa* (trudność 40) wyciąga treść – „delegacja młodych adeptów do stolicy; imiona wpisane z góry” (flaga `rozkaz_danina`), *Skradanie* (35) pozwala podsłuchać, że nikt nie mówi o powrocie (flaga `rozkaz_bez_powrotu`); postawa: pokorne przyjęcie `dlug` +1, pyskówka `wola` +1, brak testu = neutralnie.
3. **Delegacja** (dialog `delegacja`): Gnieworad wskazuje „najmniej ważnych”: bohatera i trzech towarzyszy (**Skarimir** – wesołek, miecz; **Ragnosława** – zadziorna, włócznia; **Wojmir Cienki** – nerwowy pisarczyk). Bohater może zapytać o powód (*Wymowa* 35 → Gnieworad mruknie coś o „żywej daniinie”, flaga `delegacja_danina`).
4. **Pożegnanie i przygotowania:** krótka scena przy bramie z towarzyszami (dialog `towarzysze`: 3 wejścia po 2–3 węzły, bez testów poza jednym drobnym), kwatermistrz i kram (istniejące `demo_kram*`, prowiant do kupienia).
5. **Marsz, 2 dni** (scena `travel`, trasa `brzezina_wilczy_brod`): dzień 1 – bandyci (zostają; towarzysze nie walczą, tylko komentują w narracji sceny), wieczorem rozmowa przy ognisku (dialog `ognisko`, zdarzenie obozu: Skarimir żartuje, Ragnosława pyta o rozkazy, Wojmir się boi; odpowiedzi ±1 `wola`/`dlug`, flaga `towarzysze_zaufanie` przy cieple wobec Wojmira). Dzień 2 – stałe zdarzenie **`noc_upiorow`**.

### Akt I – Noc upiorów i Przebudzenie (rozdz. 3–4)
6. **Rzeź na szlaku** (zdarzenie `noc_upiorow`, `endsTrip`):
   - narracja zmierzchu i znaki zjawiska: scena `phenomenon` (Iskrząca Burza, startuje od razu);
   - **walka** z 2 upiorami nocy (`upior_nocy`, patrz „Dane”); zwykła broń prawie nie rani (`damageTaken` sieczne/kłute ×0.1), ogień ×2; `canFlee: false`, `onDefeat` → scena omdlenia (bohater nigdy nie dostaje `DefeatError`);
   - narracja zagłady towarzyszy (kolejno Ragnosława, Skarimir, Wojmir – krótkie, bez patosu, w tonie rubasznej surowości); flagi `towarzysze_zgineli`.
7. **Przebudzenie** (dialog `istota`): środek nocy; akcja `healFull` (pełne HP, zdjęte efekty); Istota o czarnej szklanej twarzy mówi kwestię z dokumentu: „Tkanka zrośnięta. Rdzeń sprawny. Dług zaciągnięty. Zniszcz to, co zbudowano na tej ziemi.” Bohater ma 3 odpowiedzi: *pokorna* (`dlug` +1), *pytająca* (bez zmian, flaga `pytanie_o_dlug`), *buntownicza* (`wola` +1). Zawsze flaga `dlug_istoty`. Jeśli `rozkaz_danina` – dodatkowa linia Istoty („Rozkaz cesarza nie był poselstwem.”). Pełne znaczenie długu pozostaje ukryte.
8. **Świt**: zdarzenie się kończy (`endsTrip`), zegar jedzie do świtu, bohater (jedyny ocalały) „dociera” do Wilczego Brodu (powiadomienie o przybyciu). Scena `demo_kurier` przepisana: strażnica, komendant Wszebor widzi półżywego wędrowca w mundurze szkoły (insygnia delegacji do schowania – krótka wzmianka, flaga `ukryte_insygnia` do E2b), dalej `demo_komendant`, zlecenie, mapa, odpoczynek, `demo_przekora`/`demo_posluch`, `demo_zapis`, `demo_koniec`.

## Silnik (dwie zmiany)

1. **`endsTrip: true` na zdarzeniu podróży** (`data/travel.json`, `src/systems/travel.js` walidacja, `src/scenes/trip.js`): po odegraniu zdarzenia z `endsTrip` etap się kończy bez podsumowania i obozu – `world.travel.day` przeskakuje poza `daysTotal`, `runTrip` kończy pętlę, `waitForDawn` dowozi zegar do `departHour`, `endTravel` ustawia lokalizację celu, powiadomienie o przybyciu jak zwykle. Wznowienie zapisu w trakcie zdarzenia (`eventScene`) działa jak dotąd; po wznowieniu zdarzenie też kończy podróż. Zdarzenie `endsTrip` nie może być w tabeli losowej (`weight` 0) i tylko na trasie z `fixed` wskazującym je (walidacja).
2. **Akcja `healFull`** (`src/systems/actions.js`, `ACTION_KEYS`, walidacja – wartość `true`): `character.hp = hpMax` (z `getStats`), usuwa wszystkie efekty postaci (godzinowe i turowe), zdarzenie `{ type: "leczenie", hp }` do powiadomień. Dostępna w dialogach i zdarzeniach (wspólny system akcji).

Zmiana formatu zapisu nie jest potrzebna (`world.travel` już przechowuje `event`/`eventScene`); `rules.travel` bez zmian.

## Dane

- **`data/enemies.json`:** `upior_nocy` (kopia `upior_zwiadowca`): `hp` 150, `armor` 6, `damageTaken` `{ sieczne: 0.1, klute: 0.1, ogien: 2.0 }`, odporności jak zwiadowca, ataki Szpon (hit 70, 6–10) i Wycie; `art: "upior_zwiadowca"`, `xp` 0 (walka nie nagradza), `loot: []`. Walka zawsze kończy się przegraną gracza (dowód: test 200 ziaren).
- **`data/travel.json`:** zdarzenie `noc_upiorow` (`kind: "story"`, `weight: 0`, `endsTrip: true`, sceny jak wyżej); trasa `brzezina_wilczy_brod` `fixed`: `"2": "noc_upiorow"` (dzień 1 bez zmian).
- **`data/dialogues/`:** `kurier.json`, `delegacja.json`, `towarzysze.json`, `ognisko.json`, `istota.json` (węzły i testy jak wyżej; styl: rubaszność i surowość, bez ogonków w `id`, polskie teksty); drobne korekty `kwatermistrz.json` (wzmianka o kurierze już przybyłym).
- **`data/story.json`:** `start` = `prolog_wstep`, dwie sceny wstępu (patrz „Przebieg”, pkt 0), następnie nowe sceny prologu i aktu I w kolejności z „Przebieg”; usunięte `demo_droga` (list do komendanta zastąpiony rozkazem delegacji); `demo_kurier` przepisany; `time` na scenach tak, by sparing/kurier/przygotowania zajmowały ok. 1 dzień przed odejściem o świcie następnego dnia.
- **`data/ui.json`:** nowe klucze tylko tam, gdzie potrzeba (np. powiadomienie `action.heal`).
- **`data/rules.json`:** bez zmian.

## Decyzje (do zatwierdzenia przy przeglądzie)

| Decyzja | Wybór | Powód / koszt |
|---|---|---|
| Los dema | Początek przepisany na prawdziwą fabułę, reszta (komendant, zlecenie, eskorta) zostaje jako tymczasowy akt II | Decyzja użytkownika. Koszt: fabularny „szew” między nocą upiorów a komendantem, naprawi E2b. |
| Towarzysze | Trzech nazwanych (Skarimir, Ragnosława, Wojmir), tylko fabularnie, giną w narracji | Decyzja użytkownika (opcja 1). |
| Noc upiorów | Nie do wygrania zwykłą bronią, zawsze `onDefeat` | Decyzja użytkownika. Wygrywalna wersja z ogniem/artefaktem – ewentualnie w E2b/E2c. |
| Zdarzenie jako koniec podróży | `endsTrip` (silnik), a nie osobna trasa | Najmniejsza zmiana; trasa Wilczy Bród już istnieje. |
| Gałąź | `cykl-e2a` zaktualizowana o `master` (E1, E1b, C2c, E3a scalone) | Ramki, nowa walka i ilustracje są już w kodzie; testy TTY korzystają z `readFrame`. |
| Ilustracje | W zakresie E2a (decyzja użytkownika 2026-10-23) | Gra ma być mocno ilustrowana; nowe sceny i postacie dostają obrazy od razu. Koszt: dłuższy cykl. |
| Rozstrzygnięcie `wola`/dług | Nie zmieniamy sprzeczności „głodny wędrowiec vs `demo_przekora`” (E3) | Decyzja użytkownika z wcześniejszego cyklu. |

## Ilustracje (E3a: format `.pix`, pola `art`/`portrait`)

Rysuje asystent (styl zatwierdzony w E3a: sylwetki, paleta 256, przezroczyste tło); podgląd `node bin/game.js --art <id>`.

- **Portrety (20×20), pole `portrait` na rozmowie lub węźle:** `portret_kurier` (`kurier`), `portret_gnieworad` (`delegacja`, Gnieworad w `kurier`), `portret_skarimir`, `portret_ragnoslawa`, `portret_wojmir` (węzły `towarzysze` i `ognisko` dostają `portrait` per mówca), `portret_istota` (`istota`: czarna szklana twarz).
- **Sceny (do 48×20), pole `art`:** `wstep_gwiazdy` (`prolog_wstep`: noc, spadająca gwiazda nad wzgórzami), `wstep_brzezina` (`prolog_wstep_wies`: wieś, dym z kominów, szkoła na skraju), `kurier_plac` (`prolog_kurier_narracja`), `ognisko_druzyna` (`bandyci_ognisko`, czworo przy ogniu), `noc_upiory` (narracja ataku i walka nocy w scenach `noc_*`), `noc_ciemnosc` (`noc_omdlenie`, `noc_zaglada`), `noc_istota` (`noc_przebudzenie`), `swit_ocalaly` (`noc_swit`). Istniejące `szkolka`, `kram`, `wymarsz`, `trakt`, `oboz`, `mapa_brod` zostają użyte tam, gdzie pasują (szkoła, kram, brama, `demo_kurier`).
- Walka z `upior_nocy` używa istniejącej grafiki `upior_zwiadowca`.
- Testy: każde `art`/`portrait` istnieje i mieści się w limicie (walidacja danych), a demo w TTY 200×50 w kolorze ma ilustracje w klatkach prologu i nocy (jak e2e E3a).

## Testy

- **Silnik:** `endsTrip` – po zdarzeniu podróż kończy się w celu (`location = wilczy_brod`, `travel = null`), zegar na `departHour`, powiadomienie o przybyciu, brak obozu i podsumowania etapu; zapis w trakcie zdarzenia wznawia się i też kończy podróż; walidacja odrzuca `endsTrip` z `weight > 0` i bez `fixed`. `healFull` – HP = max, efekty zdjęte, zdarzenie `leczenie`; walidacja `healFull: false`/liczby odrzucona.
- **Treść:** `node bin/game.js --validate`; `upior_nocy` – 200 ziaren, klasa miecza i włóczni, gracz zawsze przegrywa, `onDefeat` osiągany, HP po walce = 1, nigdy `DefeatError`; dialogi: każdy węzeł osiągalny, testy `Wymowa`/`Skradanie` mają sukces i porażkę, flagi i zmienne ±1 jak w opisie.
- **Przebieg:** test sceny po scenie od menu do `demo_koniec` w trybie liniowym i w TTY 80×24 (zaktualizowane e2e demo, `createAdaptiveIO`), zapis i wczytanie w środku zdarzenia nocy, powrót do stanu bez przerwy; kontrola, że po przebudzeniu HP = max i `dlug_istoty` ustawiona.
