import { escapeHtml } from './escapeHtml';

import brzezinaBramaUrl from '../assets/props/brzezina_brama.jpg';
import brzezinaDworUrl from '../assets/props/brzezina_dwor.jpg';
import drogowskazUrl from '../assets/props/drogowskaz.jpg';
import drzewoBrzozaUrl from '../assets/props/drzewo_brzoza.jpg';
import drzewoMartweUrl from '../assets/props/drzewo_martwe.jpg';
import drzewoSosnaUrl from '../assets/props/drzewo_sosna.jpg';
import karczmaUrl from '../assets/props/karczma.jpg';
import krysztalRunicznyUrl from '../assets/props/krysztal_runiczny.jpg';
import manekinTreningowyUrl from '../assets/props/manekin_treningowy.jpg';
import namiotZwiadowcowUrl from '../assets/props/namiot_zwiadowcow.jpg';
import ogniskoUrl from '../assets/props/ognisko.jpg';
import oltarzRunicznyUrl from '../assets/props/oltarz_runiczny.jpg';
import plotCmentarnyUrl from '../assets/props/plot_cmentarny.jpg';
import staryMlynUrl from '../assets/props/stary_mlyn.jpg';
import straganKupieckiUrl from '../assets/props/stragan_kupiecki.jpg';
import sztandarSzkolyUrl from '../assets/props/sztandar_szkoly.jpg';
import traktKapliczkaUrl from '../assets/props/trakt_kapliczka.jpg';
import wiezaStrazniczaUrl from '../assets/props/wieza_straznicza.jpg';

export type StoryVistaTheme =
  | 'falling_star'
  | 'birch_manor'
  | 'training_yard'
  | 'courtyard_lantern'
  | 'forest_trail'
  | 'river_ford_map'
  | 'campfire_night'
  | 'haunted_night'
  | 'misty_mill'
  | 'astral_crater'
  | 'dawn_horizon';

const ART_ID_TO_THEME: Readonly<Record<string, StoryVistaTheme>> = {
  wstep_gwiazdy: 'falling_star',
  wstep_brzezina: 'birch_manor',
  szkolka: 'training_yard',
  nagroda: 'courtyard_lantern',
  kurier_plac: 'courtyard_lantern',
  kram: 'courtyard_lantern',
  wymarsz: 'forest_trail',
  trakt: 'forest_trail',
  stary_trakt: 'forest_trail',
  bor_klusownikow: 'forest_trail',
  mapa_brod: 'river_ford_map',
  ulfgrod: 'river_ford_map',
  odpoczynek: 'campfire_night',
  oboz: 'campfire_night',
  noc_upiory: 'haunted_night',
  noc_ciemnosc: 'haunted_night',
  stary_mlyn: 'misty_mill',
  gluszec: 'misty_mill',
  obserwatorium: 'astral_crater',
  krater_gwiazdy: 'astral_crater',
  wrak_maszyny: 'astral_crater',
  koniec: 'dawn_horizon'
};

export function resolveStoryVistaTheme(artId: string | undefined): StoryVistaTheme {
  if (!artId) return 'forest_trail';
  const normalized = artId.trim().toLowerCase();
  if (Object.hasOwn(ART_ID_TO_THEME, normalized)) {
    return ART_ID_TO_THEME[normalized];
  }
  if (normalized.includes('gwiazd') || normalized.includes('niebo')) return 'falling_star';
  if (normalized.includes('brzezin') || normalized.includes('dwor')) return 'birch_manor';
  if (normalized.includes('noc') || normalized.includes('upior') || normalized.includes('zmor')) return 'haunted_night';
  if (normalized.includes('oboz') || normalized.includes('ognisk') || normalized.includes('odpocz')) return 'campfire_night';
  if (normalized.includes('mlyn') || normalized.includes('bagn') || normalized.includes('glusz')) return 'misty_mill';
  if (normalized.includes('krater') || normalized.includes('obserw') || normalized.includes('wrak')) return 'astral_crater';
  if (normalized.includes('mapa') || normalized.includes('brod') || normalized.includes('grod')) return 'river_ford_map';
  if (normalized.includes('koniec') || normalized.includes('swit')) return 'dawn_horizon';
  return 'forest_trail';
}

