"""Seria 1: wrogowie jako portrety z przodu (64x48). Ludzie: generator parametryczny `human(spec)`; stwory: series_enemies_special.py.

Wszystkie ksztalty rysowane symetrycznie wzgledem x=31.5 (swiatlo z gory), potem lustro lewa->prawa, potem asymetria
(blizna, przepaska, zwisajace kosmyki). Uruchom z tools/art:  python series_enemies.py [id ...]
"""
import sys

from toolkit import Canvas
from palette import RAMPS, OUTLINE
from pilot_common import finish

M = Canvas.mask_poly
E = Canvas.mask_ellipse
TOP = (0, -1)
CX = 31.5
L = OUTLINE


def mix(**kw):
    base = dict(
        skin="skin", hair=None, hair_style="short", hat=None, hat_ramp="leather", cloth="cloth_brown", cloth2=None,
        beard=None, beard_ramp="fur_brown", eyes=24, mood="grim", armor=None, armor_ramp="metal", extras=(),
        bg=(233, 234, 235, 52, 58), mouth="flat", collar=None, female=False, child=False,
    )
    base.update(kw)
    return base


def build_woman(s):
    """Portret kobiety: osobny rysunek niż męski – węższa twarz i ramiona, drobne usta i nos, włosy do piersi (albo welon)."""
    c = Canvas(64, 48)
    c.gradient_v(0, 0, 63, 47, list(s["bg"]))
    skin, cloth = RAMPS[s["skin"]], RAMPS[s["cloth"]]
    hat = RAMPS[s["hat_ramp"]]
    hair = RAMPS[s["hair"]] if s["hair"] else None
    h = s["hat"]
    ex = s["extras"]

    # --- z tylu: welon albo wlosy opadajace za ramiona ---
    if h == "wimple":
        c.cel(M([(33, 2), (21, 5), (15, 13), (13, 30), (10, 47), (33, 47)]), hat, light=TOP, line=L, depth=1)
    elif hair:
        c.cel(M([(33, 3), (21, 6), (16, 14), (14, 28), (12, 40), (12, 47), (33, 47)]), hair, light=TOP, line=L, depth=1)
    # --- korpus: wezsze, opadajace ramiona ---
    c.cel(M([(2, 47), (6, 41), (15, 37), (25, 35), (33, 36), (33, 47)]), cloth, light=TOP, line=L, depth=2)
    if s["armor"] == "pauldrons":
        armor = RAMPS[s["armor_ramp"]]
        c.cel(M([(19, 38), (33, 39), (33, 47), (16, 47)]), armor, light=TOP, line=L, depth=1)
        c.cel(E(14, 40, 8, 4), armor, light=TOP, line=L, depth=2)
    # --- szyja i dekolt albo podbrodek welonu ---
    if h == "wimple":
        c.cel(M([(33, 24), (21, 24), (17, 36), (12, 45), (33, 47)]), hat, light=TOP, line=L, depth=1)
    else:
        c.cel(M([(28, 26), (35, 26), (35, 33), (38, 37), (31, 41), (25, 37), (28, 33)]), skin, light=TOP, line=L, depth=1, mid=3)
    # --- twarz: waska, zweza sie ku brodzie ---
    face = E(CX, 18, 9.5, 11) | M([(22, 18), (41, 18), (40, 24), (36, 31), (33, 34), (30, 34), (27, 31), (23, 24)])
    c.cel(face, skin, light=TOP, line=L, depth=1, mid=3)
    # --- brwi i oczy ---
    brow = hair[2] if hair else skin[1]
    tilt = {"angry": (-1, 1), "grim": (-1, 0), "sly": (0, 0), "blank": (0, 0), "kind": (0, -1)}[s["mood"]]
    c.line(24, 15 + tilt[0], 29, 15 + tilt[1], brow)
    eye_y = 18
    c.poly([(24, eye_y), (30, eye_y), (29, eye_y + 3), (25, eye_y + 3)], 231)
    if s["mood"] != "blank":
        c.rect(26, eye_y, 28, eye_y + 2, s["eyes"])
        c.px(27, eye_y + 1, 233)
    c.line(24, eye_y - 1, 29, eye_y - 1, L)     # gorna powieka z rzesami
    c.px(23, eye_y, L)
    if s["mood"] == "sly":
        c.line(25, eye_y, 29, eye_y, skin[2])   # przymruzenie
    # --- nos i usta: drobne, wysoko nad broda ---
    c.line(31, 22, 31, 25, skin[4])
    c.px(30, 26, skin[2])
    c.line(29, 28, 31, 28, 131)
    c.line(30, 29, 31, 29, 174)
    # --- zmarszczki: delikatne, tylko w tonie skory ---
    if "wrinkles" in ex:
        c.px(23, 21, skin[2])
        c.line(25, 22, 28, 22, skin[2])
    # --- wlosy z przodu: przedzialek i pasma wzdluz twarzy, na ramiona ---
    if hair and h != "wimple":
        c.cel(M([(33, 4), (22, 6), (18, 13), (19, 21), (23, 16), (26, 11), (33, 8)]), hair, light=TOP, line=L, depth=1)
        c.line(31, 4, 31, 8, hair[1])
        if s["hair_style"] == "braid":
            for by in range(21, 45, 4):
                c.cel(E(19, by, 3, 2.5), hair, light=TOP, line=L, depth=1)
            c.rect(17, 45, 20, 46, cloth[1])
        else:
            c.cel(M([(19, 14), (17, 26), (15, 36), (16, 45), (21, 46), (22, 37), (23, 28), (22, 18)]), hair, light=TOP, line=L, depth=1)
            c.line(19, 19, 18, 38, hair[1])
            c.line(20, 22, 20, 42, hair[4])
    # --- nakrycia glowy ---
    if h == "scarf":
        c.cel(M([(33, 2), (21, 4), (15, 12), (16, 17), (22, 11), (33, 8)]), hat, light=TOP, line=L, depth=1)
    elif h == "wimple":
        c.cel(M([(33, 5), (22, 8), (20, 15), (21, 24), (23, 18), (25, 12), (33, 10)]), hat, light=TOP, line=L, depth=1)
    elif h == "band":
        c.cel(M([(33, 7), (22, 9), (19, 13), (19, 15), (23, 12), (33, 10)]), hat, light=TOP, line=L, depth=1)
    c.mirror_left_to_right()
    # --- asymetria ---
    if s["mouth"] == "smirk":
        c.px(35, 27, 131)
    if "earring" in ex:
        c.px(23, 26, RAMPS["gold"][4]); c.px(23, 27, RAMPS["gold"][3])
    if "goggles" in ex:   # podniesione na czolo, nie na oczach
        for gx in (26, 37):
            c.cel(E(gx, 9, 3.5, 3), RAMPS["gold"], light=TOP, line=L, depth=1)
            c.cel(E(gx, 9, 2, 1.5), RAMPS["water"], light=TOP, line=None, depth=1)
            c.px(gx - 1, 8, 231)
        c.line(30, 9, 33, 9, L); c.line(17, 11, 22, 10, L); c.line(41, 10, 46, 11, L)
    return c


