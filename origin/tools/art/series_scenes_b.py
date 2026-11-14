"""Seria 3b: sceny 96x48 (czesc 2, od ogniska druzyny do zasadzki)."""
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
def ognisko_druzyna():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 32, [16, 17, 18, 60, 61])
    stars(c, 50, 31, 20)
    hills(c, 26, 34, 233, 20, amp=3)
    forest(c, 36, 21, 10, [233, 233, 22, 22, 28], 14, 24)
    c.gradient_v(0, 36, W - 1, H - 1, [233, 234, 52, 58])
    glow_spot(c, 48, 42, 26, 94, 0.16)
    glow_spot(c, 48, 42, 14, 166, 0.25)
    c.cel_poly([(38, 44), (58, 40), (59, 43), (40, 46)], RAMPS["wood"], line=OUTLINE, depth=1)
    fire(c, 48, 43, 0.9)
    sparks(c, 48, 26, 8, 5)
    # trzy siedzące postacie w blasku ognia
    for (x, col, h) in ((22, RAMPS["cloth_green"], 14), (74, RAMPS["cloth_red"], 15), (36, RAMPS["cloth_blue"], 12)):
        c.cel_poly([(x - 6, 46), (x - 4, 46 - h + 4), (x + 4, 46 - h + 4), (x + 6, 46)], col, line=OUTLINE, depth=1)
        c.cel_ellipse(x, 46 - h + 1, 3, 3, RAMPS["skin"], line=OUTLINE, depth=1)
    c.cel_ellipse(60, 45, 7, 3, RAMPS["wood"], line=OUTLINE, depth=1)
    save(c, "ognisko_druzyna", "Ognisko drużyny – trzy postacie wokół ognia pod gwiazdami")


