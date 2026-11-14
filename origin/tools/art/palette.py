"""Kolory xterm-256 i rampy tonów (od ciemnego do jasnego) wspólne dla wszystkich obrazków."""

_CUBE = [0, 95, 135, 175, 215, 255]
_SYSTEM = [
    (0, 0, 0), (205, 0, 0), (0, 205, 0), (205, 205, 0), (0, 0, 238), (205, 0, 205), (0, 205, 205), (229, 229, 229),
    (127, 127, 127), (255, 0, 0), (0, 255, 0), (255, 255, 0), (92, 92, 255), (255, 0, 255), (0, 255, 255), (255, 255, 255),
]


def rgb(index):
    """RGB koloru xterm-256."""
    if index < 16:
        return _SYSTEM[index]
    if index < 232:
        n = index - 16
        return (_CUBE[n // 36], _CUBE[(n // 6) % 6], _CUBE[n % 6])
    v = 8 + 10 * (index - 232)
    return (v, v, v)


def luminance(index):
    r, g, b = rgb(index)
    return round(0.299 * r + 0.587 * g + 0.114 * b)


def _lab(color):
    def lin(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(v) for v in color)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883

    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


_LABS = {i: _lab(rgb(i)) for i in range(16, 256)}


def nearest(color):
    """Najblizszy (w przestrzeni Lab) kolor xterm 16-255 dla (r, g, b) - zachowuje odcien, nie ucieka w szarosc."""
    target = _lab(color)
    return min(_LABS, key=lambda i: sum((a - b) ** 2 for a, b in zip(_LABS[i], target)))


def ramp(dark, light, n):
    """`n` kolorów xterm od `dark` do `light` (rgb), rosnąco pod względem jasności."""
    out = []
    for i in range(n):
        t = i / (n - 1) if n > 1 else 0
        out.append(nearest(tuple(round(dark[k] + (light[k] - dark[k]) * t) for k in range(3))))
    return sorted(out, key=luminance)


# Materialy: reczne rampy (indeksy xterm, od ciemnego do jasnego); automatyczny dobor nie daje dobrych ciemnych brazow.
RAMPS = {
    "skin": [95, 137, 180, 223, 230],
    "skin_dark": [94, 130, 137, 173, 180],
    "wood": [58, 94, 130, 137, 180],
    "leather": [52, 94, 130, 173, 180],
    "fur_brown": [58, 94, 95, 137, 180],
    "fur_grey": [237, 241, 245, 249, 253],
    "cloth_grey": [237, 241, 245, 249, 253],
    "iron": [233, 235, 238, 241, 244],
    "metal": [236, 240, 103, 146, 189],
    "gold": [94, 136, 178, 220, 227],
    "stone": [238, 241, 101, 144, 187],
    "grass": [22, 28, 64, 106, 148],
    "leaf": [22, 28, 35, 71, 114],
    "water": [17, 24, 31, 74, 117],
    "fire": [52, 124, 166, 208, 220, 229],
    "ember": [52, 124, 166, 208, 220],
    "glass": [17, 18, 24, 67, 110, 195],
    "night": [16, 17, 18, 60, 61],
    "sky_day": [67, 110, 111, 153, 195],
    "dusk": [53, 90, 132, 173, 216],
    "blood": [52, 88, 124, 160, 196],
    "cloth_red": [52, 88, 124, 167, 174],
    "cloth_blue": [17, 18, 25, 61, 104],
    "cloth_green": [22, 28, 64, 71, 114],
    "cloth_brown": [58, 94, 130, 137, 180],
    "bone": [95, 137, 180, 223, 230],
    "snow": [60, 103, 146, 189, 231],
    "hair_blond": [94, 136, 179, 221, 229],
    "hair_red": [52, 94, 130, 166, 173],
    "hair_brown": [52, 58, 94, 130, 137],
    "hair_black": [234, 235, 237, 240, 60],
    "hair_silver": [240, 244, 248, 252, 255],
    "linen": [244, 248, 252, 254, 231],
    "cloth_black": [234, 235, 236, 238, 240],
}
OUTLINE = 233  # prawie czarny obrys
