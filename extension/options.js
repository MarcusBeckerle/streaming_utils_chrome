import {settings, normalizeSettings, request, showMessage, renderJob, bindRevealButton} from './shared.js';
const $ = id => document.getElementById(id);
const elements = {panel: $('job'), label: $('job-title'), progress: $('progress'), detail: $('job-detail'), metadata: $('job-metadata'), reveal: $('show-explorer')};
bindRevealButton(elements.reveal, $('message'));
let running = false, helperReady = false;
const fields = {
  youtubeEnabled: ['youtube-enabled', 'checked'], amazonEnabled: ['amazon-enabled', 'checked'],
  adEnabled: ['ad-enabled', 'checked'], autoSkip: ['auto-skip', 'checked'], adSpeed: ['ad-speed', 'value'],
  amazonAdEnabled: ['amazon-ad-enabled', 'checked'], amazonAutoSkip: ['amazon-auto-skip', 'checked'], amazonAdSpeed: ['amazon-ad-speed', 'value'],
  defaultFormat: ['default-format', 'value'], mp3Bitrate: ['mp3-bitrate', 'value'], videoQuality: ['video-quality', 'value'], audioFolder: ['audio-folder', 'value'], videoFolder: ['video-folder', 'value']
};
const dirty = new Set();
let savedSettings = null, saving = false;
function refreshDirty() {
  dirty.clear();
  if (savedSettings) {
    for (const [key, [id, prop]] of Object.entries(fields)) {
      const raw = $(id)[prop];
      const value = typeof savedSettings[key] === 'number' ? Number(raw)
        : typeof raw === 'string' ? raw.trim() : raw;
      if (value !== savedSettings[key]) dirty.add(key);
    }
  }
  $('save-settings').disabled = saving || !dirty.size;
}
for (const [id] of Object.values(fields)) {
  for (const event of ['input', 'change']) $(id).addEventListener(event, refreshDirty);
}
function populate(config) {
  for (const [key, [id, prop]] of Object.entries(fields)) if (!dirty.has(key)) $(id)[prop] = config[key];
  savedSettings = {...config};
  refreshDirty();
}
function selectTab(service) {
  for (const name of ['youtube', 'amazon']) {
    const selected = name === service;
    $(`tab-${name}`).setAttribute('aria-selected', String(selected));
    $(`tab-${name}`).tabIndex = selected ? 0 : -1;
    $(`panel-${name}`).hidden = !selected;
  }
  $('youtube-helper').hidden = service !== 'youtube';
}
for (const name of ['youtube', 'amazon']) {
  $(`tab-${name}`).onclick = () => selectTab(name);
  $(`tab-${name}`).onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'youtube' : event.key === 'End' ? 'amazon' : name === 'youtube' ? 'amazon' : 'youtube';
    selectTab(next); $(`tab-${next}`).focus();
  };
}
function setupChanged(download) {
  if (!download) return;
  if (download.state === 'complete') {
    showMessage($('message'), 'Setup gespeichert. Bitte StreamingUtils-Setup.cmd im Downloadordner starten.');
  } else if (download.state === 'interrupted') {
    showMessage($('message'), `Setup wurde nicht gespeichert (${download.error || 'Download abgebrochen'}). Bitte erneut versuchen oder Installieren.cmd im entpackten Paket starten.`, true);
  } else {
    showMessage($('message'), 'Setup-Download gestartet. Bitte den Abschluss in Chromes Downloadanzeige abwarten.');
  }
}
function jobChanged(job) {
  running = job?.state === 'running';
  renderJob(job, elements);
  $('install').disabled = running;
}
async function check() {
  $('check').disabled = true;
  $('tools').replaceChildren();
  showMessage($('status-message'), 'Installation wird geprüft …');
  try {
    const status = await request('status');
    helperReady = true;
    const helperCurrent = ['fileDetails', 'reveal', 'videoQuality'].every(feature => status.features?.includes(feature));
    $('setup-help').hidden = helperCurrent;
    $('helper-update').hidden = helperCurrent;
    $('setup').textContent = helperCurrent ? 'Windows-Setup erneut herunterladen' : 'Helfer-Update herunterladen';
    $('install').hidden = status.ready;
    showMessage($('status-message'), status.ready ? 'Alles bereit. Downloads können gestartet werden.' : 'Der Helfer ist verbunden. Es fehlen noch Programme.', !status.ready);
    for (const tool of status.tools) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = `${tool.ok ? '✓' : '○'} ${tool.name}`;
      dt.className = tool.ok ? 'success' : 'error';
      dd.textContent = tool.ok ? `${tool.version} · ${tool.path}` : (tool.error || 'Nicht gefunden');
      $('tools').append(dt, dd);
    }
    $('audio-folder').placeholder = status.defaults.audioFolder;
    $('video-folder').placeholder = status.defaults.videoFolder;
  } catch (error) {
    helperReady = false;
    $('helper-update').hidden = true;
    $('setup-help').hidden = false;
    $('setup').textContent = 'Windows-Setup herunterladen';
    $('install').hidden = true;
    showMessage($('status-message'), error.message, true);
  } finally {
    $('check').disabled = false;
    document.querySelectorAll('[data-browse]').forEach(button => { button.disabled = !helperReady; });
  }
}
$('settings-form').onsubmit = async event => {
  event.preventDefault();
  refreshDirty();
  if (saving || !dirty.size) return;
  saving = true;
  refreshDirty();
  try {
    const current = await settings();
    populate(current);
    if (!dirty.size) return;
    for (const key of dirty) { const [id, prop] = fields[key]; current[key] = $(id)[prop]; }
    const config = normalizeSettings(current);
    for (const folder of [config.audioFolder, config.videoFolder]) {
      if (folder && !/^[A-Za-z]:\\/.test(folder)) throw new Error('Bitte einen vollständigen lokalen Windows-Pfad verwenden, z. B. D:\\YouTube.');
      if (folder && /[<>"|?*\x00-\x1f]/.test(folder)) throw new Error('Der Ordner enthält ungültige Zeichen.');
    }
    await chrome.storage.local.set({settings: config});
    populate(config);
    showMessage($('save-message'), 'Gespeichert. Gilt sofort für bereits geladene YouTube- und Amazon-Tabs.');
  } catch (error) { showMessage($('save-message'), error.message, true); }
  finally { saving = false; refreshDirty(); }
};
document.querySelectorAll('[data-browse]').forEach(button => {
  button.onclick = async () => {
    button.disabled = true;
    try {
      const result = await request('browse', {folder: $(button.dataset.browse).value});
      if (result.folder) {
        $(button.dataset.browse).value = result.folder;
        refreshDirty();
        const key = button.dataset.browse === 'audio-folder' ? 'audioFolder' : 'videoFolder';
        showMessage($('save-message'), dirty.has(key) ? 'Ordner ausgewählt. Bitte Einstellungen speichern.' : 'Ordner unverändert.');
      }
    } catch (error) { showMessage($('message'), error.message, true); }
    finally { button.disabled = !helperReady; }
  };
});
$('check').onclick = check;
$('setup').onclick = async () => {
  $('setup').disabled = true;
  showMessage($('message'), 'Setup wird vorbereitet …');
  try {
    await request('setup');
    setupChanged((await chrome.storage.local.get('setupDownload')).setupDownload);
  } catch (error) { showMessage($('message'), `Setup wurde nicht gespeichert: ${error.message} Alternativ Installieren.cmd im entpackten Paket starten.`, true); }
  finally { $('setup').disabled = false; }
};
$('install').onclick = async () => {
  $('install').disabled = true;
  try { jobChanged(await request('install')); }
  catch (error) { showMessage($('message'), error.message, true); $('install').disabled = running; }
};
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) populate(normalizeSettings(changes.settings.newValue));
  if (changes.setupDownload) setupChanged(changes.setupDownload.newValue);
  if (!changes.job) return;
  jobChanged(changes.job.newValue);
  if (changes.job.newValue?.kind === 'install' && changes.job.newValue?.state !== 'running') void check();
});
async function init() {
  const config = await settings();
  populate(config);
  jobChanged((await chrome.storage.local.get('job')).job);
  setupChanged(await request('setupStatus'));
  await check();
}
init().catch(error => showMessage($('message'), error.message, true));
