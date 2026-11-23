import {
  registerCustomPropSprite,
  type CustomPropSpriteSpec
} from '@ulf/renderer/isoSceneView';
import brzezinaBramaUrl from './props/brzezina_brama.jpg';
import brzezinaDworUrl from './props/brzezina_dwor.jpg';
import brzezinaKuzniaUrl from './props/brzezina_kuznia.jpg';
import chataLesnaUrl from './props/chata_lesna.jpg';
import drzewoBrzozaUrl from './props/drzewo_brzoza.jpg';
import karczmaUrl from './props/karczma.jpg';
import namiotZwiadowcowUrl from './props/namiot_zwiadowcow.jpg';
import oltarzRunicznyUrl from './props/oltarz_runiczny.jpg';
import ruinySpaloneUrl from './props/ruiny_spalone.jpg';
import staryMlynUrl from './props/stary_mlyn.jpg';
import straganKupieckiUrl from './props/stragan_kupiecki.jpg';
import studniaSlowianskaUrl from './props/studnia_slowianska.jpg';
import traktKapliczkaUrl from './props/trakt_kapliczka.jpg';
import traktWozUrl from './props/trakt_woz.jpg';
import wejscieKopalniUrl from './props/wejscie_kopalni.jpg';

/**
 * Painterly 2.5D isometric dark Slavic fantasy prop sprites covering Prologue, Act I, and Act II.
 * Bundled via Vite asset URLs and loaded on demand with automatic white-background keying
 * and Sobel luminance PBR normal maps.
 */