@scene
def ostatnia_strazica():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [60, 97, 139, 181, 216, 223])
    hills(c, 26, 34, 66, 22, amp=3)
    c.gradient_v(0, 34, W - 1, H - 1, [28, 64, 22, 58])
    st = RAMPS["stone"]
    c.cel_rect(0, 20, 95, 40, st, line=OUTLINE, depth=2)
    for y in range(22, 40, 4):
        for x in range(0, 96, 8):
            c.line(x + (y // 4 % 2) * 4, y, x + (y // 4 % 2) * 4 + 6, y, st[1])
    for x in range(0, 96, 8):   # blanki
        c.cel_rect(x, 14, x + 4, 20, st, line=OUTLINE, depth=1)
    for (x0, w) in ((6, 16), (74, 16)):  # wieże
        c.cel_rect(x0, 4, x0 + w, 40, st, line=OUTLINE, depth=2)
        for k in range(0, w, 6):
            c.cel_rect(x0 + k, 0, x0 + k + 3, 5, st, line=OUTLINE, depth=1)
        c.rect(x0 + w // 2 - 1, 14, x0 + w // 2, 22, 233)
        c.rect(x0 + w // 2 - 1, 28, x0 + w // 2, 36, 233)
    c.cel_poly([(34, 40), (34, 28), (40, 22), (56, 22), (62, 28), (62, 40)], [233, 233, 234, 235, 236], line=OUTLINE, depth=1, mid=0)
    c.line(48, 22, 48, 40, st[0], 1)
    for (x, col) in ((24, RAMPS["cloth_red"]), (70, RAMPS["cloth_red"])):
        c.line(x, 4, x, 16, RAMPS["wood"][2], 1)
        c.cel_poly([(x + 1, 5), (x + 9, 8), (x + 1, 12)], col, line=OUTLINE, depth=1)
    c.paint(M([(40, 47), (56, 47), (52, 40), (44, 40)]), 137)
    for (x, y) in ((14, 44), (84, 44), (22, 46)):
        bush(c, x, y, 5, 2)
    person(c, 30, 40, 9, 235, hood=False)
    save(c, "ostatnia_strazica", "Ostatnia strażnica – kamienna twierdza z basztami i czerwonymi sztandarami")


@scene
def pobojowisko():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [233, 235, 237, 239, 243, 247])
    hills(c, 26, 34, 239, 23, amp=3)
    c.gradient_v(0, 32, W - 1, H - 1, [238, 241, 94, 58])
    rnd = random.Random(24)
    for _ in range(12):  # połamane włócznie
        x = rnd.randrange(6, 90); y = rnd.randrange(36, 46)
        c.line(x, y, x + rnd.randint(-8, 8), y - rnd.randint(4, 9), RAMPS["wood"][2], 1)
    for (x, y) in ((20, 42), (44, 44), (72, 41), (86, 45)):   # tarcze
        c.cel_ellipse(x, y, 5, 3, RAMPS["wood"], line=OUTLINE, depth=1)
        c.ellipse(x, y, 1, 1, RAMPS["metal"][3])
    for (x, y) in ((30, 40), (58, 42), (10, 45)):   # hełmy
        c.cel_ellipse(x, y, 3, 2, RAMPS["metal"], line=OUTLINE, depth=1)
    c.line(52, 26, 52, 46, RAMPS["wood"][2], 2)       # złamany sztandar
    c.cel_poly([(53, 27), (64, 34), (53, 38), (58, 32)], RAMPS["cloth_red"], line=OUTLINE, depth=1)
    for (x, y) in ((10, 8), (16, 12), (74, 6), (80, 10), (46, 4)):
        crow(c, x, y)
    for (x, y) in ((34, 44), (66, 46)):
        c.poly([(x - 3, y), (x, y - 3), (x + 3, y)], 52)
    fog(c, 34, 46, 245, 0.2)
    save(c, "pobojowisko", "Pobojowisko – połamane włócznie, tarcze, hełmy, kruki")


@scene
def rozdroze():
    c = Canvas(W, H)
    sky(c, "dusk", 30)
    stars(c, 20, 25, 10)
    hills(c, 26, 34, 235, 26, amp=2)
    for x in (6, 16, 80, 90):
        birch(c, x, 38, 20)
    ground(c, 34, [22, 28, 94, 58])
    c.paint(M([(44, 34), (52, 34), (60, 47), (36, 47)]), 137)
    c.paint(M([(30, 36), (46, 34), (46, 38), (0, 44), (0, 40)]), 137)
    c.paint(M([(50, 34), (66, 36), (96, 40), (96, 44), (50, 38)]), 137)
    c.dither(0, 36, W - 1, 47, 137, 94, 0.25)
    wood = RAMPS["wood"]
    c.rect(47, 18, 48, 40, wood[1])
    for (dx, dy, w) in ((-1, 20, 14), (1, 26, 14), (-1, 32, 12)):
        pts = [(48 + dx * 2, dy), (48 + dx * w, dy), (48 + dx * (w + 3), dy + 2), (48 + dx * w, dy + 4), (48 + dx * 2, dy + 4)]
        c.cel_poly(pts, wood, line=OUTLINE, depth=1)
    c.line(48, 16, 48, 18, wood[3], 1)
    c.glow(0, 34, W - 1, 46, 130, 0.08)
    save(c, "rozdroze", "Rozdroże – droga rozchodzi się w trzy strony, drogowskaz o zmierzchu")


@scene
def stary_mlyn():
    c = Canvas(W, H)
    sky(c, "day", 28)
    for (x, y) in ((16, 8), (60, 5)):
        for k in range(14):
            c.px(x + k, y + (k % 3 == 0), 231)
    hills(c, 24, 34, 66, 27, amp=3)
    ground(c, 34, [28, 64, 22, 58])
    c.gradient_v(0, 38, W - 1, H - 1, RAMPS["water"][:4])
    rnd = random.Random(28)
    for _ in range(30):
        x, y = rnd.randrange(W), rnd.randrange(39, H)
        c.line(x, y, x + rnd.randint(2, 6), y, 117 if rnd.random() < .3 else 31)
    hut(c, 22, 38, 34, 20, [237, 241, 245, 249, 253], [235, 237, 94, 130, 137], lit=True)
    # koło wodne
    wheel = RAMPS["wood"]
    c.cel_ellipse(62, 34, 10, 10, wheel, line=OUTLINE, depth=2)
    c.cel_ellipse(62, 34, 6, 6, [233, 233, 234, 235, 236], line=OUTLINE, depth=1, mid=0)
    for a in range(8):
        ang = a * math.pi / 4
        c.line(62, 34, 62 + int(10 * math.cos(ang)), 34 + int(10 * math.sin(ang)), wheel[0], 1)
        c.rect(62 + int(9 * math.cos(ang)) - 1, 34 + int(9 * math.sin(ang)) - 1, 62 + int(9 * math.cos(ang)), 34 + int(9 * math.sin(ang)), wheel[4])
    c.cel_ellipse(62, 34, 2, 2, RAMPS["iron"], line=OUTLINE, depth=1)
    for (x, y, rx, ry) in ((10, 40, 4, 2), (84, 41, 5, 2)):
        rock(c, x, y, rx, ry)
    c.cel_rect(36, 20, 40, 26, RAMPS["stone"], line=OUTLINE, depth=1)
    smoke(c, 38, 18, 4, 247)
    save(c, "stary_mlyn", "Stary młyn – wodne koło, biała chata, strumień")


@scene
def stary_trakt():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 18, [233, 22, 28, 64, 106])
    forest(c, 30, 31, 16, [233, 22, 28, 28, 64], 14, 24)
    ground(c, 30, [22, 28, 58, 94])
    road(c, 28, (42, 54), (14, 82), (241, 238))
    for k in range(7):   # bruk
        y = 30 + k * 2 + k * k // 3
        c.line(46 - k * 4, y, 52 + k * 4, y, 235, 1)
    for x in (12, 84):
        conifer(c, x, 47, 36, 15, [233, 233, 22, 22, 28], tiers=5)
    for (x, y) in ((26, 44), (68, 45), (34, 40)):
        bush(c, x, y, 5, 2, [22, 28, 64, 106, 148])
    for x in range(20, 80, 6):
        c.px(x, 40 + (x % 5), 106)
    for k in range(6):
        c.glow(18 + k * 12, 0, 24 + k * 12, 34, 187, 0.06, skip=())
    fog(c, 28, 40, 245, 0.15)
    save(c, "stary_trakt", "Stary trakt – zarośnięty bruk między ciemnymi sosnami")


@scene
def swit_ocalaly():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 34, [17, 53, 90, 132, 173, 216, 223])
    c.ellipse(48, 33, 12, 12, 220)
    c.ellipse(48, 33, 8, 8, 229)
    glow_spot(c, 48, 33, 30, 216, 0.2)
    hills(c, 32, 40, 233, 32, amp=2)
    ground(c, 38, [233, 22, 58, 94])
    forest(c, 38, 33, 8, [233, 233, 22, 22, 28], 14, 22, 0, 34)
    forest(c, 38, 34, 8, [233, 233, 22, 22, 28], 14, 22, 62, 96)
    c.cel_poly([(30, 46), (40, 36), (52, 46)], RAMPS["cloth_brown"], line=OUTLINE, depth=1)
    c.cel_poly([(56, 47), (66, 38), (78, 47)], RAMPS["cloth_brown"], line=OUTLINE, depth=1)
    for x in (24, 60, 74):
        c.rect(x, 42, x + 1, 46, 233)
    c.rect(44, 42, 50, 46, 233)
    c.poly([(45, 43), (47, 41), (49, 43)], 124)
    smoke(c, 47, 40, 4, 243)
    for (x, y) in ((14, 6), (24, 10), (78, 8), (86, 4)):
        crow(c, x, y)
    save(c, "swit_ocalaly", "Świt po nocy – wschodzące słońce nad zgliszczami obozu")


@scene
def szkolka():
    c = Canvas(W, H)
    sky(c, "day", 26)
    hills(c, 24, 32, 66, 35, amp=2)
    ground(c, 32, [94, 137, 94, 58])
    c.dither(0, 34, W - 1, H - 1, 137, 94, 0.3)
    wood = RAMPS["wood"]
    for x in range(0, W, 5):   # płot
        c.cel_rect(x, 26, x + 2, 36, wood, line=OUTLINE, depth=1)
    c.rect(0, 29, W - 1, 30, wood[3])
    for (x, base) in ((14, 44), (34, 42), (70, 44)):   # manekiny
        c.cel_rect(x - 1, base - 18, x + 1, base, wood, line=OUTLINE, depth=1)
        c.cel_rect(x - 8, base - 15, x + 8, base - 12, wood, line=OUTLINE, depth=1)
        c.cel_ellipse(x, base - 20, 4, 4, RAMPS["cloth_brown"], line=OUTLINE, depth=1)
        c.cel_rect(x - 3, base - 12, x + 3, base - 4, RAMPS["cloth_brown"], line=OUTLINE, depth=1)
    # stojak z bronią
    c.cel_rect(82, 30, 92, 44, wood, line=OUTLINE, depth=1)
    for k in range(4):
        c.line(84 + k * 2, 24, 84 + k * 2, 44, RAMPS["metal"][3 if k % 2 else 4], 1)
    c.cel_poly([(50, 42), (56, 36), (62, 42), (58, 46), (52, 46)], RAMPS["wood"], line=OUTLINE, depth=1)
    c.line(52, 44, 60, 38, RAMPS["metal"][4], 2)
    c.line(50, 30, 44, 26, RAMPS["metal"][4], 1)
    save(c, "szkolka", "Szkółka – plac ćwiczeń z drewnianymi manekinami i stojakiem na broń")


@scene
def trakt():
    c = Canvas(W, H)
    sky(c, "day", 26)
    hills(c, 22, 30, 66, 36, amp=3)
    ground(c, 28, [28, 64, 106, 22])
    for k in range(5):   # pola
        c.line(0, 30 + k * 3, 30 - k * 4, 30 + k * 3, 148 if k % 2 else 106, 1)
        c.line(66 + k * 4, 30 + k * 3, 95, 30 + k * 3, 148 if k % 2 else 106, 1)
    road(c, 28, (44, 52), (22, 74), (137, 94))
    for x in (10, 26, 74, 88):
        birch(c, x, 40, 22)
    for (x, y) in ((60, 36), (36, 42)):
        rock(c, x, y, 3, 2)
    c.rect(66, 24, 67, 38, RAMPS["wood"][1])
    c.cel_poly([(60, 24), (66, 24), (70, 26), (66, 28), (60, 28)], RAMPS["wood"], line=OUTLINE, depth=1)
    for (x, y) in ((14, 6), (70, 8)):
        crow(c, x, y)
    save(c, "trakt", "Trakt – droga między polami i brzozami w dzień")


@scene
def ulewa():
    c = Canvas(W, H)
    sky(c, "storm", 30)
    for (cx, cy, rw) in ((20, 6, 22), (60, 4, 28), (84, 10, 18)):
        c.cel_ellipse(cx, cy, rw, 6, [233, 235, 237, 239, 241], line=None, depth=2)
    hills(c, 28, 36, 235, 37, amp=3)
    forest(c, 36, 38, 10, [233, 233, 22, 22, 28], 12, 22)
    ground(c, 36, [233, 22, 238, 239])
    rnd = random.Random(39)
    for _ in range(18):
        x, y = rnd.randrange(W), rnd.randrange(38, H)
        c.ellipse(x, y, 3, 1, 110)
        c.px(x, y, 195)
    # błyskawica
    pts = [(70, 0), (66, 8), (71, 12), (64, 22), (68, 24), (60, 34)]
    for a, b in zip(pts, pts[1:]):
        c.line(a[0], a[1], b[0], b[1], 231, 2)
    glow_spot(c, 66, 16, 16, 195, 0.2)
    person(c, 24, 44, 14, 233)
    rain(c, 0.16, 110, seed=1, length=5, slant=1)
    rain(c, 0.08, 195, seed=2, length=3, slant=1)
    save(c, "ulewa", "Ulewa – burzowe niebo, błyskawica, strugi deszczu, kałuże")


@scene
def wilki():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [16, 17, 18, 60, 61])
    stars(c, 40, 41, 18)
    c.ellipse(20, 8, 6, 6, 230)
    hills(c, 26, 34, 233, 42, amp=3)
    forest(c, 36, 43, 12, [233, 233, 22, 22, 28], 14, 26)
    c.gradient_v(0, 34, W - 1, H - 1, [60, 103, 146, 189])
    c.dither(0, 36, W - 1, H - 1, 146, 189, 0.3)
    dark = [233, 235, 237, 239, 241]
    for (x, base, s) in ((26, 43, 1.0), (54, 45, 1.25), (80, 42, 0.9)):
        rx, ry = int(10 * s), int(4 * s)
        by = base - int(9 * s)
        for lx in (x - rx + 2, x - rx + 5, x + rx - 5, x + rx - 2):
            c.cel_rect(lx, by + 2, lx + 1, base, dark, line=None, depth=1)
        c.cel_poly([(x - rx, by - 1), (x - rx - int(7 * s), by + int(4 * s)), (x - rx - int(5 * s), by + int(6 * s)), (x - rx + 2, by + 2)], dark, line=OUTLINE, depth=1)
        c.cel(E(x, by, rx, ry), dark, light=(0, -1), line=OUTLINE, depth=2)
        hx = x + rx
        c.cel_poly([(hx - 3, by - 3), (hx + int(3 * s), by - int(6 * s)), (hx + int(9 * s), by - 1), (hx + int(10 * s), by + 1), (hx + int(4 * s), by + 3), (hx - 2, by + 3)], dark, line=OUTLINE, depth=1)
        c.cel_poly([(hx + 1, by - int(5 * s)), (hx + 2, by - int(9 * s)), (hx + int(5 * s), by - int(6 * s))], dark, line=OUTLINE, depth=1)
        c.px(hx + int(4 * s), by - 2, 220)
        c.px(hx + int(5 * s), by - 2, 227)
        c.px(hx + int(10 * s), by, 231)
        for k in range(3):
            c.line(x - rx + 4 + k * 5, by - ry + 1, x - rx + 6 + k * 5, by - ry - 1, 241, 1)
    save(c, "wilki", "Wilki – sfora na śniegu pod księżycem, żółte oczy")