/**
 * SVG filter that keys out pure white (#FFFFFF) backgrounds from our hand-painted
 * Ostrze 2.5D prop sprites while preserving full painterly color & brush texture,
 * with optional atmospheric mood tinting (daylight/night/dusk).
 */
function buildKeyFilterDef(
  id: string,
  rMul = 1.0,
  gMul = 1.0,
  bMul = 1.0
): string {
  return `
    <filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" result="keyed" values="
        ${rMul} 0 0 0 0
        0 ${gMul} 0 0 0
        0 0 ${bMul} 0 0
        -5.0 -5.0 -5.0 0 13.8
      "/>
      <feComposite in="keyed" in2="SourceAlpha" operator="in"/>
    </filter>
  `;
}

function spriteLayer(
  href: string,
  x: number,
  y: number,
  w: number,
  h: number,
  filterId: string,
  opacity = 1,
  flipX = false
): string {
  const transform = flipX ? ` transform="translate(${x * 2 + w}, 0) scale(-1, 1)"` : '';
  return `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" filter="url(#${filterId})" opacity="${opacity}" preserveAspectRatio="xMidYMid meet"${transform}/>`;
}

function buildStarsLayer(uid: string, count: number, tint = '#f4e6c8'): string {
  const coords = [
    [32, 22, 1.4, 0.9, 'a'],
    [68, 38, 1.0, 0.65, 'b'],
    [108, 18, 1.6, 0.95, 'c'],
    [148, 44, 1.1, 0.7, 'a'],
    [192, 24, 1.3, 0.8, 'b'],
    [236, 36, 1.5, 0.9, 'c'],
    [282, 19, 1.0, 0.6, 'a'],
    [326, 42, 1.7, 0.95, 'b'],
    [372, 26, 1.2, 0.75, 'c'],
    [418, 16, 1.5, 0.9, 'a'],
    [452, 40, 1.1, 0.7, 'b'],
    [54, 62, 0.9, 0.55, 'c'],
    [134, 68, 1.0, 0.6, 'a'],
    [258, 58, 1.1, 0.65, 'b'],
    [354, 64, 0.9, 0.55, 'c'],
    [438, 60, 1.2, 0.7, 'a']
  ];
  return coords
    .slice(0, count)
    .map(
      ([cx, cy, r, op, cls], idx) =>
        `<circle class="ostrze-vista-star ostrze-vista-star--${cls}" cx="${cx}" cy="${cy}" r="${r}" fill="${tint}" opacity="${op}" data-s="${uid}-${idx}"/>`
    )
    .join('');
}

function buildEmbersLayer(color = '#ffb95c'): string {
  const embers = [
    [214, 198, 2.0, 'a'],
    [232, 188, 1.5, 'b'],
    [248, 194, 2.2, 'c'],
    [264, 184, 1.6, 'a'],
    [224, 174, 1.3, 'c'],
    [256, 172, 1.8, 'b'],
    [239, 162, 1.4, 'a']
  ];
  return embers
    .map(
      ([cx, cy, r, cls]) =>
        `<circle class="ostrze-vista-ember ostrze-vista-ember--${cls}" cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`
    )
    .join('');
}

