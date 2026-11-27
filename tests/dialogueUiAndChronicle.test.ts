import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import {
  chooseOstrzeDialogueOption,
  getOstrzeDialogueView,
  startOstrzeDialogue
} from '../src/game/rules/dialogueEngine';
import { PrologueDirector } from '../src/game/scenes/PrologueDirector';
import {
  formatDialogueChoiceHtml,
  formatDialogueProseHtml
} from '../src/game/ui/views/DialogueView';

describe('cRPG Dialogue Folio — Transcript, Formatting & Option Classification', () => {
  it('separates narrator stage directions from spoken Polish quotes and escapes HTML safely', () => {
    const html = formatDialogueProseHtml(
      'Skarimir podrzuca kość. „Do stolicy, <script>alert(1)</script> na koszt cesarza!”\n\nPatrzy na kocioł.'
    );
    expect(html).toContain('<span class="ostrze-dlg-narration">Skarimir podrzuca kość. </span>');
    expect(html).toContain(
      '<span class="ostrze-dlg-quote">„Do stolicy, &lt;script&gt;alert(1)&lt;/script&gt; na koszt cesarza!”</span>'
    );
    expect(html).toContain('<span class="ostrze-dlg-plain">Patrzy na kocioł.</span>');
    expect(html).not.toContain('<script>');
  });

  it('formats player choice action prefixes distinctly from quoted replies', () => {
    const html = formatDialogueChoiceHtml('Roześmiej się: „W kupie zawsze raźniej.”');
    expect(html).toContain('<span class="ostrze-dlg-opt-action">Roześmiej się: </span>');
    expect(html).toContain('<span class="ostrze-dlg-opt-quote">„W kupie zawsze raźniej.”</span>');

    const plain = formatDialogueChoiceHtml('Wręcz mu słoninę.');
    expect(plain).toBe('Wręcz mu słoninę.');
  });

  it('records conversation history, visited options, and classifies farewell options cleanly', () => {
    const director = new PrologueDirector({ engine: new OstrzeEngineState(), seed: 42 });
    const { state, rng } = director;

    const session = startOstrzeDialogue('brzezina_skarimir', state, ORIGIN_DATA);
    const initialView = getOstrzeDialogueView(session, state, ORIGIN_DATA);

    expect(initialView.history).toEqual([]);
    expect(initialView.turnNumber).toBe(1);

    const farewellOpt = initialView.options.find((o) => o.option.id === 'koniec');
    const laughOpt = initialView.options.find((o) => o.option.id === 'smiech_razem');
    expect(farewellOpt?.isFarewell).toBe(true);
    expect(laughOpt?.isFarewell).toBe(false);
    expect(laughOpt?.alreadyVisited).toBe(false);

    const nextSession = chooseOstrzeDialogueOption(
      session,
      laughOpt!.index,
      state,
      ORIGIN_DATA,
      rng
    );
    expect(nextSession).not.toBeNull();
    const nextView = getOstrzeDialogueView(nextSession!, state, ORIGIN_DATA);

    expect(nextView.turnNumber).toBe(2);
    expect(nextView.history).toHaveLength(1);
    expect(nextView.history[0]?.speaker).toBe('Skarimir');
    expect(nextView.history[0]?.playerChoiceText).toContain('W kupie zawsze raźniej');
    expect(nextSession?.visitedOptionKeys).toContain('start:smiech_razem');
  });
});
