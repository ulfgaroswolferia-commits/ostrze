"""Biblioteka elementow scen 96x48: niebo, wzgorza, drzewa, chaty, skaly, ogien, dym, mgla, deszcz, sylwetki.

Wszystko rysuje na przekazanym `Canvas`; kolory z palette.RAMPS. Wspolne zasady stylu: ciemny obrys, swiatlo z lewej gory,
trzy plany (tlo, srodek, przod).
"""
import math
import random

from toolkit import Canvas
from palette import RAMPS, OUTLINE

W, H = 96, 48
M = Canvas.mask_poly
E = Canvas.mask_ellipse
R = Canvas.mask_rect

SKY = {
    "day": [67, 110, 111, 153, 195, 230],
    "dusk": [233, 17, 53, 90, 132, 173],
    "night": [16, 17, 18, 60, 61],
    "dawn": [60, 97, 139, 181, 223, 230],
    "storm": [233, 235, 237, 239, 60, 102],
    "grey": [239, 243, 247, 250, 253],
    "star": [16, 17, 18, 24, 31],
}


def sky(c, kind, y1=33):
    c.gradient_v(0, 0, W - 1, y1, SKY[kind])


def ground(c, y0, ramp, y1=H - 1):
    c.gradient_v(0, y0, W - 1, y1, ramp)


def hills(c, y0, y1, color, seed, amp=3):
    rnd = random.Random(seed)
    phase = rnd.random() * 6
    for x in range(W):
        top = y0 + int(amp * math.sin(x / 9.0 + phase) + amp * 0.6 * math.sin(x / 4.3 + phase * 2))
        for y in range(top, y1 + 1):
            c.px(x, y, color)


