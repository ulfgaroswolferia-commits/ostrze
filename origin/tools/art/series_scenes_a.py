"""Seria 3a: sceny 96x48 (czesc 1, alfabetycznie od bagien do odpoczynku)."""
import math
import random

from toolkit import Canvas
from palette import RAMPS, OUTLINE
from pilot_common import finish, stars
from scene_lib import *  # noqa: F401,F403
from scene_lib import M, E, R, W, H

SCENES = {}


def scene(fn):
    SCENES[fn.__name__] = fn
    return fn


def save(c, name, comment):
    finish(c, name, comment, "scene")


@scene
def bagna_szarej_wody():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [235, 22, 23, 29, 65, 108])
    hills(c, 24, 32, 233, 3, amp=2)
    for x, h in ((6, 16), (22, 12), (70, 18), (88, 13), (44, 9)):
        dead_tree(c, x, 32, h, [233, 235, 237, 239, 241])
    c.gradient_v(0, 32, W - 1, H - 1, [22, 23, 29, 66])
    rnd = random.Random(2)
    for _ in range(46):
        x, y = rnd.randrange(W), rnd.randrange(33, H)
        c.line(x, y, x + rnd.randint(2, 8), y, 108 if rnd.random() < .3 else 29)
    c.cel_poly([(0, 47), (4, 40), (20, 38), (34, 42), (30, 47)], [22, 28, 64, 106, 148], line=OUTLINE, depth=2)
    c.cel_poly([(58, 47), (64, 41), (84, 39), (96, 41), (96, 47)], [22, 28, 64, 106, 148], line=OUTLINE, depth=2)
    for x in (10, 16, 24, 70, 78, 90):
        c.line(x, 42, x + 1, 30 + x % 6, 64, 1)
        c.cel_rect(x - 1, 27 + x % 6, x + 1, 31 + x % 6, RAMPS["wood"], line=OUTLINE, depth=1)
    for k in range(6):
        c.cel_rect(36 + k * 4, 44 - k % 2, 38 + k * 4, 46 - k % 2, RAMPS["wood"], line=OUTLINE, depth=1)
    for (wx, wy) in ((46, 30), (60, 34), (30, 28)):
        glow_spot(c, wx, wy, 6, 123, 0.35)
        c.px(wx, wy, 231)
        c.glint(wx, wy, 195, 1)
    fog(c, 26, 40, 109, 0.3)
    save(c, "bagna_szarej_wody", "Bagna Szarej Wody – mgła, martwe drzewa, błędne ognie, kładka")


@scene
def bor_klusownikow():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 20, [233, 17, 53, 90, 132])
    forest(c, 30, 1, 14, [233, 234, 22, 22, 28], 10, 18)
    c.gradient_v(0, 30, W - 1, H - 1, [22, 28, 58, 94])
    forest(c, 36, 2, 8, [233, 22, 28, 28, 64], 16, 26)
    for k in range(6):  # smugi swiatla
        x0 = 20 + k * 11
        c.glow(x0, 0, x0 + 6, 40, 187, 0.07, skip=())
    hut(c, 64, 40, 18, 12, [233, 22, 28, 64, 106], [233, 22, 28, 64, 106], lit=False, door=False)
    c.poly([(62, 41), (73, 28), (84, 41)], 22)
    c.cel_poly([(62, 41), (73, 28), (84, 41)], RAMPS["wood"], line=OUTLINE, depth=2)
    c.poly([(70, 41), (73, 34), (76, 41)], 233)
    # sidla: petla na kołku
    c.line(24, 44, 24, 36, RAMPS["wood"][2], 2)
    c.line(24, 36, 34, 36, RAMPS["leather"][3], 1)
    c.ellipse(34, 40, 3, 4, 233)
    c.ellipse(34, 40, 2, 3, 94)
    c.line(34, 36, 34, 37, RAMPS["leather"][3], 1)
    conifer(c, 8, 47, 34, 15, [233, 233, 22, 22, 28], tiers=5)
    conifer(c, 90, 47, 38, 16, [233, 233, 22, 22, 28], tiers=5)
    for (x, y) in ((44, 44), (50, 46), (56, 43)):
        c.cel_ellipse(x, y, 2, 1, RAMPS["stone"], line=OUTLINE, depth=1)
    fog(c, 30, 46, 58, 0.15)
    save(c, "bor_klusownikow", "Bór kłusowników – gęsty las, smugi światła, szałas i sidła")


