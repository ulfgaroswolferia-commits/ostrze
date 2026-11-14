import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { runApp } from "../src/app.js";
import { loadData } from "../src/engine/data.js";
import { setColorsEnabled } from "../src/ui/colors.js";
import { loadGame } from "../src/engine/save.js";
import { tmpDir, createAdaptiveIO, endAfterFirstDay } from "./helpers.js";

let data, savedHome;
beforeEach(async () => { savedHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); setColorsEnabled(false); data = endAfterFirstDay(await loadData()); });
afterEach(() => { if (savedHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = savedHome; });

const CREATOR = ["Thorgniew", "1", "1++", "2+", "3++", "8", "7", "9", "12", "1"];
const LEVEL_UP = ["1+++", "2+++", "12", "5"];
const WIN = { fight: "win" };
const TO_COURIER = ["1", "", "", "", ...CREATOR, "", WIN, "", "", ...LEVEL_UP, "", "5", "", "2", "", "", "5", "", "3", "4", "", "", { trip: { fight: "win" } }];
const TAKE_NORA = ["1", "1", "1", "1", "1", "1", "9"];

test("ucieczka z Wilczej Nory nie zamyka zlecenia: zostaje aktywne", async () => {
  const io = createAdaptiveIO([...TO_COURIER, "", ...TAKE_NORA, "1", { trip: { fight: "win" } }, "", { fight: "flee" }, "", { trip: { fight: "win" } }, "^C", "t"]);
  await runApp({ data, io, options: { debug: false, seed: 7 } });
  const st = (await loadGame("auto", data)).state ?? (await loadGame("auto", data));
  assert.match(io.text(), /Cofasz się wąwozem/);
  assert.equal(st.quests.wilcza_nora.status, "active");
  assert.doesNotMatch(io.text(), /Zadanie przepadło: Wilcza Nora/);
});
