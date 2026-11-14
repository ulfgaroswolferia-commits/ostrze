# Przegląd treści całej gry (język, logika, trywialność, spójność) – wyniki

Zakres: wszystkie dialogi (113), sceny miejsc i zdarzeń (travel.json), opisy zleceń, sceny fabuły i opisy przedmiotów. Metody: (1) skan automatyczny wszystkich tekstów (powtórzenia słów, interpunkcja, niedomknięte cudzysłowy, rodzaj gramatyczny Istoty, współczesne słowa), (2) czytanie scena po scenie aktów I–V, (3) test graficzny scen fabuły (osiągalność scen i zakończeń).

Znalezione i naprawione (testy: `test/content_quality.test.js`):
- **Szablonowe kwestie powrotne NPC** – 57 scen (≈20 postaci aktów I–III) używało trzech tych samych fraz („Spać nie możesz, psia mać?”, „Idź no człowieku, znajdź sobie zajęcie”, „Nie mam teraz czasu, muszę się podrapać”). Każda postać ma teraz własne trzy kwestie (krótsze z każdą wizytą), test zakazuje powrotu szablonu i identycznych tekstów pogadanek.
- **Rodzaj Istoty** – w aktach I–III mówiła „spodziewałem się”, „ostrzegałem”, w IV–V po żeńsku; ujednolicone do żeńskiego.
- **Dwie Jagi** – wdowa z Głuszca i zielarka z bagien miały to samo imię; zielarka to teraz Żywia.
- **„Zapamiętam ci to”** (niejasna fraza opcji gracza) → „Zapamiętam.”
- Akty IV–V: drugi przegląd spójności po recenzjach cykli (Ostrze/Para Gwiazd w epilogu, obietnica `istota_wyrok` przy portalu sprawnym, maska i imię Istoty, zdanie podsumowujące zależne od wyniku).

Sprawdzone i bez zastrzeżeń: akcenty gwarowe i humor aktów I–III (spójne), opisy przedmiotów (115, żaden się nie powtarza), opisy zleceń, osiągalność wszystkich scen fabuły i obu zakończeń, brak współczesnych słów i literówek wykrywalnych skanem.

Trywialność (obserwacje, bez zmian): zwykli wrogowie (szabrownicy, Jarnowianie) wygrywają w symulacji ~100% z Ostrzem – to cecha balansu (Ostrze jest silne, napięcie dają bossowie i atrycja HP bez odpoczynku), warto zweryfikować w grze.

Nie zrobiono (wymaga gracza, nie testu): pełne przejście całej gry ręcznie; ocena rytmu i długości dialogów w terminalu.