@scene
def gluszec():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [60, 97, 139, 181, 223])
    hills(c, 24, 34, 65, 5, amp=3)
    forest(c, 34, 6, 10, [22, 22, 28, 28, 64], 10, 18)
    c.gradient_v(0, 34, W - 1, H - 1, [22, 28, 94, 58])
    road(c, 34, (44, 52), (28, 70), (137, 94))
    for (x, h, w) in ((6, 16, 18), (28, 14, 16), (60, 18, 20), (80, 14, 14)):
        hut(c, x, 38 + (x % 3), w, h)
        smoke(c, x + w // 2, 38 - h - 6, 4, 245)
    for x in range(2, 94, 4):
        if not 30 < x < 66:
            c.rect(x, 41, x, 45, RAMPS["wood"][1])
    c.line(0, 43, 28, 43, RAMPS["wood"][2], 1)
    c.line(66, 43, 95, 43, RAMPS["wood"][2], 1)
    for (x, y) in ((88, 29), (92, 31), (84, 31)):  # cmentarz
        c.rect(x, y, x, y + 4, 233)
        c.rect(x - 1, y + 1, x + 1, y + 1, 233)
    c.ellipse(38, 44, 3, 2, 233); c.rect(41, 42, 43, 43, 233)  # pies
    save(c, "gluszec", "Głuszec – wieś przy lesie, dymy z chat, płot i cmentarz")


@scene
def kamieniolom():
    c = Canvas(W, H)
    sky(c, "day", 20)
    st = RAMPS["stone"]
    c.cel_poly([(0, 0), (30, 0), (24, 14), (18, 22), (10, 32), (0, 36)], st, line=OUTLINE, depth=2)
    c.cel_poly([(96, 0), (66, 0), (72, 12), (80, 22), (88, 30), (96, 34)], st, line=OUTLINE, depth=2)
    for k, (x0, y0, x1, y1) in enumerate(((0, 10, 24, 14), (0, 20, 14, 24), (96, 8, 74, 12), (96, 18, 82, 22), (96, 28, 90, 32))):
        c.line(x0, y0, x1, y1, st[0], 2)
    ground(c, 34, [145, 101, 241, 238])
    c.cel_poly([(0, 47), (10, 36), (86, 36), (96, 47)], [238, 241, 101, 144, 187], line=OUTLINE, depth=2)
    for (x, y, rx, ry) in ((20, 42, 5, 3), (30, 44, 3, 2), (60, 43, 6, 3), (72, 45, 3, 2), (46, 40, 4, 2)):
        rock(c, x, y, rx, ry)
    # wozek
    c.cel_poly([(38, 38), (60, 38), (58, 28), (40, 28)], RAMPS["wood"], line=OUTLINE, depth=1)
    c.cel_ellipse(43, 40, 3, 3, RAMPS["iron"], line=OUTLINE, depth=1)
    c.cel_ellipse(56, 40, 3, 3, RAMPS["iron"], line=OUTLINE, depth=1)
    for k in range(5):
        rock(c, 42 + k * 3, 27 - (k % 2), 2, 2)
    # kilof w skale
    c.line(76, 40, 70, 30, RAMPS["wood"][2], 2)
    c.poly([(66, 29), (74, 28), (72, 31)], RAMPS["metal"][4])
    person(c, 14, 40, 9, 237, hood=False); person(c, 86, 39, 9, 237, hood=False)
    c.glow(0, 24, W - 1, 44, 231, 0.10, skip=())
    save(c, "kamieniolom", "Kamieniołom – tarasy skały, wózek z gruzem, kilof, kurz")


@scene
def kapliczka_rozstaje():
    c = Canvas(W, H)
    sky(c, "dusk", 32)
    stars(c, 20, 3, 12)
    hills(c, 28, 36, 235, 4, amp=2)
    for x in (8, 18, 82, 90):
        birch(c, x, 40, 20)
    ground(c, 36, [22, 28, 94, 58])
    c.paint(M([(40, 36), (56, 36), (96, 47), (0, 47)]), 137)
    c.dither(0, 40, W - 1, 47, 137, 94, 0.3)
    c.paint(M([(44, 36), (52, 36), (60, 47), (36, 47)]), 94)
    wood = RAMPS["wood"]
    c.cel_rect(46, 18, 49, 38, wood, line=OUTLINE, depth=1)
    c.cel_rect(41, 20, 54, 30, wood, line=OUTLINE, depth=2)
    c.cel_poly([(38, 21), (47, 12), (57, 21)], [235, 237, 94, 130, 137], line=OUTLINE, depth=2)
    c.rect(44, 22, 51, 29, 233)
    c.poly([(46, 28), (49, 28), (48, 24)], 208)
    c.px(48, 25, 229)
    glow_spot(c, 48, 26, 12, 130, 0.25)
    c.line(47, 14, 47, 18, wood[3], 1); c.line(45, 16, 49, 16, wood[3], 1)
    # drogowskazy
    c.rect(72, 24, 73, 40, wood[1])
    c.cel_poly([(63, 26), (72, 26), (76, 28), (72, 30), (63, 30)], wood, line=OUTLINE, depth=1)
    c.cel_poly([(73, 32), (82, 32), (82, 36), (73, 36), (70, 34)], wood, line=OUTLINE, depth=1)
    for (x, y) in ((20, 44), (30, 46), (68, 45)):
        bush(c, x, y, 4, 2)
    save(c, "kapliczka_rozstaje", "Kapliczka na rozstajach – świeczka w kapliczce, drogowskazy, zmierzch")


@scene
def koniec():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 34, [16, 17, 18, 60, 61, 97])
    stars(c, 90, 31, 28, bright=(231, 229, 195, 153))
    for (x0, y0, x1, y1) in ((70, 4, 54, 16), (30, 2, 18, 11), (84, 14, 72, 22)):
        c.line(x0, y0, x1, y1, 231, 1)
        c.line(x0 + 1, y0 - 1, x1 + 1, y1 - 1, 195, 1)
        c.glint(x1, y1, 231, 2)
    hills(c, 34, 47, 233, 8, amp=3)
    c.poly([(0, 47), (0, 38), (24, 34), (50, 38), (70, 36), (96, 40), (96, 47)], 233)
    c.cel_poly([(0, 47), (0, 40), (24, 36), (44, 40), (60, 47)], [233, 234, 235, 22, 22], line=None, depth=1)
    person(c, 38, 38, 12, 233)
    c.px(38, 28, 231)
    save(c, "koniec", "Koniec – samotna postać na grzbiecie wzgórza, spadające gwiazdy")