@scene
def wrak_maszyny():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 28, [16, 17, 18, 60, 24])
    stars(c, 40, 51, 20)
    hills(c, 26, 34, 233, 44, amp=2)
    c.gradient_v(0, 32, W - 1, H - 1, [233, 235, 238, 241])
    metal = RAMPS["metal"]
    c.cel_poly([(10, 44), (14, 28), (40, 18), (72, 22), (88, 34), (84, 44)], metal, line=OUTLINE, depth=2)
    for (x0, y0, x1, y1) in ((20, 30, 30, 42), (40, 22, 46, 40), (60, 26, 66, 42)):
        c.line(x0, y0, x1, y1, metal[0], 1)
    c.cel_ellipse(50, 30, 8, 6, [17, 24, 31, 74, 117], line=OUTLINE, depth=1)
    c.glint(48, 28, 231, 2)
    for (x, y) in ((22, 22), (34, 16), (58, 14), (70, 20)):   # sterczące kable i szkło
        crystal(c, x, y + 8, 8, 2)
    c.cel_poly([(70, 32), (84, 28), (90, 36), (80, 40)], metal, line=OUTLINE, depth=1)
    for x in (24, 38, 56):
        c.line(x, 30, x + 4, 36, RAMPS["gold"][3], 1)
    glow_spot(c, 50, 30, 20, 74, 0.12)
    for (x, y, rx, ry) in ((8, 45, 4, 2), (30, 46, 5, 2), (78, 46, 5, 2)):
        rock(c, x, y, rx, ry, [233, 235, 238, 241, 101])
    sparks(c, 50, 18, 6, 6)
    save(c, "wrak_maszyny", "Wrak maszyny – pogięty kadłub, kable, szkło, błękitny rdzeń")


