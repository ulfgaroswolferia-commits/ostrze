import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";

const data = await loadData();
const dlg = (id) => data.dialogues.find((d) => d.id === id);
const story = (id) => data.story.scenes.find((s) => s.id === id);
const loc = (id) => data.travel.locations.find((l) => l.id === id);

test("miasto: targowanie u przekupki kosztuje (nie ma darmowego prowiantu), szulerzy płacą za wygraną tylko raz", () => {
  const p = dlg("przekupka");
  assert.ok(p.nodes.taniej.actions.some((a) => a.takeMoney >= 1));
  assert.ok(p.nodes.kram.options.find((o) => o.id === "targ").requires?.money >= 1);
  assert.ok(dlg("przekupka").nodes.taniej.text.includes("Dwa grosze"));
  const s = dlg("szulerzy");
  assert.ok(JSON.stringify(s.nodes.beczka.options.find((o) => o.id === "gram").requires).includes("szulerzy_wygral"));
  assert.ok(s.nodes.wygrana.actions.some((a) => a.setFlag === "szulerzy_wygral"));
  assert.ok(s.nodes.gra.actions?.some((a) => a.takeMoney === 5));
  assert.ok(s.nodes.wygrana.actions.some((a) => a.giveMoney === 10));
});

test("wir: znacznik progów wskazuje wejście, reszta świty w końcowej scenie rozbrojenia, epilog bez martwej gałęzi i bez noża na schodach", () => {
  const q = data.quests.find((x) => x.id === "watek_wir");
  assert.equal(q.objectives[0].at, "wir_lysa_skala.wejscie");
  const po = loc("wir_lysa_skala").spots.find((s) => s.id === "komnata_wiru").scenes.find((x) => x.id === "komnata_po_r");
  assert.match(po.text, /świta|świty/i);
  assert.equal(story("akt6_epilog_list_nikt"), undefined);
  assert.doesNotMatch(story("akt6_epilog_cesarz_zamach").text, /na schodach/);
  assert.match(story("akt6_epilog_szklo").text, /szkł/);
  assert.deepEqual(story("akt6_epilog_szklo").if, { flag: "szklo_wola" });
});

test("kapitan przystani: powitanie pasuje do każdej wizyty (bez przedstawiania się od nowa), a Brygida wyjaśnia dwa miejsca", () => {
  const k = dlg("kapitan_przystani").nodes.biuro;
  assert.doesNotMatch(k.text, /Z lądu\? Papiery/);
  assert.ok(k.actions.some((a) => a.reveal === "oboz_hetmana") && k.actions.some((a) => a.setFlag === "kapitan_przystani_poznany"));
  assert.match(dlg("brygida_wyspa").nodes.kacik.text, /przy stole|na nabrzeżu/);
});
