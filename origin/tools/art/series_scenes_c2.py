"""Seria 3b (cd.): unikalne obrazy lokacji - czesc 2 (15 lokacji: twierdze, obozy, miasto, port, stocznia, pałac, loch)."""
import math
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


def banner(c, x, y, h, col):
    c.line(x, y, x, y + h, WOOD[2], 1)
    c.cel_poly([(x + 1, y + 1), (x + 9, y + 4), (x + 1, y + 8)], col, line=OUTLINE, depth=1)


def tent(c, x, base, w, h, col):
    c.cel_poly([(x - w, base), (x, base - h), (x + w, base)], col, line=OUTLINE, depth=2)
    c.poly([(x - 2, base), (x, base - h // 2), (x + 2, base)], 233)


@scene
def twierdza_graniczna():
    c = Canvas(W, H)
    sky(c, "day", 30)
    hills(c, 26, 34, 66, 61, amp=3)
    ground(c, 34, [28, 64, 22, 58])
    c.cel_rect(0, 22, 95, 40, ST, line=OUTLINE, depth=2)
    for x in range(0, 96, 6):
        c.cel_rect(x, 18, x + 3, 22, ST, line=OUTLINE, depth=1)
    c.cel_rect(34, 4, 62, 40, ST, line=OUTLINE, depth=2)           # donżon
    for x in range(34, 62, 6):
        c.cel_rect(x, 0, x + 3, 5, ST, line=OUTLINE, depth=1)
    for (x, y) in ((40, 12), (52, 12), (40, 24), (52, 24)):
        c.rect(x, y, x + 2, y + 5, 233)
    for x0 in (6, 80):
        c.cel_rect(x0, 8, x0 + 10, 40, ST, line=OUTLINE, depth=2)
        c.cel_poly([(x0 - 2, 8), (x0 + 5, 0), (x0 + 12, 8)], [235, 237, 94, 130, 137], line=OUTLINE, depth=1)
    banner(c, 48, -2, 10, RAMPS["cloth_red"])
    c.cel_poly([(40, 40), (40, 30), (44, 26), (52, 26), (56, 30), (56, 40)], [233, 233, 234, 235, 236], line=OUTLINE, depth=1, mid=0)
    c.line(40, 32, 56, 32, WOOD[2], 1)
    c.paint(M([(42, 47), (54, 47), (54, 40), (42, 40)]), 137)
    c.line(42, 40, 54, 40, WOOD[2], 2)
    save(c, "twierdza_graniczna", "Twierdza graniczna – potężny donżon z basztami, most i sztandar")


@scene
def oboz_jarnowian_przedni():
    c = Canvas(W, H)
    sky(c, "day", 26)
    c.gradient_v(0, 22, W - 1, 30, [24, 31, 74, 117])
    ground(c, 30, [28, 64, 106, 94])
    for k in range(3):
        c.line(0, 32 + k * 3, 95, 32 + k * 3, 94, 1)
    for x in range(0, 96, 5):    # palisada
        c.cel_poly([(x, 36), (x, 28), (x + 2, 25), (x + 4, 28), (x + 4, 36)], WOOD, line=OUTLINE, depth=1)
    for (x, base, w, h) in ((20, 44, 12, 12), (48, 46, 14, 14), (76, 44, 12, 12)):
        tent(c, x, base, w, h, RAMPS["cloth_grey"])
        banner(c, x, base - h - 8, 8, RAMPS["cloth_blue"])
    for (x, y) in ((8, 44), (88, 44)):   # stosy rusznic
        for k in range(4):
            c.line(x - 3 + k * 2, y, x + 1, y - 10, RAMPS["iron"][3], 1)
    c.cel_poly([(34, 46), (42, 42), (46, 46)], RAMPS["iron"], line=OUTLINE, depth=1)
    c.cel_ellipse(36, 46, 2, 2, RAMPS["wood"], line=OUTLINE, depth=1)
    person(c, 62, 46, 9, 233); person(c, 14, 46, 9, 233)
    save(c, "oboz_jarnowian_przedni", "Przedni obóz Jarnowian – szare namioty, niebieskie proporce, rusznice, morze")


@scene
def koszary():
    c = Canvas(W, H)
    sky(c, "dusk", 30)
    stars(c, 16, 62, 12)
    ground(c, 34, [233, 235, 238, 241])
    brick = [52, 88, 94, 130, 137]
    c.cel_rect(8, 14, 88, 40, brick, line=OUTLINE, depth=2)
    for y in range(16, 40, 3):
        for x in range(9, 88):
            if (x * 5 + y * 7) % 9 == 0:
                c.px(x, y, brick[1])
    c.cel_poly([(4, 14), (48, 2), (92, 14), (88, 16), (8, 16)], [235, 237, 238, 241, 101], line=OUTLINE, depth=2)
    for k in range(6):
        x = 14 + k * 12
        c.rect(x, 22, x + 4, 28, OUTLINE); c.rect(x + 1, 23, x + 3, 27, 208)
    c.cel_poly([(42, 40), (42, 30), (46, 26), (50, 26), (54, 30), (54, 40)], [233, 233, 52, 124, 166], line=OUTLINE, depth=1, mid=1)
    for x in (30, 66):
        c.rect(x, 28, x, 34, WOOD[1])
        c.poly([(x - 1, 27), (x + 1, 27), (x, 24)], 220)
        glow_spot(c, x, 28, 7, 130, 0.2)
    banner(c, 48, -2, 8, RAMPS["cloth_red"])
    person(c, 36, 46, 11, 233); person(c, 60, 46, 11, 233)
    c.line(36, 46, 36, 34, RAMPS["metal"][3], 1); c.line(60, 46, 60, 34, RAMPS["metal"][3], 1)
    save(c, "koszary", "Koszary miejskie – ceglany gmach, pochodnie, straż z włóczniami o zmierzchu")


@scene
def targ_pod_murem():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [233, 17, 53, 90, 132])
    c.cel_rect(0, 8, 95, 34, ST, line=OUTLINE, depth=2)
    for y in range(10, 34, 4):
        for x in range(0, 96, 8):
            c.line(x + (y // 4 % 2) * 4, y, x + (y // 4 % 2) * 4 + 6, y, ST[1])
    for x in range(0, 96, 8):
        c.cel_rect(x, 4, x + 4, 8, ST, line=OUTLINE, depth=1)
    ground(c, 34, [233, 235, 238, 241])
    for y in range(36, H, 4):
        for x in range((y // 4 % 2) * 4, W, 8):
            c.rect(x, y, x + 3, y + 2, 239)
    cols = (RAMPS["cloth_red"], RAMPS["cloth_blue"], RAMPS["cloth_green"], RAMPS["cloth_brown"])
    for k, x in enumerate(range(6, 90, 21)):
        c.cel_poly([(x, 24), (x + 18, 24), (x + 20, 30), (x - 2, 30)], cols[k % 4], line=OUTLINE, depth=1)
        c.cel_rect(x, 30, x + 18, 40, WOOD, line=OUTLINE, depth=1)
        for j in range(3):
            c.cel_ellipse(x + 4 + j * 5, 29, 1, 1, RAMPS["gold"], line=None, depth=1)
        lamp(c, x + 20, 40, 6)
    for (x, base, h) in ((20, 46, 11), (44, 46, 10), (66, 46, 12), (84, 46, 10)):
        person(c, x, base, h, 233)
    save(c, "targ_pod_murem", "Targ Pod Murem – stragany pod kamiennym murem, latarnie, tłum o zmierzchu")


@scene
def kuznie():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, H - 1, [233, 234, 235, 52, 58])
    c.cel_rect(0, 6, 95, 12, WOOD, line=OUTLINE, depth=1)
    for x in range(8, 96, 20):
        c.cel_rect(x, 6, x + 3, 40, WOOD, line=OUTLINE, depth=1)
    c.cel_poly([(10, 44), (14, 22), (40, 22), (44, 44)], ST, line=OUTLINE, depth=2)       # palenisko
    c.poly([(18, 36), (22, 26), (32, 26), (36, 36)], 233)
    fire(c, 27, 36, 0.8)
    glow_spot(c, 27, 30, 26, 166, 0.25)
    glow_spot(c, 27, 30, 14, 208, 0.25)
    c.cel_poly([(56, 40), (60, 34), (84, 34), (88, 40), (82, 46), (62, 46)], RAMPS["iron"], line=OUTLINE, depth=2)   # kowadło
    c.cel_rect(66, 28, 80, 34, RAMPS["iron"], line=OUTLINE, depth=1)
    c.line(72, 24, 78, 12, WOOD[2], 2); c.cel_rect(70, 22, 82, 26, RAMPS["iron"], line=OUTLINE, depth=1)
    for k in range(6):
        c.line(48 + k * 4, 14, 48 + k * 4, 26 + k % 2 * 3, RAMPS["metal"][3 + k % 2], 1)
    sparks(c, 74, 30, 12, 8)
    c.glint(70, 32, 229, 2)
    c.gradient_v(0, 44, W - 1, H - 1, [233, 52, 58])
    save(c, "kuznie", "Kuźnie wyspiarzy – żarzące się palenisko, kowadło, młot, snop iskier")


@scene
def karczma_ulfgrod():
    c = Canvas(W, H)
    sky(c, "dusk", 30)
    stars(c, 24, 63, 12)
    ground(c, 36, [233, 235, 238, 241])
    for y in range(38, H, 4):
        for x in range((y // 4 % 2) * 4, W, 8):
            c.rect(x, y, x + 3, y + 2, 239)
    c.cel_rect(10, 24, 86, 40, ST, line=OUTLINE, depth=2)          # parter z kamienia
    c.cel_rect(12, 8, 84, 24, WOOD, line=OUTLINE, depth=2)         # piętro szachulcowe
    for x in range(14, 84, 10):
        c.line(x, 8, x, 24, 233, 1)
    c.line(12, 16, 84, 16, 233, 1)
    c.cel_poly([(6, 10), (48, -2), (90, 10), (84, 12), (12, 12)], [235, 237, 94, 130, 137], line=OUTLINE, depth=2)
    for x in range(18, 82, 14):
        c.rect(x, 13, x + 5, 20, OUTLINE); c.rect(x + 1, 14, x + 4, 19, 208); c.glint(x + 2, 15, 229, 1)
    for x in (18, 62):
        c.rect(x, 28, x + 8, 34, OUTLINE); c.rect(x + 1, 29, x + 7, 33, 208); c.dither(x + 1, 29, x + 7, 33, 208, 220, 0.4)
    c.cel_poly([(40, 40), (40, 30), (44, 26), (52, 26), (56, 30), (56, 40)], [233, 52, 124, 166, 208], line=OUTLINE, depth=1, mid=2)
    c.cel_rect(70, 22, 80, 30, WOOD, line=OUTLINE, depth=1)       # szyld
    c.ellipse(75, 26, 2, 2, RAMPS["gold"][3])
    for x in (30, 66):
        lamp(c, x, 40, 8)
    person(c, 12, 46, 11, 233); person(c, 84, 46, 11, 233)
    glow_spot(c, 48, 42, 20, 130, 0.15)
    save(c, "karczma_ulfgrod", "Karczma w Ulfgrodzie – kamienny parter, piętro szachulcowe, ciepłe okna, bruk")


@scene
def karczma_stoczniowa():
    c = Canvas(W, H)
    sky(c, "dusk", 24)
    stars(c, 20, 64, 10)
    c.gradient_v(0, 24, W - 1, 34, [235, 24, 31, 66])
    for x in range(0, W, 6):
        c.line(x, 28 + x // 6 % 2, x + 4, 28 + x // 6 % 2, 110)
    c.cel_rect(0, 34, 95, 38, WOOD, line=OUTLINE, depth=1)       # pomost
    for x in range(2, 96, 8):
        c.rect(x, 38, x + 1, 47, WOOD[0])
    for (x, h) in ((74, 28), (88, 22)):                           # maszty
        c.line(x, 34, x, 34 - h, WOOD[2], 2)
        c.line(x - 8, 34 - h + 8, x + 8, 34 - h + 8, WOOD[2], 1)
        c.cel_poly([(x - 8, 34 - h + 8), (x + 8, 34 - h + 8), (x + 4, 34 - h + 18), (x - 4, 34 - h + 18)], RAMPS["bone"], line=OUTLINE, depth=1)
    hut(c, 8, 34, 44, 20, WOOD, [235, 237, 238, 241, 101], lit=True)
    for x in (16, 34):
        c.rect(x, 22, x + 5, 28, OUTLINE); c.rect(x + 1, 23, x + 4, 27, 208); c.glint(x + 2, 24, 229, 1)
    lamp(c, 56, 40, 12)
    for (x, y) in ((60, 44), (66, 45)):
        c.cel_ellipse(x, y, 3, 3, WOOD, line=OUTLINE, depth=1)
    c.cel_rect(24, 36, 36, 40, WOOD, line=OUTLINE, depth=1)
    glow_spot(c, 30, 30, 24, 130, 0.15)
    save(c, "karczma_stoczniowa", "Karczma stoczniowa – nad pomostem, maszty, beczki, ciepłe okna o zmierzchu")


@scene
def palac():
    c = Canvas(W, H)
    sky(c, "dusk", 30)
    stars(c, 14, 65, 10)
    hills(c, 30, 38, 235, 66, amp=2)
    ground(c, 36, [233, 235, 238, 241])
    pal = RAMPS["bone"]
    c.cel_rect(8, 18, 88, 40, pal, line=OUTLINE, depth=2)
    for k in range(7):
        c.cel_rect(12 + k * 11, 22, 16 + k * 11, 40, pal, line=OUTLINE, depth=1)
    c.cel_rect(36, 6, 60, 40, pal, line=OUTLINE, depth=2)
    for (cx, w, h) in ((48, 14, 10), (14, 8, 6), (82, 8, 6)):     # złote kopuły
        c.cel(E(cx, 6 if cx == 48 else 16, w, h), RAMPS["gold"], light=TOP if False else (-1, -1), line=OUTLINE, depth=2)
        c.line(cx, (6 if cx == 48 else 16) - h, cx, (6 if cx == 48 else 16) - h - 5, RAMPS["gold"][3], 1)
    for (x, y) in ((44, 14), (50, 14), (44, 24), (50, 24)):
        c.rect(x, y, x + 2, y + 6, OUTLINE); c.rect(x + 1, y + 1, x + 1, y + 5, 208)
    c.cel_poly([(42, 40), (42, 32), (46, 28), (50, 28), (54, 32), (54, 40)], [233, 52, 124, 166, 208], line=OUTLINE, depth=1, mid=1)
    for k in range(7):
        c.rect(30 - k * 2, 40 + k, 66 + k * 2, 40 + k, pal[2 + k % 2])
    for x in (8, 84):
        banner(c, x, 4, 12, RAMPS["cloth_red"])
    person(c, 40, 41, 8, 233, hood=False); person(c, 56, 41, 8, 233, hood=False)
    glow_spot(c, 48, 30, 30, 187, 0.08)
    save(c, "palac", "Pałac cesarski – biała fasada ze złotymi kopułami, schody, straż, czerwone sztandary")


@scene
def stocznia():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [60, 97, 139, 181, 223, 230])
    c.gradient_v(0, 28, W - 1, 38, [24, 31, 74, 117])
    ground(c, 38, [94, 137, 94, 58])
    c.cel_poly([(14, 40), (18, 26), (74, 26), (86, 34), (80, 40), (20, 46)], WOOD, line=OUTLINE, depth=2)
    for k in range(10):
        c.line(24 + k * 6, 28, 24 + k * 6, 44, WOOD[1], 1)
    for x in (18, 44, 70):
        c.line(x, 10, x - 6, 40, WOOD[2], 2); c.line(x, 10, x + 6, 40, WOOD[2], 2)
    c.line(14, 12, 80, 12, WOOD[2], 2)
    c.line(44, 12, 44, 24, 241, 1)
    c.cel_rect(41, 24, 47, 28, RAMPS["iron"], line=OUTLINE, depth=1)
    c.cel_rect(2, 30, 10, 46, WOOD, line=OUTLINE, depth=1)
    for (x, y) in ((88, 40), (84, 44), (90, 45)):
        c.cel_ellipse(x, y, 3, 3, WOOD, line=OUTLINE, depth=1)
    person(c, 30, 46, 9, 233); person(c, 58, 46, 9, 233)
    c.glow(0, 4, W - 1, 28, 231, 0.06, skip=())
    save(c, "stocznia", "Stocznia – kadłub na stoczni, rusztowania, żuraw, poranek")


@scene
def ruiny_stacji():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [16, 17, 18, 24, 31])
    stars(c, 60, 67, 22)
    ground(c, 32, [233, 235, 238, 22])
    metal = RAMPS["metal"]
    for (x, h, w) in ((10, 20, 4), (24, 30, 4), (60, 26, 4), (80, 34, 4)):    # żebra konstrukcji
        c.cel_poly([(x, 40), (x + 2, 40 - h), (x + w, 40 - h + 2), (x + w + 2, 40)], metal, line=OUTLINE, depth=1)
    c.cel(E(46, 30, 22, 14), [17, 24, 31, 74, 117], light=(-1, -1), line=OUTLINE, depth=2)     # kopuła ze szkła
    for (x0, y0, x1, y1) in ((36, 22, 44, 36), (54, 20, 60, 34), (46, 18, 48, 40)):
        c.line(x0, y0, x1, y1, 233, 1)
    c.poly([(54, 28), (62, 24), (60, 34)], 233)
    glow_spot(c, 46, 30, 22, 74, 0.15)
    leaf = RAMPS["leaf"]
    for x in range(6, 90, 7):
        for i in range(4):
            c.px(x + i % 2, 40 - i, leaf[1 + i % 3])
    for (x, y, rx, ry) in ((6, 45, 4, 2), (40, 46, 5, 2), (88, 45, 4, 2)):
        rock(c, x, y, rx, ry, [233, 235, 238, 241, 101])
    c.glint(40, 24, 231, 2)
    save(c, "ruiny_stacji", "Ruiny stacji – żebra konstrukcji i pęknięta szklana kopuła, zarośnięte")


@scene
def loch_pod_palacem():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, H - 1, [233, 233, 234, 235, 237])
    for k in range(4):   # sklepienia
        x = k * 26 - 4
        c.cel_poly([(x, 40), (x, 20), (x + 14, 8), (x + 28, 20), (x + 28, 40)], ST, line=OUTLINE, depth=2)
        c.cel_poly([(x + 5, 40), (x + 5, 24), (x + 14, 16), (x + 23, 24), (x + 23, 40)], [233, 233, 233, 234, 235], line=OUTLINE, depth=1, mid=0)
    c.gradient_v(0, 40, W - 1, H - 1, [233, 235, 238, 241])
    gold = RAMPS["gold"]
    for (x0, y0, x1, y1) in ((10, 8, 34, 42), (36, 6, 56, 44), (70, 8, 62, 42), (88, 10, 74, 44)):   # kable
        c.line(x0, y0, x1, y1, gold[1], 1); c.line(x0 + 1, y0, x1 + 1, y1, gold[3], 1)
    c.cel_poly([(40, 44), (42, 26), (54, 26), (56, 44)], RAMPS["iron"], line=OUTLINE, depth=1)     # słup rdzenia
    c.cel_ellipse(48, 22, 7, 7, RAMPS["gold"], line=OUTLINE, depth=1)
    c.ellipse(48, 22, 3, 3, 229)
    glow_spot(c, 48, 22, 26, 136, 0.2)
    glow_spot(c, 48, 22, 12, 220, 0.25)
    c.glint(48, 22, 231, 3)
    lamp(c, 10, 44, 14); lamp(c, 86, 44, 14)
    for (x, y, rx, ry) in ((20, 46, 5, 2), (74, 46, 4, 2)):
        rock(c, x, y, rx, ry)
    save(c, "loch_pod_palacem", "Loch pod pałacem – kamienne sklepienia, złote kable i świecący rdzeń")


@scene
def oboz_cesarski_przedni():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [16, 17, 18, 60, 61])
    stars(c, 40, 68, 20)
    hills(c, 28, 36, 233, 69, amp=2)
    ground(c, 34, [233, 235, 52, 58])
    for (x, base, w, h) in ((16, 44, 14, 14), (48, 46, 16, 16), (80, 44, 14, 14)):
        tent(c, x, base, w, h, RAMPS["cloth_red"])
        banner(c, x, base - h - 8, 8, RAMPS["cloth_red"])
    for (x, y) in ((30, 44), (66, 45)):
        fire(c, x, y, 0.45)
        glow_spot(c, x, y - 4, 12, 130, 0.2)
    c.cel_poly([(34, 34), (40, 30), (52, 30), (58, 34), (56, 38), (36, 38)], WOOD, line=OUTLINE, depth=1)   # machina oblężnicza
    c.line(46, 30, 52, 18, WOOD[2], 2); c.cel_ellipse(53, 17, 3, 3, ST, line=OUTLINE, depth=1)
    person(c, 38, 46, 9, 233); person(c, 72, 46, 9, 233)
    save(c, "oboz_cesarski_przedni", "Przedni obóz cesarski – czerwone namioty i proporce, ogniska, machina oblężnicza")


@scene
def oboz_hetmana():
    c = Canvas(W, H)
    sky(c, "dusk", 24)
    stars(c, 16, 70, 10)
    c.gradient_v(0, 22, W - 1, 32, [235, 24, 31, 66])
    ground(c, 32, [233, 22, 94, 58])
    c.cel_poly([(18, 44), (26, 14), (48, 4), (70, 14), (78, 44)], RAMPS["fur_brown"], line=OUTLINE, depth=2)   # wielki namiot
    c.cel_poly([(40, 44), (42, 26), (54, 26), (56, 44)], [233, 52, 124, 166, 208], line=OUTLINE, depth=1, mid=2)
    for k in range(5):
        c.line(24 + k * 10, 40, 32 + k * 8, 14, WOOD[1], 1)
    banner(c, 48, -4, 12, RAMPS["cloth_blue"])
    for x in (12, 84):
        fire(c, x, 44, 0.45); glow_spot(c, x, 40, 12, 130, 0.2)
    for (x, base) in ((8, 46), (30, 47), (66, 47), (90, 46)):
        person(c, x, base, 10, 233)
    c.line(86, 30, 86, 46, WOOD[2], 2); c.cel_poly([(86, 30), (94, 33), (86, 36)], RAMPS["cloth_blue"], line=OUTLINE, depth=1)
    save(c, "oboz_hetmana", "Obóz hetmana – futrzany namiot z sztandarem, ogniska nad zatoką")


@scene
def przeprawa_szarej():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 24, [239, 243, 247, 250, 253])
    hills(c, 20, 28, 241, 71, amp=2)
    forest(c, 28, 72, 12, [233, 233, 22, 22, 28], 10, 18)
    c.gradient_v(0, 28, W - 1, H - 1, [238, 241, 144, 187])
    c.gradient_v(0, 30, W - 1, 42, [235, 239, 243, 247])
    rnd = random.Random(73)
    for _ in range(30):
        x, y = rnd.randrange(W), rnd.randrange(32, 42)
        c.line(x, y, x + rnd.randint(2, 6), y, 250)
    c.cel_rect(0, 26, 30, 30, WOOD, line=OUTLINE, depth=1)        # zerwany most
    c.cel_rect(66, 26, 95, 30, WOOD, line=OUTLINE, depth=1)
    c.line(30, 28, 36, 34, WOOD[1], 1); c.line(66, 28, 62, 34, WOOD[1], 1)
    c.line(2, 18, 93, 22, 241, 1)                                  # lina promu
    c.cel_poly([(34, 40), (38, 36), (62, 36), (66, 40), (60, 43), (40, 43)], WOOD, line=OUTLINE, depth=2)
    person(c, 50, 36, 9, 233)
    c.line(62, 40, 74, 46, WOOD[2], 2)
    save(c, "przeprawa_szarej", "Przeprawa przez Szarą – zerwany most, prom na linie i szara woda")


@scene
def port_rzeczny():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 28, [60, 97, 139, 181, 223, 230])
    hills(c, 22, 30, 66, 74, amp=2)
    c.gradient_v(0, 28, W - 1, 40, [24, 31, 74, 117])
    rnd = random.Random(75)
    for _ in range(26):
        x, y = rnd.randrange(W), rnd.randrange(30, 40)
        c.line(x, y, x + rnd.randint(2, 6), y, 117)
    ground(c, 38, [94, 137, 94, 58])
    c.cel_rect(0, 36, 95, 40, WOOD, line=OUTLINE, depth=1)
    for x in range(3, 96, 8):
        c.rect(x, 40, x + 1, 47, WOOD[0])
    for (x, w) in ((12, 18), (60, 20)):
        c.cel_poly([(x, 36), (x + 2, 28), (x + w - 2, 28), (x + w, 36)], WOOD, line=OUTLINE, depth=2)
        c.line(x + w // 2, 28, x + w // 2, 14, WOOD[2], 2)
        c.line(x + w // 2 - 4, 18, x + w // 2 + 4, 18, WOOD[2], 1)
    c.line(86, 36, 86, 12, WOOD[2], 2); c.line(86, 12, 74, 14, WOOD[2], 2); c.line(74, 14, 74, 24, 241, 1)   # dźwig
    c.cel_rect(70, 24, 78, 30, WOOD, line=OUTLINE, depth=1)
    for (x, y) in ((40, 46), (46, 46), (52, 45)):
        c.cel_ellipse(x, y, 3, 3, WOOD, line=OUTLINE, depth=1)
    c.cel_rect(34, 30, 50, 34, WOOD, line=OUTLINE, depth=1)
    person(c, 28, 40, 9, 233)
    save(c, "port_rzeczny", "Port rzeczny – drewniane pomosty, łodzie, żuraw i beczki o poranku")