@scene
def kram():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [233, 234, 17, 53, 90])
    for x in range(0, W, 8):  # rozmyte stragany w tle
        c.rect(x, 18 + (x * 3 % 7), x + 5, 34, 235)
        c.poly([(x - 1, 18 + (x * 3 % 7)), (x + 3, 14 + (x * 3 % 7)), (x + 7, 18 + (x * 3 % 7))], 237)
    c.gradient_v(0, 34, W - 1, H - 1, [233, 235, 238, 241])
    for y in range(36, H, 4):
        for x in range((y // 4 % 2) * 4, W, 8):
            c.rect(x, y, x + 3, y + 2, 239)
    wood = RAMPS["wood"]
    # zadaszenie w paski
    for i, x in enumerate(range(10, 86, 6)):
        col = RAMPS["cloth_red"] if i % 2 == 0 else RAMPS["bone"]
        c.cel_poly([(x, 6), (x + 6, 6), (x + 7, 16), (x - 1, 16)], col, line=OUTLINE, depth=1)
    c.rect(10, 6, 85, 7, OUTLINE)
    c.rect(11, 16, 11, 40, wood[0]); c.rect(84, 16, 84, 40, wood[0])
    # lada i półki
    c.cel_rect(12, 30, 83, 40, wood, line=OUTLINE, depth=2)
    for x in range(14, 82, 5):
        c.line(x, 31, x, 39, wood[1])
    c.cel_rect(12, 22, 83, 24, wood, line=OUTLINE, depth=1)
    # towary: dzbany, butelki, sukno, chleby
    for (x, col) in ((18, RAMPS["cloth_blue"]), (26, RAMPS["cloth_green"]), (34, RAMPS["cloth_red"])):
        c.cel_poly([(x, 30), (x + 6, 30), (x + 6, 26), (x, 26)], col, line=OUTLINE, depth=1)
    for x in (44, 50, 56):
        c.cel_ellipse(x, 27, 2, 3, RAMPS["leather"], line=OUTLINE, depth=1)
        c.rect(x - 1, 22, x, 23, 233)
    for x in (64, 70):
        c.cel_ellipse(x, 28, 4, 2, RAMPS["wood"], line=OUTLINE, depth=1)
    for (x, col) in ((20, 17), (30, 52), (60, 24), (74, 22)):
        c.cel_rect(x, 17, x + 2, 22, [col, col, col, col, col], line=OUTLINE, depth=1)
    c.glint(21, 18, 231, 1)
    lamp(c, 6, 40, 20); lamp(c, 89, 40, 20)
    person(c, 47, 38, 18, 233)
    save(c, "kram", "Kram kupca – pasiaste zadaszenie, towary na ladzie, latarnie")


@scene
def krater_gwiazdy():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [16, 17, 18, 24, 31])
    stars(c, 60, 5, 24)
    c.gradient_v(0, 28, W - 1, H - 1, [233, 235, 238, 241])
    c.cel_poly([(0, 47), (0, 32), (14, 28), (34, 36), (62, 36), (82, 28), (96, 32), (96, 47)], [233, 235, 238, 241, 101], line=OUTLINE, depth=2)
    c.cel_poly([(10, 47), (22, 34), (36, 40), (60, 40), (74, 34), (86, 47)], [233, 52, 88, 124, 166], line=OUTLINE, depth=2)
    glow_spot(c, 48, 38, 28, 124, 0.25)
    glow_spot(c, 48, 38, 16, 208, 0.3)
    # ostrze gwiazdy wbite w ziemie
    c.cel_poly([(46, 12), (50, 12), (51, 38), (48, 46), (45, 38)], [24, 31, 74, 117, 195], line=OUTLINE, depth=1)
    c.line(48, 14, 48, 40, 231, 1)
    c.cel_rect(42, 36, 54, 38, RAMPS["gold"], line=OUTLINE, depth=1)
    c.glint(48, 24, 231, 4)
    for (x, y) in ((40, 30), (58, 26), (36, 20), (62, 18), (48, 6)):
        c.glint(x, y, 195, 1)
    for (x, y, rx, ry) in ((16, 42, 4, 2), (30, 44, 3, 2), (70, 43, 5, 2), (84, 45, 3, 2)):
        rock(c, x, y, rx, ry, [233, 235, 238, 241, 101])
    sparks(c, 48, 14, 12, 3)
    save(c, "krater_gwiazdy", "Krater gwiazdy – ostrze z nieba wbite w rozpaloną ziemię, poświata")


@scene
def kurier_plac():
    c = Canvas(W, H)
    sky(c, "day", 26)
    for x, w, h in ((4, 20, 22), (30, 18, 18), (60, 20, 20), (84, 16, 16)):
        hut(c, x, 34, w, h)
    c.gradient_v(0, 34, W - 1, H - 1, [137, 94, 58, 94])
    c.dither(0, 36, W - 1, H - 1, 137, 94, 0.3)
    # studnia
    c.cel_ellipse(18, 40, 7, 3, RAMPS["stone"], line=OUTLINE, depth=1)
    c.rect(11, 38, 25, 40, RAMPS["stone"][2])
    c.rect(12, 28, 13, 38, RAMPS["wood"][1]); c.rect(23, 28, 24, 38, RAMPS["wood"][1])
    c.cel_poly([(10, 29), (18, 24), (26, 29)], [235, 237, 94, 130, 137], line=OUTLINE, depth=1)
    # kon z jezdzcem
    horse = RAMPS["fur_brown"]
    c.cel(E(64, 36, 12, 5) | E(56, 33, 5, 5), horse, line=OUTLINE, depth=2)
    c.cel_poly([(72, 33), (76, 25), (80, 28), (77, 38)], horse, line=OUTLINE, depth=1)
    c.cel_poly([(76, 25), (84, 27), (82, 30), (78, 29)], horse, line=OUTLINE, depth=1)
    for x in (54, 58, 68, 72):
        c.line(x, 39, x - 2, 46, 233, 2)
    c.cel_poly([(60, 31), (64, 20), (68, 31)], RAMPS["cloth_red"], line=OUTLINE, depth=1)
    c.ellipse(64, 18, 2, 2, RAMPS["skin"][3])
    c.line(60, 22, 50, 28, RAMPS["cloth_red"][4], 2)
    c.glow(34, 40, 52, 47, 231, 0.2)  # kurz
    save(c, "kurier_plac", "Plac wsi – studnia i kurier galopujący w czerwonym płaszczu")


@scene
def lesniczowka():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 22, [233, 22, 28, 64, 106])
    forest(c, 30, 7, 14, [233, 22, 28, 28, 64], 12, 20)
    c.gradient_v(0, 32, W - 1, H - 1, [22, 28, 94, 58])
    hut(c, 28, 40, 38, 18)
    c.cel_rect(52, 12, 56, 24, RAMPS["stone"], line=OUTLINE, depth=1)
    smoke(c, 54, 10, 5, 245)
    # poroże nad drzwiami
    c.line(45, 28, 41, 22, 231, 1); c.line(49, 28, 53, 22, 231, 1)
    c.line(43, 25, 40, 24, 231, 1); c.line(51, 25, 54, 24, 231, 1)
    # stos drewna
    for k in range(4):
        for j in range(5 - k):
            c.cel_ellipse(70 + j * 3 + k * 2, 44 - k * 3, 2, 2, RAMPS["wood"], line=OUTLINE, depth=1)
    c.cel_poly([(12, 44), (20, 42), (24, 46), (16, 47)], RAMPS["wood"], line=OUTLINE, depth=1)
    conifer(c, 8, 47, 36, 15, [233, 233, 22, 22, 28], tiers=5)
    conifer(c, 90, 47, 34, 14, [233, 233, 22, 22, 28], tiers=5)
    glow_spot(c, 34, 30, 8, 130, 0.2)
    fog(c, 34, 46, 58, 0.12)
    save(c, "lesniczowka", "Leśniczówka – chata z rogami nad drzwiami, stos drewna, dym")


