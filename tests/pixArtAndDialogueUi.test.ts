import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import {
  getPixArtDataUri,
  getPixArtMeta,
  hasPixArt,
  listAvailablePixArtIds,
  parsePix,
  renderPixToSvgDataUri,
  resolvePixPortraitId,
  resolveSpeakerRole,
  xterm256ToHex
} from '../src/game/assets/pixArt';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import {
  chooseOstrzeDialogueOption,
  getOstrzeDialogueView,
  startOstrzeDialogue
} from '../src/game/rules/dialogueEngine';
import { PrologueDirector } from '../src/game/scenes/PrologueDirector';
import type { NarrativeCardData, OstrzeModalUi } from '../src/game/ui/OstrzeModalUi';
import {
  renderStoryVistaBannerHtml,
  resolveStoryVistaTheme
} from '../src/game/ui/storyVistaBanner';

describe('pixArt renderer and origin/data/art loader', () => {
  it('maps xterm-256 indices across ANSI-16, 6x6x6 cube, and grayscale ramp', () => {
    expect(xterm256ToHex(0)).toMatch(/^#[0-9a-f]{6}$/);
    expect(xterm256ToHex(16)).toBe('#000000');
    expect(xterm256ToHex(196)).toBe('#ff0000');
    expect(xterm256ToHex(231)).toBe('#ffffff');
    expect(xterm256ToHex(232)).toBe('#080808');
    expect(xterm256ToHex(255)).toBe('#eeeeee');
  });

  it('parses .pix grids, ignores comments/transparency, and produces RLE SVG data URIs', () => {
    const sample = [
      '# test sprite',
      'paleta: a=196 b=231',
      'aa.b',
      '..bb'
    ].join('\n');

    const parsed = parsePix(sample);
    expect(parsed).not.toBeNull();
    expect(parsed?.width).toBe(4);
    expect(parsed?.height).toBe(2);

    const uri = renderPixToSvgDataUri(parsed!);
    expect(uri.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    const decoded = decodeURIComponent(uri.slice('data:image/svg+xml;utf8,'.length));
    expect(decoded).toContain('shape-rendering="crispEdges"');
    // 'aa' run-length encoded into width="2"
    expect(decoded).toContain('<rect x="0" y="0" width="2" height="1" fill="#ff0000"/>');
    expect(decoded).toContain('<rect x="3" y="0" width="1" height="1" fill="#ffffff"/>');
    expect(decoded).toContain('<rect x="2" y="1" width="2" height="1" fill="#ffffff"/>');

    expect(parsePix('no palette here\naaaa')).toBeNull();
  });

  it('loads real 48x48 portraits and 96x48 narrative scenes from origin/data/art', () => {
    const allIds = listAvailablePixArtIds();
    expect(allIds.length).toBeGreaterThan(100);

    for (const portraitId of [
      'portret_skarimir',
      'portret_ragnoslawa',
      'portret_wojmir',
      'portret_gnieworad',
      'portret_istota',
      'portret_wszebor',
      'portret_wrzosek'
    ]) {
      expect(hasPixArt(portraitId), `Expected ${portraitId}.pix`).toBe(true);
      const meta = getPixArtMeta(portraitId);
      expect(meta?.width).toBe(48);
      expect(meta?.height).toBe(48);
      expect(meta?.dataUri.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    }

    for (const sceneId of ['wstep_gwiazdy', 'wstep_brzezina', 'szkolka', 'kurier_plac', 'wymarsz']) {
      const meta = getPixArtMeta(sceneId);
      expect(meta?.width).toBe(96);
      expect(meta?.height).toBe(48);
    }
  });

  it('resolves portrait priority (explicit -> speaker -> fallback null) and speaker roles', () => {
    expect(resolvePixPortraitId('portret_skarimir', 'Nieznajomy')).toBe('portret_skarimir');
    expect(resolvePixPortraitId('nieistniejacy_id', 'Ragnosława przy Ognisku')).toBe('portret_ragnoslawa');
    expect(resolvePixPortraitId(undefined, 'Wojmir Cienki')).toBe('portret_wojmir');
    expect(resolvePixPortraitId(undefined, 'Zupełnie Obcy Napis')).toBeNull();
    expect(getPixArtDataUri('portret_skarimir')).not.toBeNull();
    expect(resolveSpeakerRole('Skarimir')).toContain('Adept');
    expect(resolveSpeakerRole('Komendant Wszebor')).toContain('Wilczy Bród');
  });
});

describe('Dialogue portrait propagation, check outcome, and Narrative artId', () => {
  it('propagates dialogue/node portrait and structured lastCheckOutcome in dialogueEngine', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 42);
    createCharacter(
      state,
      {
        name: 'Mściwój',
        classId: 'miecz',
        attributes: {
          sila: 8,
          zrecznosc: 7,
          krzepa: 5,
          bystrosc: 5,
          rozum: 6,
          oglada: 5,
          fart: 5
        },
        tagged: ['sieczna', 'wymowa', 'skradanie']
      },
      ORIGIN_DATA
    );

    // Dialogue-level portrait (brzezina_skarimir)
    const sSkarimir = startOstrzeDialogue('brzezina_skarimir', state, ORIGIN_DATA);
    const vSkarimir = getOstrzeDialogueView(sSkarimir, state, ORIGIN_DATA);
    expect(vSkarimir.portrait).toBe('portret_skarimir');

    // Node-level portrait (towarzysze -> skarimir node)
    const sTow = startOstrzeDialogue('towarzysze', state, ORIGIN_DATA);
    const sTowNext = chooseOstrzeDialogueOption(sTow, 0, state, ORIGIN_DATA, createRng(42));
    expect(sTowNext).not.toBeNull();
    const vTowNext = getOstrzeDialogueView(sTowNext!, state, ORIGIN_DATA);
    expect(vTowNext.portrait).toBe('portret_skarimir');

    // Structured check outcome on brzezina_skarimir_kociol skill check
    const sKociol = startOstrzeDialogue('brzezina_skarimir_kociol', state, ORIGIN_DATA);
    const sAfterCheck = chooseOstrzeDialogueOption(sKociol, 0, state, ORIGIN_DATA, createRng(42));
    expect(sAfterCheck).not.toBeNull();
    const vAfterCheck = getOstrzeDialogueView(sAfterCheck!, state, ORIGIN_DATA);
    expect(['success', 'failure']).toContain(vAfterCheck.lastCheckOutcome);
    expect(vAfterCheck.lastCheckFeedback).toBeTruthy();
  });

  it('passes story.json artId to showNarrative in PrologueDirector', () => {
    const engine = new OstrzeEngineState();
    const shownCards: NarrativeCardData[] = [];
    const mockUi = {
      showNarrative: (card: NarrativeCardData) => {
        shownCards.push(card);
      },
      setHubPanel: () => {},
      showCharacterCreator: () => {}
    } as unknown as OstrzeModalUi;

    const director = new PrologueDirector({ engine, ui: mockUi, seed: 2026 });
    director.startPrologue();
    expect(shownCards.length).toBe(1);
    expect(shownCards[0].artId).toBe('wstep_gwiazdy');

    shownCards[0].onContinue();
    expect(shownCards.length).toBe(2);
    expect(shownCards[1].artId).toBe('wstep_brzezina');
  });

  it('maps story artIds to painterly animated vista banners with SVG layers and themes', () => {
    expect(resolveStoryVistaTheme('wstep_gwiazdy')).toBe('falling_star');
    expect(resolveStoryVistaTheme('wstep_brzezina')).toBe('birch_manor');
    expect(resolveStoryVistaTheme('noc_upiory')).toBe('haunted_night');
    expect(resolveStoryVistaTheme('krater_gwiazdy')).toBe('astral_crater');
    expect(resolveStoryVistaTheme('mapa_brod')).toBe('river_ford_map');
    expect(resolveStoryVistaTheme('unknown_custom_id')).toBe('forest_trail');

    const welcomeHtml = renderStoryVistaBannerHtml(
      'wstep_gwiazdy',
      'Voided — Na przekór gwiazdom',
      'ostrze-welcome-art-frame'
    );
    expect(welcomeHtml).toContain('ostrze-welcome-art-frame');
    expect(welcomeHtml).toContain('data-vista-theme="falling_star"');
    expect(welcomeHtml).toContain('ostrze-vista-comet');
    expect(welcomeHtml).toContain('<svg');
  });
});
