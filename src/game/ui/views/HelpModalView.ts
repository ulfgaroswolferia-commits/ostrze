import { escapeHtml } from '../escapeHtml';
import { mountModalCard } from '../mountModalCard';
import { renderSlavicIcon, type SlavicIconId } from '../slavicIcons';

export type HelpModalTab = 'controls' | 'guide';

export interface HelpModalViewParams {
  root: HTMLElement;
  initialTab?: HelpModalTab;
  onClose: () => void;
}

const CONTROL_GROUPS: ReadonlyArray<{
  title: string;
  items: ReadonlyArray<{ keys: string; desc: string }>;
}> = [
  {
    title: 'Eksploracja i kamera',
    items: [
      { keys: 'LPM (klik)', desc: 'Ruch postaci, rozmowa z NPC, użycie ogniska, drogowskazu lub skrzyni' },
      { keys: 'A / PPM na wrogu', desc: 'Tryb celowania — cios otwierający z zaskoczenia (+20% obr., +15% kryt) i start walki turowej' },
      { keys: 'WASD / Strzałki', desc: 'Przesuwanie kamery po mapie' },
      { keys: 'Kółko myszy', desc: 'Przybliżanie i oddalanie widoku 2.5D' },
      { keys: 'Krawędź ekranu', desc: 'Płynne przesuwanie kamery (zatrzymuje się nad panelami UI)' }
    ]
  },
  {
    title: 'Okna i nawigacja',
    items: [
      { keys: 'K', desc: 'Karta Postaci — atrybuty, umiejętności i talenty' },
      { keys: 'I', desc: 'Ekwipunek i Pas — plecak z filtrami kategorii i przypinaniem do pasa [4–7]' },
      { keys: 'C', desc: 'Skradanie — ciche podejście i przygotowanie ataku z zaskoczenia' },
      { keys: 'B', desc: 'Bestiariusz i Wiedza Łowiecka (+1 obr. po pokonaniu 3 szt. danego gatunku)' },
      { keys: 'M', desc: 'Interaktywna mapa świata i podróż (w Prologu tryb podglądu)' },
      { keys: 'J', desc: 'Dziennik aktywnych zadań i lista kroków do wykonania' },
      { keys: 'F1 / ?', desc: 'Otwórz lub zamknij to okno Pomocy i skrótów' },
      { keys: 'ESC', desc: 'Zamknij aktywne okno lub otwórz Menu pauzy' }
    ]
  },
  {
    title: 'Walka turowa 2.5D',
    items: [
      { keys: 'Klik na wroga', desc: 'Wybór celu (aktualizuje kartę celu i podgląd obrażeń) lub atak' },
      { keys: '1 / 2', desc: 'Atak podstawowy lub silny cios (silny cios przełamuje Gardę wroga: +25% obr., -1 AP)' },
      { keys: 'R', desc: 'Manewr specjalny broni (4 AP, 2 t. odnowienia — przełamuje Gardę i aktywuje synergie statusów)' },
      { keys: '3', desc: 'Garda — wzmacnia obronę, amortyzuje ciosy bossów i daje Ripostę (1×/rundę w zwarciu przy uniku/bloku)' },
      { keys: '4 – 7', desc: 'Pas Szybkiego Użycia: opatrunki, odtrutki, olej na ostrze i bomby' }
    ]
  }
];

const GUIDE_SECTIONS: ReadonlyArray<{ icon: SlavicIconId; title: string; body: string }> = [
  {
    icon: 'flame',
    title: 'Odporności i podatności wrogów',
    body: 'Karta celu w prawym górnym rogu pokazuje odporności i podatności wybranego wroga. Upiory odpychają zwykłą stal (-90% cięte/kłute), ale są silnie podatne na ogień (Flasza oleju) i Gwiezdne Ostrze wykute przez kowala Bogdana.'
  },
  {
    icon: 'armor',
    title: 'Garda [3], Riposta i Przełamanie Gardy',
    body: 'Gdy boss szykuje potężny cios, nad kartą celu pojawia się ostrzeżenie. Włączenie Gardy [3] zmniejsza obrażenia, a przy uniku lub mocnym bloku w zwarciu uruchamia darmową Ripostę (1× na rundę). Ciężki cios [2], Manewr [R] lub perk Mistrz finty przełamują Gardę wroga (+25% obr., -1 AP).'
  },
  {
    icon: 'weapon',
    title: 'Synergie statusów (Ustaw → Dobij)',
    body: 'Łącz efekty w walce: Krwawienie + cios w zwarciu daje Krwawą Rzeź (+20% obr., +10% kryt), Podpalenie + silny cios/manewr wywołuje Wybuch Żaru (+5 obr. ognia i +1 t. podpalenia), a Oszołomienie lub Okaleczenie nóg odsłania Lukę w Obronie (+15% trafienia i +15% obr.).'
  },
  {
    icon: 'candle',
    title: 'Ognisko, alchemia i zbieranie ziół',
    body: 'Kliknij dowolne ognisko, aby uwarzyć napary, wytopić łój do ostrza (+2 obr.), przygotować Flaszę oleju, Świecę dymną, ugotować posiłek lub przespać noc (usuwa Zmęczenie i leczy). W lasach zbieraj zioła i jagody z krzewów.'
  },
  {
    icon: 'storm',
    title: 'Zjawiska atmosferyczne i pora dnia',
    body: 'Burza Iskier, Mgła Ciszy, Ulewa czy Noc bez Gwiazd wpływają na widoczność, walkę i czas podróży. Mgła Ciszy blokuje broń prochową, ale wspiera skradanie (+20%). Aktywne zjawisko widać na górnej odznace HUD i na Mapie [M].'
  },
  {
    icon: 'consumable',
    title: 'Statusy bojowe i perki',
    body: 'Krwawienie i Zatrucie zadają obrażenia na początku tury — wyleczysz je z Pasa [4]–[7] (opatrunek, odtrutka). Cyrulik wzmacnia leczenie o +25%, Sokole oko dodaje +2 obr. do rzutów, a Nieugięty chroni przed strachem i ogłuszeniem.'
  }
];

