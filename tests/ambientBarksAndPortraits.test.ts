import { describe, expect, it } from 'vitest';
import { createWilczyBrodScene } from '../src/game/maps/chapter1Maps';
import { createGluszecScene } from '../src/game/maps/chapter2Maps';
import { createBrzezinaYardScene } from '../src/game/maps/prologueMaps';
import { tryTriggerAmbientBark } from '../src/game/rules/ambientBarks';
import { resolveDialoguePortraitId } from '../src/game/ui/views/DialogueView';

describe('Drakensang Hub Life (Ambient Barks) & Dialogue Portraits', () => {
  it('triggers ambient barks for nearby hub NPCs without overwriting quest markers or firing in combat', () => {
    const gluszec = createGluszecScene();
    const npcs = gluszec.actors ?? [];

    // Silenced during combat or open modal
    expect(
      tryTriggerAmbientBark({
        sceneId: 'gluszec',
        playerX: 13,
        playerY: 14,
        npcs,
        combatActive: true,
        modalOpen: false
      })
    ).toBeNull();

    expect(
      tryTriggerAmbientBark({
        sceneId: 'gluszec',
        playerX: 13,
        playerY: 14,
        npcs,
        combatActive: false,
        modalOpen: true
      })
    ).toBeNull();

    // Protect existing quest marker bubbles
    const bogdan = npcs.find((n) => n.id === 'npc_kowal_bogdan')!;
    bogdan.speechBubbleText = '⚒️';
    const res = tryTriggerAmbientBark({
      sceneId: 'gluszec',
      playerX: bogdan.tileX,
      playerY: bogdan.tileY,
      npcs: [bogdan],
      combatActive: false,
      modalOpen: false
    });
    expect(res).toBeNull();
    expect(bogdan.speechBubbleText).toBe('⚒️');

    // Fires cleanly when NPC has no active marker/bark
    bogdan.speechBubbleText = null;
    const triggered = tryTriggerAmbientBark({
      sceneId: 'gluszec',
      playerX: bogdan.tileX - 2,
      playerY: bogdan.tileY,
      npcs: [bogdan],
      combatActive: false,
      modalOpen: false,
      randomFn: () => 0
    });
    expect(triggered).not.toBeNull();
    expect(triggered!.npcId).toBe('npc_kowal_bogdan');
    expect(bogdan.speechBubbleText).toBe(triggered!.text);
    expect(bogdan.speechBubbleTimer).toBeGreaterThan(3);

    // Also works in Brzezina and Wilczy Bród
    const brzezina = createBrzezinaYardScene();
    const brzezinaBark = tryTriggerAmbientBark({
      sceneId: 'brzezina_dziedziniec',
      playerX: 12,
      playerY: 12,
      npcs: brzezina.actors ?? [],
      combatActive: false,
      modalOpen: false,
      randomFn: () => 0
    });
    expect(brzezinaBark).not.toBeNull();

    const wb = createWilczyBrodScene();
    const wbBark = tryTriggerAmbientBark({
      sceneId: 'wilczy_brod',
      playerX: 13,
      playerY: 15,
      npcs: wb.actors ?? [],
      combatActive: false,
      modalOpen: false,
      randomFn: () => 0
    });
    expect(wbBark).not.toBeNull();
  });

  it('maps Prologue, Act I, and Act II speakers to fitting Slavic portraits (never king-in-ermine fallback)', () => {
    const speakers: Array<[string, string]> = [
      ['Mistrz Gnieworad', 'npc_radogost'],
      ['Komendant Wszebor', 'npc_milosz_patrol'],
      ['Kowal Zbych', 'npc_bozydar'],
      ['Kowal Bogdan', 'npc_bozydar'],
      ['Rusznikarz Szkarad', 'npc_gniewosz'],
      ['Karczmarz Wrzosek', 'npc_dobromir'],
      ['Kupiec Ostromir', 'npc_dobromir'],
      ['Sołtys Głuszca', 'npc_radogost'],
      ['Znachorka (Zielarka)', 'npc_wislawa'],
      ['Siostra Halina (Zielarka)', 'npc_wislawa'],
      ['Wdowa Jaga', 'npc_wislawa'],
      ['Gajowy (Strażnik Boru)', 'npc_bogusz'],
      ['Kopacz Jerzy', 'npc_sambor'],
      ['Młynarz Radosz', 'npc_sambor'],
      ['Furman Sieciech', 'npc_sambor'],
      ['Dozorca Wincenty', 'npc_milosz_patrol'],
      ['Pogorzelec Chwalisław', 'npc_sambor'],
      ['Zmora z Kopalni', 'npc_lyra']
    ];

    for (const [speaker, expectedPortrait] of speakers) {
      const actual = resolveDialoguePortraitId(speaker);
      expect(actual, `Portrait for ${speaker}`).toBe(expectedPortrait);
      expect(actual).not.toBe('npc_gniewko');
    }
  });
});
