# Ledger E2b3 + E2d (wykonanie natywne, bez osobnego pliku planu – spec jest planem)

Spec: docs/superpowers/specs/2026-10-24-cykl-e2b3-e2d-dopracowanie-walka-design.md · Wytyczne: docs/wytyczne-tresci-i-qa.md

- Głowa: kara 30→20 + `masteryRelief {per 25, amount 5}`; `zonePenalty` w techniques.js; opis w interfejsie pokazuje aktualną karę.
- Włócznie: **zbadano najpierw** – combo (`dual`) i rzut z dystansu (`throw`) działały, ale były ukryte w „Techniki”, a rzut nazywał się „Para włóczni” i liczył się z miotania. Poprawki: `throwName`/`throwSkill` w przedmiocie, „Atak obiema” i „Rzuć: Włócznia” w menu głównym.
- Wklejanie: `readKey` zbiera resztę porcji (`ahead`), czyszczone w następnym ticku/przy `ask`.
- Zakończenie: Ruling: `demo_koniec` jest wyjściem „Zamknij dzień” z huba przed `akt2_koniec` (to nie porażka eskorty); tekst nie mówi już o „Akcie I” – zmiana mechaniki pętli odłożona (wymagałaby przebudowy ~12 testów e2e) – koszt: gracz zamykający dzień w hubie kończy grę.
- Riposty: audyt – wszystkie 11 testów w dialogach mają węzeł porażki ≥100 zn.; test `guidelines.test.js` to pilnuje. NPC do pogadania: każda lokacja ma ≥1 postać z 5 scenami.
- Grafiki: portrety Wrzosek, kowal, leśniczy, żona Borka, córka; obraz Leśniczówki; trakt.pix podpięty do Traktu. Kramarz: brak dialogu (sklep ma obraz `kram`) – pominięty.
- Testy: 1002/1002, `--validate` czyste.

## Recenzja końcowa (Opus) i tura poprawek
- Final: fixed bufor wklejki omijał discardInput — test io „discardInput odrzuca resztę porcji”, suite 1005/1005
- Final: fixed Ctrl+C w ogonie porcji połykany — test io „Ctrl+C w ogonie”; stare setImmediate nie czyści nowszego bufora
- Final: fixed „Trafienie −0” → „±0”; „Podnieś: Włócznia” w menu głównym po rzucie, martwy „Rzuć” ukryty
- Final: minor (deferred): kursor menu walki po indeksie; symulacja przeżywalności na prawdziwych danych (200 losowań) tylko dla szansy głowy; test wklejania w polu imienia w ramce; test guidelines 1.4 liczy też sceny techniczne; portret kramarza (brak dialogu)
