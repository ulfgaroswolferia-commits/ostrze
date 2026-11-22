import { computeAttackPreview } from '@ulf/rpg/combatSystem';
import type { OstrzeEngineState } from '../../engine-bridge/OstrzeEngineState';
import { getPixArtMeta } from '../assets/pixArt';
import { ostrzeAudio } from '../audio/ostrzeAudio';
import type { OriginGameData } from '../data/originTypes';
import { resolveEnemyArchetype } from '../rules/combatAi';
import {
  classifyCombatLogEvent,
  formatEnemyResistances,
  getDamageTypeLabel,
  getEnemyDamageMultiplier,
  resolveEnemyOriginId,
  resolveEnemyPixArtId,
  resolvePlayerWeaponDamageType
} from '../rules/combatEnemyMeta';
import { escapeHtml } from './escapeHtml';

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
  private readonly abortController = new AbortController();
  private disposed = false;

  private selectedEnemyId: string | null = null;
  private wasCombatActive = false;
  private lastSeenLogHead: string | null = null;
  private critFlashUntil = 0;
  private lastRenderedKey: string | null = null;

  constructor(engine: OstrzeEngineState, data: OriginGameData) {
    this.engine = engine;
    this.data = data;

    document.getElementById('ostrze-combat-target-root')?.remove();
    this.root = document.createElement('div');
    this.root.id = 'ostrze-combat-target-root';
    document.body.appendChild(this.root);
  }

  public destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    this.root.remove();
  }

  private escape(str: string): string {
    return escapeHtml(str);
  }

  public sync(): void {
    if (this.disposed) return;
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
      this.lastRenderedKey = null;
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
      this.lastRenderedKey = null;
      return;
    }

    if (!this.selectedEnemyId || !livingEnemies.some((e) => e.id === this.selectedEnemyId)) {
      const selectedTarget = livingEnemies.find(
        (e) => e.id === this.engine.combatState.selectedTargetId
      );
      const activeTurnEnemy = livingEnemies.find(
        (e) => e.id === this.engine.combatState.activeTurnActorId
      );
      this.selectedEnemyId = (selectedTarget ?? activeTurnEnemy ?? livingEnemies[0]).id;
    }

    const target = livingEnemies.find((e) => e.id === this.selectedEnemyId) ?? livingEnemies[0];
    const c = target.combat!;
    const isCritFlash = Date.now() < this.critFlashUntil;
    const telegraph = this.engine.getTelegraphedIntent(target.id);
    const ostrzeState = this.engine.getActiveOstrzeState();
    const playerWeaponType = resolvePlayerWeaponDamageType(ostrzeState, this.data);
    const selectedMode = this.engine.combatState.selectedAttackMode;
    const stateKey = [
      target.id,
      target.recipe.name,
      c.hp,
      c.maxHp,
      c.ap,
      c.maxAp,
      c.dazedHeadTurns,
      c.crippledLegsTurns,
      c.defending ? 1 : 0,
      isCritFlash ? 1 : 0,
      telegraph ?? '',
      playerWeaponType,
      selectedMode,
      this.engine.player.tileX,
      this.engine.player.tileY,
      target.tileX,
      target.tileY,
      livingEnemies.map((e) => `${e.id}:${e.recipe.name}`).join(',')
    ].join('|');

    if (stateKey === this.lastRenderedKey) {
      return;
    }
    this.lastRenderedKey = stateKey;

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

    const defenseVal = originDef?.defense ?? 12;
    const archetype = resolveEnemyArchetype(originId, originDef, c.difficulty);
    const archetypeLabels: Record<typeof archetype, string> = {
      boss: '👑 Boss',
      ranged_kiter: '🏹 Łucznik',
      predator: '🐺 Drapieżnik',
      melee_cautious: '⚔️ Wojownik'
    };

    const mult = getEnemyDamageMultiplier(originId, playerWeaponType, this.data);
    const dmgTypeLabel = getDamageTypeLabel(playerWeaponType);
    const playerSnap = this.engine.getActorCombatant(this.engine.player);
    const enemySnap = this.engine.getActorCombatant(target);
    const dist = Math.hypot(target.tileX - this.engine.player.tileX, target.tileY - this.engine.player.tileY);
    const preview = computeAttackPreview(playerSnap, enemySnap, dist, selectedMode);
    const estMin = Math.max(1, Math.round(preview.estimatedMinDamage * mult));
    const estMax = Math.max(estMin, Math.round(preview.estimatedMaxDamage * mult));
    const multBadge =
      mult < 1
        ? `<span class="ostrze-combat-mult is-resist">×${mult} ODPORNOŚĆ</span>`
        : mult > 1
          ? `<span class="ostrze-combat-mult is-weak">×${mult} PODATNOŚĆ</span>`
          : playerWeaponType === 'gwiezdne'
            ? `<span class="ostrze-combat-mult is-star">✨ Gwiezdne (×1.0)</span>`
            : `<span class="ostrze-combat-mult">×1.0</span>`;

    const telegraphHtml =
      telegraph === 'heavy_cleave'
        ? `<div class="ostrze-combat-telegraph">⚠️ BIERZE ZAMACH — użyj Gardy lub ogłusz!</div>`
        : telegraph === 'terror_howl'
          ? `<div class="ostrze-combat-telegraph">⚠️ ZBIERA SIŁY DO WYCIA — ogłusz go!</div>`
          : '';

    this.root.innerHTML = `
      <aside class="ostrze-combat-target-card ${isCritFlash ? 'is-crit-flash' : ''}">
        ${tabsHtml}
        ${telegraphHtml}
        <div class="ostrze-combat-target-head">
          ${portraitHtml}
          <div class="ostrze-combat-target-info">
            <div class="ostrze-combat-target-name">
              ${this.escape(target.recipe.name)}
              <span class="ostrze-combat-archetype">${archetypeLabels[archetype]}</span>
            </div>
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
        <div class="ostrze-combat-attack-preview">
          <span>⚔️ Twój atak (${this.escape(dmgTypeLabel)}): <strong>${estMin}–${estMax} obr.</strong> · ${preview.hitChancePct}%</span>
          ${multBadge}
        </div>
        ${statusPills.length > 0 ? `<div class="ostrze-combat-pills">${statusPills.join('')}</div>` : ''}
      </aside>
    `;

    this.root.querySelectorAll<HTMLElement>('[data-combat-target]').forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const id = btn.dataset.combatTarget ?? null;
          if (id && id !== this.selectedEnemyId) {
            this.selectedEnemyId = id;
            ostrzeAudio.playUiClick();
            this.sync();
          }
        },
        { signal: this.abortController.signal }
      );
    });
  }
}