@scene
def wstep_brzezina():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [60, 97, 139, 181, 223, 230])
    hills(c, 24, 34, 66, 45, amp=3)
    ground(c, 32, [28, 64, 106, 22])
    for x in (4, 14, 26, 70, 82, 92):
        birch(c, x, 40 + (x % 3), 22 + (x % 5))
    hut(c, 34, 40, 26, 14)
    smoke(c, 46, 22, 4, 247)
    road(c, 36, (44, 52), (32, 66), (137, 94))
    for (x, y) in ((20, 44), (74, 45)):
        bush(c, x, y, 5, 2)
    for x in range(8, 90, 5):
        c.px(x, 44 + (x % 3), 148)
    glow_spot(c, 40, 34, 9, 223, 0.1)
    save(c, "wstep_brzezina", "Brzezina o poranku – chata wśród brzóz, dym z komina")


@scene
def wstep_gwiazdy():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 36, [16, 17, 18, 24, 60, 61])
    stars(c, 110, 61, 32, bright=(231, 229, 195, 153))
    c.line(10, 4, 70, 30, 231, 2)
    c.line(14, 3, 72, 29, 195, 1)
    c.glint(72, 30, 231, 4)
    glow_spot(c, 72, 30, 14, 195, 0.2)
    hills(c, 34, 47, 233, 46, amp=3)
    c.poly([(0, 47), (0, 40), (20, 36), (44, 40), (66, 37), (96, 41), (96, 47)], 233)
    person(c, 34, 40, 11, 237)
    c.cel_poly([(60, 47), (70, 38), (84, 47)], [233, 233, 234, 235, 236], line=None, depth=1)
    save(c, "wstep_gwiazdy", "Wstęp – spadająca gwiazda nad zarysem wzgórz i samotnym wędrowcem")


