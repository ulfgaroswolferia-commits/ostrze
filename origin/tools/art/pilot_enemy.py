"""Wrogowie to ZAWSZE portrety z przodu (glowa i ramiona, 64x48). Rysowane symetrycznie (swiatlo z gory), potem asymetryczne detale."""
import random

from toolkit import Canvas
from palette import RAMPS, OUTLINE
from pilot_common import finish

M = Canvas.mask_poly
E = Canvas.mask_ellipse
TOP = (0, -1)  # swiatlo z gory - lewa i prawa polowa wygladaja tak samo


def wolf_head():
    c = Canvas(64, 48)
    fur = RAMPS["fur_grey"]
    dark = [233, 235, 237, 239, 241]
    amber = RAMPS["gold"]
    L = OUTLINE
    cx = 31.5
    # tlo: ciemna mgla z kolem blasku za glowa
    c.gradient_v(0, 0, 63, 47, [233, 233, 234, 235])
    c.glow(8, 2, 55, 40, 236, 0.12, skip=())
    # kolnierz z futra i ramiona
    c.cel(M([(0, 47), (3, 38), (12, 33), (24, 34), (31, 36), (31, 47)]), fur, light=TOP, line=L, depth=2)
    c.cel(M([(4, 47), (9, 40), (16, 38), (22, 44), (24, 47)]), dark, light=TOP, line=L, depth=1)
    # uszy
    c.cel(M([(9, 20), (7, 2), (23, 11)]), fur, light=TOP, line=L, depth=1)
    c.poly([(10, 17), (9, 6), (19, 12)], 95)
    c.poly([(11, 15), (10, 9), (17, 12)], 131)
    # czaszka i policzki (futro rozchodzi sie na boki)
    skull = E(cx, 23, 18, 15) | M([(14, 24), (6, 32), (4, 38), (14, 37), (22, 32)]) | M([(15, 14), (8, 20), (14, 26)])
    c.cel(skull, fur, light=TOP, line=L, depth=3)
    # kufa: jasniejsza, wysunieta
    muzzle = E(cx, 34, 11, 8) | M([(24, 28), (39, 28), (36, 40), (27, 40)])
    c.cel(muzzle, [239, 243, 247, 251, 255], light=TOP, line=L, depth=2)
    # nos
    c.cel(M([(27, 28), (36, 28), (34, 32), (29, 32)]), [233, 233, 235, 237, 240], light=TOP, line=L, depth=1, mid=1)
    c.rect(28, 29, 29, 29, 245)
    c.line(31, 32, 31, 36, 233)
    c.line(31, 36, 25, 38, 233)
    c.line(31, 36, 38, 38, 233)
    # otwarta paszcza z kłami
    c.poly([(24, 38), (39, 38), (37, 44), (31, 46), (26, 44)], 52)
    c.poly([(27, 41), (36, 41), (34, 45), (31, 46), (29, 45)], 124)
    c.poly([(28, 41), (35, 41), (33, 43), (30, 43)], 167)
    for (tx, ty) in ((24, 38), (38, 38)):
        c.poly([(tx - 1, ty), (tx + 3, ty), (tx + 1, ty + 7)], 231)
    for (tx, ty) in ((27, 39), (35, 39)):
        c.poly([(tx, ty), (tx + 3, ty), (tx + 1, ty + 5)], 255)
    c.poly([(23, 38), (26, 38), (24, 42)], 255)
    # oczy: zlowrogie, skosne, bursztynowe
    for sign in (1, -1):
        def X(x):
            return int(round(cx + sign * (cx - x)))
        pts = [(X(15), 17), (X(25), 19), (X(24), 22), (X(16), 20)]
        c.poly(pts, 233)
        c.poly([(X(17), 18), (X(24), 20), (X(23), 21), (X(17), 19)], amber[3])
        c.px(X(21), 20, 233)
        c.px(X(21), 19, 231)
        c.line(X(14), 14, X(26), 18, 233)  # brew
        c.line(X(14), 15, X(25), 19, fur[1])
    # zmarszczki i pociagniecia sierści
    for k in range(7):
        c.line(24 + k % 3, 8 + k, 27, 12 + k // 2, fur[3])
    rnd = random.Random(21)
    for _ in range(40):
        x, y = rnd.randrange(6, 31), rnd.randrange(8, 36)
        if c.get(x, y) in fur:
            c.line(x, y, x + 2, y + 2, fur[min(4, fur.index(c.get(x, y)) + 1)])
    for y in range(34, 47, 3):
        c.line(2, y, 8, y - 3, fur[4])
        c.line(11, y + 1, 17, y - 2, fur[3])
    c.mirror_left_to_right()
    # asymetria: blizna przez prawe oko, wyszczerbione ucho, kłaki
    c.line(40, 12, 46, 24, 124, 1)
    c.line(41, 12, 47, 24, 167, 1)
    c.poly([(54, 12), (57, 5), (56, 12)], 233)
    c.px(55, 6, 233)
    for (x, y) in ((52, 33), (55, 36), (50, 30)):
        c.line(x, y, x + 3, y + 3, fur[4])
    c.outline(OUTLINE)
    c.glint(30, 12, 231, 1)
    finish(c, "wilk", "Wilk – portret z przodu, warczący, bursztynowe oczy, blizna", "enemy")
