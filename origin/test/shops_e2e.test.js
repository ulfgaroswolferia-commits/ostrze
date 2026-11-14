import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { buyPrice } from "../src/systems/shop.js";
import { getStats } from "../src/systems/stats.js";
import { validateData } from "../src/engine/data.js";

const data = minimalData();
const shop = (id) => data.shops.find((s) => s.id === id);
const item = (id) => data.items.find((i) => i.id === id);
const tierOf = (id) => item(id).tier ?? 0;
const WILCZY = ["kramarz_brod", "kowal_brod", "szkarad_ruszniczar"];
const GLUSZEC = ["handlarz_gluszec", "kowal_gluszec_sklep"];
const GWIAZDY = ["zapasy_obserwatorium", "warsztat_brygidy"];

test("sklepy: siedem sklepów z 10–15 pozycjami, dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  for (const id of [...WILCZY, ...GLUSZEC, ...GWIAZDY]) {
    assert.ok(shop(id), `brak sklepu ${id}`);
    const n = shop(id).stock.length;
    assert.ok(n >= 10 && n <= 15, `${id}: ${n} pozycji`);
  }
});

test("sklepy: stopnie rosną z regionem – Wilczy Bród bez T3, Głuszec i Obserwatorium bez T4, szkoła co najwyżej T2", () => {
  for (const id of WILCZY) for (const s of shop(id).stock) assert.ok(tierOf(s.id) <= 2, `${id}: ${s.id} T${tierOf(s.id)}`);
  for (const id of [...GLUSZEC, ...GWIAZDY, "kramarz_szkolny"]) for (const s of shop(id).stock) assert.ok(tierOf(s.id) <= (id === "kramarz_szkolny" ? 2 : 3), `${id}: ${s.id}`);
  assert.ok(GLUSZEC.some((id) => shop(id).stock.some((s) => tierOf(s.id) === 3)), "Głuszec sprzedaje T3");
  assert.ok(GWIAZDY.some((id) => shop(id).stock.some((s) => tierOf(s.id) === 3)), "Obserwatorium sprzedaje T3");
});

test("sklepy: każdy region ma w swoich sklepach broń, pancerz, amulet i miksturę", () => {
  for (const ids of [WILCZY, GLUSZEC, GWIAZDY]) {
    const all = ids.flatMap((id) => shop(id).stock.map((s) => item(s.id)));
    assert.ok(all.some((i) => i.type === "weapon"), `${ids[0]}: broń`);
    assert.ok(all.some((i) => i.type === "armor" && i.slot !== "talizman"), `${ids[0]}: pancerz`);
    assert.ok(all.some((i) => i.type === "armor" && i.slot === "talizman"), `${ids[0]}: amulet`);
    assert.ok(all.some((i) => i.type === "consumable"), `${ids[0]}: mikstura`);
  }
});

test("sklepy: w Wilczym Brodzie jest łuk, kusza i proch (strzelecka i proch mają zastosowanie)", () => {
  const stock = WILCZY.flatMap((id) => shop(id).stock.map((s) => item(s.id)));
  assert.ok(stock.some((i) => i.skill === "strzelecka"));
  assert.ok(stock.some((i) => i.skill === "proch"));
  assert.ok(shop("szkarad_ruszniczar").stock.some((s) => s.id === "kula_z_prochem"));
});

test("sklepy: pierwszy sprzęt T2 w Wilczym Brodzie da się kupić za niecałe 150 gr przy zwykłym Handlu", () => {
  const state = combatState(data, "miecz");
  const handel = getStats(state, data).skills.handel ?? 0;
  const cheap = shop("kowal_brod").stock.map((s) => item(s.id)).filter((i) => i.tier === 2 && (i.type === "weapon" || i.type === "armor")).map((i) => buyPrice(data, i, handel));
  assert.ok(Math.min(...cheap) <= 150, `najtańszy T2: ${Math.min(...cheap)}`);
});

test("sklepy: wszystkie skupują surowce", () => {
  for (const s of data.shops) assert.ok(s.buys.includes("material"), `${s.id}: nie skupuje surowców`);
});

test("sklepy: spoty z towarem są w hubach od wejścia, a Szkarad ma kilka stanów rozmowy", () => {
  const spot = (loc, id) => data.travel.locations.find((l) => l.id === loc).spots.find((s) => s.id === id);
  const kowal = spot("wilczy_brod", "kowal");
  assert.ok(kowal.type === "scene" && kowal.scenes.some((s) => s.type === "shop" && s.shop === "kowal_brod"), "kowal z Brodu sprzedaje");
  for (const [loc, id, shopId] of [["gluszec", "kuznia_sklep", "kowal_gluszec_sklep"], ["obserwatorium", "warsztat_sklep", "warsztat_brygidy"]]) {
    const s = spot(loc, id);
    assert.ok(s && s.type === "shop" && s.ref === shopId && !s.secret, `${loc}.${id}`);
  }
  const szkarad = spot("wilczy_brod", "szkarad");
  assert.ok(szkarad && szkarad.secret, "Szkarad jest odkrywany przez kowala");
  const kowalDialogue = data.dialogues.find((d) => d.id === "kowal");
  assert.ok(JSON.stringify(kowalDialogue).includes('"reveal":"wilczy_brod.szkarad"'), "kowal ujawnia Szkarada");
  assert.ok(szkarad.scenes.some((s) => s.type === "shop" && s.shop === "szkarad_ruszniczar"));
  const dialogue = data.dialogues.find((d) => d.id === "szkarad");
  const speakers = Object.values(dialogue.nodes).filter((n) => n.speaker === "Rusznikarz Szkarad");
  assert.ok(speakers.length >= 5, `węzłów Szkarada: ${speakers.length}`);
  assert.ok(dialogue.portrait && data.art[dialogue.portrait]);
});
