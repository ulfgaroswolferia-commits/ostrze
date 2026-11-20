/// <reference types="vite/client" />

/**
 * Parser and crisp SVG data-URI renderer for origin/data/art/*.pix pixel art.
 * Keeps origin/data/ untouched while providing sharp 48x48 portraits and 96x48 scene banners
 * in both browser and Node/Vitest environments.
 */

export interface PixImage {
  width: number;
  height: number;
  palette: Record<string, number>;
  rows: string[];
}

export interface PixArtMeta {
  id: string;
  width: number;
  height: number;
  dataUri: string;
}

const ANSI_16_HEX: readonly string[] = [
  '#0c0d10', // 0 black
  '#8b2626', // 1 red
  '#2d7a3e', // 2 green
  '#9e7a28', // 3 yellow/brown
  '#2c5282', // 4 blue
  '#7b3c7d', // 5 magenta
  '#2c7a7b', // 6 cyan
  '#c8c4b8', // 7 white/light gray
  '#555966', // 8 bright black (dark gray)
  '#d64545', // 9 bright red
  '#4eb862', // 10 bright green
  '#e5b869', // 11 bright yellow
  '#5a93d4', // 12 bright blue
  '#b86bc2', // 13 bright magenta
  '#52b8ba', // 14 bright cyan
  '#f0ece1'  // 15 bright white
];

const CUBE_LEVELS = [0, 95, 135, 175, 215, 255] as const;

function toHexByte(n: number): string {
  return n.toString(16).padStart(2, '0');
}

/**
 * Converts an xterm-256 color index (0..255) into a #rrggbb hex color.
 */
export function xterm256ToHex(code: number): string {
  const idx = Math.max(0, Math.min(255, Math.floor(code)));
  if (idx < 16) {
    return ANSI_16_HEX[idx];
  }
  if (idx <= 231) {
    const c = idx - 16;
    const r = CUBE_LEVELS[Math.floor(c / 36)];
    const g = CUBE_LEVELS[Math.floor((c % 36) / 6)];
    const b = CUBE_LEVELS[c % 6];
    return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  }
  const gray = 8 + (idx - 232) * 10;
  const h = toHexByte(gray);
  return `#${h}${h}${h}`;
}

const PALETTE_LINE_RE = /^paleta:\s*(.*)$/;

/**
 * Parses a `.pix` text file into a grid + xterm-256 palette.
 * Returns null if the input is malformed.
 */
export function parsePix(raw: string): PixImage | null {
  const lines = raw.replace(/\r/g, '').split('\n');
  let palette: Record<string, number> | null = null;
  const rows: string[] = [];

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const match = PALETTE_LINE_RE.exec(line);
    if (match) {
      if (palette) return null;
      palette = {};
      for (const pair of match[1].split(/\s+/).filter(Boolean)) {
        const kv = /^([a-zA-Z0-9])=(\d+)$/.exec(pair);
        if (!kv) return null;
        const colorCode = Number(kv[2]);
        if (colorCode < 0 || colorCode > 255) return null;
        palette[kv[1]] = colorCode;
      }
      continue;
    }
    rows.push(line);
  }

  if (!palette || rows.length === 0) return null;
  const width = [...rows[0]].length;
  if (width === 0) return null;

  for (const row of rows) {
    if ([...row].length !== width) return null;
  }

  return {
    width,
    height: rows.length,
    palette,
    rows
  };
}

/**
 * Renders a parsed PixImage into a crisp, run-length-encoded SVG data URI.
 */
