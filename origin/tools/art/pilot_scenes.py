"""Sceny pilotazu (96x48): karczma, oboz, ruiny, pole szkla. Wspolne pomocnicze: swierki, wzgorza, deski."""
import math
import random

from toolkit import Canvas
from palette import RAMPS, OUTLINE
from pilot_common import finish, stars


def conifer(c, cx, base, h, w, ramp, line=OUTLINE, tiers=4):
    """Swierk: kilka nachodzacych na siebie trojkatow, cieniowanych komiksowo."""
    trunk_h = max(2, h // 8)
    c.cel_rect(cx - 1, base - trunk_h, cx + 1, base, RAMPS["wood"], line=None, depth=1)
    for t in range(tiers):
        top = base - h + t * (h - trunk_h) // (tiers + 1)
        bottom = top + (h - trunk_h) // tiers + 3
        half = max(2, int(w / 2 * (0.45 + 0.55 * (t + 1) / tiers)))
        c.cel_poly([(cx, top), (cx + half, bottom), (cx - half, bottom)], ramp, line=line, depth=1)


def silhouette_hills(c, y0, y1, color, seed, amp=3):
    rnd = random.Random(seed)
    phase = rnd.random() * 6
    for x in range(c.w):
        top = y0 + int(amp * math.sin(x / 9.0 + phase) + amp * 0.6 * math.sin(x / 4.3 + phase * 2))
        for y in range(top, y1 + 1):
            c.px(x, y, color)


def plank_lines(c, x0, y0, x1, y1, color, step=3):
    for y in range(y0 + step, y1, step):
        for x in range(x0 + 1, x1):
            if (x * 7 + y * 3) % 11 != 0:
                c.px(x, y, color)


def tavern():
    c = Canvas(96, 48)
    c.gradient_v(0, 0, 95, 33, [233, 17, 53, 90, 132, 173])
    stars(c, 40, 4, 16)
    silhouette_hills(c, 28, 36, 235, 2, amp=2)
    for x, h in ((4, 14), (12, 18), (84, 17), (91, 13), (78, 11)):
        conifer(c, x, 37, h, 9, [22, 22, 28, 28, 64], tiers=3)
    c.gradient_v(0, 36, 95, 47, [22, 28, 94, 58])
    c.paint(c.mask_poly([(34, 47), (54, 47), (50, 36), (44, 36)]), 137)
    c.dither(34, 40, 54, 47, 137, 94, 0.4)
    wood = RAMPS["wood"]
    c.cel_rect(16, 19, 74, 39, wood, line=OUTLINE, depth=2)
    plank_lines(c, 16, 19, 74, 39, wood[1])
    for bx in (16, 38, 52, 73):
        c.rect(bx, 19, bx + 1, 39, wood[0])
    c.cel_poly([(10, 19), (45, 4), (80, 19), (74, 21), (16, 21)], [235, 237, 94, 130, 137], line=OUTLINE, depth=2)
    for ry in range(8, 19, 3):
        c.line(45 - (ry - 4) * 2, ry + 1, 45 + (ry - 4) * 2, ry + 1, 233)
    c.cel_rect(60, 6, 65, 13, RAMPS["stone"], line=OUTLINE, depth=1)
    for i, (dx, dy) in enumerate(((0, 0), (1, -3), (3, -6), (4, -9))):
        c.ellipse(62 + dx, 4 + dy, 2 + i // 2, 1 + i // 2, 241 - i)
    c.cel_rect(40, 27, 50, 39, [233, 52, 124, 166, 208], line=OUTLINE, depth=1, mid=2)
    c.rect(41, 28, 49, 39, 233)
    c.dither(41, 28, 49, 39, 233, 208, 0.45)
    c.line(45, 28, 45, 39, wood[1])
    c.px(47, 33, 227)
    for wx in (22, 56):
        c.rect(wx, 24, wx + 9, 31, OUTLINE)
        c.rect(wx + 1, 25, wx + 8, 30, 208)
        c.dither(wx + 1, 25, wx + 8, 30, 208, 220, 0.4)
        c.rect(wx + 4, 25, wx + 5, 30, wood[0])
        c.line(wx + 1, 27, wx + 8, 27, wood[0])
        c.glint(wx + 2, 26, 229, 1)
        c.glow(wx - 2, 32, wx + 11, 47, 136, 0.22)
    c.rect(76, 17, 90, 18, wood[0])
    c.rect(89, 17, 90, 31, wood[0])
    c.cel_rect(80, 21, 87, 29, wood, line=OUTLINE, depth=1)
    c.cel_poly([(82, 22), (85, 22), (84, 28)], [237, 241, 245, 249, 253], line=None, depth=1)
    c.line(80, 18, 80, 21, 233)
    c.line(87, 18, 87, 21, 233)
    c.rect(12, 25, 13, 38, wood[0])
    c.cel_rect(10, 20, 15, 25, [233, 124, 208, 220, 229], line=OUTLINE, depth=1, mid=2)
    c.glint(12, 22, 229, 2)
    c.glow(2, 14, 22, 36, 94, 0.15)
    for bx in (66, 71):
        c.cel_ellipse(bx, 37, 3, 3, wood, line=OUTLINE, depth=1)
        c.rect(bx - 3, 36, bx + 3, 36, 233)
    finish(c, "karczma_pod_wilczym_klem", "Karczma Pod Wilczym Kłem o zmierzchu – ciepłe okna, szyld z kłem", "scene")


def camp():
    c = Canvas(96, 48)
    c.gradient_v(0, 0, 95, 32, [16, 17, 18, 60, 61])
    stars(c, 55, 9, 18)
    c.ellipse(78, 9, 4, 4, 230)
    c.ellipse(80, 8, 3, 3, 17)
    silhouette_hills(c, 26, 34, 233, 5, amp=3)
    for x, h, w in ((6, 26, 13), (17, 21, 11), (30, 16, 9), (66, 18, 10), (79, 25, 13), (90, 20, 11)):
        conifer(c, x, 38, h, w, [233, 234, 22, 22, 28], tiers=4)
    c.gradient_v(0, 34, 95, 47, [233, 234, 52, 58])
    for r, col, d in ((26, 94, 0.15), (18, 130, 0.25), (11, 166, 0.35)):
        for (x, y) in c.mask_ellipse(48, 40, r * 1.6, r * 0.45):
            if 0 <= x < 96 and 34 <= y < 48 and ((x + y) % 2 == 0 or d > 0.3):
                c.px(x, y, col)
    for k in range(9):
        a = k / 9 * 2 * math.pi
        sx, sy = 48 + int(10 * math.cos(a)), 41 + int(3.4 * math.sin(a))
        c.cel_ellipse(sx, sy, 2, 1, RAMPS["stone"], line=OUTLINE, depth=1)
    c.cel_poly([(38, 41), (58, 36), (59, 39), (40, 43)], RAMPS["wood"], line=OUTLINE, depth=1)
    c.cel_poly([(38, 36), (58, 41), (57, 43), (37, 39)], RAMPS["wood"], line=OUTLINE, depth=1)
    fire = RAMPS["fire"]
    c.poly([(40, 40), (44, 28), (47, 33), (49, 22), (52, 31), (55, 27), (58, 40)], fire[1])
    c.poly([(42, 40), (46, 31), (48, 35), (49, 26), (52, 34), (54, 31), (56, 40)], fire[2])
    c.poly([(44, 40), (47, 34), (49, 30), (51, 36), (53, 34), (54, 40)], fire[3])
    c.poly([(46, 40), (48, 36), (49, 33), (51, 37), (52, 40)], fire[4])
    c.poly([(47, 40), (49, 37), (50, 40)], fire[5])
    for (sx, sy) in ((45, 22), (53, 19), (49, 15), (56, 24), (42, 26), (51, 11)):
        c.px(sx, sy, 220)
        c.px(sx, sy + 1, 208)
    c.cel_ellipse(22, 42, 6, 3, RAMPS["wood"], line=OUTLINE, depth=1)
    c.cel_ellipse(75, 43, 6, 3, RAMPS["wood"], line=OUTLINE, depth=1)
    c.cel_poly([(60, 44), (72, 41), (80, 44), (78, 47), (62, 47)], RAMPS["cloth_blue"], line=OUTLINE, depth=1)
    c.cel_poly([(6, 44), (16, 30), (30, 44)], RAMPS["cloth_brown"], line=OUTLINE, depth=2)
    c.poly([(14, 44), (16, 36), (22, 44)], 233)
    c.glow(6, 31, 30, 44, 130, 0.14)
    c.glint(48, 24, 229, 1)
    finish(c, "oboz", "Obóz nocą – ognisko, pnie, namiot, gwiazdy", "scene")


def ruins():
    c = Canvas(96, 48)
    c.gradient_v(0, 0, 95, 36, [67, 110, 111, 153, 216, 223])
    rnd = random.Random(12)
    for (cx, cy, rw) in ((20, 10, 16), (66, 7, 22), (48, 18, 12)):
        for _ in range(rw * 2):
            x = cx + rnd.randint(-rw, rw)
            y = cy + rnd.randint(-2, 2)
            c.px(x, y, 231 if y <= cy else 195)
    silhouette_hills(c, 30, 40, 66, 3, amp=3)
    c.gradient_v(0, 38, 95, 47, [28, 64, 22, 58])
    stone = RAMPS["stone"]
    c.cel_poly([(0, 47), (0, 40), (30, 34), (60, 33), (96, 39), (96, 47)], [22, 28, 64, 106, 148], line=None, depth=2)
    c.cel_rect(34, 12, 60, 40, stone, line=OUTLINE, depth=2)
    for y in range(14, 40, 4):
        for x in range(35, 60, 6):
            off = (y // 4 % 2) * 3
            c.line(min(x + off, 58), y, min(x + off + 4, 58), y, stone[1])
    c.cel_poly([(34, 13), (38, 8), (42, 12), (46, 6), (50, 11), (54, 9), (60, 13), (60, 17), (34, 17)], stone, line=OUTLINE, depth=2)
    c.rect(44, 18, 47, 19, 233)
    c.rect(46, 21, 47, 28, 233)
    c.cel_poly([(42, 40), (42, 33), (45, 30), (49, 30), (52, 33), (52, 40)], [233, 233, 234, 235, 236], line=OUTLINE, depth=1, mid=0)
    leaf = RAMPS["leaf"]
    for (x, y, h) in ((35, 15, 14), (58, 17, 18), (40, 25, 10)):
        for i in range(h):
            c.px(x + (i % 3 == 0), y + i, leaf[1 + i % 3])
            if i % 4 == 0:
                c.px(x + 1, y + i, leaf[4])
                c.px(x - 1, y + i, leaf[3])
    for (x, y, r) in ((28, 41, 3), (24, 43, 2), (64, 41, 4), (70, 43, 3), (31, 44, 2), (60, 45, 2)):
        c.cel_ellipse(x, y, r, max(1, r - 1), stone, line=OUTLINE, depth=1)
    for x in range(0, 96, 3):
        y = 38 + (x * 5 % 7)
        c.line(x, y + 2, x + 1, y, 106)
    for (bx, by) in ((12, 6), (18, 9), (80, 12)):
        c.px(bx, by, 233)
        c.px(bx + 1, by + 1, 233)
        c.px(bx + 2, by, 233)
    finish(c, "ruiny_straznicy", "Ruiny strażnicy – zburzona wieża, bluszcz, gruz, pochmurne niebo", "scene")


def glass_field():
    c = Canvas(96, 48)
    c.gradient_v(0, 0, 95, 30, [16, 17, 18, 60, 24, 31])
    stars(c, 70, 21, 20, bright=(231, 195, 153, 110))
    for x in range(0, 96, 2):
        y = 26 + int(2 * math.sin(x / 7.0))
        c.px(x, y, 24)
        c.px(x + 1, y + 1, 31)
    c.gradient_v(0, 31, 95, 47, [17, 233, 233, 17, 24])
    glass = RAMPS["glass"]
    rnd = random.Random(4)
    for _ in range(40):
        x, y = rnd.randrange(96), rnd.randrange(33, 47)
        c.line(x, y, x + rnd.randint(2, 7), y, 24)
    shards = []
    for _ in range(26):
        x = rnd.randrange(2, 94)
        base = rnd.randint(34, 46)
        h = rnd.randint(5, 20) + (base - 34) // 2
        w = rnd.randint(3, 6)
        lean = rnd.randint(-3, 3)
        shards.append((base, x, h, w, lean))
    for base, x, h, w, lean in sorted(shards):
        c.cel_poly([(x - w, base), (x + lean, base - h), (x + w, base)], glass, line=OUTLINE, depth=1)
        c.line(x - w + 1, base - 1, x + lean, base - h + 2, glass[5], 1)
        if h > 14:
            c.px(x + lean, base - h + 3, 231)
            c.px(x + lean, base - h + 4, 231)
        c.dither(x - w, base + 1, x + w + 2, base + 2, 17, 24, 0.4)
    finish(c, "pole_szkla", "Pole szkła – czarne odłamki pod gwiazdami, odbicia i rozbłyski", "scene")
