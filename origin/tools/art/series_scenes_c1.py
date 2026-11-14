"""Seria 3b (cd.): unikalne obrazy lokacji, ktore dotad dzielily cudza grafike - czesc 1 (16 lokacji)."""
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


@scene
def ostoja_zbojcow():
    c = Canvas(W, H)
    sky(c, "dusk", 24)
    stars(c, 20, 81, 12)
    c.cel_poly([(0, 47), (0, 14), (20, 6), (40, 12), (56, 8), (76, 14), (96, 10), (96, 47)], ST, line=OUTLINE, depth=3)
    c.cel_poly([(30, 47), (32, 28), (40, 22), (56, 22), (64, 28), (66, 47)], [233, 233, 52, 124, 166], line=OUTLINE, depth=2, mid=0)
    glow_spot(c, 48, 36, 20, 166, 0.25)
    fire(c, 48, 44, 0.7)
    for x in range(6, 90, 7):    # palisada
        if not 28 < x < 68:
            c.cel_poly([(x, 46), (x, 30), (x + 2, 26), (x + 4, 30), (x + 4, 46)], WOOD, line=OUTLINE, depth=1)
    for (x, y) in ((20, 34), (76, 34)):    # czaszki na palach
        c.line(x, 46, x, y + 3, WOOD[2], 1)
        c.ellipse(x, y, 2, 2, 231)
        c.px(x - 1, y, 233); c.px(x + 1, y, 233)
    person(c, 40, 46, 11, 233); person(c, 58, 46, 11, 233)
    save(c, "ostoja_zbojcow", "Ostoja zbójców – skalna jaskinia z ogniskiem, palisada, czaszki na palach")


@scene
def ruiny_fortu():
    c = Canvas(W, H)
    sky(c, "dusk", 30)
    stars(c, 14, 82, 12)
    hills(c, 28, 36, 235, 51, amp=2)
    ground(c, 34, [22, 28, 64, 58])
    c.cel_poly([(0, 40), (0, 22), (14, 18), (24, 26), (30, 40)], ST, line=OUTLINE, depth=2)
    c.cel_poly([(60, 40), (62, 14), (72, 10), (84, 20), (96, 16), (96, 40)], ST, line=OUTLINE, depth=2)
    c.cel_rect(36, 28, 56, 40, ST, line=OUTLINE, depth=1)
    c.poly([(34, 40), (36, 26), (40, 32)], 233)
    c.line(24, 8, 24, 30, WOOD[2], 2)
    c.cel_poly([(25, 9), (37, 14), (28, 20), (32, 24), (25, 25)], RAMPS["cloth_red"], line=OUTLINE, depth=1)
    for (x, y, rx, ry) in ((14, 44, 6, 3), (36, 45, 5, 2), (50, 44, 7, 3), (78, 45, 5, 2)):
        rock(c, x, y, rx, ry)
    for x in range(0, 96, 4):
        c.px(x, 40 + (x % 5), 106)
    leaf = RAMPS["leaf"]
    for (x, y, h) in ((8, 22, 12), (66, 16, 14), (90, 20, 12)):
        for i in range(h):
            c.px(x + (i % 3 == 0), y + i, leaf[1 + i % 3])
    fog(c, 36, 46, 109, 0.12)
    save(c, "ruiny_fortu", "Ruiny fortu granicznego – zawalone mury, poszarpany sztandar, bluszcz")


@scene
def jar_dezerterow():
    c = Canvas(W, H)
    sky(c, "day", 12)
    c.cel_poly([(0, 0), (30, 0), (26, 14), (22, 26), (16, 38), (0, 47)], [22, 28, 94, 130, 137], line=OUTLINE, depth=3)
    c.cel_poly([(96, 0), (66, 0), (70, 14), (74, 26), (80, 38), (96, 47)], [22, 28, 94, 130, 137], line=OUTLINE, depth=3)
    ground(c, 24, [22, 28, 94, 58])
    c.gradient_v(30, 34, 66, 47, RAMPS["water"][:4])
    c.line(32, 36, 64, 36, 117, 1)
    conifer(c, 12, 28, 22, 12, [233, 22, 28, 28, 64]); conifer(c, 84, 28, 22, 12, [233, 22, 28, 28, 64])
    for (x, base, col) in ((36, 40, RAMPS["cloth_brown"]), (52, 41, RAMPS["cloth_grey"]), (68, 40, RAMPS["cloth_brown"])):
        c.cel_poly([(x - 8, base), (x, base - 12), (x + 8, base)], col, line=OUTLINE, depth=1)
    fire(c, 44, 44, 0.5); smoke(c, 44, 30, 4, 245)
    person(c, 30, 44, 9, 233); person(c, 60, 44, 9, 233)
    for x in range(20, 80, 4):
        c.px(x, 43 + (x % 3), 64)
    save(c, "jar_dezerterow", "Jar Dezerterów – wąwóz ze strumieniem, ukryte namioty i ogniska")


