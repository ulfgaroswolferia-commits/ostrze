import { computeAttackPreview } from '@ulf/rpg/combatSystem';
import type { OstrzeEngineState } from '../../engine-bridge/OstrzeEngineState';
import { getPixArtMeta } from '../assets/pixArt';
import { ostrzeAudio } from '../audio/ostrzeAudio';
import type { OriginGameData } from '../data/originTypes';
import { resolveEnemyArchetype } from '../rules/combatAi';
import { resolveQuickBeltSlots } from '../rules/combatConsumables';
import {
  classifyCombatLogEvent,
  formatEnemyResistances,
  getDamageTypeLabel,
  getEnemyDamageMultiplier,
  resolveEnemyOriginId,
  resolveEnemyPixArtId,
  resolvePlayerWeaponDamageType
} from '../rules/combatEnemyMeta';
import {
  evaluateGuardBreak,
  evaluateStatusSynergies
} from '../rules/combatSynergies';
import {
  evaluateExecutionBonus,
  MAX_COMBAT_MOMENTUM
} from '../rules/combatMomentum';
import { escapeHtml } from './escapeHtml';

/**
 * Compact Ostrze combat target card mounted alongside engine HudOverlay
 * (without modifying engine/ internals). Shows 64x48 .pix enemy portrait,
 * HP/AP/Defense, live attack preview with status synergies & Guard Break,
 * separated Enemy vs Player status sections, actionable boss telegraphs,
 * synced target switcher tabs ([Tab]), and triggers WebAudio combat SFX + crit pulse.
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
  public onRequestManeuver?: (targetId: string) => void;
  public onUiMutated?: () => void;

  constructor(engine: OstrzeEngineState, data: OriginGameData) {
    this.engine = engine;
    this.data = data;

    document.getElementById('ostrze-combat-target-root')?.remove();
    this.root = document.createElement('div');
    this.root.id = 'ostrze-combat-target-root';
    document.body.appendChild(this.root);

    // Single delegated click listener prevents leaking per-render AbortSignal listeners.
    this.root.addEventListener?.(
      'click',
      (e) => {
        const el = e.target as HTMLElement | null;
        if (!el) return;

        const maneuverBtn = el.closest<HTMLElement>('[data-combat-maneuver]');
        if (maneuverBtn) {
          const targetId = this.selectedEnemyId ?? this.engine.combatState.selectedTargetId;
          if (!targetId) return;
          if (this.onRequestManeuver) {
            this.onRequestManeuver(targetId);
            return;
          }
          const res = this.engine.performPlayerWeaponManeuver(targetId);
          if (res.ok) {
            ostrzeAudio.playManeuverSfx();
            this.sync();
            this.onUiMutated?.();
          }
          return;
        }

        const barrelBtn = el.closest<HTMLElement>('[data-combat-barrel]');
        if (barrelBtn) {
          const bId = barrelBtn.dataset.combatBarrel;
          const res = this.engine.detonateOilBarrel(bId);
          if (res.ok) {
            ostrzeAudio.playExplosionSfx();
            this.sync();
            this.onUiMutated?.();
          }
          return;
        }

        const targetBtn = el.closest<HTMLElement>('[data-combat-target]');
        if (targetBtn) {
          const id = targetBtn.dataset.combatTarget ?? null;
          if (id && id !== this.selectedEnemyId) {
            this.selectedEnemyId = id;
            this.engine.combatState.selectedTargetId = id;
            ostrzeAudio.playUiClick();
            this.sync();
          }
        }
      },
      { signal: this.abortController.signal }
    );
  }

  public destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    this.root.remove();
  }

  /**
   * Cycles the active combat target to the next living hostile and syncs `engine.combatState.selectedTargetId`.
   */
  public cycleTarget(): boolean {
    if (this.disposed || !this.engine.combatState.active) return false;
    const livingEnemies = this.engine.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
    if (livingEnemies.length <= 1) return false;
    const curId = this.selectedEnemyId ?? this.engine.combatState.selectedTargetId;
    const curIdx = livingEnemies.findIndex((e) => e.id === curId);
    const nextEnemy = livingEnemies[(curIdx + 1) % livingEnemies.length];
    if (!nextEnemy) return false;
    this.selectedEnemyId = nextEnemy.id;
    this.engine.combatState.selectedTargetId = nextEnemy.id;
    ostrzeAudio.playUiClick();
    this.sync();
    return true;
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
      ostrzeAudio.setMusicTheme('combat');
      this.lastSeenLogHead = this.engine.logs[0] ?? null;
    } else if (!isActive && this.wasCombatActive) {
      const playerAlive = (this.engine.player.combat?.hp ?? 1) > 0;
      const anyLivingEnemy = this.engine.npcs.some((n) => n.combat?.isHostile && n.combat.isAlive);
      if (!playerAlive) {
        ostrzeAudio.playCombatSfx('defeat');
      } else if (!anyLivingEnemy) {
        ostrzeAudio.playCombatSfx('victory');
      }
      ostrzeAudio.restoreExplorationMusic();
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

    // Detect latest combat log event for target-card crit pulse (combat SFX fires directly from engine event)
    const latestLog = this.engine.logs[0] ?? null;
    if (latestLog && latestLog !== this.lastSeenLogHead) {
      this.lastSeenLogHead = latestLog;
      const kind = classifyCombatLogEvent(latestLog);
      if (kind === 'crit') {
        this.critFlashUntil = Date.now() + 550;
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
    if (!this.engine.combatState.selectedTargetId) {
      this.engine.combatState.selectedTargetId = target.id;
    }
    const c = target.combat!;
    const isCritFlash = Date.now() < this.critFlashUntil;
    const telegraph = this.engine.getTelegraphedIntent(target.id);
    const ostrzeState = this.engine.getActiveOstrzeState();
    const playerWeaponType = resolvePlayerWeaponDamageType(ostrzeState, this.data);
    const selectedMode = this.engine.combatState.selectedAttackMode;
    const targetBurnTurns = this.engine.getEnemyBurnTurns(target.id);
    const targetBleedTurns = this.engine.getEnemyBleedTurns(target.id);
    const playerStatuses = this.engine.getPlayerActiveStatusTurns();
    const playerDefending = Boolean(this.engine.player.combat?.defending);
    const playerRiposteReady = this.engine.isPlayerRiposteReady();
    const playerFeintReady = this.engine.isPlayerFeintReady();
    const playerOiled = Boolean(
      ostrzeState?.character?.effects.some((e) => e.id === 'natluszczone_ostrze')
    );
    const targetCover = this.engine.getActorCoverInfo(target);
    const playerCover = this.engine.getActorCoverInfo(this.engine.player);
    const maneuverState = this.engine.getWeaponManeuverState(target.id);
    const nearbyBarrel = this.engine.findNearbyOilBarrel();
    const momentumBonus = this.engine.getCombatMomentumBonus();
    const executionBonus = evaluateExecutionBonus(c.hp, c.maxHp);
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
      targetBurnTurns,
      targetBleedTurns,
      targetCover.hasCover ? 1 : 0,
      playerCover.hasCover ? 1 : 0,
      maneuverState.maneuver.id,
      maneuverState.cooldownLeft,
      maneuverState.canUse ? 1 : 0,
      nearbyBarrel?.id ?? '',
      momentumBonus.momentum,
      executionBonus.isExecutable ? 1 : 0,
      this.engine.player.combat?.ap ?? 0,
      isCritFlash ? 1 : 0,
      telegraph ?? '',
      playerWeaponType,
      selectedMode,
      playerDefending ? 1 : 0,
      playerRiposteReady ? 1 : 0,
      playerFeintReady ? 1 : 0,
      playerOiled ? 1 : 0,
      playerStatuses.krwawienie ?? 0,
      playerStatuses.zatrucie ?? 0,
      playerStatuses.strach ?? 0,
      this.engine.player.tileX,
      this.engine.player.tileY,
      target.tileX,
      target.tileY,
      livingEnemies
        .map((e) => `${e.id}:${e.recipe.name}:${e.combat?.hp ?? 0}/${e.combat?.maxHp ?? 0}`)
        .join(',')
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
    if (targetBleedTurns > 0) {
      statusPills.push(`<span class="ostrze-combat-pill is-weak">🩸 Krwawienie (${targetBleedTurns} t.)</span>`);
    }
    if (targetBurnTurns > 0) {
      statusPills.push(`<span class="ostrze-combat-pill is-weak">🔥 Podpalony (${targetBurnTurns} t.)</span>`);
    }
    if (c.dazedHeadTurns > 0) {
      statusPills.push(`<span class="ostrze-combat-pill is-status">💫 Oszołomiony (${c.dazedHeadTurns})</span>`);
    }
    if (c.crippledLegsTurns > 0) {
      statusPills.push(`<span class="ostrze-combat-pill is-status">🦵 Okaleczony (${c.crippledLegsTurns})</span>`);
    }
    if (c.defending) {
      statusPills.push(`<span class="ostrze-combat-pill is-defend">🛡️ Garda</span>`);
    }
    if (targetCover.hasCover) {
      statusPills.push(`<span class="ostrze-combat-pill is-defend">🧱 Osłona (-20% dyst.)</span>`);
    }
    for (const tag of resistances) {
      statusPills.push(
        `<span class="ostrze-combat-pill ${tag.kind === 'resist' ? 'is-resist' : 'is-weak'}">${this.escape(tag.label)}</span>`
      );
    }

    const tabsHtml =
      livingEnemies.length > 1
        ? `<div class="ostrze-combat-tabs" title="Przełącz cel klawiszem Tab">${livingEnemies
            .map((enemy, idx) => {
              const eHpPct = Math.min(
                100,
                Math.max(0, Math.round(((enemy.combat?.hp ?? 0) / Math.max(1, enemy.combat?.maxHp ?? 1)) * 100))
              );
              return `
                <button
                  type="button"
                  class="ostrze-combat-tab ${enemy.id === target.id ? 'is-active' : ''} ${eHpPct <= 30 ? 'is-low' : ''}"
                  data-combat-target="${this.escape(enemy.id)}"
                >
                  <span class="ostrze-combat-tab-text">${idx + 1}. ${this.escape(enemy.recipe.name)}</span>
                  <span class="ostrze-combat-tab-hp"><span style="width:${eHpPct}%"></span></span>
                </button>
              `;
            })
            .join('')}<kbd class="ostrze-kbd ostrze-combat-tab-kbd" title="Przełącz cel">Tab</kbd></div>`
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

    // Live synergies & Guard Break evaluation for current selected attack mode
    const isMeleeWeapon = playerSnap.derived.weaponProfile.maxRange <= 2;
    const synergies = evaluateStatusSynergies({
      targetBleeding: targetBleedTurns > 0,
      targetBurning: targetBurnTurns > 0,
      targetDazedOrCrippled: c.dazedHeadTurns > 0 || c.crippledLegsTurns > 0,
      isMeleeAttack: isMeleeWeapon,
      isHeavyOrManeuver: selectedMode === 'power'
    });
    const guardBreak = evaluateGuardBreak({
      targetDefending: Boolean(c.defending),
      attackMode: selectedMode,
      isFeint: playerFeintReady
    });

    const totalDmgMult =
      mult *
      synergies.damageMultiplier *
      guardBreak.damageMultiplier *
      momentumBonus.damageMultiplier *
      executionBonus.damageMultiplier;
    const estMin =
      Math.max(1, Math.round(preview.estimatedMinDamage * totalDmgMult)) +
      synergies.bonusFireDamage;
    const estMax =
      Math.max(
        Math.max(1, Math.round(preview.estimatedMinDamage * totalDmgMult)),
        Math.round(preview.estimatedMaxDamage * totalDmgMult)
      ) + synergies.bonusFireDamage;
    const estHitPct = Math.min(
      95,
      Math.max(5, preview.hitChancePct + synergies.hitBonusPct + momentumBonus.hitBonusPct)
    );

    const multBadge =
      mult < 1
        ? `<span class="ostrze-combat-mult is-resist">×${mult} ODPORNOŚĆ</span>`
        : mult > 1
          ? `<span class="ostrze-combat-mult is-weak">×${mult} PODATNOŚĆ</span>`
          : playerWeaponType === 'gwiezdne'
            ? `<span class="ostrze-combat-mult is-star">✨ Gwiezdne (×1.0)</span>`
            : `<span class="ostrze-combat-mult">×1.0</span>`;

    const activeSynergyPills: string[] = [];
    if (executionBonus.isExecutable && executionBonus.tag) {
      activeSynergyPills.push(
        `<span class="ostrze-combat-pill is-execute" data-combat-executable="true">${this.escape(executionBonus.tag)}</span>`
      );
    }
    if (guardBreak.triggered) {
      activeSynergyPills.push(
        `<span class="ostrze-combat-pill is-synergy">💥 PRZEŁAMANIE GARDY (+25%, -1 AP)</span>`
      );
    }
    for (const tag of synergies.tags) {
      activeSynergyPills.push(`<span class="ostrze-combat-pill is-synergy">${this.escape(tag)}</span>`);
    }
    const activeSynergyHtml =
      activeSynergyPills.length > 0
        ? `<div class="ostrze-combat-synergy-strip" data-combat-synergies="true">${activeSynergyPills.join('')}</div>`
        : '';

    const tacticalHints: string[] = [];
    if (selectedMode !== 'power') {
      if (c.defending && !guardBreak.triggered) {
        tacticalHints.push('💥 Przełamanie Gardy (+25%, -1 AP)');
      }
      if (targetBurnTurns > 0) {
        tacticalHints.push('🔥 Wybuch Żaru (+5 ognia)');
      }
    }
    const tacticalTipHtml =
      tacticalHints.length > 0
        ? `<div class="ostrze-combat-tactical-tip" data-combat-tactical-tip="true">💡 <kbd class="ostrze-kbd">2</kbd> Silny cios lub <kbd class="ostrze-kbd">R</kbd> → ${this.escape(tacticalHints.join(' · '))}</div>`
        : '';

    const telegraphHtml =
      telegraph === 'heavy_cleave'
        ? `<div class="ostrze-combat-telegraph" data-combat-telegraph="heavy_cleave">⚠️ BIERZE ZAMACH — użyj Gardy <kbd class="ostrze-kbd">3</kbd> lub ogłusz <kbd class="ostrze-kbd">R</kbd>!</div>`
        : telegraph === 'terror_howl'
          ? `<div class="ostrze-combat-telegraph" data-combat-telegraph="terror_howl">⚠️ ZBIERA SIŁY DO WYCIA — ogłusz go <kbd class="ostrze-kbd">R</kbd> lub Garda <kbd class="ostrze-kbd">3</kbd>!</div>`
          : '';

    const playerPills: string[] = [];
    const beltSlots = ostrzeState
      ? resolveQuickBeltSlots(ostrzeState, this.data, this.engine.player.combat?.ap ?? 0, {
          playerHp: this.engine.player.combat?.hp,
          playerMaxHp: this.engine.player.combat?.maxHp,
          hasLivingEnemy: livingEnemies.length > 0
        })
      : [];
    const findCureHint = (effId: string): string => {
      for (const s of beltSlots) {
        if (!s) continue;
        const item = this.data.items.find((i) => i.id === s.itemId);
        if (item?.removes?.includes(effId)) {
          return ` → [${s.slotIndex + 4}] ${item.name}`;
        }
      }
      return '';
    };
    if ((playerStatuses.krwawienie ?? 0) > 0) {
      const hint = findCureHint('krwawienie');
      playerPills.push(
        `<span class="ostrze-combat-pill is-weak">🩸 Krwawienie (${playerStatuses.krwawienie} t.)${this.escape(hint)}</span>`
      );
    }
    if ((playerStatuses.zatrucie ?? 0) > 0) {
      const hint = findCureHint('zatrucie');
      playerPills.push(
        `<span class="ostrze-combat-pill is-weak">☠️ Zatrucie (${playerStatuses.zatrucie} t.)${this.escape(hint)}</span>`
      );
    }
    if ((playerStatuses.strach ?? 0) > 0) {
      playerPills.push(
        `<span class="ostrze-combat-pill is-status">😨 Strach (${playerStatuses.strach} t.)</span>`
      );
    }
    if (playerDefending) {
      playerPills.push(
        `<span class="ostrze-combat-pill is-defend">${playerRiposteReady ? '🛡️ Garda aktywna · Riposta' : '🛡️ Garda aktywna'}</span>`
      );
    }
    if (playerCover.hasCover) {
      playerPills.push(`<span class="ostrze-combat-pill is-defend">🧱 Osłona (-20% dyst.)</span>`);
    }
    if (playerOiled) {
      playerPills.push(`<span class="ostrze-combat-pill is-status">✨ Natłuszczone ostrze</span>`);
    }
    if (playerFeintReady) {
      playerPills.push(`<span class="ostrze-combat-pill is-defend">⚔️ Finta gotowa</span>`);
    }

    const enemyStatusSectionHtml =
      statusPills.length > 0
        ? `
          <div class="ostrze-combat-section" data-enemy-combat-status="true">
            <div class="ostrze-combat-section-label">Statusy celu</div>
            <div class="ostrze-combat-pills">${statusPills.join('')}</div>
          </div>
        `
        : '';

    const momentumPipsHtml = Array.from({ length: MAX_COMBAT_MOMENTUM }, (_, idx) => {
      const filled = idx < momentumBonus.momentum;
      const isPeak = momentumBonus.tier === 2 && filled;
      return `<span class="ostrze-momentum-pip ${filled ? 'is-filled' : ''} ${isPeak ? 'is-peak' : ''}"></span>`;
    }).join('');
    const momentumDesc =
      momentumBonus.tier === 2
        ? `${momentumBonus.label} (+20% obr., +15% kryt)`
        : momentumBonus.tier === 1
          ? `${momentumBonus.label} (+10% obr., +8% kryt)`
          : `${momentumBonus.label} (${momentumBonus.momentum}/${MAX_COMBAT_MOMENTUM})`;
    const momentumRowHtml = `
      <div class="ostrze-momentum-row is-tier-${momentumBonus.tier}" data-combat-momentum="${momentumBonus.momentum}" title="Trafienia, synergie, riposty i dobicia ładują Impet Walki (na maksie: Szał Ostrza +20% obr. i +15% kryt; zabicie wroga zwraca +2 AP).">
        <div class="ostrze-momentum-head">
          <span class="ostrze-momentum-label">${this.escape(momentumDesc)}</span>
        </div>
        <div class="ostrze-momentum-pips">${momentumPipsHtml}</div>
      </div>
    `;

    const playerStripHtml = `
      <div class="ostrze-combat-section" data-player-combat-status="true">
        <div class="ostrze-combat-section-label">Twój stan</div>
        ${momentumRowHtml}
        ${playerPills.length > 0 ? `<div class="ostrze-combat-pills">${playerPills.join('')}</div>` : ''}
      </div>
    `;

    const maneuverBtnLabel =
      maneuverState.cooldownLeft > 0
        ? `${maneuverState.maneuver.icon} ${this.escape(maneuverState.maneuver.shortLabel)} (${maneuverState.cooldownLeft} t.)`
        : `${maneuverState.maneuver.icon} <kbd class="ostrze-kbd">R</kbd> ${this.escape(maneuverState.maneuver.shortLabel)} <span class="ostrze-maneuver-cost">${maneuverState.maneuver.apCost} AP</span><span class="ostrze-maneuver-rhythm">⚡ Rytm</span>`;
    const canDetonateBarrel = Boolean(
      nearbyBarrel && (this.engine.player.combat?.ap ?? 0) >= 3
    );
    const barrelBtnHtml = nearbyBarrel
      ? `<button type="button" class="ostrze-tactical-action-btn is-barrel" data-combat-barrel="${this.escape(nearbyBarrel.id)}" ${canDetonateBarrel ? '' : 'disabled'} title="Wysadź beczkę ze smołą w promieniu 2 kafli (ogień + Podpalenie)">🛢️ Wysadź beczkę (3 AP)</button>`
      : '';
    const tacticalActionsHtml = `
      <div class="ostrze-combat-tactical-actions">
        <button
          type="button"
          class="ostrze-tactical-action-btn ${maneuverState.canUse ? 'is-ready' : ''}"
          data-combat-maneuver="true"
          ${maneuverState.canUse ? '' : 'disabled'}
          title="${this.escape(maneuverState.maneuver.description)}"
        >${maneuverBtnLabel}</button>
        ${barrelBtnHtml}
      </div>
    `;

    const oddsClass = estHitPct >= 75 ? 'is-high' : estHitPct >= 50 ? 'is-mid' : 'is-low';

    this.root.innerHTML = `
      <aside class="ostrze-combat-target-card ${isCritFlash ? 'is-crit-flash' : ''} ${executionBonus.isExecutable ? 'is-executable' : ''}">
        ${tabsHtml}
        ${telegraphHtml}
        <div class="ostrze-combat-target-head">
          ${portraitHtml}
          <div class="ostrze-combat-target-info">
            <div class="ostrze-combat-target-name">
              <span class="ostrze-combat-target-title">${this.escape(target.recipe.name)}</span>
              <span class="ostrze-combat-archetype">${archetypeLabels[archetype]}</span>
            </div>
            <div class="ostrze-hp-bar ostrze-combat-hp-bar">
              <div class="ostrze-hp-fill ${hpPct <= 30 ? 'is-low' : ''}" style="width:${hpPct}%"></div>
              <span class="ostrze-hp-label">${c.hp} / ${c.maxHp} HP</span>
            </div>
            <div class="ostrze-combat-target-stats">
              <span class="ostrze-combat-stat-chip">AP <strong class="ostrze-num">${c.ap}/${c.maxAp}</strong></span>
              <span class="ostrze-combat-stat-chip">Obrona <strong class="ostrze-num">${defenseVal}</strong></span>
            </div>
          </div>
        </div>
        <div class="ostrze-combat-attack-preview">
          <div class="ostrze-combat-forecast-main">
            <span class="ostrze-combat-forecast-label">⚔️ Twój atak (${this.escape(dmgTypeLabel)}):</span>
            <strong class="ostrze-combat-forecast-dmg ostrze-num">${estMin}–${estMax} obr.</strong>
            <span class="ostrze-combat-hit-odds ${oddsClass} ostrze-num">${estHitPct}%</span>
          </div>
          ${multBadge}
        </div>
        ${activeSynergyHtml}
        ${tacticalTipHtml}
        ${enemyStatusSectionHtml}
        ${playerStripHtml}
        ${tacticalActionsHtml}
      </aside>
    `;
  }
}
