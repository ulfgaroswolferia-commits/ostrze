import {
  registerCustomPropSprite,
  type CustomPropSpriteSpec
} from '@ulf/renderer/isoSceneView';
import brzezinaBramaUrl from './props/brzezina_brama.jpg';
import brzezinaDworUrl from './props/brzezina_dwor.jpg';
import brzezinaKuzniaUrl from './props/brzezina_kuznia.jpg';
import drzewoBrzozaUrl from './props/drzewo_brzoza.jpg';
import traktKapliczkaUrl from './props/trakt_kapliczka.jpg';
import traktWozUrl from './props/trakt_woz.jpg';

/**
 * Painterly 2.5D isometric dark Slavic fantasy prop sprites (Vertical Slice: Brzezina + Trakt,
 * reusable across all acts). Bundled via Vite asset URLs and loaded with automatic Sobel PBR normals.
 */
export const PAINTERLY_PROP_SPECS: readonly CustomPropSpriteSpec[] = [
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
    kind: 'slavic_shrine',
    url: traktKapliczkaUrl,
    anchorX: 0.5,
    anchorY: 0.88,
    targetWidthPx: 145,
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
