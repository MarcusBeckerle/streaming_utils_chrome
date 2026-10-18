import {settings, youtubeUrl, BITRATES, VIDEO_QUALITIES} from './shared.js';

const HOST = 'de.youtube_utils.helper';
let running = null;
let jobWrites = Promise.resolve();
const initialized = (async () => {
  const {job} = await chrome.storage.local.get('job');
  if (job?.state === 'running') await chrome.storage.local.set({job: {...job, state: 'error', message: 'Verbindung unterbrochen. Bitte den Zielordner prüfen und bei Bedarf erneut starten.'}});
})();

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => chrome.contextMenus.create({id: 'settings', title: 'Einstellungen', contexts: ['action']}));
});
chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === 'settings') chrome.runtime.openOptionsPage();
});

async function refreshSetupDownload(id) {
  const {setupDownload} = await chrome.storage.local.get('setupDownload');
  if (setupDownload?.id !== id) return;
  const [item] = await chrome.downloads.search({id});
  const state = item ? {id, state: item.state, error: item.error || '', filename: item.filename || ''}
    : {id, state: 'interrupted', error: 'Download nicht mehr vorhanden.', filename: ''};
  await chrome.storage.local.set({setupDownload: state});
  return state;
}

chrome.downloads.onChanged.addListener(delta => {
  if (delta.state || delta.error) void refreshSetupDownload(delta.id).catch(console.error);
});

function native(action, data = {}, onProgress, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const port = chrome.runtime.connectNative(HOST);
    let settled = false;
    const timeout = timeoutMs ? setTimeout(() => finish(new Error('Der Windows-Helfer antwortet nicht. Bitte Setup erneut ausführen.')), timeoutMs) : null;
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      port.disconnect();
      error ? reject(error) : resolve(result);
    }
    port.onMessage.addListener(message => {
      if (message.id !== id) return;
      if (message.event === 'progress') onProgress?.(message);
      else if (message.event === 'result') finish(message.ok ? null : new Error(message.error || 'Der Vorgang ist fehlgeschlagen.'), message.result);
    });
    port.onDisconnect.addListener(() => {
      const detail = chrome.runtime.lastError?.message;
      finish(new Error(detail ? `Windows-Helfer nicht erreichbar: ${detail}` : 'Die Verbindung zum Windows-Helfer wurde geschlossen.'));
    });
    port.postMessage({id, action, ...data});
  });
}

function saveJob(job) {
  const snapshot = {...job};
  jobWrites = jobWrites.catch(() => {}).then(() => chrome.storage.local.set({job: snapshot}));
  return jobWrites;
}

async function startJob(kind, data, title) {
  if (running) throw new Error('Es läuft bereits ein Vorgang. Bitte warte, bis er abgeschlossen ist.');
  const job = {id: crypto.randomUUID(), kind, title, state: 'running', message: 'Verbindung wird aufgebaut …', percent: null};
  running = job;
  await saveJob(job);
  void (async () => {
    try {
      const result = await native(kind, data, event => {
        job.message = String(event.message || '').slice(0, 3000);
        job.percent = Number.isFinite(event.percent) ? event.percent : null;
        if (Number.isFinite(event.durationSeconds) && event.durationSeconds >= 0) job.durationSeconds = event.durationSeconds;
        void saveJob(job);
      }, 0);
      job.state = 'done';
      job.percent = 100;
      job.message = kind === 'download' ? `Gespeichert: ${result.path}` : 'Programme sind eingerichtet. Status erneut prüfen.';
      job.path = result.path;
      if (Number.isFinite(result.sizeBytes)) job.sizeBytes = result.sizeBytes;
      if (Number.isFinite(result.durationSeconds)) job.durationSeconds = result.durationSeconds;
    } catch (error) {
      job.state = 'error'; job.message = error.message;
    } finally {
      await saveJob(job);
      running = null;
    }
  })();
  return job;
}

async function handle(message) {
  await initialized;
  switch (message.action) {
    case 'status': return native('status');
    case 'browse': return native('browse', {folder: String(message.folder || '')}, undefined, 0);
    case 'install': return startJob('install', {}, 'Fehlende Programme installieren');
    case 'reveal': {
      const {job} = await chrome.storage.local.get('job');
      if (job?.kind !== 'download' || job.state !== 'done' || !job.path || job.id !== message.jobId) {
        throw new Error('Diese Datei ist nicht mehr der letzte abgeschlossene Download. Bitte das Popup erneut öffnen.');
      }
      try { return await native('reveal', {path: job.path}); }
      catch (error) {
        if (/Unbekannte Aktion/.test(error.message)) throw new Error('Bitte Installieren.cmd aus dem neuen Paket erneut ausführen, um den Windows-Helfer zu aktualisieren.');
        throw error;
      }
    }
    case 'setup': {
      // Read the private bundled resource ourselves. Chrome's download manager
      // cannot reliably download a non-web-accessible chrome-extension:// URL.
      const response = await fetch(chrome.runtime.getURL('setup/YouTubeUtils-Setup.cmd'));
      if (!response.ok) throw new Error('Die Setup-Datei fehlt im Paket. Bitte Installieren.cmd aus dem entpackten Paket starten.');
      const script = await response.text();
      const downloadId = await chrome.downloads.download({
        url: 'data:application/octet-stream;base64,' + btoa(script),
        filename: 'StreamingUtils-Setup.cmd', saveAs: true
      });
      await chrome.storage.local.set({setupDownload: {id: downloadId, state: 'in_progress'}});
      // Catch downloads which finished or failed before the event listener knew the ID.
      await refreshSetupDownload(downloadId);
      return {downloadId};
    }
    case 'setupStatus': {
      const {setupDownload} = await chrome.storage.local.get('setupDownload');
      return setupDownload ? refreshSetupDownload(setupDownload.id) : null;
    }
    case 'download': {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const url = youtubeUrl(tab?.url);
      if (!url) throw new Error('Bitte zuerst ein YouTube-Video oder Short öffnen.');
      const config = await settings();
      const format = message.format || config.defaultFormat;
      if (!['mp3', 'video'].includes(format)) throw new Error('Ungültiges Format.');
      const bitrate = Number(message.bitrate || config.mp3Bitrate);
      if (!BITRATES.includes(bitrate)) throw new Error('Ungültige MP3-Bitrate.');
      const videoQuality = String(message.videoQuality ?? config.videoQuality);
      if (!VIDEO_QUALITIES.includes(videoQuality)) throw new Error('Ungültige Videoqualität.');
      if (format === 'video' && videoQuality !== 'best') {
        const status = await native('status');
        if (!status.features?.includes('videoQuality')) throw new Error('Für die gewählte Videoqualität bitte das Helfer-Update in den Einstellungen herunterladen und starten.');
      }
      return startJob('download', {url, format, bitrate, videoQuality, folder: format === 'mp3' ? config.audioFolder : config.videoFolder}, (tab.title || 'YouTube-Video').replace(/ - YouTube$/, ''));
    }
    default: throw new Error('Unbekannte Aktion.');
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  // Content scripts and web pages cannot invoke local processes or installers.
  const allowedPages = ['popup.html', 'options.html'].map(path => chrome.runtime.getURL(path));
  if (sender.id !== chrome.runtime.id || !allowedPages.includes(sender.url)) return;
  handle(message).then(result => respond({ok: true, result}), error => respond({ok: false, error: error.message}));
  return true;
});
