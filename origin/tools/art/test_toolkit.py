"""Testy przybornika: python -m unittest discover tools/art"""
import json
import os
import subprocess
import tempfile
import unittest

from toolkit import Canvas, ArtError, LIMITS
import palette


def parse_with_node(path):
    """Parsuje plik prawdziwym parserem gry; zwraca {w, h} albo zgłasza błąd."""
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    code = (
        "import('./src/engine/pix.js').then(m=>{const fs=require('fs');"
        "const a=m.parsePix(fs.readFileSync(process.argv[1],'utf8'));console.log(JSON.stringify({w:a.w,h:a.h}))})"
    )
    out = subprocess.run(["node", "-e", code, path], cwd=root, capture_output=True, text=True)
    if out.returncode != 0:
        raise AssertionError(out.stderr)
    return json.loads(out.stdout)


class CanvasTest(unittest.TestCase):
    def test_save_is_parsed_by_the_game_parser(self):
        c = Canvas(8, 6)
        c.rect(1, 1, 6, 4, 94)
        c.px(0, 0, 15)
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "x.pix")
            c.save(path, "test")
            self.assertEqual(parse_with_node(path), {"w": 8, "h": 6})

    def test_check_rejects_too_big_and_odd_height(self):
        with self.assertRaises(ArtError):
            Canvas(97, 48).check("scene")
        with self.assertRaises(ArtError):
            Canvas(96, 47).check("scene")
        Canvas(96, 48).check("scene")
        Canvas(48, 48).check("portrait")
        Canvas(64, 48).check("enemy")
        self.assertEqual(LIMITS["enemy"], (64, 48))

    def test_62_colours_fit_63rd_fails(self):
        c = Canvas(64, 2)
        for i in range(62):
            c.px(i, 0, 16 + i)
        with tempfile.TemporaryDirectory() as d:
            c.save(os.path.join(d, "a.pix"), "62")
            c.px(62, 0, 200)
            with self.assertRaises(ArtError):
                c.save(os.path.join(d, "b.pix"), "63")

    def test_outline_only_around_opaque(self):
        c = Canvas(7, 7)
        c.rect(2, 2, 4, 4, 100)
        c.outline(0)
        self.assertEqual(c.get(1, 3), 0)
        self.assertEqual(c.get(3, 3), 100)
        self.assertIsNone(c.get(0, 0))
        self.assertIsNone(c.get(1, 1), "obrys 4-sąsiedzki nie wchodzi na skosy")

    def test_shaded_ellipse_has_several_tones_lit_from_the_light(self):
        ramp = palette.ramp((40, 20, 10), (230, 180, 120), 5)
        c = Canvas(40, 40)
        c.shaded_ellipse(20, 20, 15, 15, ramp, light=(-1, -1))
        tones = {c.get(x, y) for x in range(40) for y in range(40) if c.get(x, y) is not None}
        self.assertGreaterEqual(len(tones), 4)
        lum = palette.luminance
        self.assertGreater(lum(c.get(12, 12)), lum(c.get(28, 28)))

    def test_ramp_is_monotonic_in_luminance(self):
        r = palette.ramp((20, 20, 40), (240, 240, 200), 6)
        lums = [palette.luminance(i) for i in r]
        self.assertEqual(lums, sorted(lums))
        self.assertEqual(len(r), 6)

    def test_dither_mixes_two_colours(self):
        c = Canvas(8, 8)
        c.dither(0, 0, 7, 7, 10, 20, 0.5)
        colours = [c.get(x, y) for x in range(8) for y in range(8)]
        self.assertEqual(set(colours), {10, 20})
        self.assertAlmostEqual(colours.count(10) / 64, 0.5, delta=0.1)

    def test_glow_overlays_only_existing_pixels(self):
        c = Canvas(8, 8)
        c.rect(0, 0, 3, 7, 50)
        c.glow(0, 0, 7, 7, 200, 0.5)
        self.assertIsNone(c.get(6, 3), "przezroczyste zostaje przezroczyste")
        left = {c.get(x, y) for x in range(4) for y in range(8)}
        self.assertEqual(left, {50, 200})

    def test_load_roundtrips_save(self):
        c = Canvas(8, 6)
        c.rect(1, 1, 6, 4, 94)
        c.px(0, 0, 15)
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "x.pix")
            c.save(path, "t")
            back = Canvas.load(path)
        self.assertEqual(back.grid, c.grid)

    def test_poly_fills_triangle(self):
        c = Canvas(12, 12)
        c.poly([(1, 10), (10, 10), (5, 1)], 33)
        self.assertEqual(c.get(5, 8), 33)
        self.assertIsNone(c.get(1, 1))

    def test_cel_highlights_light_side_and_shades_the_other(self):
        ramp = [10, 20, 30, 40, 50]
        c = Canvas(24, 24)
        c.cel_ellipse(12, 12, 9, 9, ramp, light=(-1, -1), depth=2)
        self.assertEqual(c.get(12, 12), 30, "srodek = ton srodkowy")
        self.assertGreater(c.get(5, 8), 30, "strona swiatla jasniejsza")
        self.assertLess(c.get(19, 16), 30, "strona przeciwna ciemniejsza")

    def test_cel_line_draws_part_outline(self):
        c = Canvas(20, 20)
        c.cel_rect(4, 4, 15, 15, [10, 20, 30, 40, 50], line=99)
        self.assertEqual(c.get(4, 8), 99)
        self.assertEqual(c.get(15, 15), 99)
        self.assertNotEqual(c.get(9, 9), 99)

    def test_png_has_signature_and_size(self):
        c = Canvas(4, 4)
        c.rect(0, 0, 3, 3, 196)
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "x.png")
            c.png(path, scale=2)
            data = open(path, "rb").read()
            self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
            self.assertEqual(int.from_bytes(data[16:20], "big"), 8)
            self.assertEqual(int.from_bytes(data[20:24], "big"), 8)

    def test_preview_returns_text_lines(self):
        c = Canvas(4, 4)
        c.rect(0, 0, 3, 3, 196)
        self.assertEqual(len(c.preview().split("\n")), 2)


if __name__ == "__main__":
    unittest.main()
