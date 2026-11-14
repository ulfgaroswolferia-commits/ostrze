"""Wspolne funkcje skryptow rysujacych: zapis do data/art (+ podglad PNG), gwiazdy, cien pod postacia."""
import os
import random

ART_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "art")
PREVIEW = os.environ.get("ART_PREVIEW")


def finish(c, name, comment, kind):
    c.save(os.path.join(ART_DIR, f"{name}.pix"), comment, kind=kind)
    if PREVIEW:
        os.makedirs(PREVIEW, exist_ok=True)
        c.png(os.path.join(PREVIEW, f"{name}.png"), scale=8)


def stars(c, count, seed, ymax, bright=(231, 229, 250, 187)):
    rnd = random.Random(seed)
    for _ in range(count):
        c.px(rnd.randrange(c.w), rnd.randrange(ymax), rnd.choice(bright))
    for _ in range(max(2, count // 12)):
        c.glint(rnd.randrange(4, c.w - 4), rnd.randrange(2, max(3, ymax - 4)), 231, 1)


def ground_shadow(c, cx, cy, rx, ry, color=234):
    for (x, y) in c.mask_ellipse(cx, cy, rx, ry):
        if c.get(x, y) is None:
            c.px(x, y, color)


def contact_sheet(names, out_png, columns=3, scale=4):
    """Arkusz kontaktowy PNG kilku obrazkow z data/art (do ogladania serii naraz)."""
    from toolkit import Canvas
    imgs = [Canvas.load(os.path.join(ART_DIR, f"{n}.pix")) for n in names]
    cw = max(i.w for i in imgs) + 2
    ch = max(i.h for i in imgs) + 2
    rows = (len(imgs) + columns - 1) // columns
    sheet = Canvas(cw * columns, ch * rows)
    for k, img in enumerate(imgs):
        sheet.paste(img, (k % columns) * cw + 1, (k // columns) * ch + 1)
    sheet.png(out_png, scale=scale)
