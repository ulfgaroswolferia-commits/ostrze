import { escapeHtml } from './escapeHtml';

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

/** Deterministic painterly pine-tree skyline with varied heights and natural spruce boughs. */
function buildSpruceSkyline(
  yBase: number,
  fill: string,
  seed: number,
  density = 26,
  tallness = 1.0
): string {
  const parts: string[] = [`<path d="M0 240 L0 ${yBase}`];
  const step = 480 / density;
  for (let i = 0; i <= density; i++) {
    const x = Math.round(i * step);
    const n1 = Math.sin(i * 1.7 + seed) * 0.5 + 0.5;
    const n2 = Math.cos(i * 2.9 + seed * 1.3) * 0.5 + 0.5;
    const h = Math.round((14 + n1 * 24 + n2 * 10) * tallness);
    const yTip = yBase - h;
    const w = Math.round(step * (0.58 + n2 * 0.25));
    parts.push(
      ` L${x - w} ${yBase + 6} L${x - Math.round(w * 0.45)} ${yTip + Math.round(h * 0.55)} L${x - Math.round(w * 0.65)} ${yTip + Math.round(h * 0.52)} L${x - Math.round(w * 0.25)} ${yTip + Math.round(h * 0.25)} L${x} ${yTip} L${x + Math.round(w * 0.25)} ${yTip + Math.round(h * 0.25)} L${x + Math.round(w * 0.65)} ${yTip + Math.round(h * 0.52)} L${x + Math.round(w * 0.45)} ${yTip + Math.round(h * 0.55)} L${x + w} ${yBase + 6}`
    );
  }
  parts.push(` L480 240 Z" fill="${fill}"/>`);
  return parts.join('');
}

function buildStarsLayer(uid: string, count: number, tint = '#f6ebd2'): string {
  const coords: Array<[number, number, number, number, string]> = [
    [28, 22, 1.3, 0.9, 'a'],
    [64, 42, 0.9, 0.6, 'b'],
    [104, 17, 1.5, 0.95, 'c'],
    [146, 46, 1.0, 0.68, 'a'],
    [188, 24, 1.2, 0.8, 'b'],
    [232, 34, 1.4, 0.88, 'c'],
    [276, 18, 0.9, 0.58, 'a'],
    [322, 40, 1.6, 0.95, 'b'],
    [368, 24, 1.1, 0.72, 'c'],
    [416, 16, 1.4, 0.9, 'a'],
    [454, 38, 1.0, 0.68, 'b'],
    [48, 64, 0.85, 0.52, 'c'],
    [132, 72, 0.95, 0.58, 'a'],
    [254, 56, 1.0, 0.62, 'b'],
    [348, 62, 0.85, 0.54, 'c'],
    [438, 60, 1.15, 0.7, 'a'],
    [82, 28, 0.8, 0.5, 'b'],
    [298, 28, 1.0, 0.65, 'c']
  ];
  return coords
    .slice(0, count)
    .map(
      ([cx, cy, r, op, cls], idx) =>
        `<circle class="ostrze-vista-star ostrze-vista-star--${cls}" cx="${cx}" cy="${cy}" r="${r}" fill="${tint}" opacity="${op}" data-s="${uid}-${idx}"/>`
    )
    .join('');
}

function buildEmbersLayer(color = '#ffb95c', cxBase = 240, cyBase = 194): string {
  const offsets: Array<[number, number, number, string]> = [
    [-26, 4, 1.9, 'a'],
    [-8, -6, 1.4, 'b'],
    [8, 0, 2.1, 'c'],
    [24, -10, 1.5, 'a'],
    [-16, -20, 1.2, 'c'],
    [16, -22, 1.7, 'b'],
    [0, -32, 1.3, 'a']
  ];
  return offsets
    .map(
      ([dx, dy, r, cls]) =>
        `<circle class="ostrze-vista-ember ostrze-vista-ember--${cls}" cx="${cxBase + dx}" cy="${cyBase + dy}" r="${r}" fill="${color}"/>`
    )
    .join('');
}