def build_human(spec):
    s = mix(**spec)
    if s["female"]:
        return build_woman(s)
    c = Canvas(64, 48)
    c.gradient_v(0, 0, 63, 47, list(s["bg"]))
    skin, cloth = RAMPS[s["skin"]], RAMPS[s["cloth"]]
    hat = RAMPS[s["hat_ramp"]]
    armor = RAMPS[s["armor_ramp"]]
    hair = RAMPS[s["hair"]] if s["hair"] else None
    beard = RAMPS[s["beard_ramp"]]

    # --- kaptur (z tylu) ---
    if s["hat"] == "hood":
        c.cel(M([(10, 42), (9, 20), (14, 8), (31, 3), (49, 8), (54, 20), (53, 42), (31, 44)]), hat, light=TOP, line=L, depth=2)
        c.poly([(18, 34), (17, 18), (22, 10), (31, 8), (41, 10), (46, 18), (45, 34), (31, 38)], 233)
    # --- korpus ---
    c.cel(M([(0, 47), (3, 39), (12, 34), (24, 33), (31, 35), (31, 47)]), cloth, light=TOP, line=L, depth=2)
    if s["cloth2"]:
        c2 = RAMPS[s["cloth2"]]
        c.cel(M([(24, 34), (31, 36), (31, 47), (20, 47), (18, 40)]), c2, light=TOP, line=L, depth=1)
    if s["armor"] == "pauldrons":
        c.cel(E(10, 38, 9, 5) | E(5, 43, 6, 5), armor, light=TOP, line=L, depth=2)
        c.cel(M([(18, 36), (31, 37), (31, 47), (14, 47)]), armor, light=TOP, line=L, depth=2)
    elif s["armor"] == "breast":
        c.cel(M([(14, 34), (31, 35), (31, 47), (6, 47), (8, 40)]), armor, light=TOP, line=L, depth=2)
        c.line(31, 36, 31, 47, armor[1])
    elif s["armor"] == "chain":
        c.cel(M([(6, 47), (8, 38), (16, 33), (31, 34), (31, 47)]), armor, light=TOP, line=L, depth=2)
        c.glow(8, 34, 31, 47, armor[4], 0.3)
        c.glow(8, 34, 31, 47, armor[0], 0.18)
    elif s["armor"] == "plate":
        c.cel(E(9, 38, 10, 6) | E(4, 44, 7, 6), armor, light=TOP, line=L, depth=2)
        c.cel(M([(14, 34), (31, 35), (31, 47), (8, 47), (10, 40)]), armor, light=TOP, line=L, depth=2)
        for ry in (40, 44):
            c.line(11, ry, 31, ry, armor[1])
    if s["collar"]:
        c.cel(M([(18, 30), (26, 33), (31, 40), (31, 34), (24, 28)]), RAMPS[s["collar"]], light=TOP, line=L, depth=1)
    # pasy skorzane
    if "straps" in s["extras"]:
        c.line(2, 40, 22, 47, RAMPS["leather"][1], 2)
        c.line(14, 36, 4, 47, RAMPS["leather"][2], 2)
    # --- dzika czupryna bez nakrycia: ciemna masa wlosow za glowa, zeby nie wisiala na niej jak czapka ---
    if hair and s["hair_style"] == "wild" and not s["hat"]:
        c.cel(E(CX, 20, 17, 18), [hair[0], hair[0], hair[1], hair[1], hair[1]], light=TOP, line=L, depth=1)
    # --- szyja i uszy ---
    c.cel(M([(26, 28), (37, 28), (38, 36), (31, 39), (25, 36)]), skin, light=TOP, line=L, depth=1)
    c.cel(E(19.5, 22, 2.5, 3.5) | E(43.5, 22, 2.5, 3.5), skin, light=TOP, line=L, depth=1)
    # --- glowa ---
    c.cel(E(CX, 21, 11.5, 13.5), skin, light=TOP, line=L, depth=2)
    # --- wlosy ---
    if hair and s["hat"] not in ("helm",):
        if s["hair_style"] in ("short", "long"):
            c.cel(M([(19, 19), (20, 9), (31, 5), (43, 9), (44, 19), (41, 14), (31, 11), (22, 14)]), hair, light=TOP, line=L, depth=1)
        if s["hair_style"] == "long":
            c.cel(M([(18, 14), (16, 34), (21, 36), (21, 18)]), hair, light=TOP, line=L, depth=1)
        if s["hair_style"] == "bun":
            c.cel(M([(19, 19), (20, 9), (31, 5), (43, 9), (44, 19), (41, 14), (31, 11), (22, 14)]), hair, light=TOP, line=L, depth=1)
            c.cel(E(CX, 5, 5, 4), hair, light=TOP, line=L, depth=1)
        if s["hair_style"] == "braid":
            c.cel(M([(19, 19), (20, 9), (31, 5), (43, 9), (44, 19), (41, 14), (31, 11), (22, 14)]), hair, light=TOP, line=L, depth=1)
            c.cel(M([(18, 14), (16, 30), (19, 44), (23, 44), (21, 28), (21, 18)]), hair, light=TOP, line=L, depth=1)
        if s["hair_style"] == "wild":
            c.cel(M([(17, 20), (14, 8), (22, 3), (31, 1), (42, 3), (49, 8), (46, 20), (42, 12), (31, 9), (22, 12)]), hair, light=TOP, line=L, depth=1)
    # --- nakrycia glowy ---
    h = s["hat"]
    if h == "cap":
        c.cel(M([(18, 17), (20, 8), (31, 4), (43, 8), (45, 17), (50, 17), (49, 19), (14, 19), (13, 17)]), hat, light=TOP, line=L, depth=2)
    elif h == "kettle":
        c.cel(E(CX, 13, 13, 9), hat, light=TOP, line=L, depth=2)
        c.cel(M([(10, 17), (53, 17), (56, 21), (7, 21)]), hat, light=TOP, line=L, depth=1)
    elif h == "helm":
        c.cel(E(CX, 19, 14, 17) | M([(18, 24), (16, 40), (26, 40), (24, 28)]), hat, light=TOP, line=L, depth=3)
        c.rect(22, 19, 41, 22, 233)           # szpara na oczy
        c.rect(30, 19, 33, 33, hat[1])         # nosal
        c.line(31, 19, 31, 32, hat[3])
        c.line(21, 36, 24, 33, hat[0]); c.line(42, 36, 39, 33, hat[0])
    elif h == "bandana":
        c.cel(M([(19, 12), (44, 12), (46, 17), (17, 17)]), hat, light=TOP, line=L, depth=1)
        c.cel(M([(44, 13), (52, 16), (50, 22), (45, 17)]), hat, light=TOP, line=L, depth=1)
    elif h == "fur":
        c.cel(E(CX, 12, 15, 9) | E(CX, 8, 12, 7), hat, light=TOP, line=L, depth=2)
        for x in range(18, 46, 3):
            c.line(x, 5, x + 1, 10, hat[4])
    elif h == "hood":
        c.cel(M([(16, 24), (16, 12), (22, 7), (31, 5), (41, 7), (47, 12), (47, 24), (43, 16), (31, 12), (20, 16)]), hat, light=TOP, line=L, depth=1)
    elif h == "scarf":
        c.cel(M([(15, 24), (15, 12), (21, 6), (31, 3), (42, 6), (48, 12), (48, 24), (44, 18), (31, 12), (19, 18)]), hat, light=TOP, line=L, depth=1)
        c.cel(M([(44, 16), (52, 28), (46, 30), (42, 20)]), hat, light=TOP, line=L, depth=1)
    elif h == "wimple":
        c.cel(M([(14, 40), (15, 14), (22, 5), (31, 3), (41, 5), (48, 14), (49, 40), (42, 34), (42, 18), (31, 11), (21, 18), (21, 34)]), hat, light=TOP, line=L, depth=2)
    elif h == "straw":
        c.cel(E(CX, 12, 11, 7), hat, light=TOP, line=L, depth=1)
        c.cel(M([(5, 16), (58, 16), (60, 20), (3, 20)]), hat, light=TOP, line=L, depth=1)
    elif h == "mask":
        c.cel(M([(16, 12), (20, 6), (31, 3), (43, 6), (47, 12), (47, 24), (43, 18), (31, 14), (20, 18), (16, 24)]), hat, light=TOP, line=L, depth=1)
        c.cel(M([(20, 26), (31, 24), (43, 26), (42, 36), (31, 38), (21, 36)]), hat, light=TOP, line=L, depth=1)
    # --- oczy i brwi (nie przy helmie) ---
    if h != "helm":
        brow = hair[0] if hair else skin[0]
        for sign in (1, -1):
            def X(x, sign=sign):
                return int(round(CX + sign * (CX - x)))
            eye_y = 19
            if s["mood"] == "blank":
                c.poly([(X(24), eye_y), (X(29), eye_y), (X(28), eye_y + 2), (X(25), eye_y + 2)], 231)
            else:
                c.poly([(X(24), eye_y), (X(29), eye_y), (X(28), eye_y + 2), (X(25), eye_y + 2)], 231)
                c.rect(X(27) if sign == 1 else X(27), eye_y, X(27) + (1 if sign == -1 else 0), eye_y + 1, s["eyes"])
                c.px(X(26) if sign == 1 else X(26), eye_y, 233)
            tilt = {"angry": (-2, 0), "grim": (-1, -1), "sly": (0, -1), "blank": (-1, -1), "kind": (0, -2)}[s["mood"]]
            c.line(X(23), eye_y - 3 + tilt[0], X(30), eye_y - 3 + tilt[1], brow, 1)
            c.line(X(23), eye_y - 2 + tilt[0], X(30), eye_y - 2 + tilt[1], brow, 1)
            if s["mood"] == "sly":
                c.line(X(24), eye_y, X(29), eye_y, skin[0], 1)
            c.px(X(25), eye_y + 3, skin[1])
    if s["child"]:
        for sx in (25, 26, 37, 38):
            c.px(sx, 19, 231); c.px(sx, 20, 231)
    # --- nos ---
    c.cel(E(CX, 25, 3, 4), skin, light=TOP, line=None, depth=1)
    c.px(29, 28, skin[0]); c.px(34, 28, skin[0]); c.px(30, 29, skin[0]); c.px(33, 29, skin[0])
    c.line(31, 20, 31, 24, skin[3])
    # --- usta ---
    my = 32
    if s["beard"] not in ("full", "mask") and h != "mask":
        if s["mouth"] == "flat":
            c.line(27, my, 36, my, 88)
        elif s["mouth"] == "frown":
            c.line(27, my + 1, 36, my + 1, 88); c.px(26, my + 2, 88); c.px(37, my + 2, 88)
        elif s["mouth"] == "smirk":
            c.line(28, my, 36, my, 88); c.px(37, my - 1, 88); c.px(38, my - 2, 88)
        elif s["mouth"] == "snarl":
            c.poly([(27, my - 1), (36, my - 1), (35, my + 2), (28, my + 2)], 52)
            for tx in (28, 30, 33, 35):
                c.px(tx, my - 1, 231); c.px(tx, my, 231)
    # --- broda / wasy ---
    if s["beard"] == "full":
        c.cel(M([(20, 27), (22, 36), (31, 42), (41, 36), (43, 27), (40, 30), (31, 34), (23, 30)]), beard, light=TOP, line=L, depth=1)
        c.line(28, 33, 35, 33, 88)
    elif s["beard"] == "mustache":
        c.cel(M([(22, 28), (31, 27), (40, 28), (39, 32), (31, 30), (24, 32)]), beard, light=TOP, line=L, depth=1)
    elif s["beard"] == "stubble":
        c.glow(21, 27, 42, 36, RAMPS["fur_grey"][0], 0.30)
    elif s["beard"] == "goatee":
        c.cel(M([(27, 33), (36, 33), (34, 40), (31, 42), (29, 40)]), beard, light=TOP, line=L, depth=1)
    # maska na dolna czesc twarzy
    if "mask_lower" in s["extras"]:
        c.cel(M([(20, 26), (31, 24), (43, 26), (42, 36), (31, 39), (21, 36)]), RAMPS["cloth_grey"], light=TOP, line=L, depth=1)
    if "wrinkles" in s["extras"]:
        for yy in (11, 13):
            c.line(22, yy, 41, yy, skin[1])
        for (x0, y0, x1, y1) in ((21, 21, 19, 25), (22, 24, 20, 28), (42, 21, 44, 25)):
            c.line(x0, y0, x1, y1, skin[0])
        c.line(25, 28, 27, 31, skin[0]); c.line(38, 28, 36, 31, skin[0])
    c.mirror_left_to_right()
    # --- asymetria ---
    ex = s["extras"]
    if "scar" in ex:
        c.line(36, 14, 40, 27, 124); c.line(37, 14, 41, 27, 167)
    if "scar2" in ex:
        c.line(22, 26, 27, 33, 124); c.line(23, 26, 28, 33, 167)
    if "eyepatch" in ex:
        c.cel(E(36, 20, 4, 3), [233, 233, 235, 237, 239], light=TOP, line=L, depth=1, mid=1)
        c.line(19, 14, 36, 19, 233); c.line(36, 20, 44, 14, 233)
    if "bandage" in ex:
        c.cel(M([(22, 11), (43, 11), (44, 15), (21, 15)]), RAMPS["bone"], light=TOP, line=L, depth=1)
        c.px(39, 13, 124); c.px(40, 13, 124)
    if "goggles" in ex:
        for gx in (26, 37):
            c.cel(E(gx, 20, 4, 4), RAMPS["gold"], light=TOP, line=L, depth=1)
            c.cel(E(gx, 20, 2.5, 2.5), [17, 24, 31, 74, 117], light=TOP, line=None, depth=1)
            c.px(gx - 1, 19, 231)
        c.line(30, 20, 33, 20, L); c.line(14, 18, 22, 19, L); c.line(41, 19, 49, 18, L)
    if "cables" in ex:
        gold = RAMPS["gold"]
        for (x0, y0, x1, y1) in ((22, 36, 12, 47), (40, 36, 50, 47), (28, 38, 26, 47), (35, 38, 38, 47)):
            c.line(x0, y0, x1, y1, gold[1], 1); c.line(x0 + 1, y0, x1 + 1, y1, gold[3], 1)
        c.line(46, 10, 52, 22, gold[2]); c.line(47, 10, 53, 22, gold[4])
    if "flour" in ex:
        c.glow(14, 6, 50, 40, 231, 0.14)
    if "earring" in ex:
        c.px(19, 25, RAMPS["gold"][4]); c.px(19, 26, RAMPS["gold"][3])
    if "tattoo" in ex:
        for (x, y) in ((24, 16), (26, 15), (38, 16), (40, 15), (25, 28), (39, 28)):
            c.px(x, y, 17); c.px(x + 1, y, 17)
    if "feather" in ex:
        c.line(46, 6, 50, 0, RAMPS["cloth_red"][3], 2); c.line(48, 4, 52, 2, RAMPS["cloth_red"][4])
    if "arrow" in ex:
        c.line(56, 46, 46, 28, RAMPS["wood"][3], 1); c.line(57, 46, 47, 28, RAMPS["wood"][1], 1)
        c.poly([(44, 26), (47, 28), (45, 30)], RAMPS["metal"][4])
    if "pike" in ex:
        c.line(54, 47, 54, 2, RAMPS["wood"][2], 2); c.poly([(52, 8), (56, 8), (54, 0)], RAMPS["metal"][4])
        c.line(53, 8, 53, 46, RAMPS["wood"][4], 1)
    if "crossbow" in ex:
        c.line(46, 42, 62, 36, RAMPS["wood"][2], 2); c.line(52, 34, 58, 46, RAMPS["metal"][2], 1)
    if "hammer" in ex:
        c.cel_rect(44, 3, 58, 11, RAMPS["iron"], light=TOP, line=L, depth=1)
        c.line(51, 11, 51, 47, RAMPS["wood"][2], 2)
    if "sword" in ex:
        c.line(54, 46, 54, 4, RAMPS["metal"][4], 2); c.line(52, 40, 57, 40, RAMPS["gold"][2], 1)
    if "dagger" in ex:
        c.line(52, 46, 48, 32, RAMPS["metal"][4], 2); c.line(50, 44, 54, 43, RAMPS["leather"][2], 1)
    if "torch" in ex:
        c.line(52, 46, 52, 22, RAMPS["wood"][2], 2)
        c.poly([(49, 22), (55, 22), (52, 12)], RAMPS["fire"][3]); c.poly([(50, 22), (54, 22), (52, 16)], RAMPS["fire"][5])
    c.outline(OUTLINE)
    if "glint" in ex:
        c.glint(27, 6, 231, 1)
    return c


