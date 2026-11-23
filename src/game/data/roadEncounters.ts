import type { DialogueFileDef, OriginTravelEventDef } from './originTypes';

/**
 * 6 hand-crafted one-time (`once: true`) Slavic CRPG road encounters with skill checks
 * (Medycyna, Skradanie, Wiedza tajemna, Wymowa, Handel), moral choices (Wola/Dług),
 * and tangible rewards. Works seamlessly across Act I and Act II travel.
 */
export const ROAD_ENCOUNTER_DIALOGUES: Record<string, DialogueFileDef> = {
  road_dezerter: {
    id: 'road_dezerter',
    start: 'intro',
    nodes: {
      intro: {
        speaker: 'Ranny Dezerter (Wartownik)',
        text: 'Pod zwaloną brzozą siedzi młody żołnierz w poszarpanym cesarskim płaszczu. Trzyma się za zakrwawiony bok. „Nie... nie dobijaj. Uciekłem z kolumny, gdy kazali palić wsie. Pomóż zatamować krew, a oddam ci ostatnie grosze i powiem, którędy krąży patrol.”',
        options: [
          {
            id: 'heal',
            text: 'Opatrz ranę i nastaw żebro',
            check: { skill: 'medycyna', difficulty: 35, retry: false },
            success: 'healed',
            failure: 'fail_heal'
          },
          {
            id: 'intel',
            text: 'Wypytaj go o ruchy cesarskiej obławy bez dotykania ran',
            check: { skill: 'wymowa', difficulty: 35, retry: false },
            success: 'intel',
            failure: 'refuse'
          },
          {
            id: 'rob',
            text: 'Zabierz mu sakiewkę i zostaw losowi.',
            goto: 'robbed',
            actions: [{ giveMoney: 22 }, { addVar: { dlug: 1 } }]
          },
          {
            id: 'leave',
            text: 'Omiń go szerokim łukiem.'
          }
        ]
      },
      healed: {
        speaker: 'Ranny Dezerter (Wartownik)',
        text: 'Żołnierz oddycha z ulgą, ściskając świeży opatrunek. „Masz pewne ręce, wędrowcze. Weź te 18 groszy — i uważaj na wzgórzach po zmroku, oficerowie stawiają tam łuczników.”',
        actions: [{ giveMoney: 18 }, { giveXp: 30 }, { addVar: { wola: 1 } }],
        options: [{ text: 'Ruszaj dalej w drogę.' }]
      },
      fail_heal: {
        speaker: 'Ranny Dezerter (Wartownik)',
        text: 'Rana okazuje się głębsza, niż wyglądała, ale udaje ci się przynajmniej ciasno ją obwiązać. Dezerter kiwa głową z wdzięcznością i chowa się w gęstwinie.',
        actions: [{ giveXp: 10 }],
        options: [{ text: 'Ruszaj dalej.' }]
      },
      intel: {
        speaker: 'Ranny Dezerter (Wartownik)',
        text: '„Każą palić stodoły i zagarniać konie...” — dezerter szepcze szczegóły tras patroli i wciska ci garść monet za milczenie.',
        actions: [{ giveXp: 25 }, { giveMoney: 12 }],
        options: [{ text: 'Zapamiętaj tę wiedzę i idź dalej.' }]
      },
      robbed: {
        speaker: 'Ranny Dezerter (Wartownik)',
        text: 'Chłopiec nawet nie próbuje się bronić. Odchodzisz z cięższą sakiewką i cięższym sumieniem.',
        options: [{ text: 'Idź dalej.' }]
      },
      refuse: {
        speaker: 'Ranny Dezerter (Wartownik)',
        text: 'Dezerter zaciska zęby i odwraca wzrok. „Nic ci nie powiem, jeśli mi nie pomożesz.”',
        options: [{ text: 'Zostaw go i ruszaj w drogę.' }]
      }
    }
  },

  road_przemytnicy: {
    id: 'road_przemytnicy',
    start: 'intro',
    nodes: {
      intro: {
        speaker: 'Porzucony Wóz Przemytników',
        text: 'W błotnistym parowie przy trakcie dostrzegasz przewrócony wóz z zamalowanymi znakami. W krzakach obok słychać ciche głosy — dwóch przemytników szuka czegoś w ciemności, nie zauważając jeszcze twojej obecności.',
        options: [
          {
            id: 'steal',
            text: 'Zakradnij się do skrzyni pod plandeką i zgarnij zapasy',
            check: { skill: 'skradanie', difficulty: 35, retry: false },
            success: 'stolen',
            failure: 'spotted'
          },
          {
            id: 'trade',
            text: 'Wyjdź otwarcie i zaproponuj uczciwy wykup towaru',
            check: { skill: 'handel', difficulty: 30, retry: false },
            success: 'traded',
            failure: 'spotted'
          },
          {
            id: 'leave',
            text: 'Wycofaj się po cichu na główny trakt.'
          }
        ]
      },
      stolen: {
        speaker: 'Porzucony Wóz Przemytników',
        text: 'Bezszelestnie wyciągasz spod mokrej plandeki solidną Flaszę oleju i woreczek z monetami. Przemytnicy nawet nie drgnęli.',
        actions: [
          { giveItem: { id: 'flasza_oleju', qty: 1 } },
          { giveMoney: 15 },
          { giveXp: 30 }
        ],
        options: [{ text: 'Wróć na trakt.' }]
      },
      traded: {
        speaker: 'Porzucony Wóz Przemytników',
        text: 'Zaskoczeni przemytnicy wolą pozbyć się gorącego towaru niż ryzykować rozgłos. Zyskujesz Flaszę oleju i spokojny przejazd.',
        actions: [{ giveItem: { id: 'flasza_oleju', qty: 1 } }, { giveXp: 25 }],
        options: [{ text: 'Ruszaj dalej.' }]
      },
      spotted: {
        speaker: 'Porzucony Wóz Przemytników',
        text: 'Sucha gałąź trzaska pod butem! Przemytnicy zrywają się z krzykiem, zgarniają najcenniejsze pakunki i znikają w borze, zostawiając jedynie puste skrzynie.',
        options: [{ text: 'Ruszaj dalej w drogę.' }]
      }
    }
  },

  road_kamien_graniczny: {
    id: 'road_kamien_graniczny',
    start: 'intro',
    nodes: {
      intro: {
        speaker: 'Pradawny Kamień Graniczny',
        text: 'Pośrodku polany stoi pochylony głaz pokryty zatarłymi słowiańskimi runami. Powietrze wokół niego pachnie ozonem i mokrym mchem — dawni wędrowcy składali tu dary przed wejściem w głusz.',
        options: [
          {
            id: 'decipher',
            text: 'Odczytaj zatarte runy ochronne',
            check: { skill: 'wiedza_tajemna', difficulty: 25, retry: false },
            success: 'deciphered',
            failure: 'unclear'
          },
          {
            id: 'offer',
            text: 'Zostaw 5 groszy w zagłębieniu kamienia na szczęście.',
            requires: { money: 5 },
            goto: 'offering',
            actions: [{ takeMoney: 5 }, { healFull: true }, { addVar: { wola: 1 } }]
          },
          {
            id: 'leave',
            text: 'Idź dalej, nie zaczepiając dawnych mocy.'
          }
        ]
      },
      deciphered: {
        speaker: 'Pradawny Kamień Graniczny',
        text: 'Znak mówi o słabości upiorów wobec ognia i gwiezdnego żelaza. U podstawy kamienia znajdujesz kępę leczniczych ziół, a chłód ustępuje z kości.',
        actions: [{ giveXp: 35 }, { giveItem: { id: 'ziola', qty: 2 } }],
        options: [{ text: 'Ruszaj dalej.' }]
      },
      unclear: {
        speaker: 'Pradawny Kamień Graniczny',
        text: 'Większość znaków zjadł mróz i czas, ale chwila wytchnienia przy głazie porządkuje myśli.',
        actions: [{ giveXp: 10 }],
        options: [{ text: 'Ruszaj dalej.' }]
      },
      offering: {
        speaker: 'Pradawny Kamień Graniczny',
        text: 'Moneta brzmi cicho o kamień. Czujesz przypływ sił, a rany i zmęczenie z wielogodzinnego marszu ustępują (pełne HP).',
        options: [{ text: 'Kontynuuj podróż.' }]
      }
    }
  },

  road_znachor_kram: {
    id: 'road_znachor_kram',
    start: 'intro',
    nodes: {
      intro: {
        speaker: 'Wędrowny Zielarz',
        text: 'Na skraju drogi stary zielarz z koszem pełnym suszonych ziół poprawia pęknięty rzemień. „O! Zbrojna osoba! Pomóż zawiązać juki, albo dobijmy targu — mam świeżą odtrutkę i bandaż z lnianego płótna.”',
        options: [
          {
            id: 'bargain',
            text: 'Starguj cenę odtrutki i bandaża do 10 groszy',
            requires: { money: 10 },
            check: { skill: 'handel', difficulty: 30, retry: false },
            success: 'bargain_ok',
            failure: 'bargain_fail'
          },
          {
            id: 'identify',
            text: 'Pomóż mu rozpoznać rzadki korzeń w koszu',
            check: { skill: 'medycyna', difficulty: 30, retry: false },
            success: 'helped_herbalist',
            failure: 'bargain_fail'
          },
          {
            id: 'leave',
            text: 'Pożegnaj zielarza i idź dalej.'
          }
        ]
      },
      bargain_ok: {
        speaker: 'Wędrowny Zielarz',
        text: '„Twardy z ciebie kupiec, ale niech stracę!” — zielarz wręcza ci czysty bandaż i fiolkę odtrutki za zaledwie 10 groszy.',
        actions: [
          { takeMoney: 10 },
          { giveItem: { id: 'bandaz', qty: 1 } },
          { giveItem: { id: 'odtrutka', qty: 1 } },
          { giveXp: 20 }
        ],
        options: [{ text: 'Podziękuj i ruszaj w drogę.' }]
      },
      helped_herbalist: {
        speaker: 'Wędrowny Zielarz',
        text: '„Rzeczywiście, to nie zwykły łopian, lecz korzeń żywokostu! Weź dwa porządne bandaże w podzięce, wędrowcze.”',
        actions: [{ giveItem: { id: 'bandaz', qty: 2 } }, { giveXp: 25 }],
        options: [{ text: 'Ruszaj dalej.' }]
      },
      bargain_fail: {
        speaker: 'Wędrowny Zielarz',
        text: 'Staruszek kręci głową i zarzuca kosz na plecy. „Innym razem, panie. Zdrówka na szlaku!”',
        options: [{ text: 'Idź dalej.' }]
      }
    }
  },

  road_zasadzka_drzewo: {
    id: 'road_zasadzka_drzewo',
    start: 'intro',
    nodes: {
      intro: {
        speaker: 'Szabrownicy przy Zwalonym Pniu',
        text: 'Przez trakt leży świeżo ścięta sosna — klasyczna zapora rabusiów. Zza wykrotu wygląda trzech obdartych szabrowników z drągami. „Myto za przejazd, paniczu! Dwadzieścia groszy, albo sprawdzimy, czy masz miękkie żebra!”',
        options: [
          {
            id: 'bluff',
            text: 'Przekonaj ich, że tuż za tobą jedzie zbrojny podjazd ze strażnicy',
            check: { skill: 'wymowa', difficulty: 38, retry: false },
            success: 'bluff_ok',
            failure: 'pay_or_push'
          },
          {
            id: 'sneak',
            text: 'Zejdź niepostrzeżenie w jar i omiń blokadę bokiem',
            check: { skill: 'skradanie', difficulty: 35, retry: false },
            success: 'sneak_ok',
            failure: 'pay_or_push'
          },
          {
            id: 'pay',
            text: 'Rzuć im 15 groszy, żeby nie tracić czasu i krwi.',
            requires: { money: 15 },
            goto: 'paid',
            actions: [{ takeMoney: 15 }]
          }
        ]
      },
      bluff_ok: {
        speaker: 'Szabrownicy przy Zwalonym Pniu',
        text: 'Szabrownicy wymieniają nerwowe spojrzenia, słysząc o konnym patrolu. Po chwili znikają w lesie, zostawiając wolną drogę.',
        actions: [{ giveXp: 35 }, { addVar: { wola: 1 } }],
        options: [{ text: 'Ruszaj dalej.' }]
      },
      sneak_ok: {
        speaker: 'Szabrownicy przy Zwalonym Pniu',
        text: 'Przekradasz się dnem zarośniętego jaru. Gdy szabrownicy wciąż wypatrują ofiary na trakcie, ty jesteś już daleko za zakrętem.',
        actions: [{ giveXp: 30 }],
        options: [{ text: 'Kontynuuj marsz.' }]
      },
      paid: {
        speaker: 'Szabrownicy przy Zwalonym Pniu',
        text: 'Herszt łapie monety w locie i macha ręką. „Mądra głowa. Przechodź.”',
        options: [{ text: 'Idź dalej.' }]
      },
      pay_or_push: {
        speaker: 'Szabrownicy przy Zwalonym Pniu',
        text: 'Nie nabierają się! Z krzykiem ruszają z drągami — udaje ci się przedrzeć przez zarośla, ale tracisz czas na okrężną ścieżkę.',
        actions: [{ time: 30 }],
        options: [{ text: 'Otrzep się i ruszaj dalej.' }]
      }
    }
  },

  road_kapliczka_wedrowcow: {
    id: 'road_kapliczka_wedrowcow',
    start: 'intro',
    nodes: {
      intro: {
        speaker: 'Porzucona Kapliczka Wędrowców',
        text: 'Przy rozwidleniu leśnych ścieżek stoi drewniana kapliczka z wypalonym ogarkiem świecy. Pod daszkiem ktoś zostawił zawiniątko z suszonym chlebem i kartką zapisaną krzywym pismem.',
        options: [
          {
            id: 'study',
            text: 'Zbadaj symbole wyryte na daszku kapliczki',
            check: { skill: 'wiedza_tajemna', difficulty: 28, retry: false },
            success: 'blessed',
            failure: 'rest'
          },
          {
            id: 'rest',
            text: 'Odpocznij chwilę pod daszkiem i posil się chlebem.',
            goto: 'rest',
            actions: [{ healFull: true }]
          },
          {
            id: 'leave',
            text: 'Ruszaj dalej bez postoju.'
          }
        ]
      },
      blessed: {
        speaker: 'Porzucona Kapliczka Wędrowców',
        text: 'To dawny znak bezpieczeństwa Bractwa Szlaku. Chwila skupienia pod kapliczką przywraca siły i jasność umysłu.',
        actions: [{ giveXp: 30 }, { healFull: true }],
        options: [{ text: 'Ruszaj dalej w drogę.' }]
      },
      rest: {
        speaker: 'Porzucona Kapliczka Wędrowców',
        text: 'Krótki postój w osłoniętym miejscu pozwala złapać oddech przed dalszą drogą.',
        options: [{ text: 'Kontynuuj podróż.' }]
      }
    }
  }
};

