/**
 * Mounts or updates a modal card inside an existing `.ostrze-overlay` container in-place.
 * - Reusing `.ostrze-overlay` prevents WebGL `backdrop-filter: blur(4px)` teardown/flicker
 *   on every click and across modal-to-modal transitions (e.g. Welcome -> Intro -> Creator).
 * - Entrance CSS animations (`.is-entering`) play ONLY when an overlay/card is newly opened,
 *   never on in-place clicks.
 * - Preserves both `.ostrze-card` scrollTop and inner scrollable containers (`.ostrze-shop-col`,
 *   `[data-preserve-scroll]`, `.ostrze-help-body`) across same-modal re-renders.
 */
export function mountModalCard(
  root: HTMLElement,
  cardClassName: string,
  innerHtml: string,
  opts?: { styleText?: string; dataset?: Record<string, string>; onOverlayBackdropClick?: () => void }
): HTMLElement | null {
  if (typeof document === 'undefined' || typeof root.appendChild !== 'function') {
    const styleAttr = opts?.styleText ? ` style="${opts.styleText}"` : '';
    const dataAttrs = opts?.dataset
      ? Object.entries(opts.dataset)
          .map(([k, v]) => ` data-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${v}"`)
          .join('')
      : '';
    root.innerHTML = `<div class="ostrze-overlay"><div class="${cardClassName}"${styleAttr}${dataAttrs}>${innerHtml}</div></div>`;
    return root.querySelector<HTMLElement>('.ostrze-card');
  }

  const firstEl = root.firstElementChild as HTMLElement | null;
  let overlay = firstEl?.classList?.contains('ostrze-overlay') ? firstEl : null;
  const isFreshOverlay = !overlay;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'ostrze-overlay is-entering';
    root.innerHTML = '';
    root.appendChild(overlay);
  } else {
    overlay.classList.remove('is-entering');
  }

  overlay.onclick = opts?.onOverlayBackdropClick
    ? (ev) => {
        if (ev.target === ev.currentTarget) {
          opts.onOverlayBackdropClick?.();
        }
      }
    : null;

  const cardEl = overlay.firstElementChild as HTMLElement | null;
  let card = cardEl?.classList?.contains('ostrze-card') ? cardEl : null;
  const prevBaseClass = card ? card.className.replace(/\bis-entering\b/g, '').trim() : '';
  const isSameModal = Boolean(card && prevBaseClass === cardClassName.trim());
  const prevScrollTop = isSameModal && card ? card.scrollTop : 0;

  // Capture inner scrollable panel offsets before updating innerHTML on same-modal re-renders
  const innerScrollSelector = '[data-preserve-scroll], .ostrze-shop-col, .ostrze-help-body';
  const prevInnerScrolls: number[] =
    isSameModal && card
      ? Array.from(card.querySelectorAll<HTMLElement>(innerScrollSelector)).map((el) => el.scrollTop)
      : [];

  if (!card) {
    card = document.createElement('div');
    overlay.innerHTML = '';
    overlay.appendChild(card);
  }

  for (const key of Object.keys(card.dataset)) {
    delete card.dataset[key];
  }

  card.className = isFreshOverlay ? `${cardClassName} is-entering` : cardClassName;
  card.style.cssText = opts?.styleText ?? '';
  if (opts?.dataset) {
    for (const [k, v] of Object.entries(opts.dataset)) {
      card.dataset[k] = v;
    }
  }
  card.innerHTML = innerHtml;

  if (prevScrollTop > 0) {
    card.scrollTop = prevScrollTop;
  }
  if (prevInnerScrolls.length > 0) {
    const nextInnerEls = card.querySelectorAll<HTMLElement>(innerScrollSelector);
    nextInnerEls.forEach((el, idx) => {
      const saved = prevInnerScrolls[idx];
      if (saved && saved > 0) {
        el.scrollTop = saved;
      }
    });
  }
  return card;
}