function buildPineRidge(yBase: number, fill: string, seedOffset: number): string {
  const pts: string[] = [`0,240`, `0,${yBase}`];
  for (let x = 0; x <= 480; x += 12) {
    const wave = Math.sin(x * 0.045 + seedOffset) * 8 + Math.cos(x * 0.11 + seedOffset * 1.7) * 4;
    const spike = ((x / 12 + seedOffset) % 2 === 0 ? -8 : 3) + Math.sin(x * 0.23 + seedOffset) * 3;
    const y = Math.round(yBase + wave + spike);
    pts.push(`${x},${y}`);
  }
  pts.push(`480,240`);
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

function buildMistBands(uid: string, color: string, opacity: number): string {
  return `
    <defs>
      <radialGradient id="${uid}-mist" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.62"/>
        <stop offset="65%" stop-color="${color}" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g class="ostrze-vista-mist ostrze-vista-mist--slow" opacity="${opacity}">
      <ellipse cx="140" cy="196" rx="200" ry="26" fill="url(#${uid}-mist)"/>
      <ellipse cx="380" cy="204" rx="190" ry="24" fill="url(#${uid}-mist)"/>
    </g>
    <g class="ostrze-vista-mist ostrze-vista-mist--fast" opacity="${(opacity * 0.72).toFixed(2)}">
      <ellipse cx="260" cy="214" rx="230" ry="22" fill="url(#${uid}-mist)"/>
    </g>
  `;
}

function buildThemeSvgInner(theme: StoryVistaTheme, uid: string): string {
  switch (theme) {
    case 'falling_star':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#050811"/>
            <stop offset="52%" stop-color="#101b30"/>
            <stop offset="82%" stop-color="#222a3d"/>
            <stop offset="100%" stop-color="#151316"/>
          </linearGradient>
          <radialGradient id="${uid}-moon" cx="76%" cy="28%" r="36%">
            <stop offset="0%" stop-color="#f7ecd2" stop-opacity="0.45"/>
            <stop offset="40%" stop-color="#9cb5d8" stop-opacity="0.16"/>
            <stop offset="100%" stop-color="#0d1524" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="${uid}-comet" x1="0" y1="0" x2="1" y2="0.45">
            <stop offset="0%" stop-color="#fff8e0" stop-opacity="0"/>
            <stop offset="68%" stop-color="#ffd080" stop-opacity="0.58"/>
            <stop offset="100%" stop-color="#fffdf4" stop-opacity="0.98"/>
          </linearGradient>
          <mask id="${uid}-crescent">
            <rect width="480" height="240" fill="black"/>
            <circle cx="364" cy="64" r="15" fill="white"/>
            <circle cx="371" cy="59" r="13.5" fill="black"/>
          </mask>
          ${buildKeyFilterDef(`${uid}-night`, 0.42, 0.48, 0.62)}
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <rect width="480" height="240" fill="url(#${uid}-moon)"/>
        ${buildStarsLayer(uid, 16, '#f6ebd2')}
        <circle cx="364" cy="64" r="15" fill="#f3e7c9" opacity="0.92" mask="url(#${uid}-crescent)"/>
        <g class="ostrze-vista-comet">
          <line x1="72" y1="30" x2="210" y2="88" stroke="url(#${uid}-comet)" stroke-width="3.2" stroke-linecap="round"/>
          <line x1="108" y1="45" x2="210" y2="88" stroke="#fff7df" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="211" cy="88" r="5.5" fill="#ffd482" opacity="0.48"/>
          <circle cx="211" cy="88" r="2.4" fill="#ffffff"/>
        </g>
        <path d="M0 166 Q115 130 228 156 T480 144 L480 240 L0 240 Z" fill="#121826"/>
        ${buildPineRidge(174, '#0c111b', 1.2)}
        ${spriteLayer(drzewoSosnaUrl, -22, 92, 138, 152, `${uid}-night`, 0.88)}
        ${spriteLayer(drzewoSosnaUrl, 366, 86, 140, 158, `${uid}-night`, 0.9, true)}
        ${spriteLayer(brzezinaDworUrl, 174, 132, 132, 108, `${uid}-night`, 0.84)}
        <g class="ostrze-vista-glow" opacity="0.88">
          <circle cx="240" cy="188" r="24" fill="#e6943c" opacity="0.24"/>
          <rect x="228" y="186" width="5" height="4" rx="0.6" fill="#ffd27d"/>
          <rect x="247" y="186" width="5" height="4" rx="0.6" fill="#ffbe62"/>
        </g>
        ${buildMistBands(uid, '#7d98b8', 0.38)}
      `;

    case 'birch_manor':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#192130"/>
            <stop offset="46%" stop-color="#4e4044"/>
            <stop offset="78%" stop-color="#b67d52"/>
            <stop offset="100%" stop-color="#7c563a"/>
          </linearGradient>
          <radialGradient id="${uid}-sun" cx="56%" cy="72%" r="48%">
            <stop offset="0%" stop-color="#ffe2a8" stop-opacity="0.72"/>
            <stop offset="55%" stop-color="#d2864b" stop-opacity="0.24"/>
            <stop offset="100%" stop-color="#2a242c" stop-opacity="0"/>
          </radialGradient>
          ${buildKeyFilterDef(`${uid}-dawn`, 0.96, 0.84, 0.72)}
          ${buildKeyFilterDef(`${uid}-fg`, 0.84, 0.76, 0.68)}
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <rect width="480" height="240" fill="url(#${uid}-sun)"/>
        <path d="M0 156 Q130 132 250 152 T480 146 L480 240 L0 240 Z" fill="#2c2424"/>
        ${buildPineRidge(166, '#1f1a1b', 2.1)}
        <rect x="0" y="196" width="480" height="44" fill="#171412"/>
        ${spriteLayer(brzezinaDworUrl, 134, 72, 212, 168, `${uid}-dawn`, 0.98)}
        <g class="ostrze-vista-glow">
          <circle cx="240" cy="176" r="34" fill="#ffb85c" opacity="0.18"/>
        </g>
        ${buildMistBands(uid, '#ebd2b4', 0.42)}
        ${spriteLayer(drzewoBrzozaUrl, -34, 24, 168, 218, `${uid}-fg`, 0.96)}
        ${spriteLayer(drzewoBrzozaUrl, 344, 30, 170, 214, `${uid}-fg`, 0.96, true)}
      `;

    case 'training_yard':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#18202b"/>
            <stop offset="54%" stop-color="#3a3d46"/>
            <stop offset="86%" stop-color="#8b6948"/>
            <stop offset="100%" stop-color="#3c2d21"/>
          </linearGradient>
          ${buildKeyFilterDef(`${uid}-morn`, 0.92, 0.84, 0.76)}
          ${buildKeyFilterDef(`${uid}-back`, 0.72, 0.68, 0.65)}
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <polygon points="105,0 260,0 340,240 40,240" fill="#ffe1a6" opacity="0.08"/>
        ${buildPineRidge(156, '#1f2228', 4.3)}
        <rect x="0" y="178" width="480" height="62" fill="#231c16"/>
        ${spriteLayer(brzezinaBramaUrl, 148, 42, 184, 164, `${uid}-back`, 0.92)}
        ${spriteLayer(sztandarSzkolyUrl, 48, 72, 114, 152, `${uid}-morn`, 0.95)}
        ${spriteLayer(manekinTreningowyUrl, 314, 88, 120, 140, `${uid}-morn`, 0.96)}
        ${buildMistBands(uid, '#e2c59a', 0.44)}
      `;

    case 'courtyard_lantern':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0d111a"/>
            <stop offset="56%" stop-color="#222029"/>
            <stop offset="100%" stop-color="#4d3221"/>
          </linearGradient>
          <radialGradient id="${uid}-lantern" cx="50%" cy="54%" r="48%">
            <stop offset="0%" stop-color="#ffe29c" stop-opacity="0.62"/>
            <stop offset="40%" stop-color="#e58c38" stop-opacity="0.24"/>
            <stop offset="100%" stop-color="#1b1414" stop-opacity="0"/>
          </radialGradient>
          ${buildKeyFilterDef(`${uid}-dusk`, 0.88, 0.78, 0.66)}
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        ${buildStarsLayer(uid, 9, '#f2dfb8')}
        <rect x="0" y="182" width="480" height="58" fill="#18120f"/>
        ${spriteLayer(karczmaUrl, 24, 52, 210, 178, `${uid}-dusk`, 0.94)}
        ${spriteLayer(straganKupieckiUrl, 256, 86, 192, 148, `${uid}-dusk`, 0.95)}
        <rect width="480" height="240" fill="url(#${uid}-lantern)" class="ostrze-vista-glow"/>
        ${buildEmbersLayer('#ffca72')}
        ${buildMistBands(uid, '#c89262', 0.28)}
      `;

    case 'campfire_night':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#05080f"/>
            <stop offset="60%" stop-color="#101824"/>
            <stop offset="100%" stop-color="#2b1912"/>
          </linearGradient>
          <radialGradient id="${uid}-fire" cx="50%" cy="76%" r="50%">
            <stop offset="0%" stop-color="#ffe79e" stop-opacity="0.72"/>
            <stop offset="34%" stop-color="#e87928" stop-opacity="0.34"/>
            <stop offset="72%" stop-color="#6e2412" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="#0a0c10" stop-opacity="0"/>
          </radialGradient>
          ${buildKeyFilterDef(`${uid}-camp`, 0.84, 0.74, 0.64)}
          ${buildKeyFilterDef(`${uid}-darkpine`, 0.45, 0.5, 0.58)}
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        ${buildStarsLayer(uid, 14, '#f1e4c6')}
        ${buildPineRidge(154, '#0c1118', 2.8)}
        <path d="M0 194 Q240 180 480 194 L480 240 L0 240 Z" fill="#140e0b"/>
        ${spriteLayer(drzewoSosnaUrl, -24, 54, 152, 182, `${uid}-darkpine`, 0.92)}
        ${spriteLayer(drzewoSosnaUrl, 356, 58, 152, 182, `${uid}-darkpine`, 0.92, true)}
        ${spriteLayer(namiotZwiadowcowUrl, 66, 108, 150, 122, `${uid}-camp`, 0.92)}
        ${spriteLayer(ogniskoUrl, 176, 122, 128, 114, `${uid}-camp`, 0.98)}
        <rect width="480" height="240" fill="url(#${uid}-fire)" class="ostrze-vista-glow"/>
        ${buildEmbersLayer('#ffbe5e')}
      `;

    case 'haunted_night':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#050b12"/>
            <stop offset="55%" stop-color="#0d1f2b"/>
            <stop offset="100%" stop-color="#172c32"/>
          </linearGradient>
          <radialGradient id="${uid}-moon" cx="50%" cy="32%" r="42%">
            <stop offset="0%" stop-color="#e3f3f4" stop-opacity="0.56"/>
            <stop offset="45%" stop-color="#609ba6" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#071118" stop-opacity="0"/>
          </radialGradient>
          ${buildKeyFilterDef(`${uid}-haunt`, 0.44, 0.58, 0.64)}
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <rect width="480" height="240" fill="url(#${uid}-moon)"/>
        ${buildStarsLayer(uid, 10, '#cde8ec')}
        <circle cx="240" cy="70" r="24" fill="#dceef0" opacity="0.88"/>
        ${buildPineRidge(170, '#09141a', 1.8)}
        <rect x="0" y="192" width="480" height="48" fill="#070e12"/>
        ${spriteLayer(plotCmentarnyUrl, 152, 134, 176, 98, `${uid}-haunt`, 0.88)}
        ${spriteLayer(drzewoMartweUrl, -20, 44, 172, 194, `${uid}-haunt`, 0.94)}
        ${spriteLayer(drzewoMartweUrl, 330, 48, 172, 192, `${uid}-haunt`, 0.94, true)}
        <g class="ostrze-vista-wisp ostrze-vista-wisp--a">
          <circle cx="152" cy="148" r="14" fill="#5ce1d6" opacity="0.24"/>
          <circle cx="152" cy="148" r="4" fill="#c7fff8" opacity="0.92"/>
        </g>
        <g class="ostrze-vista-wisp ostrze-vista-wisp--b">
          <circle cx="328" cy="138" r="16" fill="#6ae8d8" opacity="0.22"/>
          <circle cx="328" cy="138" r="4.5" fill="#d4fffb" opacity="0.92"/>
        </g>
        <g class="ostrze-vista-wisp ostrze-vista-wisp--c">
          <circle cx="244" cy="162" r="11" fill="#7df0e0" opacity="0.2"/>
          <circle cx="244" cy="162" r="3" fill="#e0fffc" opacity="0.88"/>
        </g>
        ${buildMistBands(uid, '#78bfc2', 0.48)}
      `;

    case 'misty_mill':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#131c21"/>
            <stop offset="58%" stop-color="#29383c"/>
            <stop offset="100%" stop-color="#42514d"/>
          </linearGradient>
          ${buildKeyFilterDef(`${uid}-marsh`, 0.76, 0.82, 0.78)}
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <path d="M0 162 Q160 144 300 158 T480 150 L480 240 L0 240 Z" fill="#1b2626"/>
        ${spriteLayer(staryMlynUrl, 192, 54, 212, 178, `${uid}-marsh`, 0.96)}
        ${spriteLayer(drzewoMartweUrl, -14, 62, 158, 174, `${uid}-marsh`, 0.9)}
        ${buildMistBands(uid, '#b9cdc6', 0.56)}
      `;

    case 'astral_crater':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#070713"/>
            <stop offset="52%" stop-color="#1c1532"/>
            <stop offset="100%" stop-color="#2c1d2e"/>
          </linearGradient>
          <radialGradient id="${uid}-core" cx="50%" cy="68%" r="48%">
            <stop offset="0%" stop-color="#9beeff" stop-opacity="0.65"/>
            <stop offset="34%" stop-color="#a864ff" stop-opacity="0.32"/>
            <stop offset="72%" stop-color="#4e235c" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="#0c0916" stop-opacity="0"/>
          </radialGradient>
          ${buildKeyFilterDef(`${uid}-astral`, 0.82, 0.84, 1.04)}
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        ${buildStarsLayer(uid, 16, '#dfd2ff')}
        <path d="M0 176 L110 146 L188 184 L292 184 L368 142 L480 174 L480 240 L0 240 Z" fill="#100d18"/>
        ${spriteLayer(oltarzRunicznyUrl, 126, 94, 148, 138, `${uid}-astral`, 0.9)}
        ${spriteLayer(krysztalRunicznyUrl, 224, 72, 134, 152, `${uid}-astral`, 0.98)}
        <rect width="480" height="240" fill="url(#${uid}-core)" class="ostrze-vista-glow"/>
        ${buildEmbersLayer('#9fe8ff')}
        ${buildMistBands(uid, '#997ec8', 0.36)}
      `;

    case 'river_ford_map':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#141821"/>
            <stop offset="55%" stop-color="#33302f"/>
            <stop offset="100%" stop-color="#6b5139"/>
          </linearGradient>
          ${buildKeyFilterDef(`${uid}-map`, 0.88, 0.82, 0.72)}
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <path d="M0 152 Q120 128 240 148 T480 140 L480 240 L0 240 Z" fill="#23201f"/>
        ${buildPineRidge(166, '#171618', 2.4)}
        <path d="M0 240 Q150 202 238 192 Q298 184 320 172 L354 172 Q330 198 252 214 Q170 230 110 240 Z" fill="#4f6b7a" opacity="0.62"/>
        ${spriteLayer(wiezaStrazniczaUrl, 274, 48, 166, 178, `${uid}-map`, 0.96)}
        ${spriteLayer(drzewoSosnaUrl, -16, 68, 142, 168, `${uid}-map`, 0.9)}
        <g transform="translate(46, 48)" opacity="0.28" stroke="#e5b869" stroke-width="1.2" fill="none">
          <circle cx="0" cy="0" r="18"/>
          <line x1="0" y1="-24" x2="0" y2="24"/>
          <line x1="-24" y1="0" x2="24" y2="0"/>
        </g>
        ${buildMistBands(uid, '#d4bd98', 0.4)}
      `;

    case 'dawn_horizon':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#191d2b"/>
            <stop offset="42%" stop-color="#5a393a"/>
            <stop offset="76%" stop-color="#c97b42"/>
            <stop offset="100%" stop-color="#8b5934"/>
          </linearGradient>
          <radialGradient id="${uid}-sun" cx="50%" cy="76%" r="54%">
            <stop offset="0%" stop-color="#fff0c4" stop-opacity="0.82"/>
            <stop offset="48%" stop-color="#e39249" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="#2a1f24" stop-opacity="0"/>
          </radialGradient>
          ${buildKeyFilterDef(`${uid}-gold`, 1.0, 0.88, 0.72)}
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <rect width="480" height="240" fill="url(#${uid}-sun)" class="ostrze-vista-glow"/>
        <path d="M0 166 Q140 136 250 154 T480 148 L480 240 L0 240 Z" fill="#2c1f1e"/>
        ${buildPineRidge(184, '#161112', 0.8)}
        ${spriteLayer(drzewoBrzozaUrl, -22, 34, 158, 206, `${uid}-gold`, 0.94)}
        ${spriteLayer(drzewoBrzozaUrl, 344, 34, 158, 206, `${uid}-gold`, 0.94, true)}
        ${buildEmbersLayer('#ffe09e')}
        ${buildMistBands(uid, '#f3ce94', 0.36)}
      `;

    case 'forest_trail':
    default:
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0d151d"/>
            <stop offset="54%" stop-color="#23323b"/>
            <stop offset="100%" stop-color="#423e34"/>
          </linearGradient>
          <radialGradient id="${uid}-horizon" cx="52%" cy="68%" r="44%">
            <stop offset="0%" stop-color="#dfb87c" stop-opacity="0.4"/>
            <stop offset="60%" stop-color="#6e6552" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="#11181e" stop-opacity="0"/>
          </radialGradient>
          ${buildKeyFilterDef(`${uid}-trail`, 0.82, 0.82, 0.78)}
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <rect width="480" height="240" fill="url(#${uid}-horizon)"/>
        ${buildPineRidge(148, '#172126', 1.4)}
        ${buildPineRidge(172, '#0e1518', 3.7)}
        <path d="M172 240 Q222 198 242 172 L254 172 Q266 202 326 240 Z" fill="#3b3127" opacity="0.82"/>
        ${spriteLayer(drzewoSosnaUrl, -24, 38, 162, 198, `${uid}-trail`, 0.94)}
        ${spriteLayer(drzewoSosnaUrl, 344, 42, 162, 194, `${uid}-trail`, 0.94, true)}
        ${spriteLayer(traktKapliczkaUrl, 114, 96, 116, 134, `${uid}-trail`, 0.96)}
        ${spriteLayer(drogowskazUrl, 286, 118, 94, 112, `${uid}-trail`, 0.94)}
        ${buildMistBands(uid, '#a8bbb6', 0.44)}
      `;
  }
}

export function renderStoryVistaBannerHtml(
  artId: string | undefined,
  altText: string,
  frameClass: 'ostrze-welcome-art-frame' | 'ostrze-narrative-art-frame' = 'ostrze-narrative-art-frame'
): string {
  const theme = resolveStoryVistaTheme(artId);
  const uid = `ov-${theme}`;
  const safeAlt = escapeHtml(altText);

  return `
    <div class="${frameClass} ostrze-vista-frame" data-vista-theme="${theme}" role="img" aria-label="${safeAlt}">
      <svg class="ostrze-vista-svg" viewBox="0 0 480 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        ${buildThemeSvgInner(theme, uid)}
      </svg>
      <div class="ostrze-vista-vignette" aria-hidden="true"></div>
    </div>
  `;
}
