# Przybornik rysowania obrazków (`tools/art`)

Python 3, tylko biblioteka standardowa. Generuje pliki `data/art/*.pix` (format: `src/engine/pix.js`).

## Rozmiary (piksele; 2 piksele = 1 wiersz terminala)
| rodzaj | rozmiar |
|---|---|
| scene (scena, lokacja) | 96×48 |
| portrait (portret) | 48×48 |
| enemy (wróg – zawsze portret z przodu: głowa i ramiona) | 64×48 |

Wysokość parzysta, do 62 kolorów na obraz (litery a–z, A–Z, 0–9).

## Przykład
```python
from toolkit import Canvas
from palette import RAMPS, OUTLINE

c = Canvas(48, 48)
c.shaded_ellipse(24, 24, 16, 16, RAMPS["gold"], light=(-1, -1))   # bryła w 5 tonach
c.rect(20, 40, 28, 44, RAMPS["wood"][2])
c.noise(0, 0, 47, 47, RAMPS["wood"], seed=1)                      # faktura tylko na istniejących pikselach
c.outline(OUTLINE)                                                # ciemny obrys wokół całości
c.glint(18, 18, 231)                                              # rozbłysk
c.save("../../data/art/przyklad.pix", "Przykład", kind="portrait")
c.png("podglad.png", scale=8)                                     # powiększony podgląd
print(c.preview())                                                # podgląd w terminalu
```

## Funkcje
- kształty: `px`, `rect`, `line(width)`, `ellipse`, `poly`, `fill`, maski (`mask_rect/ellipse/poly`) i `paint(mask, c)`
- cieniowanie: `shade(mask, ramp, light, bevel)`, `shaded_ellipse/rect/poly` – ton wg normalnej i kierunku światła (domyślnie z lewej góry)
- efekty: `outline`, `dither(x0,y0,x1,y1,c1,c2,density)`, `gradient_v`, `noise`, `glint`, `paste(flip)`, `mirror_left_to_right`
- zapis i podgląd: `check(kind)`, `save(path, comment, kind)`, `preview()`, `png(path, scale)`
- `palette.RAMPS[nazwa]` – gotowe rampy 5 tonów (skin, wood, metal, iron, gold, stone, grass, leaf, water, fire, glass, night, sky_day, dusk, blood, cloth_*, bone, fur_*, leather, snow, ember); `palette.ramp(ciemny_rgb, jasny_rgb, n)` tworzy własną.

## Zasady stylu (wzór: skrzynia ze zrzutu użytkownika)
Ciemny obrys, 3–4 tony na materiał, światło z lewej góry, jasne rozbłyski na metalu i szkle, faktura (`noise`) na drewnie i kamieniu, drobne detale (nity, szwy, rysy). Tła scen: gradient + dither, trzy plany (przód, środek, tło).

## Testy
`python -m unittest discover tools/art` (z katalogu głównego repo: `cd tools/art && python -m unittest discover .`)

Obrazek obejrzysz w grze: `node bin/game.js --art <id>`.
