(() => {
  const defaults = {amazonEnabled: true, amazonAdEnabled: true, amazonAdSpeed: 16, amazonAutoSkip: true};
  let config = {...defaults};
  let loaded = false;
  const ads = new globalThis.StreamingAmazonAds();
  let player = null, observer = null;
  function update() {
    if (!loaded) return;
    const next = [...document.querySelectorAll('.dv-player-fullscreen, #dv-web-player, .atvwebplayersdk-player-container')]
      .find(node => node.getClientRects().length && node.querySelector('video')) || null;
    if (next !== player) {
      observer?.disconnect();
      player = next;
      if (player) {
        observer = new MutationObserver(update);
        observer.observe(player, {subtree: true, childList: true, characterData: true, attributes: true,
          attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-disabled', 'aria-hidden', 'aria-label']});
      }
    }
    ads.update(player, config);
  }
  chrome.storage.local.get('settings').then(({settings}) => { config = {...defaults, ...settings}; loaded = true; update(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) { config = {...defaults, ...changes.settings.newValue}; update(); }
  });
  document.addEventListener('loadedmetadata', update, true);
  let timer = setInterval(update, 250);
  window.addEventListener('pagehide', () => { ads.restore(); observer?.disconnect(); player = null; clearInterval(timer); });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { clearInterval(timer); timer = setInterval(update, 250); update(); }
  });
  update();
})();
