"""Przybornik rysowania obrazków `.pix`: kształty, cieniowanie w tonach, obrys, faktury, rozbłyski, zapis i podgląd.

Kolory to numery xterm-256 (0-255); `None` to przezroczystość. Szczegóły i przykład: README.md.
"""
import math
import random
import struct
import zlib

import palette

LIMITS = {"scene": (96, 48), "portrait": (48, 48), "enemy": (64, 48)}  # jak ART_LIMITS w src/engine/pix.js
LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
_BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
_N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def _hash01(x, y):
    """Deterministyczna 'losowa' liczba 0-1 dla piksela (mieszanie bitow, bez widocznego rastra ani smug)."""
    h = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h ^= h >> 16
    return h / 4294967296


class ArtError(Exception):
    pass


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.grid = [[None] * w for _ in range(h)]

    @classmethod
    def load(cls, path):
        """Wczytuje plik `.pix` do plotna (do edycji i arkuszy kontaktowych)."""
        pal, rows = {}, []
        with open(path, encoding="utf8") as f:
            lines = f.read().splitlines()
        for n, line in enumerate(lines, 1):
            line = line.rstrip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("paleta:"):
                for pair in line[7:].split():
                    pal[pair[0]] = int(pair[2:])
            else:
                rows.append((n, line))
        if not rows:
            raise ValueError(f"{path}: pusta siatka")
        w = len(rows[0][1])
        for n, row in rows:
            if len(row) != w:
                raise ValueError(f"{path}, wiersz {n}: wiersz ma {len(row)} znaki, oczekiwano {w}")
            for ch in row:
                if ch != "." and ch not in pal:
                    raise ValueError(f"{path}, wiersz {n}: nieznana litera „{ch}”")
        rows = [row for _, row in rows]
        c = cls(len(rows[0]), len(rows))
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                c.grid[y][x] = None if ch == "." else pal[ch]
        return c

    # --- podstawy ---
    def get(self, x, y):
        return self.grid[y][x] if 0 <= x < self.w and 0 <= y < self.h else None

    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.grid[y][x] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)

    def line(self, x0, y0, x1, y1, c, width=1):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.rect(x0, y0, x0 + width - 1, y0 + width - 1, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def fill(self, x, y, c):
        """Zalewanie (4-sasiedztwo) obszaru o kolorze startowym."""
        target = self.get(x, y)
        if target == c:
            return
        stack = [(x, y)]
        while stack:
            px_, py_ = stack.pop()
            if 0 <= px_ < self.w and 0 <= py_ < self.h and self.grid[py_][px_] == target:
                self.grid[py_][px_] = c
                stack += [(px_ + 1, py_), (px_ - 1, py_), (px_, py_ + 1), (px_, py_ - 1)]

    # --- maski (zbiory pikseli) ---
    @staticmethod
    def mask_rect(x0, y0, x1, y1):
        return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}

    @staticmethod
    def mask_ellipse(cx, cy, rx, ry):
        return {(x, y) for y in range(int(cy - ry) - 1, int(cy + ry) + 2) for x in range(int(cx - rx) - 1, int(cx + rx) + 2)
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1}

    @staticmethod
    def mask_poly(points):
        ys = [p[1] for p in points]
        out = set()
        n = len(points)
        for y in range(min(ys), max(ys) + 1):
            xs = []
            for i in range(n):
                (xa, ya), (xb, yb) = points[i], points[(i + 1) % n]
                if ya == yb:
                    continue
                if min(ya, yb) <= y + 0.5 < max(ya, yb):
                    xs.append(xa + (y + 0.5 - ya) * (xb - xa) / (yb - ya))
            xs.sort()
            for a, b in zip(xs[0::2], xs[1::2]):
                for x in range(math.ceil(a - 0.5), math.floor(b - 0.5) + 1):
                    out.add((x, y))
        return out

    def paint(self, mask, c):
        for x, y in mask:
            self.px(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c):
        self.paint(self.mask_ellipse(cx, cy, rx, ry), c)

    def poly(self, points, c):
        self.paint(self.mask_poly(points), c)

    # --- cieniowanie ---
    def shade(self, mask, ramp, light=(-1, -1), bevel=None):
        """Maluje `mask` tonami `ramp` jak bryle oswietlona z kierunku `light` (np. (-1, -1) = z lewej gory).

        `bevel` - szerokosc zaokraglenia od krawedzi w pikselach (domyslnie polowa najmniejszego wymiaru: kopula)."""
        if not mask:
            return
        dist = {}
        queue = [p for p in mask if any((p[0] + dx, p[1] + dy) not in mask for dx, dy in _N4)]
        for p in queue:
            dist[p] = 1
        for p in queue:
            for dx, dy in _N4:
                q = (p[0] + dx, p[1] + dy)
                if q in mask and q not in dist:
                    dist[q] = dist[p] + 1
                    queue.append(q)
        xs, ys = [p[0] for p in mask], [p[1] for p in mask]
        b = bevel if bevel else max(2, min(max(xs) - min(xs) + 1, max(ys) - min(ys) + 1) / 2)

        def height(p):
            return min(dist.get(p, 0), b) / b

        lx, ly = light
        norm = math.hypot(lx, ly) or 1
        lvec = (lx / norm * 0.7, ly / norm * 0.7, 0.7)
        for x, y in mask:
            nx = (height((x - 1, y)) - height((x + 1, y))) * b / 1.2
            ny = (height((x, y - 1)) - height((x, y + 1))) * b / 1.2
            length = math.sqrt(nx * nx + ny * ny + 1.0)
            dot = (nx * lvec[0] + ny * lvec[1] + lvec[2]) / length  # 0.7 przy plaskiej powierzchni
            t = max(0.0, min(0.999, 0.5 + (dot - 0.7) * 1.7))  # plaska powierzchnia = ton srodkowy
            self.px(x, y, ramp[min(len(ramp) - 1, int(t * len(ramp)))])

    def shaded_ellipse(self, cx, cy, rx, ry, ramp, light=(-1, -1)):
        self.shade(self.mask_ellipse(cx, cy, rx, ry), ramp, light)

    def shaded_rect(self, x0, y0, x1, y1, ramp, light=(-1, -1), bevel=3):
        self.shade(self.mask_rect(x0, y0, x1, y1), ramp, light, bevel)

    def shaded_poly(self, points, ramp, light=(-1, -1), bevel=3):
        self.shade(self.mask_poly(points), ramp, light, bevel)

    def cel(self, mask, ramp, light=(-1, -1), depth=2, line=None, mid=None):
        """Cieniowanie „komiksowe” jak w pixel-arcie: plaski ton srodkowy, jasna krawedz od strony swiatla,
        cien od strony przeciwnej, opcjonalny ciemny obrys (`line`) czesci. `depth` - grubosc pasa swiatla/cienia."""
        if not mask:
            return
        mid = len(ramp) // 2 if mid is None else mid
        lx, ly = light
        for (x, y) in mask:
            self.px(x, y, ramp[mid])
        for (x, y) in mask:
            # kierunek na zewnatrz: suma wektorow do pikseli spoza maski w promieniu `depth`
            ox = oy = 0
            nearest_out = None
            for r in range(1, depth + 1):
                for dx in range(-r, r + 1):
                    for dy in range(-r, r + 1):
                        if max(abs(dx), abs(dy)) != r:
                            continue
                        if (x + dx, y + dy) not in mask:
                            ox += dx
                            oy += dy
                            if nearest_out is None:
                                nearest_out = r
                if nearest_out is not None:
                    break
            if nearest_out is None:
                continue
            facing = ox * lx + oy * ly  # > 0: krawedz zwrocona do swiatla
            if line is not None and nearest_out == 1 and any((x + dx, y + dy) not in mask for dx, dy in _N4):
                self.px(x, y, line)
            elif facing > 0:
                self.px(x, y, ramp[min(len(ramp) - 1, mid + (2 if nearest_out == 1 and depth > 1 else 1))])
            elif facing < 0:
                self.px(x, y, ramp[max(0, mid - (2 if nearest_out == 1 and depth > 1 else 1))])

    def cel_ellipse(self, cx, cy, rx, ry, ramp, **kw):
        self.cel(self.mask_ellipse(cx, cy, rx, ry), ramp, **kw)

    def cel_rect(self, x0, y0, x1, y1, ramp, **kw):
        self.cel(self.mask_rect(x0, y0, x1, y1), ramp, **kw)

    def cel_poly(self, points, ramp, **kw):
        self.cel(self.mask_poly(points), ramp, **kw)

    # --- efekty ---
    def outline(self, c=palette.OUTLINE):
        """Obrys 1 px (4-sasiedztwo) wokol wszystkich nieprzezroczystych pikseli."""
        add = [(x, y) for y in range(self.h) for x in range(self.w)
               if self.grid[y][x] is None and any(self.get(x + dx, y + dy) is not None for dx, dy in _N4)]
        for x, y in add:
            self.grid[y][x] = c

    def dither(self, x0, y0, x1, y1, c1, c2, density):
        """Mieszanie dwoch kolorow wzorem Bayera; `density` 0-1 to udzial `c2`."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c2 if _BAYER[y % 4][x % 4] / 16 < density else c1)

    def glow(self, x0, y0, x1, y1, c, density=0.25, skip=(palette.OUTLINE,)):
        """Naklada kolor `c` wzorem Bayera na ISTNIEJACE piksele (poswiata, swiatlo, mgla); nie rusza przezroczystych ani `skip`."""
        # Przy niskim zageszczeniu wzor Bayera daje regularna siatke co 4 px (widoczna jako biala kratka) - tam rozsypujemy
        # punkty deterministycznie po haszu wspolrzednych: obraz jest powtarzalny, ale bez rastra.
        scatter = density <= 0.2
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                cur = self.get(x, y)
                if cur is None or cur in skip:
                    continue
                level = _hash01(x, y) if scatter else _BAYER[y % 4][x % 4] / 16
                if level < density:
                    self.px(x, y, c)

    def gradient_v(self, x0, y0, x1, y1, ramp):
        """Pionowy gradient `ramp` (od gory) z ditheringiem na styku pasow."""
        h = y1 - y0 + 1
        for y in range(y0, y1 + 1):
            pos = (y - y0) / max(1, h - 1) * (len(ramp) - 1)
            i = int(pos)
            frac = pos - i
            nxt = ramp[min(len(ramp) - 1, i + 1)]
            for x in range(x0, x1 + 1):
                self.px(x, y, nxt if _BAYER[y % 4][x % 4] / 16 < frac else ramp[i])

    def noise(self, x0, y0, x1, y1, ramp, seed=0, only_opaque=True, spread=1, density=0.3):
        """Faktura: w ulamku `density` pikseli deterministycznie przesuwa ton o -`spread`..`spread` w obrebie `ramp`."""
        rnd = random.Random(seed)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if rnd.random() > density:
                    continue
                cur = self.get(x, y)
                if only_opaque and cur is None:
                    continue
                if cur in ramp:
                    i = ramp.index(cur) + rnd.randint(-spread, spread)
                    self.px(x, y, ramp[max(0, min(len(ramp) - 1, i))])
                elif not only_opaque:
                    self.px(x, y, ramp[rnd.randrange(len(ramp))])

    def glint(self, x, y, c, size=2):
        """Rozblysk: krzyzyk o ramionach `size`."""
        self.px(x, y, c)
        for i in range(1, size + 1):
            for dx, dy in ((i, 0), (-i, 0), (0, i), (0, -i)):
                self.px(x + dx, y + dy, c)

    def paste(self, other, x, y, flip=False):
        for oy in range(other.h):
            for ox in range(other.w):
                c = other.grid[oy][other.w - 1 - ox if flip else ox]
                if c is not None:
                    self.px(x + ox, y + oy, c)

    def mirror_left_to_right(self):
        """Symetria: lewa polowa odbita na prawa (portrety, tarcze, helmy)."""
        for y in range(self.h):
            for x in range(self.w // 2):
                self.grid[y][self.w - 1 - x] = self.grid[y][x]

    # --- zapis i podglad ---
    def check(self, kind=None):
        if self.h % 2:
            raise ArtError(f"nieparzysta liczba wierszy ({self.h})")
        if kind:
            mw, mh = LIMITS[kind]
            if self.w > mw or self.h > mh:
                raise ArtError(f"{self.w}x{self.h} przekracza limit {mw}x{mh} ({kind})")

    def colours(self):
        seen = []
        for row in self.grid:
            for c in row:
                if c is not None and c not in seen:
                    seen.append(c)
        return seen

    def save(self, path, comment="", kind=None):
        self.check(kind)
        used = self.colours()
        if len(used) > len(LETTERS):
            raise ArtError(f"{len(used)} kolorow, a paleta miesci {len(LETTERS)}")
        letter = {c: LETTERS[i] for i, c in enumerate(used)}
        rows = ["".join("." if c is None else letter[c] for c in row) for row in self.grid]
        head = f"# {comment}\n" if comment else ""
        pal = " ".join(f"{letter[c]}={c}" for c in used)
        with open(path, "w", encoding="utf8", newline="\n") as f:
            f.write(f"{head}paleta: {pal}\n" + "\n".join(rows) + "\n")

    def preview(self):
        """Tekst z kodami ANSI (polbloki w 256 kolorach), wiersz na dwa wiersze pikseli."""
        lines = []
        for y in range(0, self.h, 2):
            out = ""
            for x in range(self.w):
                top, bottom = self.get(x, y), self.get(x, y + 1)
                if top is None and bottom is None:
                    out += " "
                elif top is None:
                    out += f"\x1b[38;5;{bottom}m▄\x1b[0m"
                elif bottom is None:
                    out += f"\x1b[38;5;{top}m▀\x1b[0m"
                else:
                    out += f"\x1b[38;5;{top};48;5;{bottom}m▀\x1b[0m"
            lines.append(out)
        return "\n".join(lines)

    def png(self, path, scale=8, background=(18, 18, 22)):
        """Zapisuje powiekszony podglad PNG (do ogladania obrazka poza terminalem)."""
        W, H = self.w * scale, self.h * scale
        raw = bytearray()
        for y in range(H):
            raw.append(0)
            row = self.grid[y // scale]
            for x in range(W):
                c = row[x // scale]
                raw.extend(background if c is None else palette.rgb(c))

        def chunk(tag, data):
            body = tag + data
            return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

        with open(path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n"
                    + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
                    + chunk(b"IDAT", zlib.compress(bytes(raw), 6)) + chunk(b"IEND", b""))