@scene
def stare_wodociagi():
    c = Canvas(W, H)
    sky(c, "dusk", 32)
    stars(c, 16, 83, 12)
    ground(c, 34, [22, 28, 58, 94])
    for k in range(5):
        x = 6 + k * 20
        c.cel_rect(x, 8, x + 5, 38, ST, line=OUTLINE, depth=1)
        c.cel_poly([(x + 5, 38), (x + 5, 26), (x + 10, 20), (x + 15, 26), (x + 15, 38)], [233, 233, 234, 235, 236], line=OUTLINE, depth=1, mid=0)
    c.cel_rect(0, 6, 95, 12, ST, line=OUTLINE, depth=2)
    c.rect(0, 9, 95, 10, RAMPS["water"][3])
    for x in range(0, 96, 5):
        c.line(x, 12, x - 1, 22, RAMPS["water"][2], 1)
    leaf = RAMPS["leaf"]
    for x in range(8, 96, 9):
        for i in range(5):
            c.px(x + i % 2, 12 + i, leaf[2 + i % 3])
    c.gradient_v(0, 38, W - 1, H - 1, RAMPS["water"][:4])
    for (x, y, rx, ry) in ((12, 44, 4, 2), (44, 45, 5, 2), (80, 44, 4, 2)):
        rock(c, x, y, rx, ry)
    fog(c, 28, 44, 109, 0.12)
    save(c, "stare_wodociagi", "Stare wodociągi – kamienne łuki akweduktu, woda w korycie, mech")


@scene
def wraki_floty():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 28, [239, 243, 247, 250, 253])
    c.gradient_v(0, 26, W - 1, 38, [235, 31, 24, 66])
    c.gradient_v(0, 38, W - 1, H - 1, [101, 144, 238, 241])
    rnd = random.Random(52)
    for _ in range(20):
        x, y = rnd.randrange(W), rnd.randrange(28, 38)
        c.line(x, y, x + rnd.randint(2, 7), y, 110)
    for (x, base, w, h, flip) in ((18, 40, 26, 12, 1), (58, 42, 30, 14, -1)):   # szkielety kadlubow
        c.cel_poly([(x - w, base), (x - w + 4, base - h), (x + w - 6, base - h + 2), (x + w, base)], WOOD, line=OUTLINE, depth=2)
        for k in range(-w + 4, w - 4, 5):
            c.line(x + k, base - h + 3, x + k + 1, base - 1, 233, 1)
        c.line(x - 2, base - h, x + flip * 2, base - h - 20, WOOD[2], 2)
        c.cel_poly([(x + flip * 2, base - h - 18), (x + flip * 2 + 10, base - h - 14), (x + flip * 2, base - h - 10)], RAMPS["cloth_grey"], line=OUTLINE, depth=1)
    for (x, y, rx, ry) in ((8, 45, 4, 2), (40, 46, 5, 2), (86, 45, 4, 2)):
        rock(c, x, y, rx, ry)
    for (x, y) in ((8, 6), (76, 8), (50, 4)):
        crow(c, x, y)
    fog(c, 24, 40, 247, 0.3)
    save(c, "wraki_floty", "Wraki floty – szkielety kadłubów i maszty na szarej plaży we mgle")