export function renderHelpModalView(params: HelpModalViewParams): void {
  const { root, onClose } = params;
  let activeTab: HelpModalTab = params.initialTab ?? 'controls';

  const draw = (): void => {
    const bodyHtml =
      activeTab === 'controls'
        ? `
          <div class="ostrze-help-groups">
            ${CONTROL_GROUPS.map(
              (group) => `
                <section class="ostrze-panel ostrze-help-group">
                  <h3>${escapeHtml(group.title)}</h3>
                  <div class="ostrze-help-list">
                    ${group.items
                      .map(
                        (item) => `
                          <div class="ostrze-help-row">
                            <kbd class="ostrze-kbd">${escapeHtml(item.keys)}</kbd>
                            <span>${escapeHtml(item.desc)}</span>
                          </div>
                        `
                      )
                      .join('')}
                  </div>
                </section>
              `
            ).join('')}
          </div>
        `
        : `
          <div class="ostrze-help-guide">
            ${GUIDE_SECTIONS.map(
              (sec) => `
                <article class="ostrze-panel ostrze-help-guide-card">
                  <h3 class="ostrze-ico-title">${renderSlavicIcon(sec.icon)}<span>${escapeHtml(sec.title)}</span></h3>
                  <p class="ostrze-lore-copy">${escapeHtml(sec.body)}</p>
                </article>
              `
            ).join('')}
          </div>
        `;

    mountModalCard(
      root,
      'ostrze-card ostrze-help-card',
      `
          <div class="ostrze-worldmap-header ostrze-modal-head">
            <div>
              <h2 class="ostrze-title ostrze-ico-title" style="margin-bottom:4px;">${renderSlavicIcon('help')}<span>Pomoc i sterowanie — Ostrze 2.5D</span></h2>
              <div class="ostrze-subtitle" style="margin-bottom:0;">
                Skróty klawiszowe i najważniejsze zasady przetrwania na Pogórzu oraz w Głuszu.
              </div>
            </div>
            <div class="ostrze-worldmap-tabs" role="tablist">
              <button type="button"
                class="ostrze-cs-tab ${activeTab === 'controls' ? 'is-active' : ''}"
                data-help-tab="controls"
                role="tab"
                aria-selected="${activeTab === 'controls' ? 'true' : 'false'}">
                ${renderSlavicIcon('keyboard')}<span>Sterowanie i skróty</span>
              </button>
              <button type="button"
                class="ostrze-cs-tab ${activeTab === 'guide' ? 'is-active' : ''}"
                data-help-tab="guide"
                role="tab"
                aria-selected="${activeTab === 'guide' ? 'true' : 'false'}">
                ${renderSlavicIcon('book')}<span>Poradnik Ostrza</span>
              </button>
              <button type="button" class="ostrze-modal-close-x" data-help-close-top="true" aria-label="Zamknij" title="Zamknij [ESC]">×</button>
            </div>
          </div>

          <div class="ostrze-help-body">
            ${bodyHtml}
          </div>

          <div class="ostrze-worldmap-footer">
            <span class="ostrze-worldmap-region-caption">Wskazówka: naciśnij F1 lub ? w dowolnym momencie poza polem tekstowym.</span>
            <button type="button" class="ostrze-hub-btn" id="ostrze-help-close">Zamknij <kbd class="ostrze-kbd">ESC</kbd></button>
          </div>
      `,
      { dataset: { helpModal: 'true' }, onOverlayBackdropClick: onClose }
    );

    root.querySelectorAll<HTMLButtonElement>('[data-help-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.helpTab as HelpModalTab | undefined;
        if (next && next !== activeTab) {
          activeTab = next;
          draw();
        }
      });
    });

    root.querySelector<HTMLButtonElement>('#ostrze-help-close')?.addEventListener('click', () => {
      onClose();
    });
    root.querySelector<HTMLButtonElement>('[data-help-close-top]')?.addEventListener('click', () => {
      onClose();
    });
  };

  draw();
}
