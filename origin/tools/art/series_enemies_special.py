"""Seria 1 (cd.): wrogowie nie-ludzie jako portrety z przodu 64x48. Symetria wzgledem x=31.5, swiatlo z gory."""
import random

from toolkit import Canvas
from palette import RAMPS, OUTLINE
from pilot_common import finish

M = Canvas.mask_poly
E = Canvas.mask_ellipse
TOP = (0, -1)
CX = 31.5
L = OUTLINE
SICK = [23, 66, 108, 151, 194]       # blada, zielonkawa skora utopca
GREEN = [22, 28, 64, 106, 148]       # skrzat
SNAKE = [22, 58, 64, 100, 106]


def new(bg):
    c = Canvas(64, 48)
    c.gradient_v(0, 0, 63, 47, list(bg))
    return c


def sparkle(c, seed, count, ymax=40, colors=(231, 195, 153)):
    rnd = random.Random(seed)
    for _ in range(count):
        c.px(rnd.randrange(2, 62), rnd.randrange(2, ymax), rnd.choice(colors))


def finish_enemy(c, name, comment):
    c.mirror_left_to_right()
    return c


def ghost_scout():
    c = new((233, 17, 18, 60, 236))
    bone, cloth = RAMPS["bone"], RAMPS["cloth_grey"]
    c.glow(6, 2, 57, 46, 74, 0.10, skip=())
    c.cel(M([(8, 47), (10, 24), (16, 10), (31, 4), (47, 10), (53, 24), (55, 47)]), [233, 235, 237, 239, 241], light=TOP, line=L, depth=2)
    for (x0, y0, x1, y1) in ((12, 47, 10, 38), (52, 47, 54, 38), (6, 44, 4, 36)):
        c.line(x0, y0, x1, y1, 241, 1)
    c.cel(E(CX, 24, 10, 13), bone, light=TOP, line=L, depth=2)
    c.cel(M([(25, 34), (38, 34), (36, 40), (27, 40)]), bone, light=TOP, line=L, depth=1)
    for sign in (1, -1):
        cx = int(round(CX - sign * 6.5)) if sign == 1 else int(round(CX + 6.5))
        c.poly([(cx - 4, 20), (cx + 4, 20), (cx + 3, 27), (cx - 3, 27)], 233)
        c.poly([(cx - 2, 22), (cx + 2, 22), (cx + 1, 25), (cx - 1, 25)], 51)
        c.px(cx, 23, 231)
    c.poly([(30, 28), (33, 28), (32, 32), (31, 32)], 233)
    for x in range(26, 38, 2):
        c.line(x, 36, x, 39, 233)
    c.line(26, 36, 37, 36, 233)
    c.glow(18, 12, 46, 36, 123, 0.12)
    c.mirror_left_to_right()
    c.line(41, 12, 45, 23, 124)
    for (x, y) in ((8, 20), (54, 14), (5, 30), (58, 28), (12, 8)):
        c.glint(x, y, 123, 1)
    c.outline(OUTLINE)
    finish(c, "upior_zwiadowca", "Upiór zwiadowca – blady szkielet w kapturze, lodowe oczy", "enemy")


def boar():
    c = new((233, 234, 22, 58, 94))
    fur = RAMPS["fur_brown"]
    skin = RAMPS["skin"]
    c.cel(M([(2, 47), (6, 34), (18, 30), (31, 32), (31, 47)]), fur, light=TOP, line=L, depth=2)
    c.cel(M([(10, 22), (4, 6), (18, 12)]), fur, light=TOP, line=L, depth=1)
    c.poly([(11, 19), (7, 9), (16, 13)], 95)
    c.cel(E(CX, 22, 17, 15), fur, light=TOP, line=L, depth=3)
    for x in range(14, 32, 2):
        c.line(x, 8, x + 1, 2 + (x % 4), fur[0], 1)
        c.line(x, 9, x + 1, 4 + (x % 4), fur[4], 1)
    c.cel(E(CX, 33, 11, 9), skin, light=TOP, line=L, depth=2)
    c.cel(E(CX, 31, 9, 5), [95, 131, 137, 174, 217], light=TOP, line=L, depth=1)
    for nx in (27, 30):
        c.poly([(nx, 30), (nx + 2, 30), (nx + 1, 33)], 233)
    c.poly([(22, 38), (41, 38), (38, 43), (31, 44), (25, 43)], 52)
    for sign in (1, -1):
        def X(x, s=sign):
            return int(round(CX + s * (CX - x)))
        c.poly([(X(19), 36), (X(23), 36), (X(18), 28), (X(13), 24), (X(15), 31)], 231)
        c.poly([(X(19), 36), (X(21), 36), (X(17), 29), (X(14), 26)], 255)
        c.poly([(X(21), 18), (X(27), 20), (X(26), 23), (X(21), 22)], 233)
        c.px(X(24), 21, 124); c.px(X(25), 21, 160)
        c.line(X(20), 15, X(28), 19, 233); c.line(X(20), 16, X(28), 20, fur[0])
    c.mirror_left_to_right()
    c.line(34, 9, 38, 22, 124); c.line(35, 9, 39, 22, 167)
    c.outline(OUTLINE)
    finish(c, "dzik", "Dzik – szeroki łeb, kły, szczecina na grzbiecie", "enemy")