@scene
def wymarsz():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [17, 53, 90, 132, 173, 216])
    c.ellipse(70, 30, 10, 10, 220)
    glow_spot(c, 70, 30, 24, 216, 0.16)
    hills(c, 28, 36, 235, 47, amp=3)
    ground(c, 34, [233, 22, 94, 58])
    road(c, 34, (40, 52), (20, 76), (137, 94))
    st = RAMPS["stone"]
    for x0 in (10, 76):    # brama
        c.cel_rect(x0, 14, x0 + 8, 40, st, line=OUTLINE, depth=2)
        c.cel_rect(x0 - 1, 10, x0 + 9, 14, st, line=OUTLINE, depth=1)
    c.cel_poly([(18, 14), (18, 10), (76, 10), (76, 14), (72, 14), (48, 8), (22, 14)], st, line=OUTLINE, depth=1)
    for (x, col) in ((30, RAMPS["cloth_red"]), (62, RAMPS["cloth_red"])):
        c.line(x, 8, x, 14, RAMPS["wood"][2], 1)
        c.cel_poly([(x + 1, 9), (x + 7, 11), (x + 1, 14)], col, line=OUTLINE, depth=1)
    for (x, base, h) in ((36, 46, 9), (44, 44, 8), (54, 45, 9), (62, 47, 10)):
        person(c, x, base, h, 233)
    for (x, y) in ((48, 40), (52, 42)):
        c.px(x, y, 231)
    save(c, "wymarsz", "Wymarsz – brama, sztandary i drużyna wyruszająca drogą o świcie")


