import type {
  DialogueActionSpec,
  DialogueFileDef,
  DialogueNodeDef,
  DialogueOptionDef,
  OriginGameData,
  OstrzeGameState
} from '../data/originTypes';
import {
  computeDialogueCheckChance,
  grantXp,
  rollDialogueCheck
} from './character';
import { evaluateCondition } from './conditions';
import type { SeededRng } from './dice';
import { getStats } from './stats';
import { advanceMinutes } from './time';

export interface DialogueTranscriptEntry {
  speaker: string;
  text: string;
  playerChoiceText: string;
  checkFeedback?: string;
  checkOutcome?: 'success' | 'failure';
}

export interface ActiveOstrzeDialogue {
  dialogueId: string;
  nodeId: string;
  lastCheckFeedback?: string;
  lastCheckOutcome?: 'success' | 'failure';
  lastCheckSkillLabel?: string;
  pendingShopId?: string;
  history?: DialogueTranscriptEntry[];
  visitedOptionKeys?: string[];
}

export interface VisibleDialogueOption {
  index: number;
  option: DialogueOptionDef;
  checkLabel?: string;
  checkChance?: number;
  alreadyFailed: boolean;
  alreadyVisited: boolean;
  isFarewell: boolean;
}

export interface DialogueView {
  dialogueId: string;
  nodeId: string;
  speaker: string;
  portrait?: string;
  text: string;
  options: VisibleDialogueOption[];
  lastCheckFeedback?: string;
  lastCheckOutcome?: 'success' | 'failure';
  lastCheckSkillLabel?: string;
  history: DialogueTranscriptEntry[];
  turnNumber: number;
}

function getDialogueDef(dialogueId: string, data: OriginGameData): DialogueFileDef {
  const def = data.prologueDialogues[dialogueId];
  if (!def) {
    throw new Error(`Nieznany dialog Prologu: ${dialogueId}`);
  }
  return def;
}

function addInventoryItem(state: OstrzeGameState, itemId: string, qty: number): void {
  const existing = state.inventory.items.find((entry) => entry.id === itemId);
  if (existing) {
    existing.qty += qty;
  } else {
    state.inventory.items.push({ id: itemId, qty });
  }
}

function applyEffectToState(
  state: OstrzeGameState,
  spec: string | { id: string; stacks?: number },
  data: OriginGameData
): void {
  if (!state.character) return;
  const id = typeof spec === 'string' ? spec : spec.id;
  const addStacks = typeof spec === 'string' ? 1 : (spec.stacks ?? 1);
  const def = data.effects.find((e) => e.id === id);
  const maxStacks = def?.maxStacks ?? 3;

  const existing = state.character.effects.find((e) => e.id === id);
  if (existing) {
    existing.stacks = Math.min(maxStacks, existing.stacks + addStacks);
  } else {
    state.character.effects.push({ id, stacks: Math.min(maxStacks, addStacks) });
  }
}