def viper():
    c = new((233, 22, 22, 58, 28))
    s = SNAKE
    for k in range(3):  # zwoje
        c.cel(E(CX, 41 + k * 2, 22 - k * 3, 6), s, light=TOP, line=L, depth=1)
    c.cel(M([(31, 6), (44, 16), (42, 30), (31, 34), (20, 30), (18, 16)]), s, light=TOP, line=L, depth=2)
    c.cel(M([(24, 30), (39, 30), (36, 36), (27, 36)]), s, light=TOP, line=L, depth=1)
    for (x, y) in ((31, 10), (27, 14), (36, 14), (31, 18)):
        c.poly([(x - 2, y), (x, y - 2), (x + 2, y), (x, y + 2)], 22)
    for sign in (1, -1):
        def X(x, g=sign):
            return int(round(CX + g * (CX - x)))
        c.poly([(X(21), 20), (X(27), 18), (X(27), 23), (X(22), 24)], 220)
        c.poly([(X(24), 19), (X(25), 19), (X(25), 23), (X(24), 23)], 233)
        c.line(X(20), 16, X(28), 17, 233)
    c.poly([(26, 31), (37, 31), (36, 34), (27, 34)], 52)
    c.poly([(26, 31), (28, 31), (27, 38)], 255)
    c.poly([(35, 31), (37, 31), (36, 38)], 255)
    c.line(31, 34, 31, 42, 160, 1)
    c.line(31, 42, 28, 46, 160, 1)
    c.line(31, 42, 34, 46, 160, 1)
    c.mirror_left_to_right()
    c.line(24, 8, 22, 12, 106)
    c.outline(OUTLINE)
    finish(c, "zmija_lesna", "Żmija leśna – wzniesiona głowa, jadowite kły, rozdwojony język", "enemy")


def drowned():
    c = new((17, 17, 18, 24, 22))
    sk = SICK
    c.glow(0, 20, 63, 47, 31, 0.22, skip=())
    c.cel(M([(0, 47), (4, 38), (14, 34), (31, 36), (31, 47)]), RAMPS["cloth_green"], light=TOP, line=L, depth=2)
    for x in range(6, 31, 5):
        c.line(x, 36, x - 2, 47, 22, 1)
    c.cel(E(CX, 21, 13, 15), sk, light=TOP, line=L, depth=3)
    c.cel(E(CX, 33, 8, 7), sk, light=TOP, line=L, depth=1)
    # mokre, oklapniete wlosy
    for x in range(16, 32, 2):
        c.line(x, 8, x - 2 + (x % 3), 30 + (x % 5), 22, 1)
        c.line(x + 1, 8, x - 1 + (x % 3), 26 + (x % 4), 28, 1)
    for sign in (1, -1):
        def X(x, g=sign):
            return int(round(CX + g * (CX - x)))
        c.poly([(X(18), 19), (X(27), 18), (X(26), 24), (X(19), 23)], 233)
        c.poly([(X(20), 20), (X(26), 19), (X(25), 22), (X(21), 22)], 229)
        c.px(X(23), 21, 233)
    c.poly([(24, 30), (39, 30), (36, 40), (31, 42), (27, 40)], 233)
    c.poly([(26, 31), (37, 31), (35, 36), (28, 36)], 17)
    for x in (26, 29, 33, 36):
        c.px(x, 31, 194)
    c.mirror_left_to_right()
    # rzesy i trzciny
    for (x, h) in ((50, 24), (54, 30), (8, 20), (13, 28)):
        c.line(x, 47, x + 1, 47 - h, 64, 1)
        c.line(x + 1, 47, x + 2, 47 - h, 106, 1)
        c.cel_rect(x - 1, 47 - h - 4, x + 2, 47 - h, RAMPS["wood"], light=TOP, line=L, depth=1)
    c.glint(24, 9, 117, 1)
    c.outline(OUTLINE)
    finish(c, "utopiec", "Utopiec – nabrzmiała, blada twarz, mokre kosmyki, trzciny", "enemy")


