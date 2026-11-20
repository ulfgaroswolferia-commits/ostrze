import type { DialogueFileDef, ItemDef } from './originTypes';

/**
 * Overlay items for the expanded Prologue companion arcs (Skarimir, Ragnosława, Wojmir).
 * Stored in src/game/data/ so origin/data/ remains untouched as canonical source.
 */
export const PROLOGUE_COMPANION_ITEMS: ItemDef[] = [
  {
    id: 'slonina_na_droge',
    name: 'Kawałek wędzonej słoniny',
    type: 'quest',
    value: 3,
    weight: 0.4,
    description:
      'Zawinięty w lnianą szmatkę kawał wędzonej słoniny, wycyganiony z kuchni Szkoły Ostrzy dla Skarimira.'
  },
  {
    id: 'kosc_skarimira',
    name: 'Kość do gry Skarimira',
    type: 'quest',
    value: 0,
    weight: 0.1,
    description:
      'Wystrugana z jeleniego rogu sześciościenna kość z wyszczerbioną szóstką. Skarimir żartował, że zawsze przynosi mu kolację.'
  },
  {
    id: 'miedziak_ragnoslawy',
    name: 'Miedziak zakładu Ragnosławy',
    type: 'quest',
    value: 0,
    weight: 0.1,
    description:
      'Stary, nadgryziony miedziak, którym Ragnosława przybiła zakład o pierwsze piwo w stolicy. Został po niej na pobojowisku.'
  },
  {
    id: 'list_wojmira',
    name: 'Zapieczętowany list Wojmira',
    type: 'quest',
    value: 0,
    weight: 0.1,
    description:
      'Starannie złożona kartka pokryta równym pismem Wojmira Cienkiego, zaadresowana do jego matki pod Brzeziną.'
  }
];

/**
 * Overlay dialogues for individual companion interactions across:
 * 1. Brzezina (1-on-1 dialogues + 3 optional mini-favors using courtyard props/NPCs),
 * 2. Trakt (individual campfire conversations reacting to Brzezina bonds),
 * 3. Pobojowisko o Świcie (individual examination of each fallen companion + keepsakes),
 * 4. Akt 1 — Wilczy Bród (inn echoes honoring the fallen companions).
 */
