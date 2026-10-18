(() => {
  const defaults = {youtubeEnabled: true, adEnabled: true, adSpeed: 20, autoSkip: true};
  let config = {...defaults};
  let loaded = false;
  const controller = new globalThis.YouTubeAdController();
  const skipper = new globalThis.YouTubeAdSkipper();
  let player = null;
  let observer = null;
  function update() {
    if (!loaded) return;
    const next = document.querySelector('#movie_player, .html5-video-player');
    if (next !== player) {
      observer?.disconnect();
      player = next;
      if (player) {
        observer = new MutationObserver(update);
        observer.observe(player, {attributes: true, attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-disabled', 'aria-hidden'], childList: true, subtree: true});
      }
    }
    const video = player?.querySelector('video');
    const advertising = !!player?.classList.contains('ad-showing');
    controller.update(video, advertising, config.youtubeEnabled && config.adEnabled, config.adSpeed);
    skipper.update(player, config.youtubeEnabled && config.autoSkip, Date.now(), () => controller.beforeSkip());
  }
  chrome.storage.local.get('settings').then(({settings}) => {
    config = {...config, ...settings}; loaded = true; update();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      config = {...defaults, ...changes.settings.newValue}; update();
    }
  });
  document.addEventListener('loadedmetadata', update, true);
  document.addEventListener('yt-navigate-finish', update);
  let timer = setInterval(update, 250);
  window.addEventListener('pagehide', () => { controller.restore(); observer?.disconnect(); player = null; clearInterval(timer); });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { clearInterval(timer); timer = setInterval(update, 250); update(); }
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.action !== 'videoInfo') return;
    const title = document.querySelector('ytd-watch-metadata h1 yt-formatted-string, h1.title yt-formatted-string')?.textContent?.trim()
      || document.title.replace(/ - YouTube$/, '');
    const videoDuration = controller.video?.duration;
    const adShowing = controller.ad || !!player?.classList.contains('ad-showing');
    const durationSeconds = !adShowing && Number.isFinite(videoDuration) && videoDuration > 0 ? videoDuration : null;
    respond({title, url: location.href, ad: controller.ad, actualSpeed: controller.appliedRate, durationSeconds});
  });
  update();
})();