def wisp():
    c = new((233, 17, 233, 17, 22))
    g = RAMPS["glass"]
    for r, col in ((24, 17), (20, 18), (16, 24), (12, 67), (8, 110), (5, 195)):
        for (x, y) in E(CX, 22, r * 1.15, r):
            if 0 <= x < 64 and 0 <= y < 48 and (r < 10 or (x + y) % 2 == 0 or r < 16):
                c.px(x, y, col)
    c.cel(E(CX, 22, 9, 9), [110, 153, 195, 231, 231], light=TOP, line=None, depth=2, mid=2)
    for sign in (1, -1):
        def X(x, g_=sign):
            return int(round(CX + g_ * (CX - x)))
        c.poly([(X(24), 19), (X(28), 18), (X(28), 22), (X(25), 22)], 17)
        c.px(X(26), 20, 195)
    c.poly([(27, 26), (36, 26), (34, 29), (29, 29)], 17)
    # macki i bagienne trzciny
    for (x, y0, y1, dx) in ((8, 47, 30, 4), (14, 47, 36, 3), (50, 47, 32, -4), (56, 47, 28, -4)):
        c.line(x, y0, x + dx, y1, 22, 1)
        c.line(x + 1, y0, x + 1 + dx, y1, 64, 1)
    for (x0, y0, x1, y1) in ((20, 32, 14, 42), (43, 32, 49, 42), (28, 34, 26, 44), (35, 34, 38, 44)):
        c.line(x0, y0, x1, y1, 74, 1)
        c.line(x0 + 1, y0, x1 + 1, y1, 117, 1)
    c.mirror_left_to_right()
    sparkle(c, 6, 14, 18)
    c.glint(16, 12, 231, 2)
    c.glint(44, 38, 195, 1)
    finish(c, "blednik", "Błędnik – bagienne światło z mroczną twarzą w środku", "enemy")


def goblin():
    c = new((233, 52, 58, 22, 28))
    g = GREEN
    c.cel(M([(6, 47), (8, 38), (18, 34), (37, 34), (37, 47)]), RAMPS["cloth_brown"], light=TOP, line=L, depth=2)
    # uszy
    c.cel(M([(24, 20), (0, 12), (4, 24), (24, 29)]), g, light=TOP, line=L, depth=1)
    c.poly([(21, 22), (5, 16), (7, 23), (21, 27)], 174)
    c.cel(E(CX, 24, 12, 12), g, light=TOP, line=L, depth=2)
    # czerwona szpiczasta czapka
    c.cel(M([(18, 16), (21, 8), (31, 0), (44, 2), (46, 12), (45, 16), (31, 11)]), RAMPS["cloth_red"], light=TOP, line=L, depth=2)
    c.cel(M([(16, 16), (47, 16), (46, 19), (17, 19)]), RAMPS["cloth_red"], light=TOP, line=L, depth=1)
    c.px(46, 3, 220); c.px(47, 3, 227)
    for sign in (1, -1):
        def X(x, s=sign):
            return int(round(CX + s * (CX - x)))
        c.poly([(X(22), 21), (X(29), 20), (X(28), 26), (X(23), 26)], 231)
        c.poly([(X(24), 22), (X(28), 21), (X(27), 25), (X(25), 25)], 226)
        c.px(X(26), 23, 233)
        c.line(X(21), 18, X(29), 21, 233); c.line(X(21), 19, X(29), 22, g[0])
    c.poly([(30, 25), (33, 25), (32, 29), (31, 29)], g[1])
    c.poly([(21, 31), (42, 31), (38, 37), (31, 39), (25, 37)], 233)
    c.poly([(23, 32), (40, 32), (38, 34), (25, 34)], 231)
    c.poly([(24, 35), (39, 35), (37, 37), (26, 37)], 160)
    for tx in (24, 27, 36, 39):
        c.poly([(tx, 32), (tx + 2, 32), (tx + 1, 35)], 255)
    c.mirror_left_to_right()
    c.line(40, 14, 44, 24, 124)
    c.outline(OUTLINE)
    c.glint(24, 6, 231, 1)
    finish(c, "skrzat_zlosnik", "Skrzat-złośnik – wielkie uszy, czerwona czapka, złośliwy uśmiech", "enemy")