function buildMistBands(uid: string, color: string, opacity: number, yMid = 192): string {
  return `
    <defs>
      <radialGradient id="${uid}-mist" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.62"/>
        <stop offset="55%" stop-color="${color}" stop-opacity="0.24"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g class="ostrze-vista-mist ostrze-vista-mist--slow" opacity="${opacity}">
      <ellipse cx="130" cy="${yMid}" rx="210" ry="26" fill="url(#${uid}-mist)"/>
      <ellipse cx="370" cy="${yMid + 8}" rx="200" ry="24" fill="url(#${uid}-mist)"/>
    </g>
    <g class="ostrze-vista-mist ostrze-vista-mist--fast" opacity="${(opacity * 0.72).toFixed(2)}">
      <ellipse cx="250" cy="${yMid + 16}" rx="240" ry="20" fill="url(#${uid}-mist)"/>
    </g>
  `;
}

function buildPainterlyCloudBank(y: number, fill: string, opacity: number): string {
  return `
    <g class="ostrze-vista-mist ostrze-vista-mist--slow" opacity="${opacity}">
      <path d="M-30 ${y} Q40 ${y - 26} 120 ${y - 10} T270 ${y - 14} T420 ${y - 8} T520 ${y} L520 ${y + 34} L-30 ${y + 34} Z" fill="${fill}"/>
    </g>
  `;
}