@scene
def spalona_osada():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 32, [233, 235, 237, 52, 88, 124])
    hills(c, 28, 36, 233, 53, amp=2)
    ground(c, 34, [233, 235, 238, 52])
    for (x, w, h) in ((6, 22, 14), (36, 20, 12), (66, 24, 16)):
        c.cel_rect(x, 38 - h, x + 2, 40, [233, 233, 235, 237, 239], line=OUTLINE, depth=1)
        c.cel_rect(x + w, 38 - h + 4, x + w + 2, 40, [233, 233, 235, 237, 239], line=OUTLINE, depth=1)
        c.line(x, 38 - h, x + w // 2, 38 - h - 8, 233, 2)
        c.line(x + w + 2, 38 - h + 4, x + w // 2 + 2, 38 - h - 8, 233, 2)
        c.rect(x, 40, x + w + 2, 44, 52)
        c.glow(x, 38, x + w + 2, 46, 166, 0.35)
        smoke(c, x + w // 2, 28 - h // 2, 5, 241)
    for (x, y) in ((22, 44), (50, 45), (60, 44), (88, 45)):
        c.poly([(x - 3, y), (x, y - 3), (x + 3, y)], 124)
        c.px(x, y - 1, 208)
    for x in range(0, 96, 6):
        c.px(x, 46 - (x % 4), 245)
    fog(c, 20, 40, 243, 0.25)
    save(c, "spalona_osada", "Spalona osada – zwęglone szkielety chat, żar i dym")


@scene
def pole_bitwy():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [233, 52, 88, 124, 167, 216])
    hills(c, 26, 34, 235, 54, amp=3)
    ground(c, 32, [235, 238, 94, 58])
    for k in range(14):   # wbite włócznie rzędami
        x = 6 + k * 7
        c.line(x, 44 - k % 3, x + (k % 3 - 1), 28 - k % 4, WOOD[2], 1)
        c.px(x + (k % 3 - 1), 27 - k % 4, RAMPS["metal"][4])
    for (x, y, w) in ((20, 42, 8), (60, 44, 10), (84, 41, 7)):    # kopce
        c.cel_poly([(x - w, y + 3), (x - w // 2, y - 3), (x + w // 2, y - 3), (x + w, y + 3)], [233, 235, 238, 241, 94], line=OUTLINE, depth=1)
    c.cel_rect(38, 36, 52, 44, WOOD, line=OUTLINE, depth=1)    # wywrócony wóz
    c.cel_ellipse(36, 42, 5, 5, RAMPS["iron"], line=OUTLINE, depth=1)
    c.line(52, 36, 62, 30, WOOD[2], 2)
    for (x, y) in ((10, 6), (18, 10), (70, 7), (78, 11), (46, 5), (88, 9)):
        crow(c, x, y)
    fog(c, 34, 46, 243, 0.18)
    save(c, "pole_bitwy", "Pole sprzed trzech dni – rzędy wbitych włóczni, kopce, wóz, kruki na czerwonym niebie")


@scene
def spalona_wies():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 24, [233, 235, 237, 239, 243])
    c.gradient_v(0, 24, W - 1, 34, [235, 31, 24, 66])
    for x in range(0, W, 6):
        c.line(x, 28 + (x // 6 % 2), x + 4, 28 + (x // 6 % 2), 110)
    ground(c, 34, [238, 241, 94, 58])
    for (x, w, h) in ((10, 20, 12), (44, 22, 14), (76, 16, 10)):
        c.cel_rect(x, 40 - h, x + 2, 42, [233, 233, 235, 237, 239], line=OUTLINE, depth=1)
        c.cel_rect(x + w, 40 - h, x + w + 2, 42, [233, 233, 235, 237, 239], line=OUTLINE, depth=1)
        c.line(x, 40 - h, x + w + 2, 40 - h, 233, 2)
        c.glow(x, 38, x + w + 2, 46, 166, 0.25)
    c.cel_poly([(28, 44), (40, 44), (44, 40), (24, 40)], [233, 233, 235, 237, 239], line=OUTLINE, depth=1)   # spalona łódź
    c.line(34, 40, 34, 30, 233, 1)
    smoke(c, 20, 30, 5, 241); smoke(c, 56, 28, 6, 241)
    for (x, y) in ((16, 44), (52, 45), (84, 44)):
        c.px(x, y, 208); c.px(x + 1, y, 166)
    fog(c, 26, 42, 247, 0.2)
    save(c, "spalona_wies", "Skjeldowo – pogorzelisko nad morzem, zwęglone łodzie")


@scene
def cmentarz_zbiorowy():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [233, 235, 237, 239, 243])
    hills(c, 26, 34, 239, 55, amp=2)
    ground(c, 32, [239, 241, 22, 238])
    for row in range(3):
        y = 36 + row * 4
        for k in range(9):
            x = 8 + k * 10 + (row * 5) % 10
            c.cel_rect(x, y - 6 + row, x + 1, y + 2, WOOD, line=None, depth=1)
            c.rect(x - 2, y - 4 + row, x + 3, y - 4 + row, WOOD[3])
            c.poly([(x - 3, y + 3), (x, y + 1), (x + 3, y + 3)], 238)
    lamp(c, 82, 44, 12)
    person(c, 24, 46, 11, 233)
    c.line(20, 46, 20, 38, RAMPS["wood"][2], 1)
    c.poly([(18, 38), (22, 38), (20, 36)], RAMPS["metal"][3])
    for (x, y) in ((10, 8), (60, 6)):
        crow(c, x, y)
    fog(c, 28, 46, 247, 0.3)
    save(c, "cmentarz_zbiorowy", "Cmentarz zbiorowy – rzędy krzyży we mgle, grabarz z łopatą, latarnia")


@scene
def cmentarz_lodzi():
    c = Canvas(W, H)
    sky(c, "dusk", 28)
    stars(c, 24, 91, 14)
    c.gradient_v(0, 26, W - 1, 34, [235, 24, 31, 66])
    ground(c, 34, [238, 241, 144, 187])
    for (x, y, w) in ((10, 40, 10), (30, 44, 12), (52, 40, 11), (74, 44, 12)):
        c.cel_poly([(x - w, y), (x - w + 3, y - 7), (x + w - 3, y - 7), (x + w, y)], WOOD, line=OUTLINE, depth=2)   # odwrócona łódź = grób
        for k in range(-w + 4, w - 3, 4):
            c.line(x + k, y - 6, x + k, y - 1, WOOD[1], 1)
        c.line(x, y - 7, x, y - 14, WOOD[2], 1)
        c.line(x - 3, y - 11, x + 3, y - 11, WOOD[2], 1)
    for x in (20, 42, 64, 88):
        lamp(c, x, 46, 8)
    c.glow(0, 36, W - 1, 47, 130, 0.08)
    save(c, "cmentarz_lodzi", "Cmentarz Łodzi – odwrócone łodzie jako groby na plaży, latarnie")


@scene
def rozbita_lodz():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [16, 17, 18, 24, 31])
    stars(c, 70, 93, 24)
    ground(c, 32, [233, 235, 238, 101])
    hull = [24, 31, 74, 117, 195]
    c.cel_poly([(10, 42), (12, 30), (30, 20), (62, 18), (82, 28), (86, 42), (70, 46), (28, 46)], hull, line=OUTLINE, depth=3)
    c.poly([(40, 18), (52, 18), (50, 30), (44, 30)], 233)
    c.poly([(30, 24), (36, 22), (38, 34), (30, 36)], 233)
    for (x0, y0, x1, y1) in ((20, 28, 26, 44), (56, 20, 62, 44), (70, 26, 76, 42)):
        c.line(x0, y0, x1, y1, 233, 1)
    c.glint(46, 14, 231, 4)
    glow_spot(c, 46, 30, 24, 74, 0.18)
    for (x, y, rx, ry) in ((6, 45, 4, 2), (90, 45, 4, 2), (50, 46, 5, 2)):
        rock(c, x, y, rx, ry, [233, 235, 238, 241, 101])
    for x in range(10, 90, 12):
        crystal(c, x, 44, 6 + x % 5, 2)
    save(c, "rozbita_lodz", "Rozbita łódź z nieba – pęknięty kadłub ze szkłem i błękitnym blaskiem")


@scene
def dom_czarnego_szkla():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 32, [16, 17, 18, 60, 61])
    stars(c, 60, 94, 22)
    hills(c, 30, 38, 233, 56, amp=2)
    ground(c, 36, [233, 233, 17, 18])
    g = [233, 233, 17, 18, 24]
    c.cel_poly([(24, 42), (24, 24), (40, 14), (56, 14), (72, 24), (72, 42)], g, light=(0, -1), line=OUTLINE, depth=2, mid=1)
    c.cel_poly([(40, 14), (48, 4), (56, 14)], RAMPS["glass"], line=OUTLINE, depth=1)
    c.rect(44, 30, 52, 42, OUTLINE); c.rect(45, 31, 51, 42, 208); c.dither(45, 31, 51, 42, 208, 220, 0.4)
    c.rect(30, 26, 36, 32, OUTLINE); c.rect(31, 27, 35, 31, 208)
    for (x, base, h, w, lean) in ((12, 44, 16, 4, -2), (84, 44, 14, 4, 2), (6, 46, 9, 3, 0), (90, 46, 10, 3, 1)):
        crystal(c, x, base, h, w, lean=lean)
    glow_spot(c, 48, 38, 18, 130, 0.2)
    c.glint(48, 8, 231, 3)
    fog(c, 40, 47, 109, 0.2)
    save(c, "dom_czarnego_szkla", "Dom z Czarnego Szkła – kanciasta bryła ze szkła, jedno ciepłe okno, kryształy")


@scene
def lysa_skala():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [233, 235, 237, 239, 60, 102])
    for (cx, cy, rw) in ((16, 6, 20), (70, 4, 26)):
        c.cel_ellipse(cx, cy, rw, 5, [233, 235, 237, 239, 241], line=None, depth=2)
    c.gradient_v(0, 30, W - 1, H - 1, [17, 24, 31, 66])
    rnd = random.Random(57)
    for _ in range(40):
        x, y = rnd.randrange(W), rnd.randrange(32, H)
        c.line(x, y, x + rnd.randint(2, 8), y, 117 if rnd.random() < .3 else 31)
    c.cel_poly([(18, 47), (28, 24), (38, 14), (48, 6), (58, 14), (68, 24), (78, 47)], [233, 235, 238, 241, 101], light=(-1, -1), line=OUTLINE, depth=3)
    for k in range(10):   # wykute schody
        c.rect(52 - k * 2, 14 + k * 3, 56 - k * 2, 14 + k * 3, 187)
    glow_spot(c, 48, 6, 14, 195, 0.3)
    c.glint(48, 6, 231, 3)
    c.line(48, 6, 46, 0, 195, 2)
    for (x, y) in ((8, 44), (90, 45)):
        rock(c, x, y, 4, 2)
    save(c, "lysa_skala", "Łysa Skała – goła skała pośrodku morza, wykute schody, łuna na szczycie")


@scene
def wir_lysa_skala():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, H - 1, [16, 17, 18, 24, 17])
    stars(c, 70, 95, 44, bright=(231, 195, 153, 110))
    for r in range(40, 4, -3):
        col = (17, 18, 24, 31, 67, 110, 153, 195, 231)[min(8, (40 - r) // 4)]
        for a in range(0, 360, 2):
            ang = math.radians(a) + r * 0.12
            x = int(48 + r * 1.6 * math.cos(ang)); y = int(24 + r * 0.55 * math.sin(ang))
            c.px(x, y, col)
            c.px(x + 1, y, col)
    c.ellipse(48, 24, 6, 3, 231)
    c.ellipse(48, 24, 3, 2, 255)
    c.cel_poly([(0, 47), (0, 36), (14, 40), (24, 47)], [233, 233, 17, 18, 24], line=OUTLINE, depth=2)
    c.cel_poly([(96, 47), (96, 36), (82, 40), (72, 47)], [233, 233, 17, 18, 24], line=OUTLINE, depth=2)
    for (x, base, h, w, lean) in ((6, 40, 12, 3, 1), (90, 40, 12, 3, -1), (20, 46, 8, 3, 0), (76, 46, 8, 3, 0)):
        crystal(c, x, base, h, w, lean=lean)
    glow_spot(c, 48, 24, 36, 74, 0.1)
    c.glint(48, 24, 231, 4)
    save(c, "wir_lysa_skala", "Wir na Łysej Skale – wirujący lej światła i szkła pod gwiazdami")


@scene
def stara_kopalnia():
    c = Canvas(W, H)
    sky(c, "dusk", 22)
    stars(c, 12, 96, 10)
    c.cel_poly([(0, 47), (0, 20), (24, 10), (48, 8), (72, 10), (96, 20), (96, 47)], [233, 22, 94, 130, 137], light=(-1, -1), line=OUTLINE, depth=3)
    c.cel_rect(34, 22, 62, 42, [233, 233, 52, 124, 166], line=OUTLINE, depth=2, mid=0)
    c.rect(38, 24, 58, 42, 233)
    c.cel_rect(34, 20, 62, 24, WOOD, line=OUTLINE, depth=1)
    c.cel_rect(34, 24, 38, 42, WOOD, line=OUTLINE, depth=1); c.cel_rect(58, 24, 62, 42, WOOD, line=OUTLINE, depth=1)
    for x in range(8, 90, 5):    # szyny
        c.rect(x, 44, x + 2, 44, 241)
    c.line(0, 43, 95, 43, RAMPS["iron"][4], 1); c.line(0, 46, 95, 46, RAMPS["iron"][4], 1)
    c.cel_poly([(14, 42), (36, 42), (34, 32), (16, 32)], RAMPS["iron"], line=OUTLINE, depth=1)
    c.cel_ellipse(18, 44, 3, 3, RAMPS["iron"], line=OUTLINE, depth=1); c.cel_ellipse(32, 44, 3, 3, RAMPS["iron"], line=OUTLINE, depth=1)
    for k in range(4):
        rock(c, 18 + k * 4, 31, 2, 2, [237, 241, 101, 144, 187])
    lamp(c, 70, 44, 14)
    glow_spot(c, 48, 32, 16, 94, 0.15)
    save(c, "stara_kopalnia", "Stara kopalnia – drewniana obudowa sztolni, tory, wózek i latarnia")


@scene
def wzgorze_wisielcow():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 32, [233, 235, 239, 243, 247, 250])
    hills(c, 30, 38, 239, 58, amp=2)
    c.cel_poly([(0, 47), (0, 36), (30, 30), (48, 26), (66, 30), (96, 36), (96, 47)], [233, 235, 238, 241, 101], light=(-1, -1), line=OUTLINE, depth=3)
    for (x, base) in ((30, 38), (66, 38)):   # szubienice
        c.cel_rect(x, base - 24, x + 2, base, WOOD, line=OUTLINE, depth=1)
        c.cel_rect(x, base - 24, x + 16, base - 21, WOOD, line=OUTLINE, depth=1)
        c.line(x + 4, base - 20, x + 4, base - 14, 237, 1)
        c.line(x + 12, base - 20, x + 12, base - 12, 237, 1)
        c.ellipse(x + 12, base - 11, 1, 2, 233)
    dead_tree(c, 48, 32, 18, [233, 235, 237, 239, 241])
    for (x, y) in ((12, 8), (22, 12), (80, 6), (56, 10), (46, 14)):
        crow(c, x, y)
    fog(c, 28, 46, 247, 0.25)
    save(c, "wzgorze_wisielcow", "Wzgórze Wisielców – szubienice na szarym wzgórzu, kruki, mgła")


@scene
def opuszczony_klasztor():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 32, [16, 17, 18, 60, 61])
    stars(c, 50, 97, 22)
    c.ellipse(80, 9, 5, 5, 230); c.ellipse(82, 8, 4, 4, 17)
    hills(c, 30, 38, 233, 59, amp=2)
    ground(c, 36, [233, 22, 22, 58])
    c.cel_rect(10, 20, 54, 40, ST, line=OUTLINE, depth=2)
    for k in range(5):   # łuki krużganka
        x = 14 + k * 8
        c.cel_poly([(x, 40), (x, 32), (x + 3, 28), (x + 6, 32), (x + 6, 40)], [233, 233, 234, 235, 236], line=OUTLINE, depth=1, mid=0)
    c.cel_poly([(8, 20), (32, 12), (56, 20)], [235, 237, 94, 130, 137], line=OUTLINE, depth=2)
    c.poly([(40, 18), (44, 14), (48, 18)], 233)
    c.cel_rect(62, 8, 78, 40, ST, line=OUTLINE, depth=2)       # dzwonnica
    c.cel_poly([(60, 8), (70, 0), (80, 8)], [235, 237, 94, 130, 137], line=OUTLINE, depth=1)
    c.rect(68, 12, 72, 20, OUTLINE)
    c.ellipse(70, 18, 2, 2, RAMPS["gold"][3])
    leaf = RAMPS["leaf"]
    for (x, y, h) in ((12, 24, 14), (52, 24, 14), (64, 14, 22), (77, 14, 22)):
        for i in range(h):
            c.px(x + (i % 3 == 0), y + i, leaf[1 + i % 3])
    for (x, y, rx, ry) in ((4, 45, 4, 2), (60, 45, 6, 2), (88, 44, 4, 2)):
        rock(c, x, y, rx, ry)
    fog(c, 38, 47, 109, 0.2)
    save(c, "opuszczony_klasztor", "Opuszczony klasztor – ruiny krużganków i dzwonnica w świetle księżyca")