export const ROAD_ENCOUNTER_TRAVEL_EVENTS: OriginTravelEventDef[] = [
  {
    id: 'ev_road_dezerter',
    kind: 'encounter',
    weight: 16,
    once: true,
    scenes: [{ id: 'sc_road_dezerter', type: 'dialogue', dialogue: 'road_dezerter' }]
  },
  {
    id: 'ev_road_przemytnicy',
    kind: 'encounter',
    weight: 16,
    once: true,
    scenes: [{ id: 'sc_road_przemytnicy', type: 'dialogue', dialogue: 'road_przemytnicy' }]
  },
  {
    id: 'ev_road_kamien_graniczny',
    kind: 'encounter',
    weight: 14,
    once: true,
    scenes: [{ id: 'sc_road_kamien_graniczny', type: 'dialogue', dialogue: 'road_kamien_graniczny' }]
  },
  {
    id: 'ev_road_znachor_kram',
    kind: 'encounter',
    weight: 14,
    once: true,
    scenes: [{ id: 'sc_road_znachor_kram', type: 'dialogue', dialogue: 'road_znachor_kram' }]
  },
  {
    id: 'ev_road_zasadzka_drzewo',
    kind: 'encounter',
    weight: 15,
    once: true,
    scenes: [{ id: 'sc_road_zasadzka_drzewo', type: 'dialogue', dialogue: 'road_zasadzka_drzewo' }]
  },
  {
    id: 'ev_road_kapliczka_wedrowcow',
    kind: 'encounter',
    weight: 14,
    once: true,
    scenes: [{ id: 'sc_road_kapliczka_wedrowcow', type: 'dialogue', dialogue: 'road_kapliczka_wedrowcow' }]
  }
];
