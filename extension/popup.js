import {settings, normalizeSettings, request, youtubeUrl, showMessage, renderJob, formatDuration, bindRevealButton} from './shared.js';
const $ = id => document.getElementById(id);
const elements = {panel: $('job'), label: $('job-title'), progress: $('progress'), detail: $('job-detail'), metadata: $('job-metadata'), reveal: $('show-explorer')};
bindRevealButton(elements.reveal, $('message'));
let config, ready = false, validVideo = false, busy = false, starting = false;
let supportsQuality = false;
function update() {
  for (const service of ['youtube', 'amazon']) {
    const button = $(`${service}-toggle`), enabled = config[`${service}Enabled`];
    button.setAttribute('aria-checked', String(enabled));
    button.querySelector('span').textContent = enabled ? 'An' : 'Aus';
  }
  const audio = $('format').value === 'mp3';
  $('audio-settings').hidden = !audio;
  $('video-settings').hidden = audio;
  $('folder').textContent = `Ziel: ${audio ? config.audioFolder || 'Musik\\YouTube' : config.videoFolder || 'Videos\\YouTube'}`;
  $('quality-hint').textContent = audio ? 'Beste verfügbare Tonspur → MP3 mit der gewählten Bitrate. Eine höhere Bitrate verbessert die Quelle nicht.' : 'Beste verfügbare Auflösung bis zur gewählten Höhe; keine Hochskalierung. Bild und Ton werden ohne erneute Videokomprimierung als MKV gespeichert.';
  const needsUpdate = ready && !audio && $('video-quality').value !== 'best' && !supportsQuality;
  $('quality-update').hidden = !needsUpdate;
  $('download').disabled = !ready || !validVideo || busy || starting || needsUpdate;
  $('download').textContent = audio ? 'Herunterladen & als MP3 speichern' : 'Video herunterladen';
  for (const id of ['format', 'bitrate', 'video-quality']) $(id).disabled = busy || starting;
  $('ad-state').textContent = `YouTube: ${config.youtubeEnabled ? (config.adEnabled ? Math.min(16, config.adSpeed) + '×' : 'Tempo unverändert') + (config.autoSkip ? ' · Auto-Skip an' : ' · Auto-Skip aus') : 'Werbehilfe aus'}\nAmazon: ${config.amazonEnabled ? (config.amazonAdEnabled ? config.amazonAdSpeed + '×' : 'Tempo unverändert') + (config.amazonAutoSkip ? ' · Auto-Skip an' : ' · Auto-Skip aus') : 'Werbehilfe aus'}`;
}
function jobChanged(job) { busy = job?.state === 'running'; renderJob(job, elements); if (config) update(); }
$('options').onclick = () => chrome.runtime.openOptionsPage();
for (const id of ['format', 'bitrate', 'video-quality']) $(id).onchange = () => { if (config) update(); };
// Serialize rapid clicks so the two service switches cannot overwrite each other.
let pendingToggle = Promise.resolve();
for (const service of ['youtube', 'amazon']) {
  const button = $(`${service}-toggle`);
  button.onclick = () => {
    button.disabled = true;
    pendingToggle = pendingToggle.then(async () => {
      const latest = await settings();
      latest[`${service}Enabled`] = !latest[`${service}Enabled`];
      await chrome.storage.local.set({settings: latest});
      config = latest; update();
    }).catch(error => showMessage($('message'), error.message, true)).finally(() => { button.disabled = false; });
  };
}
$('download').onclick = async () => {
    const format = $('format').value;
    starting = true; update();
    try {
      jobChanged(await request('download', {format, bitrate: Number($('bitrate').value), videoQuality: $('video-quality').value}));
      showMessage($('message'), 'Du kannst das Popup schließen. Der Vorgang läuft weiter.');
    } catch (error) { showMessage($('message'), error.message, true); }
    finally { starting = false; update(); }
};
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) { config = normalizeSettings(changes.settings.newValue); update(); }
  if (changes.job) jobChanged(changes.job.newValue);
});
async function init() {
  config = await settings();
  $('format').value = config.defaultFormat;
  $('bitrate').value = config.mp3Bitrate;
  $('video-quality').value = config.videoQuality;
  $('youtube-toggle').disabled = $('amazon-toggle').disabled = false;
  update();
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  validVideo = !!youtubeUrl(tab?.url);
  $('title').textContent = validVideo ? (tab.title || 'YouTube-Video').replace(/ - YouTube$/, '') : 'Zum Herunterladen ein YouTube-Video oder Short öffnen.';
  jobChanged((await chrome.storage.local.get('job')).job);
  if (!validVideo) return;
  try {
    const info = await chrome.tabs.sendMessage(tab.id, {action: 'videoInfo'});
    if (info?.title) $('title').textContent = info.title;
    const duration = formatDuration(info?.durationSeconds);
    $('video-duration').textContent = duration ? `Dauer: ${duration}` : '';
    $('video-duration').hidden = !duration;
  } catch { /* Existing tabs may need reloading after installation. */ }
  try {
    const status = await request('status');
    ready = status.ready;
    supportsQuality = !!status.features?.includes('videoQuality');
    if (!ready) showMessage($('message'), 'Programme fehlen. Bitte in den Einstellungen installieren.', true);
    else if (!status.features?.includes('fileDetails')) showMessage($('message'), 'Für Dateidetails und Explorer bitte Installieren.cmd aus dem neuen Paket einmal ausführen.');
  } catch { showMessage($('message'), 'Windows-Helfer fehlt oder ist nicht erreichbar. Bitte das Setup in den Einstellungen starten.', true); }
  update();
}
init().catch(error => showMessage($('message'), error.message, true));