export const PROLOGUE_COMPANION_DIALOGUES: Record<string, DialogueFileDef> = {
  // =========================================================================
  // 1. BRZEZINA — SKARIMIR (1-na-1 + przysługa „Słonina na drogę”)
  // =========================================================================
  brzezina_skarimir: {
    id: 'brzezina_skarimir',
    portrait: 'portret_skarimir',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Skarimir',
        text: 'Skarimir podrzuca w dłoni wystruganą z rogu kość do gry i szczerzy zęby. „Do stolicy, na cesarski koszt! Jak nas po drodze nic nie zeżre, to chociaż się tam najemy. Tylko spójrz na ten szkolny kocioł — sama wodnista kasza. Na pusty brzuch nawet wesołek marnieje.”',
        options: [
          {
            id: 'oddaj_slonine',
            text: 'Wręcz mu wycyganioną wędzoną słoninę.',
            requires: {
              all: [
                { flag: 'przysluga_skarimir_start' },
                { notFlag: 'przysluga_skarimir_done' },
                { item: 'slonina_na_droge' }
              ]
            },
            actions: [
              { takeItem: 'slonina_na_droge' },
              { setFlag: 'przysluga_skarimir_done' },
              { setFlag: 'tow_skarimir' },
              { addVar: { wiez_skarimir: 1 } },
              { giveXp: 20 }
            ],
            goto: 'slonina_oddana'
          },
          {
            id: 'smiech_razem',
            text: 'Roześmiej się z nim: „W kupie zawsze raźniej, nawet na cesarski trakt.”',
            requires: { notFlag: 'tow_skarimir' },
            actions: [
              { setFlag: 'tow_skarimir' },
              { addVar: { wiez_skarimir: 1 } }
            ],
            goto: 'po_smiechu'
          },
          {
            id: 'powaga_skarimir',
            text: '„Nie czas na żarty, Skarimirze. Sprawdź lepiej broń.”',
            requires: { notFlag: 'tow_skarimir' },
            actions: [{ setFlag: 'tow_skarimir' }],
            goto: 'po_powadze'
          },
          {
            id: 'zaproponuj_slonine',
            text: '„Chcesz prawdziwej omasty na drogę? Zobaczę, co da się wyciągnąć z kotła albo od Dobrogosta.”',
            requires: {
              all: [
                { notFlag: 'przysluga_skarimir_start' },
                { notFlag: 'przysluga_skarimir_done' }
              ]
            },
            actions: [
              { setFlag: 'przysluga_skarimir_start' },
              { setFlag: 'tow_skarimir' }
            ],
            goto: 'przysluga_przyjeta'
          },
          {
            id: 'przypomnij_slonine',
            text: '„Gdzie szukać tej słoniny?”',
            requires: {
              all: [
                { flag: 'przysluga_skarimir_start' },
                { notFlag: 'przysluga_skarimir_done' }
              ]
            },
            goto: 'przysluga_podpowiedz'
          },
          {
            id: 'koniec',
            text: '„Trzymaj się, Skarimirze. Zaraz ruszamy.”',
            goto: 'end'
          }
        ]
      },
      po_smiechu: {
        speaker: 'Skarimir',
        text: 'Wali cię otwartą dłonią w plecy tak, że aż dzwoni ci w uszach. „No! O to idzie! W kupie zawsze raźniej, nawet do grobu. Słuchaj — jakbyś kręcił się koło paleniska albo kramu Dobrogosta, rzuć okiem, czy nie został po śniadaniu kawałek słoniny. Na samym sucharze do stolicy nie dociągnę.”',
        options: [
          {
            id: 'przyjmij_slonine',
            text: '„Załatwię ci tę słoninę przed wymarszem.”',
            requires: { notFlag: 'przysluga_skarimir_start' },
            actions: [{ setFlag: 'przysluga_skarimir_start' }],
            goto: 'przysluga_przyjeta'
          },
          {
            id: 'odpusc_slonine',
            text: '„Zobaczymy, czy starczy czasu.”',
            goto: 'end'
          }
        ]
      },
      po_powadze: {
        speaker: 'Skarimir',
        text: 'Skarimir wzrusza ramionami i chowa kość do kieszeni. „Jak chcesz, ponuraku. Ale jak przyjdzie do marszu o pustym żołądku, jeszcze zatęsknisz za moim gadaniem.”',
        options: [
          {
            id: 'jednak_slonina',
            text: '„Zaczekaj. Skoro tak narzekasz na kaszę, rozejrzę się przy palenisku za czymś konkretniejszym.”',
            requires: { notFlag: 'przysluga_skarimir_start' },
            actions: [{ setFlag: 'przysluga_skarimir_start' }],
            goto: 'przysluga_przyjeta'
          },
          {
            id: 'koniec_powaga',
            text: 'Odejdź.',
            goto: 'end'
          }
        ]
      },
      przysluga_przyjeta: {
        speaker: 'Skarimir',
        text: 'Oczy Skarimira rozbłyskują. „Prawdziwy druh! Zajrzyj do Paleniska na środku dziedzińca — przy kotle wisi czasem zapas kuchni, a Dobrogost kręci się obok. Jak wrócisz ze słoniną, na pierwszym popasie stawiam ci najlepszą historię w całej prowincji!”',
        options: [{ text: 'Zaraz wracam.', goto: 'end' }]
      },
      przysluga_podpowiedz: {
        speaker: 'Skarimir',
        text: '„Zajrzyj do Paleniska na środku placu — tam kucharz zostawia zapas w lnianym zawiniątku, albo po prostu targuj się z Dobrogostem.”',
        options: [{ text: 'Jasne.', goto: 'end' }]
      },
      slonina_oddana: {
        speaker: 'Skarimir',
        text: 'Skarimir łapie zawiniątko, wącha je z nabożeństwem i chowa głęboko do torby. „Na bogów, pachnie dymem i solą! Nie zapomnę ci tego, słowo adepta. Jak na trakcie zrobi się gorąco, patrz na moje plecy — nie dam cię zajść z boku.”',
        options: [{ text: '„Dzielimy się na popasie.”', goto: 'end' }]
      }
    }
  },

  brzezina_skarimir_kociol: {
    id: 'brzezina_skarimir_kociol',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Palenisko Dziedzińca',
        text: 'Nad dogasającym paleniskiem wisi ciężki kocioł z kaszą, a obok na kołku dynda lniane zawiniątko z wędzoną słoniną. Kwatermistrz Dobrogost łypie w tę stronę ze swojego kramu.',
        options: [
          {
            id: 'skradnij_slonine',
            text: 'Zwiń zawiniątko, gdy Dobrogost odwróci wzrok.',
            check: { skill: 'skradanie', difficulty: 30 },
            success: 'sukces_skradanie',
            failure: 'porazka_skradanie'
          },
          {
            id: 'zagadaj_dobrogosta',
            text: 'Poproś Dobrogosta o dodatkową porcję dla czwórki wysyłanej w daleką drogę.',
            check: { skill: 'wymowa', difficulty: 32 },
            success: 'sukces_wymowa',
            failure: 'porazka_wymowa'
          },
          {
            id: 'kup_slonine',
            text: 'Rzuć Dobrogostowi 3 grosze za kawałek wędzonej słoniny.',
            requires: { money: 3 },
            actions: [
              { takeMoney: 3 },
              { giveItem: 'slonina_na_droge' }
            ],
            goto: 'kupiona'
          },
          {
            id: 'odejdz',
            text: 'Zostaw kocioł w spokoju.',
            goto: 'end'
          }
        ]
      },
      sukces_skradanie: {
        speaker: 'Palenisko Dziedzińca',
        text: 'Jednym płynnym ruchem zdejmujesz zawiniątko z kołka i chowasz za pazuchę, zanim Dobrogost zdąży odłożyć księgę rachunkową. Skarimir będzie zachwycony.',
        actions: [{ giveItem: 'slonina_na_droge' }],
        options: [{ text: 'Zanieś słoninę Skarimirowi.', goto: 'end' }]
      },
      porazka_skradanie: {
        speaker: 'Kwatermistrz Dobrogost',
        text: '„Łapy przy sobie, smarkaczu!” — woła Dobrogost znad kramu. „Jak chcesz omasty, to albo mnie przekonaj, albo rzuć trzy grosze!”',
        options: [{ text: 'Wycofaj się o krok.', goto: 'start' }]
      },
      sukces_wymowa: {
        speaker: 'Kwatermistrz Dobrogost',
        text: 'Dobrogost mruczy pod nosem, ale w końcu macha ręką. „No dobra, idziecie na cesarski szlak, a nie na odpust. Bierz ten kawał słoniny i nie mów Gnieworadowi.”',
        actions: [{ giveItem: 'slonina_na_droge' }],
        options: [{ text: 'Zanieś słoninę Skarimirowi.', goto: 'end' }]
      },
      porazka_wymowa: {
        speaker: 'Kwatermistrz Dobrogost',
        text: '„Rozkaz mówi: kasza i suchary. Jak ci mało, zapłać trzy grosze z własnej kiesy.”',
        options: [{ text: 'Rozumiem.', goto: 'start' }]
      },
      kupiona: {
        speaker: 'Kwatermistrz Dobrogost',
        text: 'Monety brzęczą w dłoni kwatermistrza. „Uczciwy interes. Bierz słoninę i trzymaj ją z dala od słońca.”',
        options: [{ text: 'Zanieś słoninę Skarimirowi.', goto: 'end' }]
      }
    }
  },

  // =========================================================================
  // 2. BRZEZINA — RAGNOSŁAWA (1-na-1 + przysługa „Czerwona pieczęć”)
  // =========================================================================
  brzezina_ragnoslawa: {
    id: 'brzezina_ragnoslawa',
    portrait: 'portret_ragnoslawa',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Ragnosława',
        text: 'Ragnosława opiera włócznię o ramię i mierzy cię chłodnym, uważnym spojrzeniem. „Wiesz, co mnie gryzie? List zapieczętowany cesarską czerwienią, a Mistrz Gnieworad ani razu nie spojrzał nam w oczy. Czemu akurat my czworo? Jeśli czegoś nie wiemy, chcę to wiedzieć przed bramą.”',
        options: [
          {
            id: 'raport_tropu',
            text: 'Opowiedz jej, czego dowiedziałeś się o czerwonej pieczęci.',
            requires: {
              all: [
                { flag: 'przysluga_ragnoslawa_start' },
                { flag: 'ragnoslawa_trop_odkryty' },
                { notFlag: 'przysluga_ragnoslawa_done' }
              ]
            },
            actions: [
              { setFlag: 'przysluga_ragnoslawa_done' },
              { setFlag: 'tow_ragnoslawa' },
              { addVar: { wiez_ragnoslawa: 1 } },
              { giveXp: 20 }
            ],
            goto: 'trop_przekazany'
          },
          {
            id: 'zaklad_piwo',
            text: '„Zobaczymy na miejscu. Ale zakład stoi: kto pierwszy stanie w stolicy, temu drugie stawia piwo.”',
            requires: { notFlag: 'tow_ragnoslawa' },
            actions: [
              { setFlag: 'tow_ragnoslawa' },
              { addVar: { wola: 1, wiez_ragnoslawa: 1 } }
            ],
            goto: 'po_zakladzie'
          },
          {
            id: 'chlodne_milczenie',
            text: '„Rozkazy nie są od dociekania. Lepiej trzymać język za zębami.”',
            requires: { notFlag: 'tow_ragnoslawa' },
            actions: [
              { setFlag: 'tow_ragnoslawa' },
              { addVar: { dlug: 1 } }
            ],
            goto: 'po_chlodzie'
          },
          {
            id: 'zacznij_trop',
            text: '„Mogę wypytać Radogosta albo Kuriera, co naprawdę kryje się za tym rozkazem.”',
            requires: {
              all: [
                { notFlag: 'przysluga_ragnoslawa_start' },
                { notFlag: 'przysluga_ragnoslawa_done' }
              ]
            },
            actions: [
              { setFlag: 'przysluga_ragnoslawa_start' },
              { setFlag: 'tow_ragnoslawa' }
            ],
            goto: 'trop_przyjetty'
          },
          {
            id: 'przypomnij_trop',
            text: '„Kogo najlepiej wypytać o ten list?”',
            requires: {
              all: [
                { flag: 'przysluga_ragnoslawa_start' },
                { notFlag: 'ragnoslawa_trop_odkryty' },
                { notFlag: 'przysluga_ragnoslawa_done' }
              ]
            },
            goto: 'trop_podpowiedz'
          },
          {
            id: 'koniec',
            text: '„Uważaj na siebie, Ragnosławo.”',
            goto: 'end'
          }
        ]
      },
      po_zakladzie: {
        speaker: 'Ragnosława',
        text: 'Parska krótkim śmiechem — pierwszy raz od rana — i wyciąga z sakiewki stary, nadgryziony miedziak. „Stoi! Ten miedziak to mój zastaw. Tylko nie myśl, że dam ci wygrać.” Ścisza głos: „Zanim jednak wyjdziemy, wybadaj Radogosta albo tego kuriera. Radogost może puścić parę z ust, co oznacza ta czerwona pieczęć.”',
        options: [
          {
            id: 'wez_trop',
            text: '„Zrobię to. Zaraz z nimi pomówię.”',
            requires: { notFlag: 'przysluga_ragnoslawa_start' },
            actions: [{ setFlag: 'przysluga_ragnoslawa_start' }],
            goto: 'trop_przyjetty'
          },
          {
            id: 'nie_teraz',
            text: '„Zobaczymy, czy powiedzą choć słowo.”',
            goto: 'end'
          }
        ]
      },
      po_chlodzie: {
        speaker: 'Ragnosława',
        text: 'Ragnosława krzywi się i spluwa w piach. „Gadasz zupełnie jak Gnieworad. Ale gdybyś jednak zmienił zdanie i chciał wiedzieć, po co nas naprawdę wysyłają, wypytaj Radogosta albo kuriera.”',
        options: [
          {
            id: 'jednak_trop',
            text: '„Dobra. Sprawdzę, co wie Radogost albo kurier.”',
            requires: { notFlag: 'przysluga_ragnoslawa_start' },
            actions: [{ setFlag: 'przysluga_ragnoslawa_start' }],
            goto: 'trop_przyjetty'
          },
          {
            id: 'odejdz',
            text: 'Odejdź.',
            goto: 'end'
          }
        ]
      },
      trop_przyjetty: {
        speaker: 'Ragnosława',
        text: '„Dobrze. Porozmawiaj z Instruktorem Radogostem na placu albo z Cesarskim Kurierem — nie pytaj wprost, tylko patrz, jak reagują. Wróć do mnie, zanim ruszymy.”',
        options: [{ text: 'Zaraz wrócę.', goto: 'end' }]
      },
      trop_podpowiedz: {
        speaker: 'Ragnosława',
        text: '„Podejdź do Radogosta na środku placu albo do Cesarskiego Kuriera. Któryś z nich na pewno wie więcej, niż mówi.”',
        options: [{ text: 'Sprawdzę to.', goto: 'end' }]
      },
      trop_przekazany: {
        speaker: 'Ragnosława',
        text: 'Ragnosława słucha w kamiennym milczeniu, zaciskając palce na drzewcu włóczni. „Więc jednak... nie delegacja zaszczytna, tylko pobór bez biletu powrotnego. Dziękuję, że nie kłamałeś i że to sprawdziłeś. Jeśli przyjdzie nam się bić na trakcie, będę pilnować twojej flanki — słowo.”',
        options: [{ text: '„Trzymamy się razem, Ragnosławo.”', goto: 'end' }]
      }
    }
  },

  brzezina_ragnoslawa_trop: {
    id: 'brzezina_ragnoslawa_trop',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Ślad Czerwonej Pieczęci',
        text: 'Zagadujesz dyskretnie o czerwoną cesarską pieczęć i to, dlaczego z całej szkoły wybrano akurat czwórkę najmłodszych adeptów.',
        options: [
          {
            id: 'test_bystrosc',
            text: 'Obserwuj uważnie wzrok rozmówcy i drobne drgnienia dłoni przy pochwie.',
            check: { attribute: 'bystrosc', difficulty: 45 },
            success: 'sukces_trop',
            failure: 'czesc_trop'
          },
          {
            id: 'test_wymowa',
            text: 'Zapytaj spokojnie, czy szkoła dostała wcześniej podobne wezwanie.',
            check: { skill: 'wymowa', difficulty: 35 },
            success: 'sukces_trop',
            failure: 'czesc_trop'
          }
        ]
      },
      sukces_trop: {
        speaker: 'Instruktor Radogost',
        text: 'Radogost na ułamek sekundy mruży oczy i ściszonym głosem rzuca: „Czerwony lak z północy nigdy nie wraca pusty. Gnieworad oddał tych, bez których szkoła przetrwa zimę — ale nie mów tego nikomu przy bramie.”',
        actions: [
          { setFlag: 'ragnoslawa_trop_odkryty' },
          { setFlag: 'rozkaz_bez_powrotu' }
        ],
        options: [{ text: 'Przekaż wieść Ragnosławie.', goto: 'end' }]
      },
      czesc_trop: {
        speaker: 'Instruktor Radogost',
        text: 'Rozmówca ucina temat twardym spojrzeniem, ale jego dłoń mimowolnie zamyka się na rękojeści, a wzrok ucieka w stronę bramy. „Czerwona pieczęć to pobór, młody. Nikt nie obiecywał powrotu. Tyle ci musi wystarczyć.”',
        actions: [{ setFlag: 'ragnoslawa_trop_odkryty' }],
        options: [{ text: 'Przekaż wieść Ragnosławie.', goto: 'end' }]
      }
    }
  },

  // =========================================================================
  // 3. BRZEZINA — WOJMIR CIENKI (1-na-1 + przysługa „Ciężki tobół”)
  // =========================================================================
  brzezina_wojmir: {
    id: 'brzezina_wojmir',
    portrait: 'portret_wojmir',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Wojmir Cienki',
        text: 'Wojmir poprawia rzemienie przy tobołku większym od własnych pleców. Dłonie lekko mu drżą, choć próbuje to ukryć za spokojnym uśmiechem. „To tylko kilkanaście mil do Wilczego Brodu, prawda? Z mapy wynika, że trakt jest bity... gorzej, że przy studni puścił mi rzemień i mało nie utopiłem kałamarza oraz listu do matki.”',
        options: [
          {
            id: 'oddaj_tobol',
            text: '„Uratowałem twoją sakwę przy studni. Kałamarz cały, list ledwo zawilgł.”',
            requires: {
              all: [
                { flag: 'przysluga_wojmir_start' },
                { flag: 'wojmir_tobol_uratowany' },
                { notFlag: 'przysluga_wojmir_done' }
              ]
            },
            actions: [
              { setFlag: 'przysluga_wojmir_done' },
              { setFlag: 'tow_wojmir' },
              { addVar: { wiez_wojmir: 1 } },
              { giveXp: 20 }
            ],
            goto: 'tobol_oddany'
          },
          {
            id: 'wsparcie_wojmir',
            text: '„Nie martw się, Wojmirze. W drodze każdy pilnuje każdego — nie zostaniesz sam.”',
            requires: { notFlag: 'tow_wojmir' },
            actions: [
              { setFlag: 'tow_wojmir' },
              { addVar: { wiez_wojmir: 1, wola: 1 } }
            ],
            goto: 'po_wsparciu'
          },
          {
            id: 'twardo_wojmir',
            text: '„Wyrzuć połowę tych papierów, bo padniesz na pierwszej mili.”',
            requires: { notFlag: 'tow_wojmir' },
            actions: [{ setFlag: 'tow_wojmir' }],
            goto: 'po_twardym'
          },
          {
            id: 'pomoz_studnia',
            text: '„Pokaż, co ci wpadło przy studni — podejdę tam i wyłowię twoją sakwę.”',
            requires: {
              all: [
                { notFlag: 'przysluga_wojmir_start' },
                { notFlag: 'przysluga_wojmir_done' }
              ]
            },
            actions: [
              { setFlag: 'przysluga_wojmir_start' },
              { setFlag: 'tow_wojmir' }
            ],
            goto: 'przysluga_przyjeta'
          },
          {
            id: 'przypomnij_studnia',
            text: '„Gdzie dokładnie leży ta sakwa?”',
            requires: {
              all: [
                { flag: 'przysluga_wojmir_start' },
                { notFlag: 'wojmir_tobol_uratowany' },
                { notFlag: 'przysluga_wojmir_done' }
              ]
            },
            goto: 'przysluga_podpowiedz'
          },
          {
            id: 'koniec',
            text: '„Trzymaj się blisko mnie, Wojmirze.”',
            goto: 'end'
          }
        ]
      },
      po_wsparciu: {
        speaker: 'Wojmir Cienki',
        text: 'Wojmir oddycha z wyraźną ulgą. „Dziękuję. Naprawdę. Z bronią jestem jaki jestem, ale umiem czytać ślady i liczyć dni marszu. Słuchaj — przy szkolnej studni zaczepiła się o cembrowinę moja boczna sakwa z kałamarzem i listem do matki. Nie mogę jej sam wyciągnąć, bo rzemień pęknie.”',
        options: [
          {
            id: 'przyjmij_wojmir',
            text: '„Zaraz podejdę do studni i ją wyciągnę.”',
            requires: { notFlag: 'przysluga_wojmir_start' },
            actions: [{ setFlag: 'przysluga_wojmir_start' }],
            goto: 'przysluga_przyjeta'
          },
          {
            id: 'pomin_wojmir',
            text: '„Jeśli zdążę przed wymarszem, zajrzę tam.”',
            goto: 'end'
          }
        ]
      },
      po_twardym: {
        speaker: 'Wojmir Cienki',
        text: 'Wojmir spuszcza głowę. „To nie tylko papiery... tam jest list do mojej matki. Zaczepił się w bocznej sakwie przy studni, jak nabierałem wody. Może jednak rzucisz na to okiem, skoro masz silniejsze ręce?”',
        options: [
          {
            id: 'jednak_pomoz',
            text: '„No dobrze, sprawdzę przy studni.”',
            requires: { notFlag: 'przysluga_wojmir_start' },
            actions: [{ setFlag: 'przysluga_wojmir_start' }],
            goto: 'przysluga_przyjeta'
          },
          {
            id: 'odejdz',
            text: 'Odejdź.',
            goto: 'end'
          }
        ]
      },
      przysluga_przyjeta: {
        speaker: 'Wojmir Cienki',
        text: '„Stoi przy zachodnim murze — Studnia Szkolna. Jak uda ci się wyjąć sakwę zanim wpadnie do wody, będę twoim dłużnikiem!”',
        options: [{ text: 'Już idę.', goto: 'end' }]
      },
      przysluga_podpowiedz: {
        speaker: 'Wojmir Cienki',
        text: '„Studnia Szkolna po zachodniej stronie dziedzińca. Sakwa wisi na rozluźnionym haku przy cembrowinie.”',
        options: [{ text: 'Zaraz ją przyniosę.', goto: 'end' }]
      },
      tobol_oddany: {
        speaker: 'Wojmir Cienki',
        text: 'Wojmir przyciska uratowany list do piersi i uśmiecha się szczerze, bez cienia lęku. „Matka by mi nie darowała, gdybym wyjechał bez słowa. Dziękuję! Na trakcie będę miał oczy szeroko otwarte — może nie macham mieczem jak ty, ale zasadzkę wypatrzę pierwszy.”',
        options: [{ text: '„Liczymy na twoje oczy, Wojmirze.”', goto: 'end' }]
      }
    }
  },

  brzezina_wojmir_studnia: {
    id: 'brzezina_wojmir_studnia',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Studnia Szkolna',
        text: 'Na żelaznym haku tuż nad czarną taflą wody wisi boczna sakwa Wojmira. Rzemień jest przetarty do połowy — jeden nieostrożny ruch i wszystko zatonie.',
        options: [
          {
            id: 'wyjmij_sila',
            text: 'Chwyć pewnie cembrowinę i sięgnij głęboko po sakwę.',
            check: { attribute: 'sila', difficulty: 42 },
            success: 'uratowana',
            failure: 'ledwo_uratowana'
          },
          {
            id: 'wyjmij_rozum',
            text: 'Podhacz rzemień drążkiem wiadra i powoli wciągnij sakwę na brzeg.',
            check: { attribute: 'rozum', difficulty: 40 },
            success: 'uratowana',
            failure: 'ledwo_uratowana'
          }
        ]
      },
      uratowana: {
        speaker: 'Studnia Szkolna',
        text: 'Wyciągasz sakwę jednym pewnym ruchem. Kałamarz nie pękł, a zapieczętowany list Wojmira do matki jest zupełnie suchy.',
        actions: [{ setFlag: 'wojmir_tobol_uratowany' }],
        options: [{ text: 'Oddaj sakwę Wojmirowi.', goto: 'end' }]
      },
      ledwo_uratowana: {
        speaker: 'Studnia Szkolna',
        text: 'Rzemień pęka w ostatniej chwili, ale łapiesz sakwę w locie tuż nad wodą! Róg koperty lekko zawilgł, lecz list i kałamarz ocalały.',
        actions: [{ setFlag: 'wojmir_tobol_uratowany' }],
        options: [{ text: 'Oddaj sakwę Wojmirowi.', goto: 'end' }]
      }
    }
  },

  // =========================================================================
  // 4. TRAKT — INDYWIDUALNE ROZMOWY PRZY OGNISKU
  // =========================================================================
  trakt_ognisko_skarimir: {
    id: 'trakt_ognisko_skarimir',
    portrait: 'portret_skarimir',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Skarimir przy Ognisku',
        text: 'Skarimir grzebie patykiem w żarze, a iskry tańczą mu na policzkach. Po zasadzce bandytów dłonie ma już spokojne, tylko śmiech brzmi trochę ciszej niż w Brzezinie.',
        options: [
          {
            id: 'wspomnij_slonine',
            text: '„Pamiętasz, co obiecałeś za tę słoninę? Dawaj swoją najlepszą historię.”',
            requires: {
              all: [{ flag: 'przysluga_skarimir_done' }, { notFlag: 'og_skarimir' }]
            },
            actions: [
              { setFlag: 'og_skarimir' },
              { addVar: { wiez_skarimir: 1 } }
            ],
            goto: 'slonina_uczta'
          },
          {
            id: 'zart_kolacja',
            text: 'Usiądź obok i posłuchaj jego żartów o cesarskiej daninie.',
            requires: { notFlag: 'og_skarimir' },
            actions: [
              { setFlag: 'og_skarimir' },
              { addVar: { wiez_skarimir: 1 } }
            ],
            goto: 'zart_ogien'
          },
          {
            id: 'po_rozmowie',
            text: '„Odpoczywaj, Skarimirze. Przed nami jeszcze długi szlak.”',
            goto: 'end'
          }
        ]
      },
      slonina_uczta: {
        speaker: 'Skarimir',
        text: 'Skarimir uśmiecha się od ucha do ucha, kroi słoninę sztyletem i podaje ci najlepszy plaster na patyku. „Widzisz? Mówiłem, że z ciebie człowiek! Jak kiedyś wrócimy z tej cholernej stolicy, rzucamy miecze i otwieramy karczmę. Bez wodnistej kaszy — sama pieczeń i kości do gry!”',
        options: [{ text: '„Stoi, druhu.”', goto: 'end' }]
      },
      zart_ogien: {
        speaker: 'Skarimir',
        text: '„Wiecie, co bym zrobił z cesarską daniną? Zeżarł! Jak to mówią: nie chwal dnia przed... przed kolacją!” Przez chwilę patrzy w ciemność za kręgiem ognia. „Dobrze, że jesteś z nami. Z tobą jakoś mniej straszno.”',
        options: [{ text: 'Skinij mu głową.', goto: 'end' }]
      }
    }
  },

  trakt_ognisko_ragnoslawa: {
    id: 'trakt_ognisko_ragnoslawa',
    portrait: 'portret_ragnoslawa',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Ragnosława przy Ognisku',
        text: 'Ragnosława siedzi nieco z boku, powoli przesuwając osełką po grocie włóczni. Iskry z paleniska odbijają się w jej oczach.',
        options: [
          {
            id: 'omow_pieczec',
            text: '„Po tym, co powiedział Radogost o czerwonej pieczęci... myślisz, że naprawdę nie mamy powrotu?”',
            requires: {
              all: [{ flag: 'przysluga_ragnoslawa_done' }, { notFlag: 'og_ragnoslawa' }]
            },
            actions: [
              { setFlag: 'og_ragnoslawa' },
              { addVar: { wiez_ragnoslawa: 1, wola: 1 } }
            ],
            goto: 'szczera_rozmowa'
          },
          {
            id: 'sprawdz_rozkazy',
            text: '„Rozkazy trzeba najpierw sprawdzić, zanim odda się za nie głowę.”',
            requires: { notFlag: 'og_ragnoslawa' },
            actions: [
              { setFlag: 'og_ragnoslawa' },
              { addVar: { wiez_ragnoslawa: 1, wola: 1 } }
            ],
            goto: 'odpowiedz_wola'
          },
          {
            id: 'rozkaz_to_rozkaz',
            text: '„Rozkaz to rozkaz. Wytrzymamy do Wilczego Brodu, a potem zobaczymy.”',
            requires: { notFlag: 'og_ragnoslawa' },
            actions: [
              { setFlag: 'og_ragnoslawa' },
              { addVar: { dlug: 1 } }
            ],
            goto: 'odpowiedz_dlug'
          },
          {
            id: 'koniec',
            text: 'Zostaw ją przy ostrzeniu włóczni.',
            goto: 'end'
          }
        ]
      },
      szczera_rozmowa: {
        speaker: 'Ragnosława',
        text: 'Ragnosława odkłada osełkę i wyjmuje swój nadgryziony miedziak. „Nie obchodzi mnie już, co chciał Gnieworad. Jak dojdziemy do ludzi, sami zdecydujemy o swoim losie. A ten miedziak pamiętaj — pierwsze piwo w karczmie jest moje, nawet jeśli miałoby być w Wilczym Brodzie.”',
        options: [{ text: '„Masz moje słowo, Ragnosławo.”', goto: 'end' }]
      },
      odpowiedz_wola: {
        speaker: 'Ragnosława',
        text: '„Wreszcie ktoś, kto myśli, zamiast tylko kiwać głową. Gdyby coś poszło źle, trzymaj się blisko mojej włóczni.”',
        options: [{ text: 'Skinij głową.', goto: 'end' }]
      },
      odpowiedz_dlug: {
        speaker: 'Ragnosława',
        text: '„Twarda z ciebie sztuka. Oby ta wierność wyszła nam na zdrowie.”',
        options: [{ text: 'Odejdź do ognia.', goto: 'end' }]
      }
    }
  },

  trakt_ognisko_wojmir: {
    id: 'trakt_ognisko_wojmir',
    portrait: 'portret_wojmir',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Wojmir przy Ognisku',
        text: 'Wojmir siedzi tak blisko płomieni, że aż onuce mu parują, i notuje coś w małym zeszycie przy blasku żaru.',
        options: [
          {
            id: 'list_do_matki',
            text: '„Piszesz dalej list do matki, Wojmirze?”',
            requires: {
              all: [{ flag: 'przysluga_wojmir_done' }, { notFlag: 'og_wojmir' }]
            },
            actions: [
              { setFlag: 'og_wojmir' },
              { addVar: { wiez_wojmir: 1 } }
            ],
            goto: 'prosba_wojmira'
          },
          {
            id: 'pociesz_wojmira',
            text: 'Usiądź przy nim i powiedz, że po bandytach najgorsze już za wami.',
            requires: { notFlag: 'og_wojmir' },
            actions: [
              { setFlag: 'og_wojmir' },
              { addVar: { wiez_wojmir: 1 } }
            ],
            goto: 'odpowiedz_wojmir'
          },
          {
            id: 'koniec',
            text: '„Odpocznij, jutro długi marsz.”',
            goto: 'end'
          }
        ]
      },
      prosba_wojmira: {
        speaker: 'Wojmir Cienki',
        text: 'Wojmir składa kartkę i pieczętuje ją kropelką wosku z podróżnej świeczki. „Dopisałem, że spotkałem w szkole kogoś, kto naprawdę dba o druhów. Posłuchaj... gdyby na tej drodze stało się ze mną coś złego — obiecaj, że przekażesz ten list w pierwszej strażnicy komuś, kto jedzie w stronę Brzeziny.”',
        options: [{ text: '„Obiecuję, Wojmirze. Ale wrócisz sam.”', goto: 'end' }]
      },
      odpowiedz_wojmir: {
        speaker: 'Wojmir Cienki',
        text: '„Chciałbym w to wierzyć. Ale niebo nad lasem robi się dziwnie fioletowe... dobrze, że nie idę sam.”',
        options: [{ text: '„Prześpij się chwilę.”', goto: 'end' }]
      }
    }
  },

  // =========================================================================
  // 5. POBOJOWISKO O ŚWICIE — INDYWIDUALNE BADANIE POLEGŁYCH
  // =========================================================================
  pobojowisko_skarimir: {
    id: 'pobojowisko_skarimir',
    portrait: 'portret_skarimir',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Poległy Skarimir',
        text: 'Skarimir leży w mokrej od rosy trawie, wciąż ściskając w zesztywniałej dłoni sztylet. Kolacji się nie doczekał. Na jego twarzy zastygł cień dawnego, zawadiackiego uśmiechu.',
        options: [
          {
            id: 'zbadaj_bliski',
            text: 'Rozegnij jego palce i sprawdź kieszeń — pamiętasz jego kość i wspólną słoninę.',
            requires: {
              all: [
                { notFlag: 'pobojowisko_skarimir' },
                { var: 'wiez_skarimir', gte: 2 }
              ]
            },
            actions: [
              { setFlag: 'pobojowisko_skarimir' },
              { giveItem: 'sztylet' },
              { giveItem: 'kosc_skarimira' }
            ],
            goto: 'pamiatka_skarimira'
          },
          {
            id: 'zbadaj_zwykly',
            text: 'Zabierz sztylet — jemu już się nie przyda, a tobie może ocalić skórę.',
            requires: { notFlag: 'pobojowisko_skarimir' },
            actions: [
              { setFlag: 'pobojowisko_skarimir' },
              { giveItem: 'sztylet' }
            ],
            goto: 'pozegnanie'
          },
          {
            id: 'juz_zbadany',
            text: 'Pochyl głowę nad Skarimirem w milczeniu.',
            requires: { flag: 'pobojowisko_skarimir' },
            goto: 'end'
          }
        ]
      },
      pamiatka_skarimira: {
        speaker: 'Poległy Skarimir',
        text: 'Oprócz sztyletu wyjmujesz z jego kieszeni wystruganą z rogu kość do gry — tę samą, którą podrzucał pod bramą Brzeziny. Chowasz ją głęboko przy sercu. W pierwszej karczmie rzucisz nią za niego.',
        options: [
          {
            id: 'gest_wola',
            text: 'Zamknij mu powieki: „Nie dam cię zapomnieć, druhu.” (+1 Wola)',
            actions: [{ addVar: { wola: 1 } }],
            goto: 'end'
          },
          {
            id: 'gest_dlug',
            text: 'Zaciśnij zęby: „Ktoś za to zapłaci.” (+1 Dług)',
            actions: [{ addVar: { dlug: 1 } }],
            goto: 'end'
          }
        ]
      },
      pozegnanie: {
        speaker: 'Poległy Skarimir',
        text: 'Zabierasz sztylet Skarimira i zamykasz mu oczy. Została po nim tylko cisza poranka.',
        options: [{ text: 'Wstań.', goto: 'end' }]
      }
    }
  },

  pobojowisko_ragnoslawa: {
    id: 'pobojowisko_ragnoslawa',
    portrait: 'portret_ragnoslawa',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Poległa Ragnosława',
        text: 'Ragnosława leży twarzą ku blademu niebu, z połamaną włócznią u boku i miną kogoś, kto do samego końca nie zamierzał ustąpić. W jej torbie zachowały się czyste opatrunki, a na szyi wisi wytarta blaszka strażniczego znaku.',
        options: [
          {
            id: 'zbadaj_bliska',
            text: 'Zabierz jej opatrunki, amulet i nadgryziony miedziak z waszego zakładu.',
            requires: {
              all: [
                { notFlag: 'pobojowisko_ragnoslawa' },
                { var: 'wiez_ragnoslawa', gte: 2 }
              ]
            },
            actions: [
              { setFlag: 'pobojowisko_ragnoslawa' },
              { giveItem: { id: 'opatrunek', qty: 2 } },
              { giveItem: 'amulet_strazniczy' },
              { giveItem: 'miedziak_ragnoslawy' }
            ],
            goto: 'pamiatka_ragnoslawy'
          },
          {
            id: 'zbadaj_zwykla',
            text: 'Zabierz opatrunki i strażniczy amulet — żywym się przydadzą.',
            requires: { notFlag: 'pobojowisko_ragnoslawa' },
            actions: [
              { setFlag: 'pobojowisko_ragnoslawa' },
              { giveItem: { id: 'opatrunek', qty: 2 } },
              { giveItem: 'amulet_strazniczy' }
            ],
            goto: 'pozegnanie'
          },
          {
            id: 'juz_zbadana',
            text: 'Stój chwilę w ciszy przy Ragnosławie.',
            requires: { flag: 'pobojowisko_ragnoslawa' },
            goto: 'end'
          }
        ]
      },
      pamiatka_ragnoslawy: {
        speaker: 'Poległa Ragnosława',
        text: 'W jej dłoni spoczywa stary, nadgryziony miedziak — ten sam, którym przybiła z tobą zakład o pierwsze piwo. W Wilczym Brodzie postawisz jej ten kufel, choćby miał zostać pełny na ławie.',
        options: [
          {
            id: 'gest_wola',
            text: 'Połóż jej dłonie na drzewcu włóczni: „Pierwsze piwo jest twoje, Ragnosławo.” (+1 Wola)',
            actions: [{ addVar: { wola: 1 } }],
            goto: 'end'
          },
          {
            id: 'gest_dlug',
            text: 'Zabierz miedziak w milczeniu: „Miałaś rację co do czerwonej pieczęci.” (+1 Dług)',
            actions: [{ addVar: { dlug: 1 } }],
            goto: 'end'
          }
        ]
      },
      pozegnanie: {
        speaker: 'Poległa Ragnosława',
        text: 'Zabierasz opatrunki i amulet Ragnosławy. Jej włócznia wbita w ziemię znaczy miejsce, w którym padła.',
        options: [{ text: 'Wstań.', goto: 'end' }]
      }
    }
  },

  pobojowisko_wojmir: {
    id: 'pobojowisko_wojmir',
    portrait: 'portret_wojmir',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Poległy Wojmir',
        text: 'Wojmir Cienki miał więcej rozumu niż siły, a w nocy upiorów ani jedno, ani drugie nie dało mu szans. Obok leży jego rozdarty tobołek z prowiantem, rozbity kałamarz i plama czarnego atramentu na rosie.',
        options: [
          {
            id: 'zbadaj_bliski',
            text: 'Zabierz prowiant i wyjmij z jego zanadrza ocalały, zapieczętowany list do matki.',
            requires: {
              all: [
                { notFlag: 'pobojowisko_wojmir' },
                { var: 'wiez_wojmir', gte: 2 }
              ]
            },
            actions: [
              { setFlag: 'pobojowisko_wojmir' },
              { giveItem: { id: 'prowiant', qty: 2 } },
              { giveItem: 'list_wojmira' }
            ],
            goto: 'pamiatka_wojmira'
          },
          {
            id: 'zbadaj_zwykly',
            text: 'Zabierz prowiant na drogę.',
            requires: { notFlag: 'pobojowisko_wojmir' },
            actions: [
              { setFlag: 'pobojowisko_wojmir' },
              { giveItem: { id: 'prowiant', qty: 2 } }
            ],
            goto: 'pozegnanie'
          },
          {
            id: 'juz_zbadany',
            text: 'Pożegnaj Wojmira w myślach.',
            requires: { flag: 'pobojowisko_wojmir' },
            goto: 'end'
          }
        ]
      },
      pamiatka_wojmira: {
        speaker: 'Poległy Wojmir',
        text: 'Pod kaftanem Wojmira spoczywa nienaruszony, zapieczętowany woskiem list do jego matki. Pamiętasz jego prośbę przy ognisku. W Wilczym Brodzie zdecydujesz, czy oddać go gońcowi, czy zachować jako jedyny ślad po nim.',
        options: [
          {
            id: 'gest_wola',
            text: 'Przykryj go płaszczem: „Dotrzymam słowa, Wojmirze.” (+1 Wola)',
            actions: [{ addVar: { wola: 1 } }],
            goto: 'end'
          },
          {
            id: 'gest_dlug',
            text: 'Schowaj list za pazuchę: „Dług wobec zmarłych też trzeba spłacić.” (+1 Dług)',
            actions: [{ addVar: { dlug: 1 } }],
            goto: 'end'
          }
        ]
      },
      pozegnanie: {
        speaker: 'Poległy Wojmir',
        text: 'Bierzesz prowiant Wojmira. Atrament z rozbitego kałamarza wsiąka powoli w ziemię.',
        options: [{ text: 'Wstań.', goto: 'end' }]
      }
    }
  },

  // =========================================================================
  // 6. AKT 1 — WILCZY BRÓD: ECHA PAMIĘCI BRZEZINY (KARCZMA)
  // =========================================================================
  wilczy_brod_pamiec_brzeziny: {
    id: 'wilczy_brod_pamiec_brzeziny',
    portrait: 'karczma_pod_wilczym_klem',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Karczma „Pod Wilczym Kłem” — Pamięć Brzeziny',
        text: 'W kącie zadymionej izby, z dala od gwaru strażników, sięgasz do torby po pamiątki z pobojowiska pod Brzeziną. Ogień w kominku trzaska dokładnie tak samo jak wtedy na trakcie.',
        options: [
          {
            id: 'toast_ragnoslawa',
            text: 'Połóż nadgryziony miedziak na ławie i zamów dwa piwa — drugie dla Ragnosławy (1 gr).',
            requires: {
              all: [
                { item: 'miedziak_ragnoslawy' },
                { money: 1 },
                { notFlag: 'echo_ragnoslawa_toast' }
              ]
            },
            actions: [
              { takeMoney: 1 },
              { setFlag: 'echo_ragnoslawa_toast' },
              { addVar: { wola: 1 } },
              { healFull: true },
              { giveXp: 35 }
            ],
            goto: 'po_toascie_ragnoslawy'
          },
          {
            id: 'wyslij_list_wojmira',
            text: 'Oddaj Wrzoskowi zapieczętowany list Wojmira, by przekazał go pierwszemu kupcowi jadącemu pod Brzezinę.',
            requires: {
              all: [
                { item: 'list_wojmira' },
                { notFlag: 'echo_wojmir_list' }
              ]
            },
            actions: [
              { takeItem: 'list_wojmira' },
              { setFlag: 'echo_wojmir_list' },
              { setFlag: 'echo_wojmir_list_wyslany' },
              { addVar: { dlug: 1 } },
              { giveXp: 35 }
            ],
            goto: 'po_liscie_wyslanym'
          },
          {
            id: 'zachowaj_list_wojmira',
            text: 'Zatrzymaj list Wojmira przy sobie — sam go kiedyś zaniesiesz, gdy świat przestanie płonąć.',
            requires: {
              all: [
                { item: 'list_wojmira' },
                { notFlag: 'echo_wojmir_list' }
              ]
            },
            actions: [
              { setFlag: 'echo_wojmir_list' },
              { addVar: { wola: 1 } },
              { giveXp: 35 }
            ],
            goto: 'po_liscie_zachowanym'
          },
          {
            id: 'kosc_skarimira_rzut',
            text: 'Rzuć na stół kością z jeleniego rogu Skarimira i wypij za jego żarty.',
            requires: {
              all: [
                { item: 'kosc_skarimira' },
                { notFlag: 'echo_skarimir_kosc' }
              ]
            },
            actions: [
              { setFlag: 'echo_skarimir_kosc' },
              { addVar: { wola: 1 } },
              { giveMoney: 5 },
              { giveXp: 35 }
            ],
            goto: 'po_kosci_skarimira'
          },
          {
            id: 'ocalali_wspomnienie',
            text: 'Pomyśl o tych, którzy pytają o ocalałych z Brzeziny — z czwórki adeptów wróciłeś tylko ty.',
            requires: {
              all: [
                { any: [
                  { questStatus: { id: 'kto_pyta_o_ocalalych', is: 'active' } },
                  { questStatus: { id: 'kto_pyta_o_ocalalych', is: 'completed' } }
                ] },
                { notFlag: 'echo_ocalali_wspomnienie' }
              ]
            },
            actions: [
              { setFlag: 'echo_ocalali_wspomnienie' },
              { addVar: { wola: 1 } },
              { giveXp: 20 }
            ],
            goto: 'po_wspomnieniu_ocalalych'
          },
          {
            id: 'odejdz',
            text: 'Wstań od ławy i wróć do spraw Wilczego Brodu.',
            goto: 'end'
          }
        ]
      },
      po_toascie_ragnoslawy: {
        speaker: 'Karczma „Pod Wilczym Kłem”',
        text: 'Wrzosek bez słowa stawia przed tobą dwa gliniane kufle. Stukasz swoim o ten drugi, nietknięty. „Wygrałaś, Ragnosławo” — szepczesz. Ciepło rozlewa się po zmęczonych mięśniach, a ciężar z barków na chwilę ustępuje (+1 Wola, pełne uleczenie, +35 XP).',
        options: [{ text: 'Wróć do wspomnień.', goto: 'start' }]
      },
      po_liscie_wyslanym: {
        speaker: 'Karczmarz Wrzosek',
        text: 'Wrzosek ogląda pieczęć i kiwa ciężko głową. „Znam furmana, co jutro ciągnie na północ. List dotrze pod Brzezinę, daję słowo.” Obietnica dana Wojmirowi przy ognisku została spełniona (+1 Dług, +35 XP).',
        options: [{ text: 'Wróć do wspomnień.', goto: 'start' }]
      },
      po_liscie_zachowanym: {
        speaker: 'Karczma „Pod Wilczym Kłem”',
        text: 'Chowasz list z powrotem za pazuchę. Obcy furman nie powinien nieść słów przyjaciela — jeśli przeżyjesz, zaniesiesz je sam (+1 Wola, +35 XP).',
        options: [{ text: 'Wróć do wspomnień.', goto: 'start' }]
      },
      po_kosci_skarimira: {
        speaker: 'Karczma „Pod Wilczym Kłem”',
        text: 'Kość Skarimira toczy się po dębowym blacie i staje na wyszczerbionej szóstce. Stary drwal przy sąsiedniej ławie gwiżdże z podziwem i podsuwa ci 5 groszy z zakładu, a ty śmiejesz się cicho — dokładnie tak, jak chciałby Skarimir (+1 Wola, +5 gr, +35 XP).',
        options: [{ text: 'Wróć do wspomnień.', goto: 'start' }]
      },
      po_wspomnieniu_ocalalych: {
        speaker: 'Pamięć Brzeziny',
        text: 'Cesarstwo pyta o ocalałych z czwórki wysłanej spod czerwonej pieczęci. Skarimir, Ragnosława i Wojmir zostali na uroczysku, ale dopóki pamiętasz ich imiona, nie byli tylko pozycją w cesarskim rejestrze (+1 Wola, +20 XP).',
        options: [{ text: 'Wróć do wspomnień.', goto: 'start' }]
      }
    }
  }
};
