import { test, before } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { dataDir } from "../src/config.js";
import { loadData } from "../src/engine/data.js";
import { combatEventText } from "../src/ui/events.js";
import { createCharacter, creatorStartAttributes } from "../src/systems/character.js";
import { createCombat } from "../src/systems/combat/state.js";
import { setColorsEnabled } from "../src/ui/colors.js";

// Combat lines about an effect on an enemy use the effect's noun, so they read right whatever the enemy's gender.
const EVENTS = ["efekt_nalozony", "efekt_odparty", "efekt_odporny", "efekt_koniec", "efekt_obrazenia", "efekt_ap"];
const TARGETS = ["bandyta", "zmija_lesna"]; // masculine, feminine; no enemy has a plural name
const NOUNS = {
  pl: {
    oslepienie: "oślepienie", ogluszenie: "ogłuszenie", zamroczenie: "zamroczenie", rozkojarzenie: "rozkojarzenie",
    podpalenie: "podpalenie", krwawienie: "krwawienie", strach: "strach", trucizna: "zatrucie", zmeczenie: "zmęczenie",
    podchmielenie: "podchmielenie", spowolnienie: "spowolnienie", glod: "głód", glod_konanie: "wygłodzenie", najedzony: "sytość",
  },
  en: {
    oslepienie: "blindness", ogluszenie: "stun", zamroczenie: "daze", rozkojarzenie: "distraction",
    podpalenie: "burning", krwawienie: "bleeding", strach: "fear", trucizna: "poison", zmeczenie: "fatigue",
    podchmielenie: "tipsiness", spowolnienie: "sluggishness", glod: "hunger", glod_konanie: "starvation", najedzony: "fullness",
  },
};
const data = {};
before(async () => {
  setColorsEnabled(false);
  data.pl = await loadData(dataDir());
  data.en = await loadData(dataDir(), { lang: "en" });
});

const render = (d, enemy, event) => {
  const character = createCharacter({
    name: "Thorgniew", classId: "miecz", attributes: { ...creatorStartAttributes(d), sila: 7, krzepa: 7, zrecznosc: 6 }, tagged: ["sieczna", "wrecz", "wymowa"],
  }, d);
  const combat = createCombat({ time: { minutes: 600 }, character, vars: {} }, d, { enemies: [{ id: enemy, count: 2 }] }, { int: () => 1 });
  return strip(combatEventText(d.ui, d, combat, { ...event, target: `${enemy}#2` }));
};

for (const lang of ["pl", "en"]) {
  test(`efekty (${lang}): każdy efekt z przymiotnikiem ma rzeczownik`, () => {
    for (const [id, noun] of Object.entries(NOUNS[lang])) {
      const effect = data[lang].effects.find((e) => e.id === id);
      assert.equal(effect?.noun, noun, id);
    }
  });

  test(`komunikaty walki (${lang}): rzeczownik efektu, bez przymiotnika, rodzaj celu bez znaczenia`, () => {
    for (const [id, noun] of Object.entries(NOUNS[lang])) {
      const name = data[lang].effects.find((e) => e.id === id).name;
      for (const enemy of TARGETS) {
        for (const type of EVENTS) {
          const text = render(data[lang], enemy, { type, id, damage: 2, ap: 1 });
          assert.ok(text.includes(noun), `${lang} ${id} ${enemy} ${type}: ${text}`);
          assert.ok(!text.includes(name), `${lang} ${id} ${enemy} ${type}: ${text}`);
        }
      }
    }
  });
}

test("komunikaty walki: efekt bez rzeczownika bierze nazwę", () => {
  const d = { ...data.pl, effects: data.pl.effects.map((e) => (e.id === "krwawienie" ? { ...e, noun: undefined } : e)) };
  assert.equal(render(d, "bandyta", { type: "efekt_nalozony", id: "krwawienie" }), "Bandyta 2: Krwawi.");
});