export function executeDialogueActions(
  actions: DialogueActionSpec[] | undefined,
  state: OstrzeGameState,
  data: OriginGameData
): { pendingShopId?: string } {
  if (!actions || actions.length === 0) return {};
  let pendingShopId: string | undefined;

  for (const act of actions) {
    if (act.setFlag) {
      state.flags[act.setFlag] = true;
    }
    if (act.clearFlag) {
      delete state.flags[act.clearFlag];
    }
    if (act.addVar) {
      for (const [k, delta] of Object.entries(act.addVar)) {
        state.vars[k] = (state.vars[k] ?? 0) + delta;
      }
    }
    if (act.giveItem) {
      const spec =
        typeof act.giveItem === 'string'
          ? { id: act.giveItem, qty: 1 }
          : { id: act.giveItem.id, qty: act.giveItem.qty ?? 1 };
      addInventoryItem(state, spec.id, spec.qty);
    }
    if ((act as { takeItem?: string | { id: string; qty?: number } }).takeItem) {
      const rawTake = (act as { takeItem: string | { id: string; qty?: number } }).takeItem;
      const spec =
        typeof rawTake === 'string'
          ? { id: rawTake, qty: 1 }
          : { id: rawTake.id, qty: rawTake.qty ?? 1 };
      const existing = state.inventory.items.find((i) => i.id === spec.id);
      if (existing) {
        existing.qty -= spec.qty;
        if (existing.qty <= 0) {
          state.inventory.items = state.inventory.items.filter((i) => i.id !== spec.id);
          for (const [slot, eqId] of Object.entries(state.inventory.equipped)) {
            if (eqId === spec.id) {
              delete state.inventory.equipped[slot];
            }
          }
        }
      }
    }
    if (act.takeMoney && state.character) {
      state.character.money = Math.max(0, state.character.money - act.takeMoney);
    }
    if (act.giveMoney && state.character) {
      state.character.money += act.giveMoney;
    }
    if (act.giveXp && state.character) {
      grantXp(state, act.giveXp, data);
    }
    if (act.applyEffect) {
      applyEffectToState(state, act.applyEffect, data);
    }
    if (act.addEffect) {
      applyEffectToState(state, act.addEffect, data);
    }
    if (act.healFull && state.character) {
      state.character.hp = getStats(state, data).derived.hpMax;
    }
    if (act.openShop) {
      pendingShopId = act.openShop;
    }
    if (act.startQuest) {
      state.quests[act.startQuest] = 'active';
    }
    if (act.completeQuest) {
      if (state.quests[act.completeQuest] !== 'completed') {
        state.quests[act.completeQuest] = 'completed';
        const qDef = data.quests.find((q) => q.id === act.completeQuest);
        if (qDef?.onComplete && state.character) {
          for (const rew of qDef.onComplete) {
            if (rew.giveMoney) state.character.money += rew.giveMoney;
            if (rew.xp) grantXp(state, rew.xp, data);
          }
        }
      }
    }
    if (act.failQuest) {
      state.quests[act.failQuest] = 'failed';
    }
    if (act.reveal) {
      if (!state.world.knownPlaces.includes(act.reveal)) {
        state.world.knownPlaces.push(act.reveal);
      }
      const basePlace = act.reveal.split('.')[0];
      if (basePlace && !state.world.knownPlaces.includes(basePlace)) {
        state.world.knownPlaces.push(basePlace);
      }
    }
    if (typeof act.time === 'number' && act.time > 0) {
      advanceMinutes(state, act.time, data);
    }
  }

  return { pendingShopId };
}

export function startOstrzeDialogue(
  dialogueId: string,
  state: OstrzeGameState,
  data: OriginGameData
): ActiveOstrzeDialogue {
  const def = getDialogueDef(dialogueId, data);
  const startNode = def.nodes[def.start];
  if (!startNode) {
    throw new Error(`Brak węzła startowego "${def.start}" w dialogu "${dialogueId}"`);
  }
  state.flags[`dialog_met_${dialogueId}`] = true;
  const { pendingShopId } = executeDialogueActions(startNode.actions, state, data);
  return {
    dialogueId,
    nodeId: def.start,
    pendingShopId,
    history: [],
    visitedOptionKeys: []
  };
}

const UNIMPLEMENTED_DEMO_QUESTS = new Set<string>();
const MAX_TRANSCRIPT_ENTRIES = 12;

function isFarewellOption(opt: DialogueOptionDef): boolean {
  if (opt.check) return false;
  const target = opt.goto ?? 'end';
  if (target !== 'end') return false;
  const actions = opt.actions ?? [];
  const hasSignificantAction = actions.some((a) =>
    Boolean(a.openShop || a.startQuest || a.completeQuest || a.giveItem || a.takeMoney)
  );
  return !hasSignificantAction;
}

export function getOstrzeDialogueView(
  session: ActiveOstrzeDialogue,
  state: OstrzeGameState,
  data: OriginGameData
): DialogueView {
  const def = getDialogueDef(session.dialogueId, data);
  const node: DialogueNodeDef | undefined = def.nodes[session.nodeId];
  if (!node) {
    throw new Error(`Brak węzła "${session.nodeId}" w dialogu "${session.dialogueId}"`);
  }

  const visitedSet = new Set(session.visitedOptionKeys ?? []);
  const options: VisibleDialogueOption[] = [];
  const rawOptions = node.options ?? [];

  rawOptions.forEach((opt, index) => {
    if (opt.requires && !evaluateCondition(opt.requires, state, data)) {
      return;
    }
    if (opt.actions?.some((a) => a.startQuest && UNIMPLEMENTED_DEMO_QUESTS.has(a.startQuest))) {
      return;
    }

    let checkLabel: string | undefined;
    let checkChance: number | undefined;
    let alreadyFailed = false;

    if (opt.check) {
      const checkId = opt.check.skill ?? opt.check.attribute ?? '';
      const skillDef = data.skills.find((s) => s.id === checkId);
      const attrDef = data.attributes.find((a) => a.id === checkId);
      const name = skillDef?.name ?? attrDef?.name ?? checkId;
      checkLabel = `${name} ${opt.check.difficulty}`;
      checkChance = state.character
        ? computeDialogueCheckChance(state, checkId, opt.check.difficulty, data)
        : 50;

      const checkKey = `${session.dialogueId}:${session.nodeId}:${opt.id ?? index}`;
      const canRetry = Boolean((opt as { retry?: boolean }).retry ?? opt.check.retry);
      alreadyFailed = !canRetry && state.world.failedChecks.includes(checkKey);
    }

    const visitKey = `${session.nodeId}:${opt.id ?? index}`;

    options.push({
      index,
      option: opt,
      checkLabel,
      checkChance,
      alreadyFailed,
      alreadyVisited: visitedSet.has(visitKey),
      isFarewell: isFarewellOption(opt)
    });
  });

  const history = session.history ?? [];

  return {
    dialogueId: session.dialogueId,
    nodeId: session.nodeId,
    speaker: node.speaker ?? 'Rozmówca',
    portrait: node.portrait ?? def.portrait,
    text: node.text,
    options,
    lastCheckFeedback: session.lastCheckFeedback,
    lastCheckOutcome: session.lastCheckOutcome,
    lastCheckSkillLabel: session.lastCheckSkillLabel,
    history,
    turnNumber: history.length + 1
  };
}