function buildThemeSvgInner(theme: StoryVistaTheme, uid: string): string {
  switch (theme) {
    case 'falling_star':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#04070f"/>
            <stop offset="46%" stop-color="#0e192d"/>
            <stop offset="76%" stop-color="#1e2a40"/>
            <stop offset="100%" stop-color="#151822"/>
          </linearGradient>
          <radialGradient id="${uid}-moon-halo" cx="77%" cy="27%" r="36%">
            <stop offset="0%" stop-color="#fff4d6" stop-opacity="0.46"/>
            <stop offset="35%" stop-color="#8fb1d9" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#0c1526" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="${uid}-comet-tail" x1="0" y1="0" x2="1" y2="0.44">
            <stop offset="0%" stop-color="#fff8e0" stop-opacity="0"/>
            <stop offset="52%" stop-color="#f7b963" stop-opacity="0.38"/>
            <stop offset="86%" stop-color="#ffe5a3" stop-opacity="0.88"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="1"/>
          </linearGradient>
          <radialGradient id="${uid}-hearth" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffb85c" stop-opacity="0.6"/>
            <stop offset="55%" stop-color="#d96c27" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#0d111a" stop-opacity="0"/>
          </radialGradient>
          <mask id="${uid}-crescent">
            <rect width="480" height="240" fill="black"/>
            <circle cx="370" cy="62" r="15" fill="white"/>
            <circle cx="377" cy="57" r="13.5" fill="black"/>
          </mask>
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <rect width="480" height="240" fill="url(#${uid}-moon-halo)"/>
        ${buildStarsLayer(uid, 18, '#f6ebd2')}
        <circle cx="370" cy="62" r="15" fill="#f6ebd0" opacity="0.95" mask="url(#${uid}-crescent)"/>
        ${buildPainterlyCloudBank(112, '#1a273e', 0.42)}
        <g class="ostrze-vista-comet">
          <line x1="56" y1="24" x2="216" y2="92" stroke="url(#${uid}-comet-tail)" stroke-width="5.5" stroke-linecap="round" opacity="0.45"/>
          <line x1="78" y1="33" x2="216" y2="92" stroke="url(#${uid}-comet-tail)" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="217" cy="92" r="7.5" fill="#ffd27d" opacity="0.42"/>
          <circle cx="217" cy="92" r="2.6" fill="#ffffff"/>
        </g>
        <!-- Distant Carpathian ridges -->
        <path d="M0 162 Q68 122 142 146 T292 134 T480 152 L480 240 L0 240 Z" fill="#131c2e"/>
        <path d="M0 176 Q112 144 218 164 T404 148 T480 166 L480 240 L0 240 Z" fill="#0d1422"/>
        ${buildSpruceSkyline(184, '#090e18', 1.4, 28, 0.85)}
        <!-- Valley settlement silhouette with warm flickering hearths -->
        <g transform="translate(192, 168)">
          <ellipse cx="46" cy="24" rx="44" ry="18" fill="url(#${uid}-hearth)" class="ostrze-vista-glow"/>
          <path d="M8 28 L18 16 L30 28 Z M30 28 L44 10 L60 28 Z M62 28 L72 18 L84 28 Z" fill="#080b12"/>
          <rect x="11" y="27" width="16" height="10" fill="#080b12"/>
          <rect x="33" y="27" width="24" height="12" fill="#080b12"/>
          <rect x="65" y="27" width="16" height="10" fill="#080b12"/>
          <g class="ostrze-vista-glow">
            <rect x="16" y="30" width="3" height="3" fill="#ffbe62"/>
            <rect x="39" y="29" width="4" height="4" fill="#ffd47d"/>
            <rect x="48" y="29" width="4" height="4" fill="#ffb85c"/>
            <rect x="70" y="30" width="3" height="3" fill="#f5a24a"/>
          </g>
        </g>
        ${buildMistBands(uid, '#7d98b8', 0.42, 196)}
        <!-- Foreground framing pine boughs -->
        ${buildSpruceSkyline(212, '#05070c', 3.9, 18, 1.1)}
      `;

    case 'birch_manor':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#141a28"/>
            <stop offset="38%" stop-color="#3a3340"/>
            <stop offset="68%" stop-color="#9e6746"/>
            <stop offset="88%" stop-color="#d89d63"/>
            <stop offset="100%" stop-color="#2c1f1a"/>
          </linearGradient>
          <radialGradient id="${uid}-sun" cx="56%" cy="72%" r="50%">
            <stop offset="0%" stop-color="#ffe7b3" stop-opacity="0.82"/>
            <stop offset="44%" stop-color="#d98748" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="#261f28" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="${uid}-win-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffcf75" stop-opacity="0.58"/>
            <stop offset="100%" stop-color="#ff9933" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <rect width="480" height="240" fill="url(#${uid}-sun)"/>
        ${buildPainterlyCloudBank(88, '#544148', 0.45)}
        <!-- Rolling Pogórze hills -->
        <path d="M0 156 Q96 128 210 148 T410 138 T480 152 L480 240 L0 240 Z" fill="#3a2c2b"/>
        ${buildSpruceSkyline(166, '#231c1e', 2.2, 30, 0.72)}
        <!-- Grounded hilltop for Brzezina Manor -->
        <path d="M0 188 Q140 166 248 172 T480 186 L480 240 L0 240 Z" fill="#181314"/>
        <!-- Detailed Slavic Timber Manor (Szkoła Ostrza) silhouette -->
        <g transform="translate(178, 114)">
          <!-- Chimney smoke curl -->
          <path class="ostrze-vista-smoke" d="M88 18 Q94 6 86 -4 T94 -22" fill="none" stroke="#d8c3ab" stroke-width="4" stroke-linecap="round" opacity="0.28"/>
          <!-- Side wing & palisade fence -->
          <path d="M-44 64 L-40 48 L-36 64 M-32 64 L-28 46 L-24 64 M-20 64 L-16 48 L-12 64 M118 64 L122 48 L126 64 M130 64 L134 46 L138 64 M142 64 L146 48 L150 64" stroke="#130f10" stroke-width="3.2" fill="none"/>
          <rect x="-46" y="55" width="38" height="3" fill="#130f10"/>
          <rect x="114" y="55" width="38" height="3" fill="#130f10"/>
          <!-- Main pitched roof with Slavic gable overhang -->
          <polygon points="0,38 56,4 114,38 106,42 56,12 8,42" fill="#0f0c0d"/>
          <polygon points="10,36 56,8 104,36" fill="#1b1516"/>
          <rect x="82" y="12" width="10" height="20" fill="#120e0f"/>
          <!-- Timber walls & porch -->
          <rect x="14" y="36" width="84" height="32" fill="#141011"/>
          <polygon points="40,42 56,30 72,42" fill="#0f0c0d"/>
          <!-- Warm glowing windows + ambient pool -->
          <ellipse cx="56" cy="54" rx="42" ry="18" fill="url(#${uid}-win-glow)" class="ostrze-vista-glow"/>
          <g class="ostrze-vista-glow">
            <rect x="24" y="45" width="11" height="10" rx="1" fill="#ffc96b"/>
            <line x1="29.5" y1="45" x2="29.5" y2="55" stroke="#24160e" stroke-width="1.2"/>
            <line x1="24" y1="50" x2="35" y2="50" stroke="#24160e" stroke-width="1.2"/>
            <rect x="76" y="45" width="11" height="10" rx="1" fill="#ffc96b"/>
            <line x1="81.5" y1="45" x2="81.5" y2="55" stroke="#24160e" stroke-width="1.2"/>
            <line x1="76" y1="50" x2="87" y2="50" stroke="#24160e" stroke-width="1.2"/>
            <rect x="51" y="48" width="10" height="18" rx="1" fill="#d4843a"/>
          </g>
        </g>
        ${buildMistBands(uid, '#f0d5b4', 0.44, 194)}
        <!-- Foreground hillside & natural curved birch silhouettes framing both edges -->
        <path d="M0 206 Q160 192 310 202 T480 196 L480 240 L0 240 Z" fill="#0d0b0c"/>
        <!-- Left foreground birch tree (tapered trunk + dark leafy boughs) -->
        <g>
          <path d="M18 240 Q24 140 16 14 L29 14 Q36 140 34 240 Z" fill="#cbc2b4" opacity="0.9"/>
          <path d="M19 64 L27 62 M21 102 L30 104 M20 144 L29 142 M22 184 L31 186" stroke="#1e1a18" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M26 78 Q62 56 96 42 M25 112 Q58 98 86 92" stroke="#181414" stroke-width="2.2" fill="none"/>
          <path d="M0 0 L132 0 Q106 38 76 52 Q52 62 28 70 Q12 76 0 88 Z" fill="#121011" opacity="0.88"/>
          <ellipse cx="64" cy="48" rx="46" ry="18" fill="#171415" opacity="0.82"/>
          <ellipse cx="94" cy="34" rx="34" ry="14" fill="#1c1818" opacity="0.74"/>
        </g>
        <!-- Right foreground birch tree -->
        <g>
          <path d="M446 240 Q442 136 452 10 L466 10 Q458 136 464 240 Z" fill="#bfb6a8" opacity="0.88"/>
          <path d="M449 58 L459 60 M447 104 L457 102 M448 152 L458 154 M449 194 L459 192" stroke="#1e1a18" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M450 74 Q414 54 382 44 M448 108 Q416 96 392 94" stroke="#181414" stroke-width="2.2" fill="none"/>
          <path d="M480 0 L348 0 Q374 36 404 52 Q434 66 480 86 Z" fill="#121011" opacity="0.88"/>
          <ellipse cx="414" cy="48" rx="44" ry="18" fill="#171415" opacity="0.82"/>
        </g>
      `;

    case 'training_yard':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#141c27"/>
            <stop offset="46%" stop-color="#343844"/>
            <stop offset="78%" stop-color="#8b694a"/>
            <stop offset="100%" stop-color="#2c2119"/>
          </linearGradient>
          <linearGradient id="${uid}-ray" x1="0.2" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stop-color="#ffe4ad" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="#ffe4ad" stop-opacity="0"/>
          </linearGradient>
          <radialGradient id="${uid}-gate-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffbe5e" stop-opacity="0.62"/>
            <stop offset="100%" stop-color="#ff8c24" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <!-- Diagonal morning sunbeams -->
        <polygon points="88,0 198,0 296,240 120,240" fill="url(#${uid}-ray)"/>
        <polygon points="236,0 318,0 412,240 288,240" fill="url(#${uid}-ray)" opacity="0.65"/>
        ${buildSpruceSkyline(156, '#1f232c', 4.3, 28, 0.8)}
        <!-- Timber palisade wall across the background -->
        <g fill="#161314">
          <path d="M0 176 L0 132 L6 122 L12 132 L18 120 L24 132 L30 124 L36 132 L42 120 L48 132 L54 123 L60 132 L66 121 L72 132 L78 124 L84 132 L90 120 L96 132 L102 123 L108 132 L114 121 L120 132 L126 124 L132 132 L138 120 L144 132 L150 122 L156 132 L162 124 L168 132 L168 176 Z"/>
          <path d="M312 176 L312 132 L318 122 L324 132 L330 120 L336 132 L342 124 L348 132 L354 121 L360 132 L366 123 L372 132 L378 120 L384 132 L390 124 L396 132 L402 121 L408 132 L414 123 L420 132 L426 120 L432 132 L438 124 L444 132 L450 122 L456 132 L462 120 L468 132 L474 123 L480 132 L480 176 Z"/>
          <rect x="0" y="146" width="168" height="4" fill="#231c1a"/>
          <rect x="312" y="146" width="168" height="4" fill="#231c1a"/>
        </g>
        <!-- Central wooden gatehouse with overhanging roof & glowing lantern -->
        <g transform="translate(166, 78)">
          <polygon points="0,34 74,4 148,34 138,40 74,14 10,40" fill="#100d0e"/>
          <rect x="14" y="34" width="120" height="18" fill="#171314"/>
          <rect x="18" y="52" width="22" height="54" fill="#131011"/>
          <rect x="108" y="52" width="22" height="54" fill="#131011"/>
          <path d="M40 106 L40 58 Q74 44 108 58 L108 106 Z" fill="#2b2320" opacity="0.55"/>
          <ellipse cx="74" cy="72" rx="26" ry="20" fill="url(#${uid}-gate-glow)" class="ostrze-vista-glow"/>
          <rect class="ostrze-vista-glow" x="71" y="64" width="6" height="9" rx="1" fill="#ffd27a"/>
        </g>
        <!-- Grounded yard floor -->
        <path d="M0 176 Q240 166 480 176 L480 240 L0 240 Z" fill="#1b1512"/>
        <!-- Left banner pole with crimson Slavic school pennant -->
        <g transform="translate(74, 102)">
          <rect x="10" y="0" width="4" height="96" fill="#241b16"/>
          <polygon points="8,4 12,-4 16,4" fill="#c79b52"/>
          <path class="ostrze-vista-flame" d="M14 12 L52 18 L44 34 L54 48 L14 52 Z" fill="#7d221c"/>
          <path d="M22 24 L38 40 M38 24 L22 40" stroke="#e3b868" stroke-width="2" stroke-linecap="round"/>
        </g>
        <!-- Right sparring dummy + weapon rack grounded in dirt -->
        <g transform="translate(342, 118)">
          <ellipse cx="26" cy="84" rx="28" ry="6" fill="#090707" opacity="0.65"/>
          <rect x="22" y="14" width="8" height="70" fill="#241a14"/>
          <rect x="2" y="30" width="48" height="7" rx="2" fill="#2b1f18"/>
          <circle cx="26" cy="14" r="9" fill="#2d211a"/>
          <circle cx="52" cy="36" r="13" fill="#2e2118" stroke="#85653d" stroke-width="2"/>
          <circle cx="52" cy="36" r="3.5" fill="#9c7b4c"/>
        </g>
        ${buildMistBands(uid, '#e2c59a', 0.46, 198)}
      `;

    case 'courtyard_lantern':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0b1019"/>
            <stop offset="56%" stop-color="#221e28"/>
            <stop offset="100%" stop-color="#4f311f"/>
          </linearGradient>
          <radialGradient id="${uid}-lantern" cx="50%" cy="46%" r="48%">
            <stop offset="0%" stop-color="#ffe49e" stop-opacity="0.82"/>
            <stop offset="34%" stop-color="#e58c38" stop-opacity="0.34"/>
            <stop offset="100%" stop-color="#1b1414" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        ${buildStarsLayer(uid, 10, '#f2dfb8')}
        <path d="M0 184 L0 102 L82 68 L156 112 L156 184 Z" fill="#131015"/>
        <path d="M318 184 L318 114 L398 76 L480 108 L480 184 Z" fill="#131015"/>
        <rect x="34" y="122" width="16" height="18" fill="#ffb85c" opacity="0.72" class="ostrze-vista-glow"/>
        <rect x="412" y="124" width="16" height="18" fill="#ffb85c" opacity="0.68" class="ostrze-vista-glow"/>
        <rect x="0" y="180" width="480" height="60" fill="#120d0c"/>
        <rect width="480" height="240" fill="url(#${uid}-lantern)" class="ostrze-vista-glow"/>
        <!-- Hanging wrought-iron tavern lantern -->
        <g stroke="#291f1a" stroke-width="3" fill="none">
          <line x1="240" y1="0" x2="240" y2="80"/>
          <path d="M224 90 L256 90 L251 124 L229 124 Z" fill="#ffd278" stroke="#362619" stroke-width="2.6"/>
          <path d="M220 90 L240 76 L260 90 Z" fill="#231a15"/>
          <line x1="240" y1="90" x2="240" y2="124" stroke="#362619" stroke-width="1.8"/>
        </g>
        ${buildEmbersLayer('#ffca72', 240, 186)}
        ${buildMistBands(uid, '#c89262', 0.28, 198)}
      `;

    case 'campfire_night':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#05080f"/>
            <stop offset="58%" stop-color="#101824"/>
            <stop offset="100%" stop-color="#2c1911"/>
          </linearGradient>
          <radialGradient id="${uid}-fire" cx="50%" cy="76%" r="52%">
            <stop offset="0%" stop-color="#ffe79e" stop-opacity="0.88"/>
            <stop offset="30%" stop-color="#e87928" stop-opacity="0.44"/>
            <stop offset="68%" stop-color="#6e2412" stop-opacity="0.16"/>
            <stop offset="100%" stop-color="#0a0c10" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        ${buildStarsLayer(uid, 16, '#f1e4c6')}
        ${buildSpruceSkyline(164, '#0c1118', 2.8, 26, 0.95)}
        ${buildSpruceSkyline(184, '#080b10', 5.1, 20, 1.05)}
        <!-- Pitched scout tent silhouette -->
        <polygon points="74,196 118,144 166,196" fill="#18120f"/>
        <polygon points="118,144 138,196 118,196" fill="#0d0908"/>
        <path d="M0 194 Q240 182 480 194 L480 240 L0 240 Z" fill="#120c0a"/>
        <rect width="480" height="240" fill="url(#${uid}-fire)" class="ostrze-vista-glow"/>
        <!-- Grounded stone ring & animated layered campfire flames -->
        <g transform="translate(212, 160)">
          <ellipse cx="28" cy="38" rx="34" ry="8" fill="#0a0605" opacity="0.72"/>
          <line x1="4" y1="38" x2="52" y2="28" stroke="#3a2318" stroke-width="6" stroke-linecap="round"/>
          <line x1="6" y1="28" x2="50" y2="38" stroke="#2d1a12" stroke-width="6" stroke-linecap="round"/>
          <path class="ostrze-vista-flame" d="M28 0 C41 14 45 27 28 36 C11 27 15 14 28 0 Z" fill="#eb7322"/>
          <path class="ostrze-vista-flame" d="M28 10 C35 19 37 28 28 34 C19 28 21 19 28 10 Z" fill="#ffe285"/>
        </g>
        ${buildEmbersLayer('#ffbe5e', 240, 184)}
      `;

    case 'haunted_night':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#050b12"/>
            <stop offset="55%" stop-color="#0d1f2b"/>
            <stop offset="100%" stop-color="#172c32"/>
          </linearGradient>
          <radialGradient id="${uid}-moon" cx="50%" cy="30%" r="44%">
            <stop offset="0%" stop-color="#e3f3f4" stop-opacity="0.58"/>
            <stop offset="45%" stop-color="#609ba6" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#071118" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <rect width="480" height="240" fill="url(#${uid}-moon)"/>
        ${buildStarsLayer(uid, 12, '#cde8ec')}
        <circle cx="240" cy="68" r="24" fill="#dceef0" opacity="0.88"/>
        ${buildPainterlyCloudBank(96, '#132833', 0.55)}
        ${buildSpruceSkyline(174, '#09141a', 1.8, 24, 0.85)}
        <!-- Crooked dead oaks & leaning graveyard crosses -->
        <g stroke="#060c10" stroke-linecap="round" fill="none">
          <path d="M58 240 Q62 170 68 124 L36 86 M68 140 L102 106 M52 104 L26 96" stroke-width="5.5"/>
          <path d="M422 240 Q416 172 408 120 L442 84 M408 142 L374 108 M426 100 L452 94" stroke-width="5.5"/>
          <path d="M188 198 L192 162 M180 172 L202 174" stroke-width="3.5"/>
          <path d="M292 200 L288 166 M279 176 L299 174" stroke-width="3.2"/>
        </g>
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
        ${buildMistBands(uid, '#78bfc2', 0.5, 198)}
      `;

    case 'misty_mill':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#111a1f"/>
            <stop offset="56%" stop-color="#27363a"/>
            <stop offset="100%" stop-color="#445550"/>
          </linearGradient>
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        ${buildPainterlyCloudBank(94, '#2f4043', 0.48)}
        <path d="M0 162 Q150 144 290 156 T480 148 L480 240 L0 240 Z" fill="#1a2626"/>
        <!-- Old timber watermill with paddle wheel & glowing window -->
        <g transform="translate(264, 96)">
          <polygon points="4,40 52,6 100,40" fill="#101718"/>
          <rect x="14" y="40" width="76" height="58" fill="#141c1d"/>
          <circle cx="14" cy="76" r="24" fill="none" stroke="#263130" stroke-width="5"/>
          <line x1="14" y1="52" x2="14" y2="100" stroke="#263130" stroke-width="3"/>
          <line x1="-10" y1="76" x2="38" y2="76" stroke="#263130" stroke-width="3"/>
          <rect class="ostrze-vista-glow" x="52" y="54" width="13" height="15" rx="1" fill="#f3b25a"/>
        </g>
        <!-- Marsh reeds & reflective water -->
        <rect x="0" y="194" width="480" height="46" fill="#101a1b"/>
        <ellipse cx="322" cy="212" rx="34" ry="5" fill="#f3b25a" opacity="0.18" class="ostrze-vista-glow"/>
        ${buildMistBands(uid, '#b9cdc6', 0.56, 194)}
      `;

    case 'astral_crater':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#060612"/>
            <stop offset="52%" stop-color="#1a1432"/>
            <stop offset="100%" stop-color="#2c1d2e"/>
          </linearGradient>
          <radialGradient id="${uid}-core" cx="50%" cy="68%" r="48%">
            <stop offset="0%" stop-color="#9beeff" stop-opacity="0.72"/>
            <stop offset="34%" stop-color="#a864ff" stop-opacity="0.34"/>
            <stop offset="72%" stop-color="#4e235c" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="#0c0916" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        ${buildStarsLayer(uid, 18, '#dfd2ff')}
        <polygon points="222,0 258,0 248,180 232,180" fill="#8ce8ff" opacity="0.12" class="ostrze-vista-glow"/>
        <rect width="480" height="240" fill="url(#${uid}-core)" class="ostrze-vista-glow"/>
        <path d="M0 170 L94 134 L176 184 L304 184 L384 130 L480 166 L480 240 L0 240 Z" fill="#100c18"/>
        <!-- Fractured astral crystal shard -->
        <polygon class="ostrze-vista-glow" points="240,108 258,154 240,192 222,154" fill="#89e5ff" opacity="0.9"/>
        <polygon points="240,120 250,154 240,182 230,154" fill="#ffffff" opacity="0.82"/>
        ${buildEmbersLayer('#9fe8ff', 240, 178)}
        ${buildMistBands(uid, '#997ec8', 0.36, 198)}
      `;

    case 'river_ford_map':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#131822"/>
            <stop offset="54%" stop-color="#34302e"/>
            <stop offset="100%" stop-color="#6e533a"/>
          </linearGradient>
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <path d="M0 148 Q120 124 240 144 T480 138 L480 240 L0 240 Z" fill="#23201f"/>
        ${buildSpruceSkyline(164, '#171618', 2.4, 26, 0.85)}
        <!-- Timber watchtower on far bank -->
        <g transform="translate(332, 108)" fill="#121112">
          <rect x="14" y="20" width="24" height="52"/>
          <polygon points="6,20 26,2 46,20"/>
          <rect class="ostrze-vista-glow" x="23" y="28" width="6" height="9" fill="#ffc46b"/>
        </g>
        <path d="M0 240 Q150 202 238 192 Q298 184 320 172 L354 172 Q330 198 252 214 Q170 230 110 240 Z" fill="#4f6b7a" opacity="0.62"/>
        <g transform="translate(46, 48)" opacity="0.28" stroke="#e5b869" stroke-width="1.2" fill="none">
          <circle cx="0" cy="0" r="18"/>
          <line x1="0" y1="-24" x2="0" y2="24"/>
          <line x1="-24" y1="0" x2="24" y2="0"/>
        </g>
        ${buildMistBands(uid, '#d4bd98', 0.4, 198)}
      `;

    case 'dawn_horizon':
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#191d2b"/>
            <stop offset="42%" stop-color="#5a393a"/>
            <stop offset="76%" stop-color="#c97b42"/>
            <stop offset="100%" stop-color="#f2c478"/>
          </linearGradient>
          <radialGradient id="${uid}-sun" cx="50%" cy="80%" r="54%">
            <stop offset="0%" stop-color="#fff0c4" stop-opacity="0.88"/>
            <stop offset="48%" stop-color="#e39249" stop-opacity="0.34"/>
            <stop offset="100%" stop-color="#2a1f24" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <rect width="480" height="240" fill="url(#${uid}-sun)" class="ostrze-vista-glow"/>
        <path d="M0 166 Q140 136 250 154 T480 148 L480 240 L0 240 Z" fill="#2c1f1e"/>
        ${buildSpruceSkyline(186, '#161112', 0.8, 26, 0.9)}
        ${buildEmbersLayer('#ffe09e', 240, 194)}
        ${buildMistBands(uid, '#f3ce94', 0.36, 198)}
      `;

    case 'forest_trail':
    default:
      return `
        <defs>
          <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0d151d"/>
            <stop offset="54%" stop-color="#23323b"/>
            <stop offset="100%" stop-color="#585346"/>
          </linearGradient>
          <radialGradient id="${uid}-horizon" cx="52%" cy="68%" r="44%">
            <stop offset="0%" stop-color="#dfb87c" stop-opacity="0.42"/>
            <stop offset="60%" stop-color="#6e6552" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="#11181e" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="480" height="240" fill="url(#${uid}-sky)"/>
        <rect width="480" height="240" fill="url(#${uid}-horizon)"/>
        ${buildSpruceSkyline(154, '#172126', 1.4, 28, 0.9)}
        ${buildSpruceSkyline(176, '#0e1518', 3.7, 22, 1.05)}
        <!-- Winding forest track -->
        <path d="M168 240 Q220 198 242 174 L254 174 Q268 202 332 240 Z" fill="#3a3026" opacity="0.82"/>
        <!-- Wayside Slavic shrine with glowing votive candle -->
        <g transform="translate(132, 130)" fill="#101314">
          <rect x="8" y="16" width="6" height="62"/>
          <polygon points="-2,18 11,4 24,18"/>
          <rect class="ostrze-vista-glow" x="9" y="20" width="4" height="7" rx="0.8" fill="#ffca6d"/>
        </g>
        ${buildMistBands(uid, '#a8bbb6', 0.44, 198)}
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