@scene
def wzgorze_wartownicze():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 32, [233, 17, 53, 90, 132, 173])
    stars(c, 24, 71, 14)
    hills(c, 30, 38, 235, 48, amp=2)
    c.cel_poly([(0, 47), (0, 40), (24, 30), (48, 20), (72, 30), (96, 40), (96, 47)], [233, 22, 28, 64, 106], line=OUTLINE, depth=3)
    c.rect(46, 12, 49, 24, RAMPS["wood"][1])
    c.cel_rect(42, 4, 53, 12, RAMPS["wood"], line=OUTLINE, depth=2)
    c.cel_poly([(40, 5), (48, 0), (56, 5)], [235, 237, 94, 130, 137], line=OUTLINE, depth=1)
    fire(c, 48, 28, 0.9)
    sparks(c, 48, 12, 8, 7)
    glow_spot(c, 48, 22, 26, 130, 0.12)
    for x in (30, 66):
        c.rect(x, 32, x + 1, 36, RAMPS["wood"][1])
    person(c, 36, 34, 9, 233)
    save(c, "wzgorze_wartownicze", "Wzgórze wartownicze – ognisko-sygnał przy wieży strażniczej o zmierzchu")


@scene
def zapadlisko_ciszy():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 30, [239, 243, 247, 250, 253])
    hills(c, 26, 34, 245, 49, amp=2)
    ground(c, 32, [241, 238, 235, 233])
    # lej
    c.cel(E(48, 36, 40, 10), [233, 233, 234, 235, 236], light=(0, -1), line=OUTLINE, depth=3, mid=0)
    for r, col in ((30, 233), (22, 16), (12, 233)):
        for (x, y) in E(48, 38, r, r * 0.25):
            c.px(x, y, col)
    for (x, base, h) in ((8, 36, 14), (86, 34, 12), (16, 44, 10)):
        dead_tree(c, x, base, h, [233, 235, 237, 239, 241])
    for k in range(6):   # powalone pnie
        c.line(30 + k * 6, 30 + k % 2, 33 + k * 6, 34 + k % 3, 237, 2)
    for (x, y, rx, ry) in ((10, 45, 4, 2), (84, 44, 5, 2)):
        rock(c, x, y, rx, ry, [233, 235, 238, 241, 245])
    c.glow(20, 30, 76, 44, 247, 0.12, skip=())
    fog(c, 22, 40, 250, 0.35)
    save(c, "zapadlisko_ciszy", "Zapadlisko ciszy – ciemny lej w szarej mgle, martwe drzewa")