@scene
def mapa_brod():
    c = Canvas(W, H)
    sky(c, "dusk", 22)
    forest(c, 24, 9, 12, [233, 22, 28, 28, 64], 10, 18)
    c.gradient_v(0, 24, W - 1, 33, [22, 28, 64, 58])
    c.gradient_v(0, 33, W - 1, 44, RAMPS["water"][:4])
    rnd = random.Random(10)
    for _ in range(50):
        x, y = rnd.randrange(W), rnd.randrange(34, 44)
        c.line(x, y, x + rnd.randint(2, 6), y, 117 if rnd.random() < .3 else 31)
    c.gradient_v(0, 44, W - 1, H - 1, [94, 58, 52, 58])
    for k in range(8):  # kamienie brodu
        rock(c, 14 + k * 9, 39 + (k % 2), 4, 2)
    c.cel_rect(2, 30, 6, 46, RAMPS["wood"], line=OUTLINE, depth=1)   # drogowskaz
    c.cel_poly([(6, 30), (18, 30), (22, 33), (18, 36), (6, 36)], RAMPS["wood"], line=OUTLINE, depth=1)
    c.ellipse(11, 33, 2, 2, 231); c.rect(10, 32, 10, 33, 233); c.rect(12, 32, 12, 33, 233)
    for (x, y) in ((50, 46), (56, 45), (62, 46), (68, 45)):   # slady lap
        c.ellipse(x, y, 1, 1, 52); c.px(x - 1, y - 1, 52); c.px(x + 1, y - 1, 52)
    glow_spot(c, 48, 36, 20, 117, 0.08)
    save(c, "mapa_brod", "Wilczy Bród – rzeka, kamienie brodu, drogowskaz z czaszką, ślady łap")


