import dlgDozorca from '../../../origin/data/dialogues/dozorca.json';
import dlgFurman from '../../../origin/data/dialogues/furman.json';
import dlgGajowy from '../../../origin/data/dialogues/gajowy.json';
import dlgHalina from '../../../origin/data/dialogues/halina.json';
import dlgKarczmarzKogut from '../../../origin/data/dialogues/karczmarz_kogut.json';
import dlgKontrola from '../../../origin/data/dialogues/kontrola.json';
import dlgKopacz from '../../../origin/data/dialogues/kopacz.json';
import dlgKowalGluszec from '../../../origin/data/dialogues/kowal_gluszec.json';
import dlgNajemnik from '../../../origin/data/dialogues/najemnik.json';
import dlgOblawa from '../../../origin/data/dialogues/oblawa.json';
import dlgPisarz from '../../../origin/data/dialogues/pisarz.json';
import dlgRanny from '../../../origin/data/dialogues/ranny.json';
import dlgSoltys from '../../../origin/data/dialogues/soltys.json';
import dlgStach from '../../../origin/data/dialogues/stach.json';
import dlgWdowa from '../../../origin/data/dialogues/wdowa.json';
import dlgZnachorka from '../../../origin/data/dialogues/znachorka.json';
import type { DialogueFileDef, OriginGameData } from './originTypes';

/**
 * Lazy-loaded Act II (Głuszec) dialogue registry directly wrapping origin/data/dialogues/*.json.
 */
export const CHAPTER2_DIALOGUES: Record<string, DialogueFileDef> = {
  karczmarz_kogut: dlgKarczmarzKogut as unknown as DialogueFileDef,
  soltys: dlgSoltys as unknown as DialogueFileDef,
  kowal_gluszec: dlgKowalGluszec as unknown as DialogueFileDef,
  znachorka: dlgZnachorka as unknown as DialogueFileDef,
  gajowy: dlgGajowy as unknown as DialogueFileDef,
  kopacz: dlgKopacz as unknown as DialogueFileDef,
  wdowa: dlgWdowa as unknown as DialogueFileDef,
  stach: dlgStach as unknown as DialogueFileDef,
  furman: dlgFurman as unknown as DialogueFileDef,
  najemnik: dlgNajemnik as unknown as DialogueFileDef,
  oblawa: dlgOblawa as unknown as DialogueFileDef,
  kontrola: dlgKontrola as unknown as DialogueFileDef,
  halina: dlgHalina as unknown as DialogueFileDef,
  dozorca: dlgDozorca as unknown as DialogueFileDef,
  ranny: dlgRanny as unknown as DialogueFileDef,
  pisarz: dlgPisarz as unknown as DialogueFileDef
};

export function registerChapter2Dialogues(data: OriginGameData): void {
  Object.assign(data.prologueDialogues, CHAPTER2_DIALOGUES);
}