def conifer(c, cx, base, h, w, ramp, tiers=4, line=OUTLINE):
    trunk_h = max(2, h // 8)
    c.cel_rect(cx - 1, base - trunk_h, cx + 1, base, RAMPS["wood"], line=None, depth=1)
    for t in range(tiers):
        top = base - h + t * (h - trunk_h) // (tiers + 1)
        bottom = top + (h - trunk_h) // tiers + 3
        half = max(2, int(w / 2 * (0.45 + 0.55 * (t + 1) / tiers)))
        c.cel_poly([(cx, top), (cx + half, bottom), (cx - half, bottom)], ramp, line=line, depth=1)


def forest(c, base, seed, n, ramp, hmin=12, hmax=24, x0=0, x1=W):
    rnd = random.Random(seed)
    for _ in range(n):
        conifer(c, rnd.randint(x0, x1), base + rnd.randint(-2, 2), rnd.randint(hmin, hmax), rnd.randint(8, 13), ramp)


def birch(c, cx, base, h, leaf=None):
    leaf = leaf or RAMPS["leaf"]
    c.cel_rect(cx - 1, base - h, cx + 1, base, [237, 245, 249, 253, 255], light=(-1, 0), line=OUTLINE, depth=1)
    for y in range(base - h + 2, base, 4):
        c.rect(cx - 1, y, cx, y, 233)
    c.cel_ellipse(cx, base - h, h // 3 + 3, h // 3, leaf, line=OUTLINE, depth=1)
    c.cel_ellipse(cx - 3, base - h + 3, h // 4 + 1, h // 5 + 1, leaf, line=None, depth=1)


def dead_tree(c, cx, base, h, color=RAMPS["wood"]):
    c.cel_rect(cx - 1, base - h, cx + 1, base, color, line=OUTLINE, depth=1)
    for k, (dx, dy) in enumerate(((-6, 7), (6, 11), (-4, 14), (5, 17))):
        if base - h + dy < base:
            c.line(cx, base - h + dy, cx + dx, base - h + dy - 4, 233, 1)
            c.line(cx, base - h + dy - 1, cx + dx, base - h + dy - 5, color[2], 1)


def bush(c, cx, cy, rx, ry, ramp=None):
    c.cel_ellipse(cx, cy, rx, ry, ramp or RAMPS["leaf"], line=OUTLINE, depth=1)


def rock(c, cx, cy, rx, ry, ramp=None):
    c.cel_ellipse(cx, cy, rx, ry, ramp or RAMPS["stone"], line=OUTLINE, depth=1)
    c.line(cx - rx // 2, cy, cx, cy - ry // 2, (ramp or RAMPS["stone"])[1], 1)


def hut(c, x, base, w, h, wall=None, roof=None, lit=True, door=True):
    """Chata: sciana z desek, dach dwuspadowy, drzwi i okno."""
    wall = wall or RAMPS["wood"]
    roof = roof or [235, 237, 94, 130, 137]
    top = base - h
    c.cel_rect(x, top, x + w, base, wall, line=OUTLINE, depth=2)
    for y in range(top + 3, base, 3):
        for xx in range(x + 1, x + w):
            if (xx * 7 + y * 3) % 11 != 0:
                c.px(xx, y, wall[1])
    c.cel_poly([(x - 3, top + 1), (x + w // 2, top - h // 2 - 2), (x + w + 3, top + 1), (x + w, top + 3), (x, top + 3)], roof, line=OUTLINE, depth=2)
    if door:
        c.rect(x + w // 2 - 2, base - 7, x + w // 2 + 1, base, OUTLINE)
        c.rect(x + w // 2 - 1, base - 6, x + w // 2, base, 52)
    if lit:
        wx = x + 3
        c.rect(wx, top + 4, wx + 3, top + 7, OUTLINE)
        c.rect(wx + 1, top + 5, wx + 2, top + 6, 208)
        c.px(wx + 1, top + 5, 227)


def smoke(c, x, y, n=4, color=241):
    for i in range(n):
        c.ellipse(x + i // 2 + (i % 2), y - i * 3, 1 + i // 2, 1 + i // 3, color - i if color - i > 233 else color)


def fire(c, cx, base, s=1.0):
    fr = RAMPS["fire"]
    def sc(v):
        return int(round(v * s))
    c.poly([(cx - sc(9), base), (cx - sc(5), base - sc(12)), (cx - sc(2), base - sc(7)), (cx, base - sc(18)), (cx + sc(3), base - sc(9)), (cx + sc(6), base - sc(13)), (cx + sc(9), base)], fr[1])
    c.poly([(cx - sc(7), base), (cx - sc(3), base - sc(9)), (cx - sc(1), base - sc(5)), (cx, base - sc(13)), (cx + sc(3), base - sc(6)), (cx + sc(5), base - sc(9)), (cx + sc(7), base)], fr[2])
    c.poly([(cx - sc(5), base), (cx - sc(2), base - sc(6)), (cx, base - sc(9)), (cx + sc(2), base - sc(5)), (cx + sc(4), base)], fr[3])
    c.poly([(cx - sc(3), base), (cx, base - sc(5)), (cx + sc(3), base)], fr[4])
    c.poly([(cx - sc(1), base), (cx, base - sc(3)), (cx + sc(1), base)], fr[5])


def sparks(c, cx, top, n, seed):
    rnd = random.Random(seed)
    for _ in range(n):
        c.px(cx + rnd.randint(-8, 8), top - rnd.randint(2, 14), rnd.choice((220, 208, 229)))


def fog(c, y0, y1, color, density=0.25, seed=0):
    """Mgla jako nakladka Bayera na istniejace piksele, gestsza ku dolowi."""
    for y in range(y0, y1 + 1):
        d = density * (0.4 + 0.6 * (y - y0) / max(1, y1 - y0))
        c.glow(0, y, W - 1, y, color, d, skip=())


def rain(c, density=0.07, color=110, seed=0, length=4, slant=1):
    rnd = random.Random(seed)
    for _ in range(int(W * H * density / length)):
        x, y = rnd.randrange(W + 6), rnd.randrange(-4, H)
        for k in range(length):
            c.px(x - k * slant, y + k, color)


def person(c, x, base, h, color=233, hood=True):
    """Prosta sylwetka stojacej postaci (cien bez wnetrza)."""
    c.ellipse(x, base - h + 2, 2, 2, color)
    c.poly([(x - 3, base), (x - 2, base - h + 5), (x + 2, base - h + 5), (x + 3, base)], color)
    if hood:
        c.poly([(x - 2, base - h + 3), (x, base - h - 1), (x + 2, base - h + 3)], color)


def crow(c, x, y, color=233):
    for dx, dy in ((0, 0), (1, 1), (2, 0), (3, 1), (4, 0)):
        c.px(x + dx, y + dy, color)


def glow_spot(c, cx, cy, r, color, density=0.3):
    c.glow(int(cx - r), int(cy - r), int(cx + r), int(cy + r * 0.7), color, density, skip=())


def road(c, y0, x_top=(44, 52), x_bottom=(30, 66), ramp=(137, 94)):
    c.paint(M([(x_bottom[0], H - 1), (x_bottom[1], H - 1), (x_top[1], y0), (x_top[0], y0)]), ramp[0])
    c.dither(x_bottom[0], y0, x_bottom[1], H - 1, ramp[0], ramp[1], 0.3)
    c.line(x_top[0], y0, x_bottom[0], H - 1, ramp[1], 1)
    c.line(x_top[1], y0, x_bottom[1], H - 1, ramp[1], 1)


def lamp(c, x, base, h=14):
    c.rect(x, base - h, x + 1, base, RAMPS["wood"][0])
    c.cel_rect(x - 2, base - h - 5, x + 3, base - h, [233, 124, 208, 220, 229], line=OUTLINE, depth=1, mid=2)
    c.glint(x, base - h - 3, 229, 2)
    glow_spot(c, x, base - h - 2, 9, 130, 0.18)


def crystal(c, x, base, h, w, ramp=None, lean=0):
    r = ramp or RAMPS["glass"]
    c.cel_poly([(x - w, base), (x + lean, base - h), (x + w, base)], r, line=OUTLINE, depth=1)
    c.line(x - w + 1, base - 1, x + lean, base - h + 2, r[-1], 1)


def banner(c, x, y, h, col):
    """Sztandar na maszcie: drzewce i trojkatna choragiew."""
    c.line(x, y, x, y + h, RAMPS["wood"][2], 1)
    c.cel_poly([(x + 1, y + 1), (x + 9, y + 4), (x + 1, y + 8)], col, line=OUTLINE, depth=1)


def tent(c, x, base, w, h, col):
    """Namiot: trojkat z ciemnym wejsciem."""
    c.cel_poly([(x - w, base), (x, base - h), (x + w, base)], col, line=OUTLINE, depth=2)
    c.poly([(x - 2, base), (x, base - h // 2), (x + 2, base)], 233)