@scene
def menhiry():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [16, 17, 18, 60, 61])
    stars(c, 70, 11, 24)
    c.ellipse(80, 9, 5, 5, 230); c.ellipse(82, 8, 4, 4, 17)
    hills(c, 28, 36, 233, 12, amp=2)
    c.gradient_v(0, 34, W - 1, H - 1, [233, 22, 22, 28])
    st = RAMPS["stone"]
    pos = [(14, 40, 18, 7), (30, 36, 24, 8), (46, 34, 26, 9), (62, 36, 22, 8), (78, 40, 17, 7), (24, 45, 14, 6), (70, 45, 15, 6)]
    for (x, base, h, w) in sorted(pos, key=lambda p: p[1]):
        c.cel_poly([(x - w // 2, base), (x - w // 2 + 1, base - h + 3), (x, base - h), (x + w // 2 - 1, base - h + 4), (x + w // 2, base)], st, line=OUTLINE, depth=2)
        for k in range(3):
            c.px(x - 1, base - h + 6 + k * 4, 117); c.px(x, base - h + 7 + k * 4, 195); c.px(x + 1, base - h + 6 + k * 4, 117)
        glow_spot(c, x, base - h // 2, 7, 74, 0.15)
    fog(c, 38, 47, 109, 0.35)
    save(c, "menhiry", "Menhiry – krąg kamieni nocą, świecące runy, mgła")


@scene
def nagroda():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, H - 1, [233, 234, 235, 52, 58])
    glow_spot(c, 48, 24, 34, 94, 0.22)
    glow_spot(c, 48, 24, 20, 136, 0.28)
    wood, gold = RAMPS["wood"], RAMPS["gold"]
    # korpus skrzyni
    c.cel_rect(24, 26, 72, 44, wood, line=OUTLINE, depth=2)
    for x in range(26, 71, 4):
        c.line(x, 28, x, 43, wood[1])
    c.cel_rect(22, 30, 74, 34, gold, line=OUTLINE, depth=1)
    c.cel_rect(22, 40, 74, 44, gold, line=OUTLINE, depth=1)
    for x in (24, 70):
        c.cel_rect(x, 26, x + 3, 44, gold, line=OUTLINE, depth=1)
    # otwarte wieko
    c.cel_poly([(22, 26), (26, 8), (70, 8), (74, 26), (70, 24), (26, 24)], wood, line=OUTLINE, depth=2)
    c.cel_rect(26, 8, 70, 11, gold, line=OUTLINE, depth=1)
    # sterta monet
    for _ in range(0):
        pass
    c.cel_poly([(26, 26), (30, 18), (40, 14), (50, 12), (60, 15), (68, 20), (70, 26)], gold, line=OUTLINE, depth=2)
    rnd = random.Random(21)
    for _ in range(46):
        x, y = rnd.randrange(30, 66), rnd.randrange(14, 26)
        c.rect(x, y, x + 2, y + 1, gold[rnd.randint(2, 4)])
        c.px(x, y, 231 if rnd.random() < .4 else gold[4])
    # klejnoty
    for (x, y, col) in ((40, 18, 124), (56, 17, 31)):
        c.poly([(x, y - 3), (x + 3, y), (x, y + 3), (x - 3, y)], col)
        c.px(x - 1, y - 1, 231)
    # kłódka
    c.cel_rect(44, 32, 52, 40, gold, line=OUTLINE, depth=1)
    c.rect(47, 35, 48, 38, 233)
    c.rect(45, 28, 46, 32, gold[3]); c.rect(50, 28, 51, 32, gold[3]); c.rect(45, 28, 51, 29, gold[3])
    for (x, y) in ((34, 12), (62, 10), (48, 4), (20, 22), (76, 20)):
        c.glint(x, y, 231, 2)
    save(c, "nagroda", "Nagroda – otwarta skrzynia pełna złota i klejnotów, blask")


@scene
def noc_ciemnosc():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, H - 1, [16, 233, 233, 234, 52])
    forest(c, 40, 13, 14, [16, 233, 233, 234, 235], 14, 28)
    # dogasające ognisko
    for r, col, d in ((16, 52, 0.3), (10, 88, 0.4), (6, 124, 0.5)):
        for (x, y) in E(48, 42, r * 1.5, r * 0.4):
            if 0 <= x < W and 0 <= y < H and (x + y) % 2 == 0:
                c.px(x, y, col)
    c.cel_poly([(40, 44), (56, 40), (58, 43), (42, 46)], RAMPS["wood"], line=OUTLINE, depth=1)
    c.poly([(45, 43), (48, 38), (51, 43)], 124)
    c.poly([(46, 43), (48, 40), (50, 43)], 208)
    # oczy w ciemności
    rnd = random.Random(33)
    for _ in range(14):
        x, y = rnd.randrange(4, 92), rnd.randrange(14, 40)
        col = rnd.choice((220, 196, 226, 202))
        c.px(x, y, col); c.px(x + 3, y, col)
    sparks(c, 48, 36, 5, 4)
    save(c, "noc_ciemnosc", "Noc w ciemności – dogasające ognisko i świecące w mroku oczy")


@scene
def noc_istota():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 34, [16, 17, 18, 60, 61])
    stars(c, 80, 21, 28)
    # ogromna twarz z czarnego szkla nad lasem
    g = [233, 233, 17, 18, 24]
    c.cel(E(48, 18, 15, 20), g, light=(0, -1), line=OUTLINE, depth=2, mid=1)
    rnd = random.Random(7)
    for _ in range(40):
        x, y = rnd.randrange(35, 62), rnd.randrange(3, 36)
        if c.get(x, y) not in (None, OUTLINE):
            c.px(x, y, rnd.choice((231, 195, 153)))
    for ex in (42, 54):
        c.poly([(ex - 4, 14), (ex + 3, 13), (ex + 4, 17), (ex - 3, 18)], 233)
        c.glint(ex, 15, 231, 3)
    for (x, top, w) in ((24, 8, 6), (32, 2, 5), (64, 2, 5), (72, 8, 6)):
        c.cel_poly([(x - w, 24), (x, top), (x + w, 24)], RAMPS["glass"], line=OUTLINE, depth=1)
    hills(c, 34, 47, 233, 14, amp=2)
    forest(c, 40, 15, 12, [233, 233, 22, 22, 28], 12, 22)
    c.gradient_v(0, 40, W - 1, H - 1, [233, 234, 52, 58])
    fire(c, 48, 45, 0.5)
    c.cel_poly([(6, 46), (16, 36), (30, 46)], RAMPS["cloth_brown"], line=OUTLINE, depth=1)
    c.cel_poly([(66, 46), (78, 35), (92, 46)], RAMPS["cloth_brown"], line=OUTLINE, depth=1)
    glow_spot(c, 48, 42, 16, 130, 0.2)
    save(c, "noc_istota", "Noc – ogromna twarz Istoty z czarnego szkła nad obozem")


@scene
def noc_upiory():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 34, [16, 17, 18, 24, 31])
    stars(c, 40, 17, 22)
    hills(c, 30, 38, 233, 16, amp=2)
    forest(c, 38, 17, 10, [233, 233, 22, 22, 28], 14, 24)
    c.gradient_v(0, 38, W - 1, H - 1, [233, 234, 52, 58])
    fire(c, 48, 45, 0.55)
    glow_spot(c, 48, 42, 14, 130, 0.2)
    for (x, y, h) in ((16, 38, 22), (30, 34, 18), (68, 36, 20), (82, 38, 24), (52, 26, 16)):
        c.glow(0, 0, 0, 0, 0, 0)
        c.cel_poly([(x - 5, y), (x - 3, y - h + 6), (x, y - h), (x + 3, y - h + 6), (x + 5, y), (x + 2, y - 3), (x - 2, y)], [17, 24, 31, 74, 117], line=None, depth=1)
        c.poly([(x - 2, y - h + 4), (x + 2, y - h + 4), (x + 1, y - h + 7), (x - 1, y - h + 7)], 233)
        c.px(x - 1, y - h + 5, 195); c.px(x + 1, y - h + 5, 195)
        c.glow(x - 7, y - h - 1, x + 7, y, 195, 0.12, skip=())
    fog(c, 36, 47, 109, 0.3)
    save(c, "noc_upiory", "Noc upiorów – widma o lodowych oczach wynurzają się z mgły wokół obozu")