@scene
def zasadzka():
    c = Canvas(W, H)
    c.gradient_v(0, 0, W - 1, 22, [233, 22, 28, 64, 106])
    forest(c, 32, 61, 14, [233, 22, 28, 28, 64], 12, 22)
    ground(c, 30, [22, 28, 58, 94])
    road(c, 30, (42, 54), (16, 80), (137, 94))
    for x in (8, 20, 76, 88):
        conifer(c, x, 47, 38, 15, [233, 233, 22, 22, 28], tiers=5)
    for (x, y) in ((24, 40), (70, 40), (14, 30), (82, 32)):
        c.poly([(x - 2, y + 8), (x - 3, y), (x, y - 4), (x + 3, y), (x + 2, y + 8)], 233)
        c.px(x - 1, y - 1, 220); c.px(x + 1, y - 1, 220)
    c.line(60, 36, 72, 30, RAMPS["metal"][4], 1)
    c.line(26, 38, 36, 32, RAMPS["metal"][4], 1)
    c.line(48, 14, 48, 22, RAMPS["wood"][2], 1)
    for (x, y) in ((44, 44), (54, 46)):
        rock(c, x, y, 3, 1)
    fog(c, 30, 46, 58, 0.15)
    save(c, "zasadzka", "Zasadzka – leśny trakt, sylwetki w cieniu drzew z błyskiem stali")
