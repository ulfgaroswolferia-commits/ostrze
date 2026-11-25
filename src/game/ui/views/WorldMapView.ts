import type { OriginGameData, OstrzeGameState } from '../../data/originTypes';
import {
  getActiveQuestPins,
  getRegionForLocation,
  resolveExpeditionNodeId,
  WORLD_MAP_NODES,
  WORLD_MAP_REGIONS,
  WORLD_MAP_ROADS,
  type WorldMapNode,
  type WorldMapRegionId
} from '../../data/worldMapData';
import { clockOf, timeOfDay } from '../../rules/time';
import { getOstrzeLocationMeta } from '../../rules/travel';
import { getWorldAtmosphere } from '../../rules/worldCycle';
import { escapeHtml } from '../escapeHtml';
import { mountModalCard } from '../mountModalCard';
import type { TravelDestinationEntry } from '../OstrzeModalUi';
import { getPhenomenonVisualMeta } from '../phenomenonOverlay';

export interface WorldMapViewParams {
  root: HTMLElement;
  state: OstrzeGameState;
  data: OriginGameData;
  destinations: TravelDestinationEntry[];
  currentLocationId: string;
  readOnly?: boolean;
  initialRegion?: WorldMapRegionId;
  initialSelectedNodeId?: string;
  onSelectDestination: (destId: string) => void;
  onClose: () => void;
}

export interface TravelForecast {
  arrivalClockText: string;
  arrivalTimeLabel: string;
  isNightArrival: boolean;
  warnings: string[];
}

const ARRIVAL_TOD_LABELS: Record<'swit' | 'dzien' | 'zmierzch' | 'noc', string> = {
  swit: 'Świt',
  dzien: 'Dzień',
  zmierzch: 'Zmierzch',
  noc: 'Noc'
};

/**
 * Computes arrival clock, time-of-day, and survival/night route warnings for a planned march.
 */
export function computeTravelForecast(
  state: OstrzeGameState,
  data: OriginGameData,
  travelMinutes: number
): TravelForecast {
  const arrivalTotalMinutes = state.time.minutes + Math.max(0, Math.round(travelMinutes));
  const { hour, minute } = clockOf(arrivalTotalMinutes);
  const arrivalClockText = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const arrivalTod = timeOfDay(arrivalTotalMinutes, data.rules);
  const isNightArrival = arrivalTod === 'noc';

  const warnings: string[] = [];
  const addedHours = Math.max(0, travelMinutes / 60);
  const ch = state.character;

  if (isNightArrival) {
    warnings.push('🌙 Dotrzesz po zmroku — nocą na traktach łatwiej o zasadzki.');
  }

  const hasFatigue = Boolean(ch?.effects.some((e) => e.id === 'zmeczenie'));
  const projectedNoSleep = (state.vars.hours_without_sleep ?? 0) + addedHours;
  if (hasFatigue) {
    warnings.push('😴 Bohater jest już zmęczony (-1 AP, -1 Bystrość) — rozważ odpoczynek.');
  } else if (projectedNoSleep > 16) {
    warnings.push('😴 Marsz wywoła zmęczenie po drodze (>16h bez snu).');
  }

  const isWellFed = Boolean(ch?.effects.some((e) => e.id === 'najedzony'));
  const hasHunger = Boolean(ch?.effects.some((e) => e.id === 'glod_lekki' || e.id === 'glod'));
  const projectedNoFood = (state.vars.hours_without_food ?? 0) + addedHours;
  if (hasHunger) {
    warnings.push('🍖 Bohater jest głodny (-1 Siła) — zjedz posiłek przed drogą.');
  } else if (!isWellFed && projectedNoFood > 16) {
    warnings.push('🍖 W trakcie marszu dopadnie cię głód (>16h bez jedzenia).');
  }

  return {
    arrivalClockText,
    arrivalTimeLabel: ARRIVAL_TOD_LABELS[arrivalTod],
    isNightArrival,
    warnings
  };
}

function renderDangerStars(danger: number): string {
  const clamped = Math.max(1, Math.min(5, Math.round(danger)));
  return '★'.repeat(clamped) + '☆'.repeat(Math.max(0, 4 - clamped));
}