export const PAINTERLY_PROP_SPECS: readonly CustomPropSpriteSpec[] = [
  // === PROLOGUE (Brzezina + Trakt) ===
  {
    id: 'brzezina_dwor_szkoly',
    url: brzezinaDworUrl,
    anchorX: 0.5,
    anchorY: 0.84,
    targetWidthPx: 295,
    keyOutWhiteBackground: true
  },
  {
    id: 'brzezina_dormitorium_1',
    url: brzezinaDworUrl,
    anchorX: 0.5,
    anchorY: 0.84,
    targetWidthPx: 235,
    keyOutWhiteBackground: true
  },
  {
    id: 'brzezina_dormitorium_2',
    url: brzezinaKuzniaUrl,
    anchorX: 0.5,
    anchorY: 0.85,
    targetWidthPx: 225,
    keyOutWhiteBackground: true
  },
  {
    id: 'brzezina_zbrojownia_szkoly',
    url: brzezinaKuzniaUrl,
    anchorX: 0.5,
    anchorY: 0.85,
    targetWidthPx: 225,
    keyOutWhiteBackground: true
  },
  {
    id: 'brzezina_chata',
    url: brzezinaKuzniaUrl,
    anchorX: 0.5,
    anchorY: 0.85,
    targetWidthPx: 215,
    keyOutWhiteBackground: true
  },
  {
    id: 'brzezina_baszta_szkoly',
    url: brzezinaBramaUrl,
    anchorX: 0.5,
    anchorY: 0.86,
    targetWidthPx: 225,
    keyOutWhiteBackground: true
  },
  {
    id: 'trakt_barykada_skrzynie',
    url: traktWozUrl,
    anchorX: 0.5,
    anchorY: 0.86,
    targetWidthPx: 195,
    keyOutWhiteBackground: true
  },
  {
    idPrefix: 'trakt_woz',
    url: traktWozUrl,
    anchorX: 0.5,
    anchorY: 0.86,
    targetWidthPx: 195,
    keyOutWhiteBackground: true
  },

  // === ACT I & ACT II — TAVERNS, HALLS, SMITHIES, WATERMILL ===
  {
    id: 'wb_karczma',
    url: karczmaUrl,
    anchorX: 0.5,
    anchorY: 0.84,
    targetWidthPx: 275,
    keyOutWhiteBackground: true
  },
  {
    id: 'gluszec_karczma',
    url: karczmaUrl,
    anchorX: 0.5,
    anchorY: 0.84,
    targetWidthPx: 275,
    keyOutWhiteBackground: true
  },
  {
    id: 'wb_koszary_straznicy',
    url: brzezinaDworUrl,
    anchorX: 0.5,
    anchorY: 0.84,
    targetWidthPx: 265,
    keyOutWhiteBackground: true
  },
  {
    id: 'gluszec_dom_soltysa',
    url: brzezinaDworUrl,
    anchorX: 0.5,
    anchorY: 0.84,
    targetWidthPx: 275,
    keyOutWhiteBackground: true
  },
  {
    id: 'wb_kuznia',
    url: brzezinaKuzniaUrl,
    anchorX: 0.5,
    anchorY: 0.85,
    targetWidthPx: 215,
    keyOutWhiteBackground: true
  },
  {
    id: 'wb_szkarad_warsztat',
    url: brzezinaKuzniaUrl,
    anchorX: 0.5,
    anchorY: 0.85,
    targetWidthPx: 210,
    keyOutWhiteBackground: true
  },
  {
    id: 'gluszec_kuznia',
    url: brzezinaKuzniaUrl,
    anchorX: 0.5,
    anchorY: 0.85,
    targetWidthPx: 215,
    keyOutWhiteBackground: true
  },
  {
    id: 'mlyn_budynek',
    url: staryMlynUrl,
    anchorX: 0.5,
    anchorY: 0.84,
    targetWidthPx: 285,
    keyOutWhiteBackground: true
  },
  {
    id: 'lesniczowka_chata',
    url: chataLesnaUrl,
    anchorX: 0.5,
    anchorY: 0.85,
    targetWidthPx: 240,
    keyOutWhiteBackground: true
  },
  {
    id: 'lesniczowka_szopa',
    url: chataLesnaUrl,
    anchorX: 0.5,
    anchorY: 0.86,
    targetWidthPx: 165,
    keyOutWhiteBackground: true
  },
  {
    id: 'mlyn_spichlerz',
    url: chataLesnaUrl,
    anchorX: 0.5,
    anchorY: 0.85,
    targetWidthPx: 230,
    keyOutWhiteBackground: true
  },

  // === ACT I & ACT II — WAGONS, SHRINES, RUINS, MINE PORTALS ===
  {
    id: 'wb_woz_ostromira',
    url: traktWozUrl,
    anchorX: 0.5,
    anchorY: 0.86,
    targetWidthPx: 195,
    keyOutWhiteBackground: true
  },
  {
    id: 'przelecz_woz_ostromira',
    url: traktWozUrl,
    anchorX: 0.5,
    anchorY: 0.86,
    targetWidthPx: 195,
    keyOutWhiteBackground: true
  },
  {
    id: 'trakt_k_woz',
    url: traktWozUrl,
    anchorX: 0.5,
    anchorY: 0.86,
    targetWidthPx: 195,
    keyOutWhiteBackground: true
  },
  {
    id: 'stary_trakt_rozbity_woz',
    url: traktWozUrl,
    anchorX: 0.5,
    anchorY: 0.86,
    targetWidthPx: 195,
    keyOutWhiteBackground: true
  },
  {
    id: 'kapliczka_oltarz',
    url: traktKapliczkaUrl,
    anchorX: 0.5,
    anchorY: 0.88,
    targetWidthPx: 155,
    keyOutWhiteBackground: true
  },
  {
    id: 'gluszec_kapliczka_cmentarz',
    url: traktKapliczkaUrl,
    anchorX: 0.5,
    anchorY: 0.88,
    targetWidthPx: 150,
    keyOutWhiteBackground: true
  },
  {
    idPrefix: 'spalona_chata',
    url: ruinySpaloneUrl,
    anchorX: 0.5,
    anchorY: 0.84,
    targetWidthPx: 235,
    keyOutWhiteBackground: true
  },
  {
    idPrefix: 'ruiny_zgliszcza',
    url: ruinySpaloneUrl,
    anchorX: 0.5,
    anchorY: 0.84,
    targetWidthPx: 220,
    keyOutWhiteBackground: true
  },
  {
    idPrefix: 'kopalnia_wejscie',
    url: wejscieKopalniUrl,
    anchorX: 0.5,
    anchorY: 0.85,
    targetWidthPx: 245,
    keyOutWhiteBackground: true
  },
  {
    idPrefix: 'kamieniolom_wejscie',
    url: wejscieKopalniUrl,
    anchorX: 0.5,
    anchorY: 0.85,
    targetWidthPx: 240,
    keyOutWhiteBackground: true
  },

  // === GLOBAL KIND FALLBACKS (ACT I & ACT II LANDMARKS) ===
  {
    kind: 'slavic_cottage',
    url: chataLesnaUrl,
    anchorX: 0.5,
    anchorY: 0.85,
    targetWidthPx: 215,
    keyOutWhiteBackground: true
  },
  {
    kind: 'watchtower',
    url: brzezinaBramaUrl,
    anchorX: 0.5,
    anchorY: 0.86,
    targetWidthPx: 225,
    keyOutWhiteBackground: true
  },
  {
    kind: 'market_stall',
    url: straganKupieckiUrl,
    anchorX: 0.5,
    anchorY: 0.86,
    targetWidthPx: 180,
    keyOutWhiteBackground: true
  },
  {
    kind: 'ranger_tent',
    url: namiotZwiadowcowUrl,
    anchorX: 0.5,
    anchorY: 0.86,
    targetWidthPx: 175,
    keyOutWhiteBackground: true
  },
  {
    kind: 'slavic_well',
    url: studniaSlowianskaUrl,
    anchorX: 0.5,
    anchorY: 0.87,
    targetWidthPx: 130,
    keyOutWhiteBackground: true
  },
  {
    kind: 'slavic_shrine',
    url: traktKapliczkaUrl,
    anchorX: 0.5,
    anchorY: 0.88,
    targetWidthPx: 145,
    keyOutWhiteBackground: true
  },
  {
    kind: 'runic_altar',
    url: oltarzRunicznyUrl,
    anchorX: 0.5,
    anchorY: 0.87,
    targetWidthPx: 165,
    keyOutWhiteBackground: true
  },
  {
    kind: 'sarcophagus',
    url: oltarzRunicznyUrl,
    anchorX: 0.5,
    anchorY: 0.87,
    targetWidthPx: 165,
    keyOutWhiteBackground: true
  },
  {
    kind: 'ancient_oak',
    url: drzewoBrzozaUrl,
    anchorX: 0.5,
    anchorY: 0.88,
    targetWidthPx: 220,
    keyOutWhiteBackground: true
  }
];

export function registerOstrzePainterlyProps(): void {
  for (const spec of PAINTERLY_PROP_SPECS) {
    registerCustomPropSprite(spec);
  }
}