def sleepless():
    c = new((233, 233, 17, 60, 236))
    sk = [59, 102, 145, 188, 231]
    c.cel(M([(2, 47), (4, 38), (14, 34), (31, 35), (31, 47)]), RAMPS["cloth_grey"], light=TOP, line=L, depth=2)
    for x in range(6, 30, 4):
        c.line(x, 40, x - 1, 47, 237, 1)
    c.cel(E(CX, 21, 11, 14), sk, light=TOP, line=L, depth=2)
    c.cel(E(19.5, 22, 2, 3) | E(43.5, 22, 2, 3), sk, light=TOP, line=L, depth=1)
    # cienkie wlosy
    for x in range(21, 32, 2):
        c.line(x, 8, x - 3, 22 + x % 4, 240, 1)
    for sign in (1, -1):
        def X(x, g=sign):
            return int(round(CX + g * (CX - x)))
        c.poly([(X(21), 18), (X(29), 17), (X(28), 25), (X(22), 24)], 90)       # sine oczodoly
        c.poly([(X(22), 19), (X(28), 18), (X(27), 24), (X(23), 23)], 231)
        c.poly([(X(24), 20), (X(27), 20), (X(26), 23), (X(24), 23)], 196)
        c.px(X(25), 21, 233)
        c.line(X(22), 20, X(25), 22, 124, 1)
        c.line(X(21), 14, X(29), 16, 233)
    c.poly([(30, 22), (33, 22), (32, 27), (31, 27)], sk[1])
    c.poly([(26, 30), (37, 30), (36, 39), (31, 41), (27, 39)], 233)
    c.poly([(28, 31), (35, 31), (34, 38), (31, 39), (29, 38)], 52)
    c.mirror_left_to_right()
    c.line(42, 11, 45, 22, 237)
    c.glint(31, 6, 231, 1)
    c.outline(OUTLINE)
    finish(c, "niespiacy", "Nieśpiący – wyschnięta twarz, wybałuszone oczy z żyłkami, bezgłośny krzyk", "enemy")


def crystal_warden():
    c = new((233, 17, 18, 24, 31))
    g = RAMPS["glass"]
    sparkle(c, 3, 22, 40)
    # kolce na ramionach
    c.cel(M([(2, 47), (4, 36), (14, 30), (31, 32), (31, 47)]), g, light=TOP, line=L, depth=2)
    for pts in ([(4, 36), (0, 26), (10, 33)], [(12, 33), (10, 22), (18, 31)]):
        c.cel(M(pts), g, light=TOP, line=L, depth=1)
    # hełm z ostrym grzebieniem
    c.cel(M([(31, 0), (38, 6), (44, 8), (47, 22), (44, 36), (36, 40), (27, 40), (19, 36), (16, 22), (19, 8), (25, 6)]), g, light=TOP, line=L, depth=3)
    c.poly([(21, 18), (42, 18), (40, 25), (31, 28), (23, 25)], 233)
    c.poly([(23, 19), (40, 19), (38, 23), (31, 25), (25, 23)], 51)
    c.rect(28, 19, 35, 22, 195)
    c.line(31, 4, 31, 17, g[5]); c.line(31, 28, 31, 40, g[1])
    for (x0, y0, x1, y1) in ((22, 12, 26, 18), (24, 30, 28, 38)):
        c.line(x0, y0, x1, y1, g[4])
    c.mirror_left_to_right()
    c.line(36, 8, 44, 26, 195)
    c.glint(27, 11, 231, 2)
    c.outline(OUTLINE)
    finish(c, "straznik_wiru", "Strażnik Wiru – szklany hełm z grzebieniem, świecąca szczelina wizjera", "enemy")


def vortex_servant():
    c = new((233, 17, 17, 18, 24))
    g = RAMPS["glass"]
    sparkle(c, 8, 18, 40)
    c.cel(M([(4, 47), (6, 28), (14, 14), (31, 6), (49, 14), (57, 28), (59, 47)]), [233, 17, 18, 24, 60], light=TOP, line=L, depth=2)
    c.cel(M([(18, 30), (20, 18), (31, 12), (44, 18), (46, 30), (38, 38), (31, 40), (25, 38)]), g, light=TOP, line=L, depth=2)
    c.poly([(22, 22), (41, 22), (40, 30), (31, 33), (23, 30)], 233)
    c.cel(E(CX, 26, 4, 4), [17, 24, 31, 117, 195], light=TOP, line=None, depth=1)
    c.px(31, 24, 231); c.px(32, 24, 231)
    for (x0, y0, x1, y1) in ((21, 20, 27, 34), (42, 20, 36, 34)):
        c.line(x0, y0, x1, y1, g[1])
    c.mirror_left_to_right()
    c.line(26, 14, 22, 26, 195)
    c.glint(14, 16, 195, 1)
    c.outline(OUTLINE)
    finish(c, "sluga_wiru", "Sługa Wiru – kaptur z ciemnego szkła, pojedyncze świecące oko", "enemy")


