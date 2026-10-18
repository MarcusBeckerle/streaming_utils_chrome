(() => {
  const SELECTORS = '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern';
  class AdSkipper {
    constructor() { this.lastClick = new WeakMap(); }
    update(player, enabled, now = Date.now(), beforeClick = () => {}) {
      if (!enabled || !player?.classList.contains('ad-showing')) return false;
      for (const button of player.querySelectorAll(`${SELECTORS}, button, [role="button"]`)) {
        const labels = [button.textContent, button.getAttribute('aria-label')]
          .map(value => (value || '').replace(/\s+/g, ' ').trim().toLowerCase());
        // Exact visible/accessibility labels cover player variants with renamed
        // classes. Never treat countdowns or general player controls as skip.
        if (labels.some(label => /\d/.test(label))) continue;
        if (!button.matches(SELECTORS) && !labels.some(label => /^(?:überspringen|werbung überspringen|anzeige überspringen|anzeigen überspringen|skip|skip ad|skip ads|skip advertisement)$/.test(label))) continue;
        if (button.disabled || button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') continue;
        if (!button.getClientRects().length) continue;
        if (getComputedStyle(button).pointerEvents === 'none') continue;
        let visible = true;
        for (let node = button; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) {
            visible = false; break;
          }
        }
        if (!visible || now - (this.lastClick.get(button) ?? -Infinity) < 1000) continue;
        // Only press YouTube's available control; never seek or bypass its countdown.
        this.lastClick.set(button, now);
        beforeClick();
        button.click();
        return true;
      }
      return false;
    }
  }
  globalThis.YouTubeAdSkipper = AdSkipper;
})();
