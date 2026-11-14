"""Seria 3b (domkniecie): ostatnie trzy lokacje ze wspolna grafika - Zaulek Szklarzy, Ulfgrod, Dom Ciszy."""
import random

from toolkit import Canvas
from palette import RAMPS, OUTLINE
from pilot_common import finish, stars
from scene_lib import *  # noqa: F401,F403
from scene_lib import M, E, R, W, H

SCENES = {}
ST = RAMPS["stone"]
WOOD = RAMPS["wood"]


def scene(fn):
    SCENES[fn.__name__] = fn
    return fn


def save(c, name, comment):
    finish(c, name, comment, "scene")


@scene
def zaulek_szklarzy():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 24, [233, 17, 18, 53, 90])
    stars(c, 12, 77, 8)
    brick = [52, 88, 94, 130, 137]
    for (x0, x1) in ((0, 34), (62, 95)):          # wąskie domy po bokach
        c.cel_rect(x0, 4, x1, 44, brick, line=OUTLINE, depth=2)
        for y in range(8, 44, 3):
            for x in range(x0 + 1, x1):
                if (x * 5 + y * 7) % 9 == 0:
                    c.px(x, y, brick[1])
    c.cel_poly([(0, 6), (17, -2), (34, 6)], [235, 237, 94, 130, 137], line=OUTLINE, depth=1)
    c.cel_poly([(62, 6), (79, -2), (95, 6)], [235, 237, 94, 130, 137], line=OUTLINE, depth=1)
    c.cel_rect(34, 0, 62, 14, ST, line=OUTLINE, depth=1)                  # łuk nad zaułkiem
    c.gradient_v(34, 14, 62, 44, [233, 233, 235, 237])
    for y in range(36, H, 4):
        for x in range((y // 4 % 2) * 4, W, 8):
            c.rect(x, y, x + 3, y + 2, 239)
    # szklane witryny i butelki
    for (x, y) in ((6, 20), (22, 20), (68, 20), (82, 20)):
        c.rect(x, y, x + 8, y + 10, OUTLINE)
        c.rect(x + 1, y + 1, x + 7, y + 9, 24)
        c.cel_ellipse(x + 3, y + 6, 2, 3, RAMPS["glass"], line=None, depth=1)
        c.cel_ellipse(x + 6, y + 7, 1, 2, [52, 88, 124, 160, 196], line=None, depth=1)
        c.glint(x + 2, y + 3, 231, 1)
        glow_spot(c, x + 4, y + 5, 7, 74, 0.2)
    for (x, y) in ((30, 22), (64, 22)):
        lamp(c, x, y + 14, 8)
    c.cel_poly([(42, 44), (44, 30), (52, 30), (54, 44)], [233, 52, 124, 166, 208], line=OUTLINE, depth=1, mid=2)
    c.cel_ellipse(48, 22, 5, 5, [17, 24, 31, 74, 117], line=OUTLINE, depth=1)    # szyld: kolba
    c.rect(47, 26, 49, 28, 233)
    for (x, y) in ((40, 40), (56, 42), (60, 38)):
        c.glow(x - 2, y, x + 2, y + 4, 74, 0.3)
    person(c, 48, 46, 10, 233)
    save(c, "zaulek_szklarzy", "Zaułek Szklarzy – ciasny zaułek, witryny z kolbami i butelkami, błękitna poświata")


def stonework(c, x0, y0, x1, y1, ramp=ST, course=3, block=6):
    """Stone blocks on a wall: dark courses and staggered joints, some blocks a shade lighter or darker."""
    for row, y in enumerate(range(y0, y1 + 1, course)):
        shift = (row % 2) * (block // 2)
        for n, left in enumerate(range(x0 - shift, x1 + 1, block)):
            tone = (row * 7 + n * 13) % 9
            if tone in (0, 4):
                c.rect(max(x0, left + 1), y + 1, min(x1, left + block - 1), min(y1, y + course - 1), ramp[3] if tone == 0 else ramp[1])
            if x0 <= left <= x1:
                c.line(left, y, left, min(y1, y + course - 1), ramp[0])
        c.line(x0, y, x1, y, ramp[0])


def battlements(c, x0, x1, top, ramp=ST, width=3, gap=3, h=3):
    for x in range(x0, x1 + 1, width + gap):
        c.cel_rect(x, top - h, min(x + width, x1), top, ramp, line=OUTLINE, depth=1)


@scene
def ulfgrod():
    c = Canvas(W, H)
    slate = [233, 235, 237, 239, 60]
    c.gradient_v(0, 0, W - 1, 30, [233, 17, 53, 90, 132, 173])
    stars(c, 20, 78, 10)
    hills(c, 24, 32, 235, 79, amp=2)
    # dachy miasta za murem
    for k, x in enumerate(range(22, 74, 9)):
        h = 3 + (k * 5) % 6
        c.cel_rect(x, 22 - h, x + 7, 22, WOOD, line=OUTLINE, depth=1)
        c.cel_poly([(x - 1, 22 - h), (x + 4, 22 - h - 5), (x + 8, 22 - h)], [235, 237, 94, 130, 137], line=OUTLINE, depth=1)
    # pałac: szeroka bryła z blankami, dwie smukłe wieżyczki, złoty dach
    c.cel_rect(34, 9, 62, 22, ST, line=OUTLINE, depth=1)
    stonework(c, 35, 10, 61, 21)
    for x in (39, 47, 55):
        c.rect(x, 13, x + 2, 17, OUTLINE)
        c.rect(x, 14, x + 2, 16, 208)
    c.cel_poly([(36, 9), (41, 3), (55, 3), (60, 9)], RAMPS["gold"], line=OUTLINE, depth=1)
    for x in (29, 61):
        c.cel_rect(x, 6, x + 6, 22, ST, line=OUTLINE, depth=1)
        stonework(c, x + 1, 7, x + 5, 21, block=4)
        c.cel_poly([(x - 1, 6), (x + 3, -1), (x + 7, 6)], slate, line=OUTLINE, depth=1)
    # mur z blankami i kamiennymi blokami
    c.cel_rect(0, 23, 95, 40, ST, line=OUTLINE, depth=1)
    stonework(c, 1, 24, 94, 39)
    battlements(c, 0, 95, 23)
    # baszty narożne
    for x, top in ((6, 12), (76, 10)):
        c.cel_rect(x, top, x + 14, 40, ST, line=OUTLINE, depth=1)
        stonework(c, x + 1, top + 1, x + 13, 39, block=5)
        battlements(c, x, x + 14, top, width=2, gap=2, h=2)
        c.cel_poly([(x + 1, top - 2), (x + 7, top - 11), (x + 13, top - 2)], slate, line=OUTLINE, depth=1)
        c.rect(x + 6, top + 6, x + 8, top + 10, OUTLINE)
    # brama: niska wieża z łukiem i kratą
    c.cel_rect(38, 19, 58, 40, ST, line=OUTLINE, depth=1)
    stonework(c, 39, 20, 57, 39, block=5)
    battlements(c, 38, 58, 19, width=3, gap=2, h=3)
    arch = [(42, 40), (42, 31), (45, 27), (51, 27), (54, 31), (54, 40)]
    c.poly([(x, y) for x, y in arch], OUTLINE)
    c.poly([(43, 40), (43, 31), (46, 28), (50, 28), (53, 31), (53, 40)], 233)
    for x in (45, 48, 51):
        c.line(x, 28, x, 36, 239)
    for y in (31, 34):
        c.line(44, y, 52, y, 239)
    # bruk i droga do bramy
    ground(c, 40, [235, 236, 237, 238])
    c.poly([(43, 40), (53, 40), (66, 47), (30, 47)], 240)
    for y in range(41, H, 3):
        for x in range((y // 3 % 2) * 4, W, 8):
            c.rect(x, y, x + 4, y + 1, 239 if 30 < x < 66 else 237)
    for x in (35, 60):            # pochodnie przy bramie, bez poświaty na murze
        c.rect(x, 30, x + 1, 34, WOOD[1])
        c.rect(x, 28, x + 1, 29, 208)
        c.px(x, 27, 226)
    for (x, base) in ((36, 47), (58, 46), (66, 47)):
        person(c, x, base, 8, 233, hood=False)
    banner(c, 12, 0, 6, RAMPS["cloth_red"]); banner(c, 82, 0, 6, RAMPS["cloth_red"])
    save(c, "ulfgrod", "Ulfgród – kamienne mury z blankami, baszty, brama z kratą i pałac ze złotym dachem o zmierzchu")


@scene
def dom_ciszy():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [233, 235, 239, 243, 247])
    hills(c, 26, 34, 239, 80, amp=2)
    ground(c, 32, [239, 241, 22, 238])
    wall = [237, 241, 245, 249, 253]
    c.cel_rect(10, 16, 86, 40, wall, line=OUTLINE, depth=2)
    for k in range(5):
        x = 16 + k * 14
        c.cel_poly([(x, 40), (x, 30), (x + 4, 24), (x + 8, 30), (x + 8, 40)], [233, 233, 235, 237, 239], line=OUTLINE, depth=1, mid=0)
    c.cel_poly([(6, 16), (48, 4), (90, 16), (86, 18), (10, 18)], [235, 237, 238, 241, 101], line=OUTLINE, depth=2)
    c.cel_rect(40, 0, 56, 10, wall, line=OUTLINE, depth=1)       # dzwonnica
    c.rect(46, 2, 50, 8, OUTLINE)
    c.ellipse(48, 6, 2, 2, RAMPS["gold"][3])
    c.line(48, 8, 48, 4, 233, 1)
    c.cel_poly([(42, 40), (42, 30), (46, 26), (50, 26), (54, 30), (54, 40)], [233, 52, 124, 166, 208], line=OUTLINE, depth=1, mid=2)
    c.rect(47, 20, 49, 24, RAMPS["gold"][3]); c.rect(46, 21, 50, 22, RAMPS["gold"][3])    # krzyż
    for x in (22, 74):
        lamp(c, x, 44, 8)
    for (x, y) in ((30, 44), (66, 45)):
        c.cel_ellipse(x, y, 5, 2, RAMPS["bone"], line=OUTLINE, depth=1)
    person(c, 38, 46, 11, 245); person(c, 58, 46, 11, 245)
    fog(c, 34, 46, 247, 0.3)
    save(c, "dom_ciszy", "Dom Ciszy – biały klasztor z dzwonnicą we mgle, zakonnice przy latarniach")
