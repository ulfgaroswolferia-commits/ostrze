"""Pilotaz stylu: wilk (wrog), kwatermistrz (portret), karczma, oboz, ruiny, pole szkla (sceny).

Uruchom z katalogu tools/art:  python pilot.py [nazwa ...]   (bez argumentow: wszystkie)
Zapisuje data/art/<id>.pix oraz podglady PNG w katalogu podanym w zmiennej srodowiskowej ART_PREVIEW (jesli ustawiona).
"""
import math
import os
import random
import sys

from toolkit import Canvas
from palette import RAMPS, OUTLINE, ramp

from pilot_common import finish, ground_shadow
from pilot_scenes import tavern, camp, ruins, glass_field
from pilot_enemy import wolf_head


# ---------------------------------------------------------------- portret kwatermistrza (48x48)
def quartermaster():
    c = Canvas(48, 48)
    bgr = [233, 234, 235, 52, 58]
    c.gradient_v(0, 0, 47, 47, bgr)
    skin = RAMPS["skin"]
    cloth = RAMPS["cloth_brown"]
    leather = RAMPS["leather"]
    L = OUTLINE
    M = Canvas.mask_poly
    E = Canvas.mask_ellipse
    # ramiona i kaftan
    c.cel(M([(2, 47), (4, 38), (12, 33), (36, 33), (44, 38), (46, 47)]), cloth, line=L, depth=2)
    c.cel(M([(18, 33), (30, 33), (32, 40), (24, 47), (16, 40)]), RAMPS["cloth_grey"], line=L, depth=1)
    for by in (38, 43):
        c.ellipse(24, by, 1, 1, RAMPS["gold"][3])
        c.px(23, by - 1, 227)
    c.line(10, 36, 5, 46, cloth[1])
    c.line(38, 36, 43, 46, cloth[1])
    # szyja i glowa
    c.cel(M([(19, 27), (29, 27), (30, 34), (24, 37), (18, 34)]), skin, line=L, depth=1)
    c.cel(E(12, 20, 2, 3) | E(36, 20, 2, 3), skin, line=L, depth=1)
    c.cel(E(24, 19, 11, 13), skin, line=L, depth=2)
    # czapka z lisiego futra
    c.cel(M([(11, 15), (13, 6), (24, 2), (35, 6), (37, 15), (33, 12), (24, 10), (15, 12)]), leather, line=L, depth=2)
    for x in range(14, 36, 3):
        c.line(x, 4 + abs(x - 24) // 5, x + 1, 8, leather[4])
    # brwi, oczy, nos
    c.line(15, 15, 21, 14, 52); c.line(27, 14, 33, 15, 52)
    for ex in (19, 29):
        c.rect(ex - 2, 17, ex + 1, 18, 231)
        c.rect(ex - 1, 17, ex, 18, 24)
        c.px(ex - 1, 17, 233)
        c.px(ex - 2, 19, skin[0])
    c.cel(E(24, 22, 3, 4), skin, line=None, depth=1)
    c.px(22, 25, skin[0]); c.px(26, 25, skin[0]); c.px(23, 26, skin[0]); c.px(25, 26, skin[0])
    # rumience
    c.dither(14, 22, 18, 25, skin[2], 174, 0.3)
    c.dither(30, 22, 34, 25, skin[2], 174, 0.3)
    # wasy, usta, broda
    fb = RAMPS["fur_brown"]
    c.cel(M([(14, 27), (23, 25), (24, 27), (25, 25), (34, 27), (31, 30), (24, 28), (17, 30)]), fb, line=L, depth=1)
    c.line(21, 31, 27, 31, 88)
    c.cel(M([(19, 32), (29, 32), (27, 37), (24, 38), (21, 37)]), fb, line=L, depth=1)
    c.outline(OUTLINE)
    c.glint(17, 9, 231, 1)
    finish(c, "portret_kwatermistrz", "Kwatermistrz – wąsaty, w czapce z lisa, rumiany", "portrait")


if __name__ == "__main__":
    jobs = {"wilk": wolf_head, "portret_kwatermistrz": quartermaster, "karczma_pod_wilczym_klem": tavern, "oboz": camp, "ruiny_straznicy": ruins, "pole_szkla": glass_field}
    for name in sys.argv[1:] or jobs:
        jobs[name]()
        print("ok", name)