def glass_guard():
    c = new((233, 233, 17, 18, 60))
    g = RAMPS["glass"]
    sparkle(c, 11, 16, 40)
    c.cel(E(8, 40, 10, 8) | E(55, 40, 10, 8) | M([(2, 47), (8, 34), (31, 32), (31, 47)]), g, light=TOP, line=L, depth=2)
    c.cel(M([(31, 2), (46, 8), (50, 22), (44, 40), (31, 44), (19, 40), (13, 22), (17, 8)]), g, light=TOP, line=L, depth=3)
    c.poly([(19, 19), (30, 19), (28, 25), (19, 24)], 233)
    c.poly([(21, 20), (29, 20), (27, 23), (21, 23)], 195)
    c.rect(29, 28, 34, 38, g[1])
    c.line(31, 8, 31, 26, g[5])
    c.line(20, 30, 26, 38, g[2]); c.line(26, 30, 29, 36, g[1])
    for y in (30, 34, 38):
        c.line(24, y, 28, y, 233)
    c.mirror_left_to_right()
    c.line(38, 4, 46, 20, 195)
    c.glint(24, 10, 231, 1)
    c.outline(OUTLINE)
    finish(c, "straz_szklanna", "Strażnik szklany – fasetowany hełm, oczy-szczeliny, szklane naramienniki", "enemy")


def entity():
    c = new((233, 233, 16, 17, 18))
    g = RAMPS["glass"]
    night = RAMPS["night"]
    sparkle(c, 5, 30, 44)
    # korona z odłamków
    for (x, top, w) in ((10, 6, 5), (16, 0, 5), (24, 3, 4), (22, 8, 4)):
        c.cel(M([(x - w, 20), (x, top), (x + w, 20)]), g, light=TOP, line=L, depth=1)
    # ramiona jak z czarnego szkła
    c.cel(M([(0, 47), (4, 38), (14, 34), (24, 36), (31, 40), (31, 47)]), [233, 17, 18, 24, 60], light=TOP, line=L, depth=2)
    for (x0, y0, x1, y1) in ((6, 44, 18, 38), (4, 40, 12, 36)):
        c.line(x0, y0, x1, y1, g[5])
    # twarz: czarne szkło, w którym świecą gwiazdy
    c.cel(E(CX, 24, 11, 14), [233, 233, 17, 18, 24], light=TOP, line=L, depth=2, mid=1)
    rnd = random.Random(15)
    for _ in range(26):
        x, y = rnd.randrange(21, 32), rnd.randrange(12, 36)
        if c.get(x, y) is not None and c.get(x, y) != L:
            c.px(x, y, rnd.choice((231, 195, 153, 117)))
    for sign in (1, -1):
        def X(x, s=sign):
            return int(round(CX + s * (CX - x)))
        c.poly([(X(22), 21), (X(29), 20), (X(28), 25), (X(23), 24)], 233)
        c.glint(X(26), 22, 231, 2)
        c.px(X(26), 22, 255)
        c.line(X(21), 17, X(30), 19, 117)
    c.line(30, 25, 31, 30, 24)
    c.line(27, 33, 36, 33, 60)
    c.mirror_left_to_right()
    c.line(37, 12, 40, 30, 195)
    c.line(38, 12, 41, 30, 117)
    c.outline(OUTLINE)
    c.glint(31, 4, 231, 3)
    finish(c, "istota_szklanna", "Istota – twarz z czarnego szkła, w której świecą gwiazdy, korona z odłamków", "enemy")


SPECIAL = {
    "upior_zwiadowca": ghost_scout, "dzik": boar, "zmija_lesna": viper, "utopiec": drowned, "blednik": wisp,
    "skrzat_zlosnik": goblin, "niespiacy": sleepless, "straznik_wiru": crystal_warden, "sluga_wiru": vortex_servant,
    "straz_szklanna": glass_guard, "istota_szklanna": entity,
}