export function chooseOstrzeDialogueOption(
  session: ActiveOstrzeDialogue,
  optionIndex: number,
  state: OstrzeGameState,
  data: OriginGameData,
  rng: SeededRng
): ActiveOstrzeDialogue | null {
  const def = getDialogueDef(session.dialogueId, data);
  const node = def.nodes[session.nodeId];
  const opt = node?.options?.[optionIndex];
  if (!opt) return session;

  let nextNodeId = opt.goto ?? 'end';
  let feedback: string | undefined;
  let outcome: 'success' | 'failure' | undefined;
  let checkSkillLabel: string | undefined;

  if (opt.check) {
    const checkId = opt.check.skill ?? opt.check.attribute ?? '';
    const skillDef = data.skills.find((s) => s.id === checkId);
    const attrDef = data.attributes.find((a) => a.id === checkId);
    const checkName = skillDef?.name ?? attrDef?.name ?? checkId;
    checkSkillLabel = `${checkName} ${opt.check.difficulty}`;

    const checkKey = `${session.dialogueId}:${session.nodeId}:${opt.id ?? optionIndex}`;
    const canRetry = Boolean((opt as { retry?: boolean }).retry ?? opt.check.retry);
    const res = rollDialogueCheck(
      state,
      checkKey,
      checkId,
      opt.check.difficulty,
      canRetry,
      data,
      rng
    );

    if (res.alreadyFailed) {
      feedback = 'Ten test był już wcześniej nieudany.';
      outcome = 'failure';
      nextNodeId = opt.failure ?? session.nodeId;
    } else if (res.success) {
      feedback = `Test udany (${res.roll} ≤ ${res.chance}%).`;
      outcome = 'success';
      nextNodeId = opt.success ?? opt.goto ?? 'end';
    } else {
      feedback = `Test nieudany (${res.roll} > ${res.chance}%).`;
      outcome = 'failure';
      nextNodeId = opt.failure ?? opt.goto ?? 'end';
    }
  }

  const optResult = executeDialogueActions(opt.actions, state, data);

  if (nextNodeId === 'end') {
    return null;
  }

  const targetNode = def.nodes[nextNodeId];
  if (!targetNode) {
    return null;
  }

  const nodeResult = executeDialogueActions(targetNode.actions, state, data);

  const nextHistory: DialogueTranscriptEntry[] = [
    ...(session.history ?? []),
    {
      speaker: node.speaker ?? 'Rozmówca',
      text: node.text,
      playerChoiceText: opt.text,
      checkFeedback: feedback,
      checkOutcome: outcome
    }
  ].slice(-MAX_TRANSCRIPT_ENTRIES);

  const visitKey = `${session.nodeId}:${opt.id ?? optionIndex}`;
  const prevVisited = session.visitedOptionKeys ?? [];
  const nextVisited = prevVisited.includes(visitKey)
    ? prevVisited
    : [...prevVisited, visitKey];

  return {
    dialogueId: session.dialogueId,
    nodeId: nextNodeId,
    lastCheckFeedback: feedback,
    lastCheckOutcome: outcome,
    lastCheckSkillLabel: checkSkillLabel,
    pendingShopId: nodeResult.pendingShopId ?? optResult.pendingShopId,
    history: nextHistory,
    visitedOptionKeys: nextVisited
  };
}
