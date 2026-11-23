import { ostrzeAudio } from '../../audio/ostrzeAudio';
import type {
  AttributeId,
  OriginGameData,
  OstrzeGameState,
  SkillId
} from '../../data/originTypes';
import {
  evaluateAchievements,
  evaluateCampaignProgress
} from '../../rules/achievements';
import {
  getAvailablePerks,
  pickPerk,
  spendAttributePoint,
  spendSkillPoint,
  xpRequiredForLevel
} from '../../rules/character';
import {
  isQuickBeltEligible,
  pinItemToQuickBelt
} from '../../rules/combatConsumables';
import type { SeededRng } from '../../rules/dice';
import { getStats } from '../../rules/stats';
import { getOstrzeLocationMeta } from '../../rules/travel';
import { escapeHtml } from '../escapeHtml';

export type CharacterSheetTab = 'stats' | 'gear' | 'journal' | 'chronicle';

export function renderCharacterSheetView(params: {
  root: HTMLElement;
  state: OstrzeGameState;
  data: OriginGameData;
  rng: SeededRng;
  activeTab: CharacterSheetTab;
  onSelectTab: (tab: CharacterSheetTab) => void;
  onUpdated: () => void;
  onShowToast: (text: string, tone: 'info' | 'gold' | 'success') => void;
  onRerender: () => void;
  onClose: () => void;
}): void {
  const {
    root,
    state,
    data,
    rng,
    activeTab,
    onSelectTab,
    onUpdated,
    onShowToast,
    onRerender,
    onClose
  } = params;
  const ch = state.character;
  if (!ch) {
    onClose();
    return;
  }

  const stats = getStats(state, data);
  const cls = data.classes.find((c) => c.id === ch.classId);
  const curFloorXp = xpRequiredForLevel(ch.level, data.rules.leveling.xpStep);
  const nextLvXp = xpRequiredForLevel(ch.level + 1, data.rules.leveling.xpStep);
  const xpSpan = Math.max(1, nextLvXp - curFloorXp);
  const xpPct = Math.min(100, Math.max(0, Math.round(((ch.xp - curFloorXp) / xpSpan) * 100)));

  const attrMaxBase = data.rules.creator.attributeMax;
  const attrsHtml = data.attributes
    .map((attr) => {
      const val = stats.permanentAttributes[attr.id];
      const max = attrMaxBase + (data.rules.creator.gifts[attr.id] ?? 0);
      const canAdd = ch.freeAttributePoints > 0 && ch.attributes[attr.id] < max;
      return `
        <div class="ostrze-row">
          <span>${escapeHtml(attr.name)}</span>
          <span class="ostrze-stepper">
            <strong>${val}</strong>
            ${canAdd ? `<button class="ostrze-step-btn" data-cs-attr="${attr.id}">+</button>` : ''}
          </span>
        </div>
      `;
    })
    .join('');

  const skillsHtml = data.skills
    .map((sk) => {
      const val = stats.skills[sk.id];
      const isTagged = ch.tagged.includes(sk.id);
      const canAdd = ch.freeSkillPoints > 0 && val < 100;
      return `
        <div class="ostrze-row">
          <span>${escapeHtml(sk.name)}${isTagged ? ' ★' : ''}</span>
          <span class="ostrze-stepper">
            <strong>${val}%</strong>
            ${canAdd ? `<button class="ostrze-step-btn" data-cs-skill="${sk.id}">+</button>` : ''}
          </span>
        </div>
      `;
    })
    .join('');

  const availablePerks = getAvailablePerks(state, data);
  const pickedPerksHtml =
    ch.perks.length > 0
      ? ch.perks
          .map((id) => {
            const p = data.perks.find((x) => x.id === id);
            return `<div class="ostrze-row"><span><strong>${escapeHtml(p?.name ?? id)}</strong></span><span>✓</span></div>`;
          })
          .join('')
      : '<div class="ostrze-subtitle" style="margin-bottom:0">Brak wybranych talentów.</div>';

  const perkChoicesHtml =
    ch.freePerkPicks > 0
      ? availablePerks
          .map(
            (p) => `
            <div class="ostrze-notice-card">
              <div class="ostrze-notice-head">
                <span class="ostrze-notice-title">${escapeHtml(p.name)}</span>
                <button class="ostrze-hub-btn is-alert" data-cs-perk="${escapeHtml(p.id)}">Wybierz talent</button>
              </div>
              <div class="ostrze-subtitle" style="margin-bottom:0">${escapeHtml(p.description ?? '')}</div>
            </div>
          `
          )
          .join('')
      : '';

  const itemsHtml =
    state.inventory.items.length > 0
      ? state.inventory.items
          .map((entry) => {
            const item = data.items.find((i) => i.id === entry.id);
            const equipSlot = item?.slot ?? (item?.type === 'weapon' ? 'bron' : undefined);
            const isEquipped = Boolean(equipSlot && state.inventory.equipped[equipSlot] === entry.id);
            const canEquip = Boolean(equipSlot) && !isEquipped;
            const healRange = item?.heal;
            const healFlat = item?.healHp;
            const canRemoveEffect = Boolean(
              item?.removes?.some((effId) => ch.effects.some((e) => e.id === effId))
            );
            const hasHeal =
              (Array.isArray(healRange) && healRange[1] > 0) ||
              (typeof healFlat === 'number' && healFlat > 0);
            const canUse =
              (hasHeal && ch.hp < stats.derived.hpMax) || canRemoveEffect;
            const useLabel = Array.isArray(healRange)
              ? healRange[0] === healRange[1]
                ? `Użyj (+${healRange[0]} HP)`
                : `Użyj (+${healRange[0]}–${healRange[1]} HP)`
              : typeof healFlat === 'number' && healFlat > 0
                ? `Użyj (+${healFlat} HP)`
                : 'Użyj';
            const beltEligible = isQuickBeltEligible(item);
            const pinnedSlotIdx = (state.inventory.quickBelt ?? []).indexOf(entry.id);
            const beltPinHtml = beltEligible
              ? pinnedSlotIdx >= 0
                ? `<button class="ostrze-hub-btn" data-cs-belt-unpin="${pinnedSlotIdx}" title="Odepnij z pasa szybkiego użycia">Pas [${pinnedSlotIdx + 4}] ✕</button>`
                : `<select class="ostrze-belt-select" data-cs-belt-pin="${escapeHtml(entry.id)}" title="Przypnij do slotu pasa walki [4]–[7]">
                    <option value="">+ Pas…</option>
                    <option value="0">Slot [4]</option>
                    <option value="1">Slot [5]</option>
                    <option value="2">Slot [6]</option>
                    <option value="3">Slot [7]</option>
                  </select>`
              : '';
            return `
              <div class="ostrze-row">
                <span>
                  ${escapeHtml(item?.name ?? entry.id)} ×${entry.qty}
                  ${isEquipped ? '<span style="color:#6fd18e;font-size:0.75rem"> [Założono]</span>' : ''}
                  ${pinnedSlotIdx >= 0 ? `<span style="color:#e5b869;font-size:0.75rem"> [Pas ${pinnedSlotIdx + 4}]</span>` : ''}
                </span>
                <span class="ostrze-stepper">
                  ${beltPinHtml}
                  ${canEquip ? `<button class="ostrze-hub-btn" data-cs-equip="${escapeHtml(entry.id)}">Załóż</button>` : ''}
                  ${canUse ? `<button class="ostrze-hub-btn" data-cs-use="${escapeHtml(entry.id)}">${useLabel}</button>` : ''}
                </span>
              </div>
            `;
          })
          .join('')
      : '<div class="ostrze-subtitle" style="margin-bottom:0">Pusty plecak.</div>';

  const pendingPts = ch.freeAttributePoints + ch.freeSkillPoints + ch.freePerkPicks;
  const hpMax = Math.max(1, stats.derived.hpMax);
  const hpPct = Math.min(100, Math.max(0, Math.round((ch.hp / hpMax) * 100)));
  const wola = state.vars.wola ?? 0;
  const dlug = state.vars.dlug ?? 0;

  const equippedEntries = Object.entries(state.inventory.equipped).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0
  );
  const equippedHtml =
    equippedEntries.length > 0
      ? equippedEntries
          .map(([slot, itemId]) => {
            const item = data.items.find((i) => i.id === itemId);
            return `<div class="ostrze-row"><span style="text-transform:capitalize;color:#9e9689">${escapeHtml(slot)}</span><strong>${escapeHtml(item?.name ?? itemId)}</strong></div>`;
          })
          .join('')
      : '<div class="ostrze-subtitle" style="margin-bottom:0">Brak założonego ekwipunku.</div>';

  const questEntries = Object.entries(state.quests).filter(([, st]) => st && st !== 'none');
  const activeQuests = questEntries.filter(([, st]) => st === 'active');
  const doneQuests = questEntries.filter(([, st]) => st === 'completed');

  const locationLabelMap: Record<string, string> = {
    wilczy_brod: 'Wilczy Bród',
    wilcza_nora: 'Wilcza Nora',
    wilczy_las: 'Las Rubieży',
    stary_mlyn: 'Stary Młyn',
    trakt_kupiecki: 'Trakt Kupiecki',
    lesniczowka: 'Leśniczówka',
    ruiny_straznicy: 'Ruiny Strażnicy',
    kamienna_przelecz: 'Kamienna Przełęcz',
    gluszec: 'Głuszec',
    bor_klusownikow: 'Bór Kłusowników',
    stary_trakt: 'Stary Trakt',
    kapliczka_rozstaje: 'Kapliczka na Rozstajach',
    kamieniolom: 'Kamieniołom',
    bagna_szarej_wody: 'Bagna Szarej Wody',
    wzgorze_wartownicze: 'Wzgórze Wartownicze',
    spalona_osada: 'Spalona Osada',
    stara_kopalnia: 'Stara Kopalnia'
  };

  const formatAtHint = (at?: string): string => {
    if (!at) return '';
    const [locId, spotId] = at.split('.');
    const locName = locationLabelMap[locId] ?? locId.replace(/_/g, ' ');
    if (!spotId) return locName;
    return `${locName} · ${spotId.replace(/_/g, ' ')}`;
  };

  const isObjectiveDone = (done?: { flag?: string; item?: string }): boolean => {
    if (!done) return false;
    if (done.flag && state.flags[done.flag]) return true;
    if (
      done.item &&
      (state.inventory.items.some((i) => i.id === done.item && i.qty > 0) ||
        Object.values(state.inventory.equipped).includes(done.item))
    ) {
      return true;
    }
    return false;
  };

  const renderQuestList = (list: Array<[string, string]>, emptyMsg: string): string => {
    if (list.length === 0) return `<div class="ostrze-subtitle" style="margin-bottom:0">${emptyMsg}</div>`;
    return list
      .map(([qId, status]) => {
        const def = data.quests.find((q) => q.id === qId);
        const objectivesHtml =
          status === 'active' && def?.objectives && def.objectives.length > 0
            ? `<ul class="ostrze-quest-objectives">${def.objectives
                .map((obj) => {
                  const done = isObjectiveDone(obj.done);
                  const hint = formatAtHint(obj.at);
                  return `<li class="ostrze-quest-obj ${done ? 'is-done' : ''}">
                    <span class="ostrze-quest-obj-mark">${done ? '✓' : '○'}</span>
                    <span>${escapeHtml(obj.text)}${hint ? ` <em class="ostrze-quest-obj-loc">(${escapeHtml(hint)})</em>` : ''}</span>
                  </li>`;
                })
                .join('')}</ul>`
            : '';
        return `
          <div class="ostrze-row ostrze-quest-row">
            <div style="flex:1">
              <strong>${escapeHtml(def?.name ?? qId)}</strong>
              ${def?.description ? `<div class="ostrze-shop-desc">${escapeHtml(def.description)}</div>` : ''}
              ${objectivesHtml}
            </div>
            <span class="ostrze-shop-tag">${status === 'completed' ? '✓ Ukończone' : 'Aktywne'}</span>
          </div>
        `;
      })
      .join('');
  };

  const keepsakeDefs: Array<{
    id: string;
    owner: string;
    echoFlag: string;
    honoredText: string;
    pendingText: string;
  }> = [
    {
      id: 'kosc_skarimira',
      owner: 'Skarimir',
      echoFlag: 'echo_skarimir_kosc',
      honoredText: 'Uczczony rzutem kością w karczmie Wilczego Brodu.',
      pendingText: 'Czeka na ostatni rzut w karczmie „Pod Wilczym Kłem”.'
    },
    {
      id: 'miedziak_ragnoslawy',
      owner: 'Ragnosława',
      echoFlag: 'echo_ragnoslawa_toast',
      honoredText: 'Zakład spełniony — piwo postawione w Wilczym Brodzie.',
      pendingText: 'Zastaw za pierwsze piwo w karczmie Wilczego Brodu.'
    },
    {
      id: 'list_wojmira',
      owner: 'Wojmir Cienki',
      echoFlag: 'echo_wojmir_list',
      honoredText: state.flags.echo_wojmir_list_wyslany
        ? 'Przekazany Wrzoskowi dla gońca do Brzeziny.'
        : 'Zachowany przy sercu jako pamiątka.',
      pendingText: 'Zapieczętowany list do matki — do przekazania lub zachowania w karczmie.'
    }
  ];

  const keepsakesHtml = keepsakeDefs
    .filter((k) => {
      const hasItem = state.inventory.items.some((i) => i.id === k.id && i.qty > 0);
      return hasItem || Boolean(state.flags[k.echoFlag]);
    })
    .map((k) => {
      const item = data.items.find((i) => i.id === k.id);
      const honored = Boolean(state.flags[k.echoFlag]);
      return `
        <div class="ostrze-keepsake-card">
          <div class="ostrze-notice-head">
            <span class="ostrze-notice-title">🕯️ ${escapeHtml(item?.name ?? k.owner)}</span>
            <span class="ostrze-shop-tag">${honored ? '✓ Uczczono' : 'Pamiątka'}</span>
          </div>
          <div class="ostrze-shop-desc">${escapeHtml(honored ? k.honoredText : k.pendingText)}</div>
        </div>
      `;
    })
    .join('');

  const progress = evaluateCampaignProgress(state, data);
  const achievements = evaluateAchievements(state, data);
  const readableKnownPlaces = Array.from(
    new Set(
      state.world.knownPlaces.map((id) => {
        const normalized = id === 'brzezina' ? 'brzezina_dziedziniec' : id;
        return getOstrzeLocationMeta(normalized)?.name ?? id;
      })
    )
  );

  const achievementsGridHtml = achievements
    .map(
      (ach) => `
        <div class="ostrze-ach-card ${ach.unlocked ? 'is-unlocked' : ''}">
          <div class="ostrze-ach-icon">${ach.icon}</div>
          <div class="ostrze-ach-body">
            <div class="ostrze-ach-title">${escapeHtml(ach.title)} ${ach.unlocked ? '✓' : ''}</div>
            <div class="ostrze-ach-desc">${escapeHtml(ach.description)}</div>
          </div>
        </div>
      `
    )
    .join('');

  const tabContentHtml =
    activeTab === 'stats'
      ? `
        ${
          pendingPts > 0
            ? `<div class="ostrze-feedback">Punkty do wydania — Cechy: ${ch.freeAttributePoints} · Umiejętności: ${ch.freeSkillPoints} · Talenty: ${ch.freePerkPicks}</div>`
            : ''
        }
        <div class="ostrze-creator-grid">
          <div class="ostrze-panel">
            <h3>Atrybuty ${ch.freeAttributePoints > 0 ? `(wolne: ${ch.freeAttributePoints})` : ''}</h3>
            ${attrsHtml}
            <h3 style="margin-top:14px">Pochodne bojowe</h3>
            ${(() => {
              const weaponId = state.inventory?.equipped?.bron;
              const weapon = weaponId ? data.items.find((it) => it.id === weaponId) : undefined;
              const wMin = (weapon?.damage?.[0] ?? 2) + stats.derived.bonusDamage;
              const wMax = (weapon?.damage?.[1] ?? 4) + stats.derived.bonusDamage;
              const wLabel = weapon ? `${weapon.name}` : 'Walka wręcz';
              return `<div class="ostrze-row"><span>Broń (${escapeHtml(wLabel)})</span><strong>${wMin}–${wMax} obr.</strong></div>`;
            })()}
            <div class="ostrze-row"><span>Pancerz / Obrona</span><strong>${stats.derived.armor} / ${stats.derived.defense}</strong></div>
            <div class="ostrze-row"><span>Premia obrażeń (atuty/olej)</span><strong>+${stats.derived.bonusDamage} obr.</strong></div>
            <div class="ostrze-row"><span>Trafienie (wręcz / dyst.)</span><strong>+${stats.derived.meleeHitChance}% / +${stats.derived.rangedHitChance}%</strong></div>
            <div class="ostrze-row"><span>Krytyk / Inicjatywa</span><strong>${stats.derived.critChance}% / ${stats.derived.initiative}</strong></div>
            ${
              stats.derived.resistStrach > 0 || stats.derived.resistOgluszenie > 0 || stats.derived.resistRozkojarzenie > 0
                ? `<div class="ostrze-row"><span>Odporności (Strach / Ogł. / Rozk.)</span><strong>${stats.derived.resistStrach}% / ${stats.derived.resistOgluszenie}% / ${stats.derived.resistRozkojarzenie}%</strong></div>`
                : ''
            }
            ${(() => {
              const badges: string[] = [];
              if (ch.perks.includes('finta')) badges.push('⚔️ Mistrz finty');
              if (ch.perks.includes('cyrulik')) badges.push('🩹 Cyrulik (+25% lecz.)');
              if (ch.perks.includes('sokole_oko')) badges.push('🎯 Sokole oko (+2 rzut)');
              if (ch.perks.includes('pewna_reka')) badges.push('🏹 Pewna ręka (+2 rzut)');
              if (ch.perks.includes('nieugiety')) badges.push('🛡️ Nieugięty');
              if (ch.perks.includes('chlodna_glowa')) badges.push('🧠 Chłodna głowa');
              return badges.length > 0
                ? `<div class="ostrze-combat-pills" style="margin-top:8px;">${badges.map((b) => `<span class="ostrze-combat-pill is-status">${escapeHtml(b)}</span>`).join('')}</div>`
                : '';
            })()}
          </div>
          <div class="ostrze-panel">
            <h3>Umiejętności ${ch.freeSkillPoints > 0 ? `(wolne: ${ch.freeSkillPoints})` : ''}</h3>
            ${skillsHtml}
          </div>
        </div>
        <div class="ostrze-panel" style="margin-bottom:14px">
          <h3>Talenty (${ch.perks.length}/${data.rules.leveling.maxPerks})</h3>
          ${pickedPerksHtml}
        </div>
        ${perkChoicesHtml ? `<div class="ostrze-panel" style="margin-bottom:14px"><h3>Wybierz nowy talent (wolne: ${ch.freePerkPicks})</h3>${perkChoicesHtml}</div>` : ''}
      `
      : activeTab === 'gear'
        ? `
          <div class="ostrze-creator-grid">
            <div class="ostrze-panel">
              <h3>Założony ekwipunek</h3>
              ${equippedHtml}
            </div>
            <div class="ostrze-panel">
              <h3>Plecak i Pas Szybkiego Użycia [4–7]</h3>
              ${itemsHtml}
            </div>
          </div>
        `
        : activeTab === 'journal'
          ? `
          <div class="ostrze-creator-grid">
            <div class="ostrze-panel">
              <h3>Aktywne zadania (${activeQuests.length})</h3>
              ${renderQuestList(activeQuests, 'Brak aktywnych zadań.')}
              <h3 style="margin-top:14px">Ukończone zadania (${doneQuests.length})</h3>
              ${renderQuestList(doneQuests, 'Brak ukończonych zadań.')}
            </div>
            <div class="ostrze-panel">
              <h3>Pamiątki z Brzeziny</h3>
              ${
                keepsakesHtml ||
                '<div class="ostrze-subtitle" style="margin-bottom:0">Nie niesiesz jeszcze żadnych osobistych pamiątek po towarzyszach.</div>'
              }
              <h3 style="margin-top:14px">Poznane lokacje (${readableKnownPlaces.length} / ${progress.totalLocations})</h3>
              <div class="ostrze-shop-desc">${escapeHtml(readableKnownPlaces.join(', ') || 'Brzezina — Dziedziniec')}</div>
            </div>
          </div>
        `
          : `
          <div class="ostrze-creator-grid" data-cs-chronicle="true">
            <div class="ostrze-panel">
              <h3>Postęp kampanii</h3>
              <div class="ostrze-chronicle-bars">
                <div class="ostrze-progress-item">
                  <div class="ostrze-row"><span>Prolog — Brzezina</span><strong>${progress.prologuePct}%</strong></div>
                  <div class="ostrze-progress-track"><div class="ostrze-progress-fill" style="width:${progress.prologuePct}%"></div></div>
                </div>
                <div class="ostrze-progress-item">
                  <div class="ostrze-row"><span>Akt I — Pogórze</span><strong>${progress.act1Pct}%</strong></div>
                  <div class="ostrze-progress-track"><div class="ostrze-progress-fill" style="width:${progress.act1Pct}%"></div></div>
                </div>
                <div class="ostrze-progress-item">
                  <div class="ostrze-row"><span>Akt II — Głusz</span><strong>${progress.act2Pct}%</strong></div>
                  <div class="ostrze-progress-track"><div class="ostrze-progress-fill" style="width:${progress.act2Pct}%"></div></div>
                </div>
              </div>
              <h3 style="margin-top:14px">Statystyki wyprawy</h3>
              <div class="ostrze-row"><span>Dzień wyprawy</span><strong>Dzień ${progress.daysElapsed}</strong></div>
              <div class="ostrze-row"><span>Atmosfera i pora</span><strong>${escapeHtml(progress.atmosphereLabel)}</strong></div>
              <div class="ostrze-row"><span>Odkryte lokacje</span><strong>${progress.visitedCount} / ${progress.totalLocations}</strong></div>
              <div class="ostrze-row"><span>Zadania (ukończone / aktywne)</span><strong>${progress.completedQuests} / ${progress.activeQuests}</strong></div>
              <div class="ostrze-row"><span>Doświadczenie / Talenty</span><strong>${progress.totalXp} XP · ${progress.perksCount}</strong></div>
            </div>
            <div class="ostrze-panel">
              <h3>Dokonania (${progress.unlockedAchievements} / ${progress.totalAchievements})</h3>
              <div class="ostrze-ach-grid">
                ${achievementsGridHtml}
              </div>
            </div>
          </div>
        `;

  root.innerHTML = `
    <div class="ostrze-overlay">
      <div class="ostrze-card ostrze-cs-card">
        <div class="ostrze-cs-header">
          <div>
            <h2 class="ostrze-title" style="margin-bottom:4px">${escapeHtml(ch.name)} — Poziom ${ch.level}</h2>
            <div class="ostrze-shop-meta">
              <span class="ostrze-shop-tag">${escapeHtml(cls?.name ?? ch.classId)}</span>
              <span class="ostrze-shop-tag">AP: ${stats.derived.ap}</span>
              <span class="ostrze-shop-tag">Wola: ${wola} · Dług: ${dlug}</span>
              <span class="ostrze-purse-pill">🪙 ${ch.money} gr</span>
            </div>
          </div>
          <div class="ostrze-cs-bars">
            <div class="ostrze-hp-bar">
              <div class="ostrze-hp-fill ${hpPct <= 30 ? 'is-low' : ''}" style="width:${hpPct}%"></div>
              <span class="ostrze-hp-label">${ch.hp} / ${hpMax} HP</span>
            </div>
            <div class="ostrze-xp-bar" title="XP: ${ch.xp} / ${nextLvXp}" style="margin:6px 0 0;">
              <div class="ostrze-xp-fill" style="width:${xpPct}%"></div>
            </div>
          </div>
        </div>

        <div class="ostrze-cs-tabs">
          <button class="ostrze-cs-tab ${activeTab === 'stats' ? 'is-active' : ''}" data-cs-tab="stats">
            Postać i Rozwój ${pendingPts > 0 ? `<span class="ostrze-cs-tab-badge">+${pendingPts}</span>` : ''}
          </button>
          <button class="ostrze-cs-tab ${activeTab === 'gear' ? 'is-active' : ''}" data-cs-tab="gear">
            Ekwipunek i Pas (${state.inventory.items.length})
          </button>
          <button class="ostrze-cs-tab ${activeTab === 'journal' ? 'is-active' : ''}" data-cs-tab="journal">
            Dziennik i Pamiątki
          </button>
          <button class="ostrze-cs-tab ${activeTab === 'chronicle' ? 'is-active' : ''}" data-cs-tab="chronicle">
            🏆 Kronika (${progress.unlockedAchievements}/${progress.totalAchievements})
          </button>
        </div>

        ${tabContentHtml}

        <div style="display:flex;justify-content:flex-end;margin-top:8px">
          <button class="ostrze-btn" id="ostrze-cs-close">Zamknij [ESC]</button>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll<HTMLElement>('[data-cs-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextTab = btn.dataset.csTab as CharacterSheetTab | undefined;
      if (nextTab && nextTab !== activeTab) {
        ostrzeAudio.playUiClick();
        onSelectTab(nextTab);
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-attr]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const attrId = btn.dataset.csAttr as AttributeId;
      if (spendAttributePoint(state, attrId, data)) {
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-skill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const skillId = btn.dataset.csSkill as SkillId;
      if (spendSkillPoint(state, skillId, data)) {
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-perk]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const perkId = btn.dataset.csPerk ?? '';
      if (pickPerk(state, perkId, data)) {
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-equip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.csEquip ?? '';
      const item = data.items.find((i) => i.id === itemId);
      const equipSlot = item?.slot ?? (item?.type === 'weapon' ? 'bron' : undefined);
      if (item && equipSlot) {
        state.inventory.equipped[equipSlot] = itemId;
        if (state.character) {
          const maxHp = getStats(state, data).derived.hpMax;
          state.character.hp = Math.max(1, Math.min(maxHp, state.character.hp));
        }
        onShowToast(`Założono: ${item.name}`, 'info');
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-use]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.csUse ?? '';
      const item = data.items.find((i) => i.id === itemId);
      const invEntry = state.inventory.items.find((i) => i.id === itemId);
      if (item && invEntry && invEntry.qty > 0 && state.character) {
        const curStats = getStats(state, data);
        const maxHp = curStats.derived.hpMax;
        let healed = 0;
        if (Array.isArray(item.heal)) {
          const [lo, hi] = item.heal;
          const skillBonus = item.healSkill ? (curStats.skills[item.healSkill] ?? 0) : 0;
          const rawHeal = Math.floor(rng.int(lo, hi) * (1 + skillBonus / 100));
          healed = Math.max(0, Math.min(maxHp - state.character.hp, rawHeal));
          state.character.hp += healed;
        } else if (typeof item.healHp === 'number' && item.healHp > 0) {
          healed = Math.max(0, Math.min(maxHp - state.character.hp, item.healHp));
          state.character.hp += healed;
        }
        if (Array.isArray(item.removes) && item.removes.length > 0) {
          const removeSet = new Set(item.removes);
          state.character.effects = state.character.effects.filter(
            (eff) => !removeSet.has(eff.id)
          );
        }
        invEntry.qty -= 1;
        if (invEntry.qty <= 0) {
          state.inventory.items = state.inventory.items.filter((i) => i.id !== itemId);
        }
        onShowToast(
          healed > 0 ? `Użyto ${item.name} (+${healed} HP)` : `Użyto ${item.name}`,
          'success'
        );
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLSelectElement>('[data-cs-belt-pin]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const itemId = sel.dataset.csBeltPin ?? '';
      const slotIdx = Number(sel.value);
      if (itemId && !Number.isNaN(slotIdx)) {
        pinItemToQuickBelt(state, slotIdx, itemId);
        onShowToast(`Przypięto do pasa szybkiego użycia [Slot ${slotIdx + 4}].`, 'info');
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-belt-unpin]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slotIdx = Number(btn.dataset.csBeltUnpin);
      if (!Number.isNaN(slotIdx)) {
        pinItemToQuickBelt(state, slotIdx, null);
        onShowToast(`Odpięto slot [${slotIdx + 4}] (powrót do auto-doboru).`, 'info');
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelector('#ostrze-cs-close')?.addEventListener('click', () => {
    onClose();
  });
}
