import type { OstrzeEngineState } from '../../engine-bridge/OstrzeEngineState';
import { getPixArtMeta } from '../assets/pixArt';
import { ostrzeAudio } from '../audio/ostrzeAudio';
import type { OriginGameData } from '../data/originTypes';
import {
  classifyCombatLogEvent,
  formatEnemyResistances,
  resolveEnemyOriginId,
  resolveEnemyPixArtId
} from '../rules/combatEnemyMeta';

/**
 * Compact Ostrze combat target card mounted alongside engine HudOverlay
 * (without modifying engine/ internals). Shows 64x48 .pix enemy portrait,
 * HP/AP/Defense, active debuffs, resistances from origin/data/enemies.json,
 * target switcher tabs, and triggers WebAudio combat SFX + crit pulse.
 */
export class CombatTargetOverlay {
  private readonly root: HTMLElement;
  private readonly engine: OstrzeEngineState;
  private readonly data: OriginGameData;

  private selectedEnemyId: string | null = null;
  private wasCombatActive = false;
  private lastSeenLogHead: string | null = null;
  private critFlashUntil = 0;

  constructor(engine: OstrzeEngineState, data: OriginGameData) {
    this.engine = engine;
    this.data = data;

    this.root = document.createElement('div');
    this.root.id = 'ostrze-combat-target-root';
    document.body.appendChild(this.root);
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public sync(): void {
    const isActive = this.engine.combatState.active;

    // Combat start / end audio transitions
    if (isActive && !this.wasCombatActive) {
      ostrzeAudio.playCombatSfx('start');
      this.lastSeenLogHead = this.engine.logs[0] ?? null;
    } else if (!isActive && this.wasCombatActive) {
      const playerAlive = (this.engine.player.combat?.hp ?? 1) > 0;
      const anyLivingEnemy = this.engine.npcs.some((n) => n.combat?.isHostile && n.combat.isAlive);
      if (!playerAlive) {
        ostrzeAudio.playCombatSfx('defeat');
      } else if (!anyLivingEnemy) {
        ostrzeAudio.playCombatSfx('victory');
      }
      this.selectedEnemyId = null;
      this.critFlashUntil = 0;
    }
    this.wasCombatActive = isActive;

    if (!isActive) {
      if (this.root.innerHTML !== '') {
        this.root.innerHTML = '';
      }
      return;
    }

    // Detect latest combat log event for SFX & crit flash
    const latestLog = this.engine.logs[0] ?? null;
    if (latestLog && latestLog !== this.lastSeenLogHead) {
      this.lastSeenLogHead = latestLog;
      const kind = classifyCombatLogEvent(latestLog);
      if (kind === 'crit') {
        ostrzeAudio.playCombatSfx('crit');
        this.critFlashUntil = Date.now() + 550;
      } else if (kind === 'hit') {
        ostrzeAudio.playCombatSfx('hit');
      } else if (kind === 'miss') {
        ostrzeAudio.playCombatSfx('miss');
      }
    }

    const livingEnemies = this.engine.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
    if (livingEnemies.length === 0) {
      this.root.innerHTML = '';
      return;
    }

    if (!this.selectedEnemyId || !livingEnemies.some((e) => e.id === this.selectedEnemyId)) {
      const activeTurnEnemy = livingEnemies.find((e) => e.id === this.engine.combatState.activeTurnActorId);
      this.selectedEnemyId = (activeTurnEnemy ?? livingEnemies[0]).id;
    }

    const target = livingEnemies.find((e) => e.id === this.selectedEnemyId) ?? livingEnemies[0];
    const c = target.combat!;
    const hpPct = Math.min(100, Math.max(0, Math.round((c.hp / Math.max(1, c.maxHp)) * 100)));

    const pixId = resolveEnemyPixArtId(target.id, target.recipe.name);
    const pixMeta = pixId ? getPixArtMeta(pixId) : null;
    const originId = resolveEnemyOriginId(target.id, target.recipe.name);
    const resistances = formatEnemyResistances(originId, this.data);
    const originDef = originId ? this.data.enemies.find((e) => e.id === originId) : undefined;

    const statusPills: string[] = [];
    if (c.dazedHeadTurns > 0) {
      statusPills.push(`<span class="ostrze-combat-pill is-status">💫 Oszołomiony (${c.dazedHeadTurns})</span>`);
    }
    if (c.crippledLegsTurns > 0) {
      statusPills.push(`<span class="ostrze-combat-pill is-status">🦵 Okaleczony (${c.crippledLegsTurns})</span>`);
    }
    if (c.defending) {
      statusPills.push(`<span class="ostrze-combat-pill is-defend">🛡️ Obrona</span>`);
    }
    for (const tag of resistances) {
      statusPills.push(
        `<span class="ostrze-combat-pill ${tag.kind === 'resist' ? 'is-resist' : 'is-weak'}">${this.escape(tag.label)}</span>`
      );
    }

    const tabsHtml =
      livingEnemies.length > 1
        ? `<div class="ostrze-combat-tabs">${livingEnemies
            .map(
              (enemy, idx) => `
                <button
                  class="ostrze-combat-tab ${enemy.id === target.id ? 'is-active' : ''}"
                  data-combat-target="${this.escape(enemy.id)}"
                >
                  ${idx + 1}. ${this.escape(enemy.recipe.name)}
                </button>
              `
            )
            .join('')}</div>`
        : '';

    const portraitHtml = pixMeta
      ? `
        <div class="ostrze-combat-portrait-frame">
          <img
            class="ostrze-combat-portrait ostrze-pix-art"
            src="${this.escape(pixMeta.dataUri)}"
            width="${pixMeta.width}"
            height="${pixMeta.height}"
            alt="${this.escape(target.recipe.name)}"
          />
        </div>
      `
      : '';

    const isCritFlash = Date.now() < this.critFlashUntil;
    const defenseVal = originDef?.defense ?? 12;

    this.root.innerHTML = `
      <aside class="ostrze-combat-target-card ${isCritFlash ? 'is-crit-flash' : ''}">
        ${tabsHtml}
        <div class="ostrze-combat-target-head">
          ${portraitHtml}
          <div class="ostrze-combat-target-info">
            <div class="ostrze-combat-target-name">${this.escape(target.recipe.name)}</div>
            <div class="ostrze-combat-target-stats">
              <span>AP: <strong>${c.ap}/${c.maxAp}</strong></span>
              <span>Obrona: <strong>${defenseVal}</strong></span>
            </div>
            <div class="ostrze-hp-bar" style="margin-top:6px;">
              <div class="ostrze-hp-fill ${hpPct <= 30 ? 'is-low' : ''}" style="width:${hpPct}%"></div>
              <span class="ostrze-hp-label">${c.hp} / ${c.maxHp} HP</span>
            </div>
          </div>
        </div>
        ${statusPills.length > 0 ? `<div class="ostrze-combat-pills">${statusPills.join('')}</div>` : ''}
      </aside>
    `;

    this.root.querySelectorAll<HTMLElement>('[data-combat-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.combatTarget ?? null;
        if (id && id !== this.selectedEnemyId) {
          this.selectedEnemyId = id;
          ostrzeAudio.playUiClick();
          this.sync();
        }
      });
    });
  }
}