export function renderPixToSvgDataUri(image: PixImage): string {
  const colorHex: Record<string, string> = {};
  for (const [key, code] of Object.entries(image.palette)) {
    colorHex[key] = xterm256ToHex(code);
  }

  const rects: string[] = [];
  for (let y = 0; y < image.height; y++) {
    const chars = [...image.rows[y]];
    let x = 0;
    while (x < chars.length) {
      const ch = chars[x];
      if (ch === '.' || !(ch in colorHex)) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < chars.length && chars[x + run] === ch) {
        run++;
      }
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${colorHex[ch]}"/>`);
      x += run;
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${image.width} ${image.height}" ` +
    `width="${image.width}" height="${image.height}" shape-rendering="crispEdges">` +
    rects.join('') +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Eagerly bundle all .pix raw files from origin/data/art/ via Vite glob.
const RAW_PIX_MODULES = import.meta.glob<string>('../../../origin/data/art/*.pix', {
  query: '?raw',
  import: 'default',
  eager: true
});

const RAW_PIX_BY_ID: Record<string, string> = {};
for (const [filePath, rawContent] of Object.entries(RAW_PIX_MODULES)) {
  const fileName = filePath.split(/[\\/]/).pop() ?? '';
  const id = fileName.replace(/\.pix$/i, '');
  if (id) {
    RAW_PIX_BY_ID[id] = rawContent;
  }
}

const META_CACHE = new Map<string, PixArtMeta | null>();

export function listAvailablePixArtIds(): string[] {
  return Object.keys(RAW_PIX_BY_ID).sort();
}

export function hasPixArt(artId: string | undefined): boolean {
  if (!artId) return false;
  return Object.hasOwn(RAW_PIX_BY_ID, artId);
}

export function getPixArtMeta(artId: string | undefined): PixArtMeta | null {
  if (!artId) return null;
  if (META_CACHE.has(artId)) {
    return META_CACHE.get(artId) ?? null;
  }
  const raw = RAW_PIX_BY_ID[artId];
  if (!raw) {
    META_CACHE.set(artId, null);
    return null;
  }
  const parsed = parsePix(raw);
  if (!parsed) {
    META_CACHE.set(artId, null);
    return null;
  }
  const meta: PixArtMeta = {
    id: artId,
    width: parsed.width,
    height: parsed.height,
    dataUri: renderPixToSvgDataUri(parsed)
  };
  META_CACHE.set(artId, meta);
  return meta;
}

export function getPixArtDataUri(artId: string | undefined): string | null {
  return getPixArtMeta(artId)?.dataUri ?? null;
}

const SPEAKER_TO_PIX_PORTRAIT: Array<{ pattern: RegExp; artId: string }> = [
  { pattern: /skarimir/i, artId: 'portret_skarimir' },
  { pattern: /ragnosław/i, artId: 'portret_ragnoslawa' },
  { pattern: /wojmir/i, artId: 'portret_wojmir' },
  { pattern: /gnieworad/i, artId: 'portret_gnieworad' },
  { pattern: /kurier|goniec/i, artId: 'portret_kurier' },
  { pattern: /dobrogost|kwatermistrz/i, artId: 'portret_kwatermistrz' },
  { pattern: /istot/i, artId: 'portret_istota' },
  { pattern: /wszebor|komendant/i, artId: 'portret_wszebor' },
  { pattern: /wrzosek|karczmarz/i, artId: 'portret_wrzosek' },
  { pattern: /szkarad|rusznikarz/i, artId: 'portret_szkarad' },
  { pattern: /ostromir|kupiec/i, artId: 'portret_ostromir' },
  { pattern: /zbych|kowal/i, artId: 'portret_kowal' },
  { pattern: /żona borka|borkowa/i, artId: 'portret_zona_borka' },
  { pattern: /córka/i, artId: 'portret_corka' },
  { pattern: /leśnicz/i, artId: 'portret_lesniczy' },
  { pattern: /zwiadowc/i, artId: 'portret_zwiadowcy' },
  { pattern: /wędrowiec/i, artId: 'portret_wedrowiec' },
  { pattern: /pielgrzym/i, artId: 'portret_pielgrzym' },
  { pattern: /instruktor|radogost/i, artId: 'instruktor' }
];

/**
 * Resolves the best `.pix` portrait ID for a dialogue node:
 * 1. Explicit `node.portrait` / `dialogue.portrait` if present in `origin/data/art/`.
 * 2. Speaker-name match against known Prologue & Act 1 portraits.
 * 3. Null (caller falls back to engine `getSlavicPortrait`).
 */
export function resolvePixPortraitId(
  explicitPortrait: string | undefined,
  speaker: string
): string | null {
  if (explicitPortrait && hasPixArt(explicitPortrait)) {
    return explicitPortrait;
  }
  for (const entry of SPEAKER_TO_PIX_PORTRAIT) {
    if (entry.pattern.test(speaker) && hasPixArt(entry.artId)) {
      return entry.artId;
    }
  }
  return null;
}

const SPEAKER_ROLES: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /skarimir/i, role: 'Adept Szkoły Ostrzy · Miecz' },
  { pattern: /ragnosław/i, role: 'Adeptka Szkoły Ostrzy · Włócznia' },
  { pattern: /wojmir/i, role: 'Adept Szkoły Ostrzy · Pisarczyk' },
  { pattern: /gnieworad/i, role: 'Mistrz Szkoły Ostrzy w Brzezinie' },
  { pattern: /radogost|instruktor/i, role: 'Instruktor Szkolny' },
  { pattern: /kurier/i, role: 'Posłaniec w Czerwonym Płaszczu' },
  { pattern: /dobrogost/i, role: 'Kwatermistrz Szkoły Ostrzy' },
  { pattern: /istot/i, role: 'Głos zza Spadających Gwiazd' },
  { pattern: /wszebor|komendant/i, role: 'Dowódca Strażnicy Wilczy Bród' },
  { pattern: /wrzosek|karczmarz/i, role: 'Karczma „Pod Wilczym Kłem”' },
  { pattern: /szkarad/i, role: 'Rusznikarz w Wilczym Brodzie' },
  { pattern: /ostromir/i, role: 'Kupiec na Trakcie' },
  { pattern: /zbych|kowal/i, role: 'Kuźnia w Wilczym Brodzie' },
  { pattern: /leśnicz/i, role: 'Leśniczówka na Rubieży' }
];

export function resolveSpeakerRole(speaker: string): string | null {
  for (const entry of SPEAKER_ROLES) {
    if (entry.pattern.test(speaker)) {
      return entry.role;
    }
  }
  return null;
}