def human(name, comment, spec):
    finish(build_human(spec), name, comment, "enemy")


def npc(name, comment, spec):
    """Portret postaci (48x48): ten sam generator, kadr przyciety do srodka 64x48 (kolumny 8-55)."""
    full = build_human(spec)
    c = Canvas(48, 48)
    for y in range(48):
        for x in range(48):
            c.grid[y][x] = full.grid[y][x + 8]
    finish(c, name, comment, "portrait")


H = {
    "instruktor": ("Instruktor Radogost – siwy żołnierz, wąsy, blizna, surowy wzrok",
                   dict(skin="skin", hair="fur_grey", beard="mustache", beard_ramp="fur_grey", cloth="cloth_green", armor="pauldrons", mood="grim", extras=("scar", "straps"), hat="cap", hat_ramp="cloth_green")),
    "bandyta": ("Bandyta – zarośnięty rzezimieszek w kapturze, kordelas",
                dict(skin="skin_dark", hair="fur_brown", beard="stubble", hat="hood", hat_ramp="cloth_brown", cloth="leather", mood="angry", mouth="snarl", extras=("scar", "dagger"))),
    "zwiadowca_cesarski": ("Cesarski zwiadowca – lekki hełm, kolczy kołnierz, czujny",
                           dict(skin="skin", hair="fur_brown", hat="kettle", hat_ramp="iron", armor="chain", cloth="cloth_red", mood="grim", extras=("glint",))),
    "klusownik": ("Kłusownik – kapelusz z futra, rozwichrzona broda, łuk za plecami",
                  dict(skin="skin_dark", hair="fur_brown", beard="full", hat="fur", hat_ramp="fur_brown", cloth="cloth_green", mood="sly", extras=("arrow", "straps"))),
    "rabus": ("Rabuś – bandana, kolczyk, szeroki uśmiech, kordelas",
              dict(skin="skin", hair="fur_brown", hair_style="long", hat="bandana", hat_ramp="cloth_red", cloth="cloth_brown", mood="sly", mouth="smirk", extras=("earring", "dagger", "scar2"))),
    "rabus_lucznik": ("Rabuś łucznik – kaptur, ostre spojrzenie, strzała",
                      dict(skin="skin", hair="fur_brown", hat="hood", hat_ramp="cloth_green", cloth="leather", mood="sly", mouth="smirk", extras=("arrow",))),
    "maruder": ("Maruder – wynędzniały, brudny, z bandażem na czole",
                dict(skin="skin_dark", hair="fur_grey", hair_style="wild", beard="stubble", cloth="cloth_grey", mood="blank", extras=("bandage", "scar2"))),
    "herszt_zbojcow": ("Herszt zbójców – szeroka twarz, czarna broda, futrzana czapa, zdobiona zbroja",
                       dict(skin="skin_dark", hair="fur_brown", beard="full", beard_ramp="iron", hat="fur", hat_ramp="fur_brown", cloth="cloth_red", armor="pauldrons", mood="angry", mouth="snarl", extras=("scar", "earring", "sword"))),
    "zolnierz_pogranicza": ("Żołnierz pogranicza – hełm kapalin, skórzana kurta, krótka włócznia",
                            dict(skin="skin", hair="fur_brown", hat="kettle", hat_ramp="iron", armor="breast", armor_ramp="iron", cloth="cloth_green", mood="grim", extras=("pike",))),
    "sierzant_pogranicza": ("Sierżant pogranicza – pełny hełm z nosalem, naramienniki, miecz",
                            dict(hat="helm", hat_ramp="metal", armor="pauldrons", cloth="cloth_green", mood="grim", extras=("sword", "glint"))),
    "jarnowski_strzelec": ("Jarnowski strzelec – gogle, sakwa na proch, brązowy kubrak",
                           dict(skin="skin", hair="fur_brown", hat="cap", hat_ramp="cloth_blue", cloth="cloth_blue", mood="sly", extras=("goggles", "straps"))),
    "jarnowski_kowal": ("Jarnowski kowal – łysy, potężne ramiona, fartuch, młot",
                        dict(skin="skin_dark", hair=None, beard="full", beard_ramp="fur_brown", cloth="leather", armor="pauldrons", armor_ramp="iron", mood="angry", extras=("hammer", "scar2"))),
    "jarnowski_zwiadowca": ("Jarnowski zwiadowca – zielony kaptur, pióro, ostry wzrok",
                            dict(skin="skin", hair="fur_brown", hat="hood", hat_ramp="cloth_blue", cloth="cloth_blue", mood="sly", extras=("dagger", "feather"))),
    "cesarski_pikinier": ("Cesarski pikinier – hełm z grzebieniem, czerwony kubrak, pika",
                          dict(skin="skin", hat="kettle", hat_ramp="metal", armor="breast", armor_ramp="metal", cloth="cloth_red", mood="grim", extras=("pike", "glint"))),
    "cesarski_kusznik": ("Cesarski kusznik – kaptur, szal, kusza przy twarzy",
                         dict(skin="skin", hair="fur_brown", hat="hood", hat_ramp="cloth_red", cloth="cloth_red", armor="chain", mood="grim", extras=("crossbow",))),
    "szabrownik": ("Szabrownik – okopcony, szmaty na głowie, krzywy uśmiech",
                   dict(skin="skin_dark", hair="fur_grey", hair_style="wild", hat="bandana", hat_ramp="cloth_grey", beard="stubble", cloth="cloth_grey", mood="sly", mouth="smirk", extras=("scar2", "dagger"))),
    "kieszonkowiec": ("Kieszonkowiec – szczupła twarz, kaptur, maska na dole twarzy, sztylet",
                      dict(skin="skin", hat="hood", hat_ramp="cloth_grey", cloth="cloth_grey", mood="sly", extras=("mask_lower", "dagger"))),
    "rzezimieszek_z_portu": ("Rzezimieszek z portu – czapka marynarska, kolczyk, tatuaże, hak",
                             dict(skin="skin_dark", hair="fur_brown", hat="cap", hat_ramp="cloth_blue", beard="stubble", cloth="cloth_blue", mood="angry", mouth="snarl", extras=("earring", "tattoo", "dagger"))),
    "cesarski_weszyciel": ("Cesarski węszyciel – szczupły, kołnierz, bystry wzrok, nóż",
                           dict(skin="skin", hair="fur_grey", beard="goatee", beard_ramp="fur_grey", cloth="cloth_grey", cloth2="cloth_red", mood="sly", mouth="smirk", extras=("dagger",), collar="cloth_red")),
    "patrol_miejski": ("Strażnik miejski – hełm z grzebieniem, kolczuga, pałka",
                       dict(skin="skin", hair="fur_brown", hat="kettle", hat_ramp="metal", armor="chain", cloth="cloth_blue", mood="grim", extras=("glint", "sword"))),
    "straznik_progu": ("Strażnik Progu – pełny hełm, ciężkie płytowe naramienniki, miecz",
                       dict(hat="helm", hat_ramp="iron", armor="plate", armor_ramp="iron", cloth="cloth_grey", mood="grim", extras=("sword", "glint"))),
    "szeptacz": ("Szeptacz – kaptur zasłaniający oczy, maska, szepczące usta",
                 dict(skin="skin", hat="mask", hat_ramp="cloth_grey", cloth="cloth_grey", mood="blank", eyes=17, extras=())),
    "kustosz_kabli": ("Kustosz Kabli – gogle, kable wplecione w kaptur i ubranie, blada twarz",
                      dict(skin="skin", hair="fur_grey", hat="hood", hat_ramp="cloth_grey", cloth="iron", mood="blank", extras=("goggles", "cables"))),
    "pelnomocnik": ("Pełnomocnik Rdzenia – urzędnik cesarski z kablami, wysoki kołnierz, zimny uśmiech",
                    dict(skin="skin", hair="fur_grey", beard="goatee", beard_ramp="fur_grey", cloth="cloth_red", cloth2="cloth_grey", collar="gold", armor="pauldrons", armor_ramp="gold", mood="sly", mouth="smirk", eyes=17, extras=("cables", "glint"))),
}


def main(names):
    from series_enemies_special import SPECIAL
    jobs = {**{k: (lambda k=k: human(k, *H[k])) for k in H}, **SPECIAL}
    for n in names or jobs:
        jobs[n]()
        print("ok", n)


if __name__ == "__main__":
    main(sys.argv[1:])
