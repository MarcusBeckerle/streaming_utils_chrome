(() => {
  // Player markers observed in Prime Video; deliberately exclude intro/next-episode controls.
  const TIMERS = '.atvwebplayersdk-ad-timer-remaining-time, .atvwebplayersdk-adtimeindicator-text';
  const CONTROLS = 'button, [role="button"], .adSkipButton';
  function visible(node) {
    if (!node?.getClientRects().length) return false;
    for (let item = node; item; item = item.parentElement) {
      const style = getComputedStyle(item);
      if (item.hidden || item.getAttribute('aria-hidden') === 'true' || style.display === 'none' ||
          ['hidden', 'collapse'].includes(style.visibility) || Number(style.opacity) === 0) return false;
    }
    return true;
  }
  function available(button) {
    return visible(button) && !button.disabled && !button.hasAttribute('disabled') &&
      button.getAttribute('aria-disabled') !== 'true' && getComputedStyle(button).pointerEvents !== 'none';
  }
  function skipKind(button) {
    const labels = [button.textContent, button.getAttribute('aria-label')]
      .map(text => (text || '').replace(/\s+/g, ' ').trim().toLowerCase());
    // A fixed accessible label may already say "Skip ad" during the countdown.
    if (labels.some(text => /\d/.test(text))) return null;
    if (labels.some(text => /^(?:(?:werbung|werbeanzeige|werbeanzeigen|trailer|werbetrailer) überspringen|skip (?:ad|ads|advert|advertisement|advertisements|trailer))$/.test(text))) return 'ad';
    if (labels.some(text => /^(?:überspringen|skip)$/.test(text))) return 'generic';
    return null;
  }
  class AmazonAds {
    constructor() {
      this.controller = new globalThis.YouTubeAdController();
      this.lastClick = new WeakMap();
    }
    restore() { this.controller.restore(); }
    update(player, config, now = Date.now()) {
      const buttons = player ? [...player.querySelectorAll(CONTROLS)] : [];
      const timerVisible = !!player && [...player.querySelectorAll(TIMERS)].some(node => visible(node) && /\d/.test(node.textContent || ''));
      const adButton = buttons.some(button => visible(button) && skipKind(button) === 'ad');
      const advertising = timerVisible || adButton;
      const videos = player ? [...player.querySelectorAll('video')].filter(visible) : [];
      const video = videos.find(item => !item.paused && !item.ended) || videos[0] || null;
      this.controller.update(video, advertising, config.amazonEnabled && config.amazonAdEnabled, config.amazonAdSpeed, now);
      if (!config.amazonEnabled || !config.amazonAutoSkip || !advertising) return false;
      for (const button of buttons) {
        const kind = skipKind(button);
        if (!(kind === 'ad' || (kind === 'generic' && timerVisible)) || !available(button)) continue;
        if (now - (this.lastClick.get(button) ?? -Infinity) < 1000) continue;
        this.lastClick.set(button, now);
        this.controller.beforeSkip(now);
        button.click();
        return true;
      }
      return false;
    }
  }
  globalThis.StreamingAmazonAds = AmazonAds;
})();
