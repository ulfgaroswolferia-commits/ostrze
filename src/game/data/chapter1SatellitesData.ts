import type { DialogueFileDef } from './originTypes';

/**
 * Overlay exploration scenes for Act 1 satellite locations (Wilczy Bród & Pogórze).
 * Uses panoramic 96x48 .pix scene art from origin/data/art/ without modifying origin/data/.
 * All skill checks follow fail-forward design: quest progress is always granted,
 * while successful checks reward extra lore, bonus items, XP, and wola/dlug choices.
 */
export const CHAPTER1_SATELLITE_DIALOGUES: Record<string, DialogueFileDef> = {
  // =========================================================================
  // 1. LAS RUBIEŻY — POLANA ZIÓŁ (quest: lek_dla_wrzoska)
  // =========================================================================
  satelita_polana_ziol: {
    id: 'satelita_polana_ziol',
    portrait: 'trakt',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Polana Ziół — Las Rubieży',
        text: 'Polana pachnie żywicą i czymś gorzkim jak piołun. Między mokrymi paprociami plączą się kępy ziela, o które prosił karczmarz Wrzosek — ale kilka łodyg ma ciemniejsze, rzadkie żyłki leczniczego ziela.',
        options: [
          {
            id: 'test_medycyna',
            text: 'Przebierz pędy uważnie, oddzielając najczystsze lecznicze liście.',
            check: { skill: 'medycyna', difficulty: 35 },
            success: 'sukces_medycyna',
            failure: 'porazka_medycyna'
          },
          {
            id: 'szybki_zbior',
            text: 'Narwij pełną garść ziela dla Wrzoska i ruszaj dalej.',
            actions: [
              { setFlag: 'ziola_zebrane' },
              { giveItem: 'ziola_dla_wrzoska' },
              { time: 30 }
            ],
            goto: 'zebrane_zwykle'
          }
        ]
      },
      sukces_medycyna: {
        speaker: 'Polana Ziół — Las Rubieży',
        text: 'Bez trudu odróżniasz cierpki piołun dla karczmarza od rzadkiego ziela krwawnika. Zbierasz pełną wiązkę dla Wrzoska, a z wybranych pędów skręcasz dodatkowy Napar z ziół (+15 XP).',
        actions: [
          { setFlag: 'ziola_zebrane' },
          { giveItem: 'ziola_dla_wrzoska' },
          { giveItem: 'napar_ziol' },
          { giveXp: 15 },
          { time: 30 }
        ],
        options: [{ text: 'Schowaj zioła do torby.', goto: 'end' }]
      },
      porazka_medycyna: {
        speaker: 'Polana Ziół — Las Rubieży',
        text: 'W wilgotnym mroku wszystkie łodygi wyglądają podobnie — nie ryzykujesz pomyłki z trującym chwastem. Zbierasz bezpieczną wiązkę ziół dla Wrzoska.',
        actions: [
          { setFlag: 'ziola_zebrane' },
          { giveItem: 'ziola_dla_wrzoska' },
          { time: 30 }
        ],
        options: [{ text: 'Schowaj zioła do torby.', goto: 'end' }]
      },
      zebrane_zwykle: {
        speaker: 'Polana Ziół — Las Rubieży',
        text: 'Kucasz w mokrych paprociach i rwiesz ziele, które karczmarze zwą lekiem, a felczerzy chwastem. Wrzosek w Wilczym Brodzie będzie zadowolony.',
        options: [{ text: 'Wróć na leśną ścieżkę.', goto: 'end' }]
      }
    }
  },

  // =========================================================================
  // 2. STARY MŁYN NOCĄ — ŚWIATŁO W MŁYNIE (quest: swiatlo_w_mlynie)
  // =========================================================================
  satelita_mlyn_noca: {
    id: 'satelita_mlyn_noca',
    portrait: 'stary_mlyn',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Stary Młyn Nocą — Światło pod Kołem',
        text: 'Po zmroku w głębi młyna coś rozbłyska bladym, zimnym światłem. Idziesz po skrzypiących schodkach. W kącie pod kołem zębatym leży odłamek czarnego szkła i pulsuje cicho — dokładnie takim samym chłodem, jaki czułeś w Noc Upiorów.',
        options: [
          {
            id: 'test_wiedza',
            text: 'Zbadaj pulsowanie odłamka, zanim go dotkniesz.',
            check: { skill: 'wiedza_tajemna', difficulty: 40 },
            success: 'sukces_wiedza',
            failure: 'porazka_wiedza'
          },
          {
            id: 'owin_szmatka',
            text: 'Owiń odłamek grubą szmatką bez przyglądania się i schowaj dla Kowala Zbycha.',
            actions: [
              { setFlag: 'odlamek_zebrany' },
              { giveItem: 'odlamek_szkla' },
              { addVar: { dlug: 1 } },
              { time: 20 }
            ],
            goto: 'zebrane_ostroznie'
          }
        ]
      },
      sukces_wiedza: {
        speaker: 'Stary Młyn Nocą — Rezonans Szkła',
        text: 'Gdy zbliżasz dłoń, szkło na ułamek sekundy odpowiada na znak pozostawiony na tobie przez Istotę. To odłamek jednej ze spadających gwiazd — nie pali, lecz zapamiętuje tych, którzy przeżyli burzę iskier (+25 XP).',
        actions: [
          { setFlag: 'odlamek_zebrany' },
          { setFlag: 'mlyn_wizja_szkla' },
          { giveItem: 'odlamek_szkla' },
          { giveXp: 25 },
          { time: 20 }
        ],
        options: [
          {
            id: 'mlyn_wola',
            text: '„Jeśli gwiazdy patrzą na mnie, będę patrzył prosto w nie.” (+1 Wola)',
            actions: [{ addVar: { wola: 1 } }],
            goto: 'end'
          },
          {
            id: 'mlyn_dlug',
            text: '„Kowal Zbych oceni, czy to broń, czy przekleństwo.” (+1 Dług)',
            actions: [{ addVar: { dlug: 1 } }],
            goto: 'end'
          }
        ]
      },
      porazka_wiedza: {
        speaker: 'Stary Młyn Nocą — Światło pod Kołem',
        text: 'Zimno szkła mrozi palce, a w uszach słyszysz tylko odległy szum rzeki. Zwijasz odłamek w lnianą szmatkę — lepiej pokazać go Kowalowi Zbychowi w Wilczym Brodzie.',
        actions: [
          { setFlag: 'odlamek_zebrany' },
          { giveItem: 'odlamek_szkla' },
          { time: 20 }
        ],
        options: [{ text: 'Zabierz odłamek szkła.', goto: 'end' }]
      },
      zebrane_ostroznie: {
        speaker: 'Stary Młyn Nocą',
        text: 'Owinięty w płótno odłamek natychmiast przygasa. Młyn znów tonie w zwykłej ciemności i zapachu stęchłego ziarna.',
        options: [{ text: 'Wyjdź nad rzekę.', goto: 'end' }]
      }
    }
  },

  // =========================================================================
  // 3. RUINY STRAŻNICY — MUR ZE ZNAKIEM (quest: amulet_z_ruin)
  // =========================================================================
  satelita_ruiny_mur: {
    id: 'satelita_ruiny_mur',
    portrait: 'ruiny_straznicy',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Ruiny Strażnicy — Mur z Wyżłobionym Znakiem',
        text: 'W głębi zawalonej izby stoi gładki, nienaruszony mur z wyżłobionym wgłębieniem. Przykładasz strażniczy amulet, a kamień drży pod palcami, jakby budził się ze snu. Znak pasuje kreska w kreskę — a pod mchem u podstawy muru majaczą zatarte ryty.',
        options: [
          {
            id: 'test_wiedza_ruiny',
            text: 'Odszukaj i odczytaj zatarte znaki pod mchem.',
            check: { skill: 'wiedza_tajemna', difficulty: 40 },
            success: 'sukces_ruiny',
            failure: 'porazka_ruiny'
          },
          {
            id: 'test_bystrosc_ruiny',
            text: 'Przeszukaj szczelinę u podstawy muru, gdzie drżał kamień.',
            check: { attribute: 'bystrosc', difficulty: 45 },
            success: 'sukces_ruiny',
            failure: 'porazka_ruiny'
          },
          {
            id: 'zwykle_zbadanie',
            text: 'Zapamiętaj to miejsce i wróć z wieścią do córki strażnika.',
            actions: [
              { setFlag: 'amulet_pytanie' },
              { setFlag: 'amulet_pasuje' },
              { time: 15 }
            ],
            goto: 'ruiny_zwykle'
          }
        ]
      },
      sukces_ruiny: {
        speaker: 'Ruiny Strażnicy — Zapomniana Nisza',
        text: 'Drgnienie kamienia poluzowało płytę pod mchem. Odsłaniasz zatartą przestrogę dawnej straży („Brama otwiera się dopiero po zmierzchu gwiazd”) oraz suchy, zapasowy Opatrunek ukryty w niszy (+25 XP).',
        actions: [
          { setFlag: 'amulet_pytanie' },
          { setFlag: 'amulet_pasuje' },
          { setFlag: 'ruiny_inskrypcja_odczytana' },
          { giveItem: 'opatrunek' },
          { giveXp: 25 },
          { time: 15 }
        ],
        options: [
          {
            id: 'ruiny_wola',
            text: '„Ktokolwiek zamknął te drzwi, zostawił klucz w naszych rękach.” (+1 Wola)',
            actions: [{ addVar: { wola: 1 } }],
            goto: 'end'
          },
          {
            id: 'ruiny_dlug',
            text: '„Córka strażnika zasługuje na całą prawdę o pracy ojca.” (+1 Dług)',
            actions: [{ addVar: { dlug: 1 } }],
            goto: 'end'
          }
        ]
      },
      porazka_ruiny: {
        speaker: 'Ruiny Strażnicy — Mur z Wyżłobionym Znakiem',
        text: 'Kamień cichnie, zanim zdążysz rozczytać zatarte bruzdy. Drzwi się nie otwierają — jeszcze nie — ale stary strażnik miał rację: znak pasuje co do rysy.',
        actions: [
          { setFlag: 'amulet_pytanie' },
          { setFlag: 'amulet_pasuje' },
          { time: 15 }
        ],
        options: [{ text: 'Wróć z wieścią do córki strażnika.', goto: 'end' }]
      },
      ruiny_zwykle: {
        speaker: 'Ruiny Strażnicy',
        text: 'Drzwi się nie otwierają. Jeszcze nie. Ale stary strażnik miał rację — jego córka w Wilczym Brodzie powinna o tym wiedzieć.',
        options: [{ text: 'Cofnij się ze zgliszczy.', goto: 'end' }]
      }
    }
  },

  // =========================================================================
  // 4. LEŚNICZÓWKA — SKRYTKA POD DĘBEM
  // =========================================================================
  satelita_skrytka_dab: {
    id: 'satelita_skrytka_dab',
    portrait: 'lesniczowka',
    start: 'start',
    nodes: {
      start: {
        speaker: 'Skrytka pod Dębem — Leśniczówka',
        text: 'Pod ułamanym dębem na skraju polany ziemia jest świeżo przysypana korą. W płytkim dole leży okuta skrzynka, ale przy zawiasie biegnie cienki sznurek zaczepiony o podwójne dno.',
        options: [
          {
            id: 'test_bystrosc_skrytka',
            text: 'Obejrzyj uważnie mechanizm przy zawiasie i otwórz podwójne dno.',
            check: { attribute: 'bystrosc', difficulty: 40 },
            success: 'sukces_skrytka',
            failure: 'porazka_skrytka'
          },
          {
            id: 'test_skradanie_skrytka',
            text: 'Zdejmij ostrożnie sznurek ostrzem, nie naruszając ukrytej przegródki.',
            check: { skill: 'skradanie', difficulty: 35 },
            success: 'sukces_skrytka',
            failure: 'porazka_skrytka'
          },
          {
            id: 'otworz_sila',
            text: 'Podważ wieko bez ceregieli i zabierz zawartość skrzynki.',
            actions: [
              { setFlag: 'schowek_bylo' },
              { giveItem: 'napar_ziol' },
              { giveItem: 'opatrunek' },
              { giveMoney: 20 }
            ],
            goto: 'otwarta_zwykla'
          }
        ]
      },
      sukces_skrytka: {
        speaker: 'Skrytka pod Dębem — Podwójne Dno',
        text: 'Sprawnie odhaczasz sznurek i podnosisz fałszywą deseczkę! Oprócz głównego zapasu (+20 gr, Napar z ziół, Opatrunek) znajdujesz płócienny mieszek z dodatkowymi 10 groszami (+20 XP).',
        actions: [
          { setFlag: 'schowek_bylo' },
          { setFlag: 'schowek_podwojne_dno' },
          { giveItem: 'napar_ziol' },
          { giveItem: 'opatrunek' },
          { giveMoney: 30 },
          { giveXp: 20 }
        ],
        options: [{ text: 'Zabierz całe znalezisko.', goto: 'end' }]
      },
      porazka_skrytka: {
        speaker: 'Skrytka pod Dębem',
        text: 'Sznurek pęka z cichym trzaskiem i klinuje dolną przegródkę na amen — ale główna komora stoi otworem. Zabierasz Napar z ziół, Opatrunek i 20 groszy.',
        actions: [
          { setFlag: 'schowek_bylo' },
          { giveItem: 'napar_ziol' },
          { giveItem: 'opatrunek' },
          { giveMoney: 20 }
        ],
        options: [{ text: 'Zabierz znalezisko.', goto: 'end' }]
      },
      otwarta_zwykla: {
        speaker: 'Skrytka pod Dębem',
        text: 'W środku leżą zioła w woreczkach, zwój czystego płótna i garść groszy (+20 gr, Napar z ziół, Opatrunek).',
        options: [{ text: 'Zabierz znalezisko.', goto: 'end' }]
      }
    }
  }
};