function renderMountainPath(x: number, y: number, scale = 1): string {
  const w = 18 * scale;
  const h = 15 * scale;
  return `<path d="M ${(x - w).toFixed(1)} ${(y + h * 0.5).toFixed(1)} L ${x.toFixed(1)} ${(y - h).toFixed(1)} L ${(x + w).toFixed(1)} ${(y + h * 0.5).toFixed(1)}" class="ostrze-map-mountain" />`;
}

/**
 * Interactive parchment SVG world map & travel modal with region tabs (Pogórze / Głusz),
 * quest markers (`❗`), active phenomenon travel banner, and destination detail panel.
 */
export function renderWorldMapView(params: WorldMapViewParams): void {
  const {
    root,
    state,
    data,
    destinations,
    currentLocationId,
    readOnly = false,
    onSelectDestination,
    onClose
  } = params;

  const normalizedCurrent = resolveExpeditionNodeId(currentLocationId);
  const visitedSet = new Set<string>(state.world.knownPlaces.map(resolveExpeditionNodeId));
  visitedSet.add(normalizedCurrent);

  const destsByNode = new Map<string, TravelDestinationEntry[]>();
  for (const d of destinations) {
    const nodeId = resolveExpeditionNodeId(d.id);
    const arr = destsByNode.get(nodeId) ?? [];
    arr.push(d);
    destsByNode.set(nodeId, arr);
  }

  const questPins = getActiveQuestPins(state, data);
  const atmosphere = getWorldAtmosphere(state, data);
  const phMeta = getPhenomenonVisualMeta(atmosphere.phenomenonId);
  const phDef = atmosphere.phenomenonId
    ? data.phenomena.find((p) => p.id === atmosphere.phenomenonId)
    : undefined;
  const travelEffect = phDef?.world?.travel;
  const travelWarning =
    travelEffect === 'dangerous'
      ? '⚠️ Zjawisko czyni podróż niebezpieczną!'
      : travelEffect === 'slow'
        ? '⏳ Zjawisko spowalnia marsz (+30% czasu).'
        : null;

  let activeRegion: WorldMapRegionId =
    params.initialRegion ?? getRegionForLocation(normalizedCurrent);
  let selectedNodeId: string =
    params.initialSelectedNodeId ??
    (WORLD_MAP_NODES.some((n) => n.id === normalizedCurrent)
      ? normalizedCurrent
      : WORLD_MAP_NODES.find((n) => n.region === activeRegion)?.id ?? 'wilczy_brod');

  const draw = (): void => {
    const regionMeta = WORLD_MAP_REGIONS[activeRegion];
    const regionNodes = WORLD_MAP_NODES.filter((n) => n.region === activeRegion);
    const regionRoads = WORLD_MAP_ROADS.filter((r) => r.region === activeRegion);
    const nodeById = new Map<string, WorldMapNode>(regionNodes.map((n) => [n.id, n]));

    if (!nodeById.has(selectedNodeId)) {
      selectedNodeId =
        regionNodes.find((n) => n.id === normalizedCurrent)?.id ??
        regionNodes.find((n) => destsByNode.has(n.id))?.id ??
        regionNodes[0]?.id ??
        'wilczy_brod';
    }

    const forestsSvg = regionMeta.forestZones
      .map(
        (f) =>
          `<ellipse cx="${f.cx}" cy="${f.cy}" rx="${f.rx}" ry="${f.ry}" class="ostrze-map-forest" />`
      )
      .join('');
    const mountainsSvg = regionMeta.mountainPeaks
      .map((m) => renderMountainPath(m.x, m.y, m.scale ?? 1))
      .join('');

    const roadsSvg = regionRoads
      .map((road) => {
        const a = nodeById.get(road.from);
        const b = nodeById.get(road.to);
        if (!a || !b) return '';
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - 10;
        return `<path d="M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}" class="ostrze-map-road ${road.dashed ? 'is-dashed' : ''}" />`;
      })
      .join('');

    const pinsSvg = regionNodes
      .map((node) => {
        const meta = getOstrzeLocationMeta(node.id);
        const label = meta?.name ?? node.id;
        const isCurrent = node.id === normalizedCurrent;
        const isSelected = node.id === selectedNodeId;
        const nodeDests = destsByNode.get(node.id) ?? [];
        const isAvailable = !readOnly && nodeDests.some((d) => !d.isCurrent);
        const isVisited = visitedSet.has(node.id) || nodeDests.length > 0;
        const hasQuest = (questPins.get(node.id)?.length ?? 0) > 0;

        const stateClass = isCurrent
          ? 'is-current'
          : isAvailable
            ? 'is-available'
            : isVisited
              ? 'is-visited'
              : 'is-locked';

        const shortLabel = label.length > 22 ? `${label.slice(0, 20)}…` : label;

        return `
          <g class="ostrze-map-pin ${stateClass} ${isSelected ? 'is-selected' : ''}"
             data-map-node="${escapeHtml(node.id)}"
             role="button"
             tabindex="0"
             aria-label="${escapeHtml(label)}">
            ${isCurrent ? `<circle cx="${node.x}" cy="${node.y}" r="20" class="ostrze-map-pin-pulse" />` : ''}
            ${isSelected ? `<circle cx="${node.x}" cy="${node.y}" r="17" class="ostrze-map-pin-ring" />` : ''}
            <circle cx="${node.x}" cy="${node.y}" r="12.5" class="ostrze-map-pin-dot" />
            <text x="${node.x}" y="${node.y + 4.5}" text-anchor="middle" class="ostrze-map-pin-icon">${node.icon}</text>
            ${
              hasQuest
                ? `<g transform="translate(${node.x + 11}, ${node.y - 11})">
                     <circle r="7" class="ostrze-map-quest-dot" />
                     <text y="3.2" text-anchor="middle" class="ostrze-map-quest-mark">!</text>
                   </g>`
                : ''
            }
            <text x="${node.x}" y="${node.y + 25}" text-anchor="middle" class="ostrze-map-pin-label">${escapeHtml(shortLabel)}</text>
          </g>
        `;
      })
      .join('');

    const selectedNode = nodeById.get(selectedNodeId);
    const selectedMeta = selectedNode ? getOstrzeLocationMeta(selectedNode.id) : undefined;
    const selectedDests = selectedNode ? destsByNode.get(selectedNode.id) ?? [] : [];
    const selectedQuests = selectedNode ? questPins.get(selectedNode.id) ?? [] : [];
    const isSelectedCurrent = selectedNode?.id === normalizedCurrent;
    const isSelectedVisited = selectedNode ? visitedSet.has(selectedNode.id) : false;

    const baseMinutes =
      selectedDests[0]?.travelMinutes ?? selectedMeta?.travelMinutes ?? 75;
    const adjustedMinutes =
      travelEffect === 'slow' ? Math.round(baseMinutes * 1.3) : baseMinutes;
    const forecast = !isSelectedCurrent
      ? computeTravelForecast(state, data, adjustedMinutes)
      : null;

    const forecastHtml = forecast
      ? `
        <span class="ostrze-worldmap-stat ${forecast.isNightArrival ? 'is-night' : ''}" data-worldmap-arrival="true">
          ${forecast.isNightArrival ? '🌙' : '🕒'} Przybycie: ok. ${escapeHtml(forecast.arrivalClockText)} (${escapeHtml(forecast.arrivalTimeLabel)})
        </span>
      `
      : '';

    const routeWarningsHtml =
      forecast && forecast.warnings.length > 0
        ? `
          <div class="ostrze-worldmap-warnings" data-worldmap-warnings="true">
            ${forecast.warnings.map((w) => `<div class="ostrze-worldmap-warning-line">${escapeHtml(w)}</div>`).join('')}
          </div>
        `
        : '';

    const questCountByRegion: Record<WorldMapRegionId, number> = { pogorze: 0, glusz: 0 };
    for (const [nodeId, list] of questPins.entries()) {
      if (list.length > 0) {
        const reg = getRegionForLocation(nodeId);
        questCountByRegion[reg] += list.length;
      }
    }

    const statusBadge = isSelectedCurrent
      ? '<span class="ostrze-badge">Tu jesteś</span>'
      : !readOnly && selectedDests.some((d) => !d.isCurrent)
        ? '<span class="ostrze-worldmap-status is-open">Dostępny cel</span>'
        : isSelectedVisited
          ? '<span class="ostrze-worldmap-status is-visited">Odwiedzona</span>'
          : '<span class="ostrze-worldmap-status is-locked">Nieodkryta / zablokowana</span>';

    const questsHtml =
      selectedQuests.length > 0
        ? `
          <div class="ostrze-worldmap-quests">
            <div class="ostrze-worldmap-section-title">❗ Aktywne zadania</div>
            <ul>
              ${selectedQuests.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}
            </ul>
          </div>
        `
        : '';

    const actionsHtml = (() => {
      if (readOnly) {
        return `<div class="ostrze-worldmap-hint">Tryb podglądu mapy (Prolog). Podróż między lokacjami odblokuje się po dotarciu do Strażnicy Wilczy Bród.</div>`;
      }
      if (isSelectedCurrent) {
        return `<div class="ostrze-worldmap-hint">Znajdujesz się obecnie w tej lokacji. Kliknij inną pinezkę na mapie, aby wyznaczyć trasę.</div>`;
      }
      const clickableDests = selectedDests.filter((d) => !d.isCurrent);
      if (clickableDests.length === 0) {
        return `<div class="ostrze-worldmap-hint">Obecnie nie możesz wyruszyć bezpośrednio w to miejsce z bieżącego regionu lub etapu fabuły.</div>`;
      }
      return `
        <div class="ostrze-worldmap-actions">
          ${clickableDests
            .map(
              (d) => `
                <button type="button" class="ostrze-btn ostrze-btn-primary ostrze-worldmap-go" data-travel-dest="${escapeHtml(d.id)}">
                  🧭 Wyrusz: ${escapeHtml(d.name)}
                </button>
              `
            )
            .join('')}
        </div>
      `;
    })();

    const atmosphereLine = phMeta
      ? `${atmosphere.timeLabel} · ${atmosphere.clockText} · ${phMeta.icon} ${atmosphere.phenomenonName ?? ''}${travelWarning ? ` — ${travelWarning}` : ''}`
      : `${atmosphere.timeLabel} · ${atmosphere.clockText} · Pogoda spokojna`;

    mountModalCard(
      root,
      'ostrze-card ostrze-worldmap-card',
      `
          <div class="ostrze-worldmap-header">
            <div>
              <h2 class="ostrze-title" style="margin-bottom:4px;">
                🗺️ ${readOnly ? 'Mapa Krainy — Podgląd' : 'Mapa Krainy — Podróż'}
              </h2>
              <div class="ostrze-worldmap-atmo ${travelWarning ? 'is-warning' : ''}" data-worldmap-atmo="true">
                ${escapeHtml(atmosphereLine)}
              </div>
            </div>
            <div class="ostrze-worldmap-tabs" role="tablist">
              ${(['pogorze', 'glusz'] as WorldMapRegionId[])
                .map((regId) => {
                  const reg = WORLD_MAP_REGIONS[regId];
                  const qCount = questCountByRegion[regId];
                  return `
                    <button type="button"
                      class="ostrze-cs-tab ${activeRegion === regId ? 'is-active' : ''}"
                      data-map-region="${regId}"
                      role="tab"
                      aria-selected="${activeRegion === regId ? 'true' : 'false'}">
                      ${escapeHtml(reg.label)}${qCount > 0 ? ` <span class="ostrze-worldmap-tab-quest" title="Aktywne zadania w regionie">!${qCount}</span>` : ''}
                    </button>
                  `;
                })
                .join('')}
            </div>
          </div>

          <div class="ostrze-worldmap-layout">
            <div class="ostrze-worldmap-canvas-wrap">
              <div class="ostrze-worldmap-region-caption">${escapeHtml(regionMeta.subtitle)}</div>
              <svg class="ostrze-worldmap-svg" viewBox="0 0 640 420" role="img" aria-label="Mapa regionu ${escapeHtml(regionMeta.label)}">
                <defs>
                  <radialGradient id="ostrzeParchmentGrad" cx="50%" cy="45%" r="65%">
                    <stop offset="0%" stop-color="#362b1d" />
                    <stop offset="70%" stop-color="#251d14" />
                    <stop offset="100%" stop-color="#17120c" />
                  </radialGradient>
                </defs>
                <rect x="4" y="4" width="632" height="412" rx="10" fill="url(#ostrzeParchmentGrad)" stroke="#6d5533" stroke-width="2" />
                <rect x="12" y="12" width="616" height="396" rx="6" fill="none" stroke="rgba(229,184,105,0.22)" stroke-dasharray="6 4" />
                ${forestsSvg}
                <path d="${regionMeta.riverPath}" class="ostrze-map-river" />
                ${mountainsSvg}
                ${roadsSvg}
                ${pinsSvg}
                <g class="ostrze-map-compass" transform="translate(56, 56)">
                  <circle r="20" fill="rgba(18,14,10,0.6)" stroke="#8c6a37" stroke-width="1.2" />
                  <path d="M 0 -15 L 4 0 L 0 15 L -4 0 Z" fill="#e5b869" opacity="0.85" />
                  <path d="M -15 0 L 0 -4 L 15 0 L 0 4 Z" fill="#a89068" opacity="0.65" />
                  <text y="-23" text-anchor="middle" fill="#e5b869" font-size="9" font-weight="700">N</text>
                </g>
              </svg>
            </div>

            <aside class="ostrze-worldmap-detail" data-worldmap-detail="${escapeHtml(selectedNodeId)}">
              <div class="ostrze-worldmap-detail-head">
                <div class="ostrze-worldmap-detail-icon">${selectedNode?.icon ?? '📍'}</div>
                <div>
                  <h3 class="ostrze-worldmap-detail-title">${escapeHtml(selectedMeta?.name ?? selectedNodeId)}</h3>
                  <div class="ostrze-worldmap-detail-sub">${escapeHtml(selectedDests[0]?.subtitle ?? selectedMeta?.subtitle ?? '')}</div>
                </div>
              </div>
              <div class="ostrze-worldmap-detail-meta">
                ${statusBadge}
                <span class="ostrze-worldmap-stat">⚔️ Zagrożenie: ${renderDangerStars(selectedMeta?.danger ?? 2)}</span>
                <span class="ostrze-worldmap-stat">🥾 Marsz: ok. ${adjustedMinutes} min${travelEffect === 'slow' ? ' (pogoda)' : ''}</span>
                ${forecastHtml}
              </div>
              ${routeWarningsHtml}
              ${questsHtml}
              ${actionsHtml}
            </aside>
          </div>

          <div class="ostrze-worldmap-footer">
            <div class="ostrze-worldmap-legend">
              <span><i class="ostrze-legend-dot is-current"></i> Tu jesteś</span>
              <span><i class="ostrze-legend-dot is-available"></i> Dostępny cel</span>
              <span><i class="ostrze-legend-dot is-quest"></i> Aktywne zadanie</span>
              <span><i class="ostrze-legend-dot is-locked"></i> Niedostępne</span>
            </div>
            <button type="button" class="ostrze-hub-btn" id="ostrze-travel-close">Zamknij [ESC / M]</button>
          </div>
      `,
      { dataset: { worldmapModal: 'true' }, onOverlayBackdropClick: onClose }
    );

    root.querySelectorAll<HTMLButtonElement>('[data-map-region]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reg = btn.dataset.mapRegion as WorldMapRegionId | undefined;
        if (reg && reg !== activeRegion) {
          activeRegion = reg;
          draw();
        }
      });
    });

    root.querySelectorAll<SVGGElement>('[data-map-node]').forEach((pin) => {
      const selectPin = (): void => {
        const nodeId = pin.dataset.mapNode;
        if (nodeId && nodeId !== selectedNodeId) {
          selectedNodeId = nodeId;
          draw();
        }
      };
      pin.addEventListener('click', selectPin);
      pin.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          selectPin();
        }
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-travel-dest]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const destId = btn.dataset.travelDest;
        if (destId) {
          onSelectDestination(destId);
        }
      });
    });

    root.querySelector<HTMLButtonElement>('#ostrze-travel-close')?.addEventListener('click', () => {
      onClose();
    });
  };

  draw();
}
