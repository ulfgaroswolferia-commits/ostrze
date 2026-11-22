import { describe, expect, it, vi } from 'vitest';
import { renderHelpModalView } from '../src/game/ui/views/HelpModalView';

describe('HelpModalView ([F1] / [?])', () => {
  it('renders keyboard shortcuts tab and guide tab cleanly', () => {
    const closeSpy = vi.fn();
    let closeHandler: (() => void) | null = null;
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: (selector: string) =>
        selector === '#ostrze-help-close'
          ? {
              addEventListener: (_ev: string, fn: () => void) => {
                closeHandler = fn;
              }
            }
          : null
    } as unknown as HTMLElement;

    renderHelpModalView({ root: fakeRoot, initialTab: 'controls', onClose: closeSpy });
    expect(fakeRoot.innerHTML).toContain('data-help-modal="true"');
    expect(fakeRoot.innerHTML).toContain('M');
    expect(fakeRoot.innerHTML).toContain('F1 / ?');
    expect(fakeRoot.innerHTML).toContain('4 – 7');
    expect(closeHandler).not.toBeNull();
    closeHandler!();
    expect(closeSpy).toHaveBeenCalledTimes(1);

    renderHelpModalView({ root: fakeRoot, initialTab: 'guide', onClose: closeSpy });
    expect(fakeRoot.innerHTML).toContain('Odporności i podatności wrogów');
    expect(fakeRoot.innerHTML).toContain('Mistrz finty');
    expect(fakeRoot.innerHTML).toContain('Mgła Ciszy');
  });
});