@scene
def obserwatorium():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 34, [16, 17, 18, 60, 61])
    stars(c, 80, 23, 30)
    for (x0, y0, x1, y1) in ((80, 4, 70, 12),):
        c.line(x0, y0, x1, y1, 231, 1); c.glint(x1, y1, 231, 2)
    hills(c, 34, 47, 233, 18, amp=2)
    c.cel_poly([(0, 47), (0, 38), (30, 32), (66, 32), (96, 38), (96, 47)], [233, 22, 22, 28, 64], line=OUTLINE, depth=2)
    st = RAMPS["stone"]
    c.cel_rect(34, 16, 62, 36, st, line=OUTLINE, depth=2)
    for y in range(18, 36, 4):
        for x in range(35, 62, 6):
            c.line(x + (y // 4 % 2) * 3, y, min(61, x + (y // 4 % 2) * 3 + 4), y, st[1])
    c.cel_poly([(32, 16), (36, 8), (48, 4), (60, 8), (64, 16)], RAMPS["metal"], line=OUTLINE, depth=2)
    c.rect(46, 4, 49, 16, 233)       # szczelina kopuly
    c.poly([(46, 12), (49, 12), (52, 2), (47, 0)], 233)
    # teleskop
    c.line(50, 14, 60, 2, RAMPS["gold"][3], 2)
    c.line(51, 14, 61, 2, RAMPS["gold"][1], 1)
    c.cel_rect(44, 28, 49, 36, [233, 52, 124, 166, 208], line=OUTLINE, depth=1, mid=2)
    for (x, y) in ((38, 22), (56, 22)):
        c.rect(x, y, x + 3, y + 4, OUTLINE); c.rect(x + 1, y + 1, x + 2, y + 3, 208)
    # schody
    for k in range(6):
        c.rect(40 - k * 2, 36 + k, 56 + k * 2, 36 + k, st[2 + k % 2])
    glow_spot(c, 47, 30, 12, 130, 0.15)
    save(c, "obserwatorium", "Obserwatorium – kamienna wieża z kopułą i teleskopem pod gwiazdami")


@scene
def odpoczynek():
    c = Canvas(W, H)
    wood = RAMPS["wood"]
    c.gradient_v(0, 0, W - 1, 34, [233, 234, 52, 58, 94])
    for x in range(0, W, 7):
        c.line(x, 0, x, 34, wood[0])
    c.rect(0, 34, W - 1, H - 1, wood[1])
    for y in range(36, H, 4):
        c.line(0, y, W - 1, y, wood[0])
    # okno z księżycem
    c.cel_rect(60, 6, 84, 26, [233, 17, 18, 60, 61], line=OUTLINE, depth=1, mid=2)
    c.rect(71, 6, 72, 26, wood[0]); c.rect(60, 15, 84, 16, wood[0])
    c.ellipse(66, 10, 3, 3, 230); stars(c, 6, 3, 6)
    # łóżko
    c.cel_rect(8, 28, 52, 44, wood, line=OUTLINE, depth=2)
    c.cel_rect(10, 24, 50, 34, RAMPS["bone"], line=OUTLINE, depth=1)
    c.cel_poly([(10, 32), (50, 32), (52, 44), (8, 44)], RAMPS["cloth_red"], line=OUTLINE, depth=2)
    c.cel_rect(10, 24, 22, 32, [237, 245, 249, 253, 255], line=OUTLINE, depth=1)
    for x in range(14, 50, 6):
        c.line(x, 34, x - 1, 43, RAMPS["cloth_red"][1])
    # stół ze świecą
    c.cel_rect(60, 34, 84, 37, wood, line=OUTLINE, depth=1)
    c.rect(62, 37, 63, 46, wood[0]); c.rect(81, 37, 82, 46, wood[0])
    c.cel_rect(70, 28, 73, 34, RAMPS["bone"], line=OUTLINE, depth=1)
    c.poly([(70, 28), (72, 28), (71, 24)], 220)
    c.px(71, 26, 229)
    glow_spot(c, 71, 28, 20, 130, 0.25)
    glow_spot(c, 71, 28, 10, 208, 0.25)
    c.cel_rect(86, 36, 94, 44, wood, line=OUTLINE, depth=1)
    c.rect(86, 39, 94, 40, RAMPS["gold"][2])
    save(c, "odpoczynek", "Izba na nocleg – łóżko, świeca na stole, okno z księżycem")
