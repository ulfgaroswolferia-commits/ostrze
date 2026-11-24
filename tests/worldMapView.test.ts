import { describe, expect, it } from 'vitest';
import { ORIGIN_DATA } from '../src/game/data/originData';
import {
  getActiveQuestPins,
  getRegionForLocation,
  resolveExpeditionNodeId,
  WORLD_MAP_NODES,
  WORLD_MAP_ROADS
} from '../src/game/data/worldMapData';
import { createEmptyOstrzeState } from '../src/game/rules/character';
import { OSTRZE_LOCATIONS } from '../src/game/rules/travel';
import { computeTravelForecast, renderWorldMapView } from '../src/game/ui/views/WorldMapView';

describe('WorldMapData & WorldMapView', () => {
  it('defines coordinates for all 21 Ostrze locations and valid road endpoints', () => {
    const nodeIds = new Set(WORLD_MAP_NODES.map((n) => n.id));
    expect(WORLD_MAP_NODES.length).toBe(OSTRZE_LOCATIONS.length);
    for (const loc of OSTRZE_LOCATIONS) {
      expect(nodeIds.has(loc.id), `missing node for ${loc.id}`).toBe(true);
    }
    for (const road of WORLD_MAP_ROADS) {
      expect(nodeIds.has(road.from), `missing road.from ${road.from}`).toBe(true);
      expect(nodeIds.has(road.to), `missing road.to ${road.to}`).toBe(true);
      expect(getRegionForLocation(road.from)).toBe(road.region);
      expect(getRegionForLocation(road.to)).toBe(road.region);
    }
    expect(resolveExpeditionNodeId('expedition:wilcza_nora')).toBe('wilcza_nora');
    expect(resolveExpeditionNodeId('expedition:eskorta_ostromira')).toBe('kamienna_przelecz');
    expect(resolveExpeditionNodeId('expedition:finish_ch1')).toBe('kamienna_przelecz');
  });

  it('maps active quests to their corresponding map pins', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 7);
    state.quests.wilcza_nora = 'active';
    state.quests.bagna_topielce = 'active';

    const pins = getActiveQuestPins(state, ORIGIN_DATA);
    expect(pins.get('wilcza_nora')?.length ?? 0).toBeGreaterThan(0);
    expect(pins.get('bagna_szarej_wody')?.length ?? 0).toBeGreaterThan(0);
  });

  it('renders parchment SVG map with phenomenon travel warning and readOnly preview support', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 11);
    state.world.activePhenomenon = 'burza_iskier';
    state.quests.wilcza_nora = 'active';

    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    renderWorldMapView({
      root: fakeRoot,
      state,
      data: ORIGIN_DATA,
      destinations: [
        {
          id: 'wilczy_brod',
          name: 'Strażnica Wilczy Bród',
          subtitle: 'Główna strażnica',
          travelMinutes: 60,
          isCurrent: true
        },
        {
          id: 'wilczy_las',
          name: 'Las Rubieży',
          subtitle: 'Puszcza',
          travelMinutes: 75,
          isCurrent: false
        }
      ],
      currentLocationId: 'wilczy_brod',
      initialSelectedNodeId: 'wilczy_las',
      onSelectDestination: () => undefined,
      onClose: () => undefined
    });

    expect(fakeRoot.innerHTML).toContain('data-worldmap-modal="true"');
    expect(fakeRoot.innerHTML).toContain('Burza iskier');
    expect(fakeRoot.innerHTML).toContain('Zjawisko czyni podróż niebezpieczną');
    expect(fakeRoot.innerHTML).toContain('data-travel-dest="wilczy_las"');
    expect(fakeRoot.innerHTML).toContain('ostrze-map-quest-mark');

    // Read-only Prologue preview suppresses travel button
    renderWorldMapView({
      root: fakeRoot,
      state,
      data: ORIGIN_DATA,
      destinations: [],
      currentLocationId: 'brzezina_dziedziniec',
      readOnly: true,
      onSelectDestination: () => undefined,
      onClose: () => undefined
    });
    expect(fakeRoot.innerHTML).toContain('Tryb podglądu mapy (Prolog)');
    expect(fakeRoot.innerHTML).not.toContain('data-travel-dest=');
  });

  it('computes arrival time forecast and warns about night arrival, fatigue, and hunger', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 19);
    // 21:00 -> 90 min march arrives at 22:30 (Noc)
    state.time.minutes = 21 * 60;
    state.vars.hours_without_sleep = 15.5;
    state.vars.hours_without_food = 15.5;

    const forecast = computeTravelForecast(state, ORIGIN_DATA, 90);
    expect(forecast.arrivalClockText).toBe('22:30');
    expect(forecast.arrivalTimeLabel).toBe('Noc');
    expect(forecast.isNightArrival).toBe(true);
    expect(forecast.warnings.some((w) => w.includes('po zmroku'))).toBe(true);
    expect(forecast.warnings.some((w) => w.includes('zmęczenie'))).toBe(true);
    expect(forecast.warnings.some((w) => w.includes('głód'))).toBe(true);
  });
});
