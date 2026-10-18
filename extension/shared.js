export const DEFAULTS = Object.freeze({
  youtubeEnabled: true, amazonEnabled: true,
  adEnabled: true, adSpeed: 20, autoSkip: true,
  amazonAdEnabled: true, amazonAdSpeed: 16, amazonAutoSkip: true,
  defaultFormat: 'mp3', mp3Bitrate: 128, videoQuality: 'best',
  videoFolder: '', audioFolder: ''
});
export const BITRATES = [64, 96, 128, 192, 256, 320];
export const VIDEO_QUALITIES = ['best', '4320', '2160', '1440', '1080', '720', '480', '360', '240', '144'];

export function normalizeSettings(value = {}) {
  const speed = Number(value.adSpeed);
  const amazonSpeed = Number(value.amazonAdSpeed);
  return {
    youtubeEnabled: typeof value.youtubeEnabled === 'boolean' ? value.youtubeEnabled : DEFAULTS.youtubeEnabled,
    amazonEnabled: typeof value.amazonEnabled === 'boolean' ? value.amazonEnabled : DEFAULTS.amazonEnabled,
    amazonAdEnabled: typeof value.amazonAdEnabled === 'boolean' ? value.amazonAdEnabled : DEFAULTS.amazonAdEnabled,
    amazonAutoSkip: typeof value.amazonAutoSkip === 'boolean' ? value.amazonAutoSkip : DEFAULTS.amazonAutoSkip,
    amazonAdSpeed: Number.isFinite(amazonSpeed) ? Math.min(16, Math.max(1, amazonSpeed)) : DEFAULTS.amazonAdSpeed,
    adEnabled: typeof value.adEnabled === 'boolean' ? value.adEnabled : DEFAULTS.adEnabled,
    autoSkip: typeof value.autoSkip === 'boolean' ? value.autoSkip : DEFAULTS.autoSkip,
    adSpeed: Number.isFinite(speed) ? Math.min(100, Math.max(1, speed)) : DEFAULTS.adSpeed,
    defaultFormat: value.defaultFormat === 'video' ? 'video' : 'mp3',
    mp3Bitrate: BITRATES.includes(Number(value.mp3Bitrate)) ? Number(value.mp3Bitrate) : 128,
    videoQuality: VIDEO_QUALITIES.includes(String(value.videoQuality)) ? String(value.videoQuality) : 'best',
    videoFolder: typeof value.videoFolder === 'string' ? value.videoFolder.trim() : '',
    audioFolder: typeof value.audioFolder === 'string' ? value.audioFolder.trim() : ''
  };
}

export function youtubeUrl(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    let id;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else id = url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})\/?$/)?.[1];
    }
    return /^[\w-]{11}$/.test(id || '') ? `https://www.youtube.com/watch?v=${id}` : null;
  } catch { return null; }
}

export async function settings() {
  const saved = await chrome.storage.local.get('settings');
  return normalizeSettings({...DEFAULTS, ...saved.settings});
}

export async function request(action, data = {}) {
  const response = await chrome.runtime.sendMessage({action, ...data});
  if (!response?.ok) throw new Error(response?.error || 'Keine Antwort von der Erweiterung.');
  return response.result;
}

export function showMessage(element, message, error = false) {
  element.textContent = message;
  element.classList.toggle('error', error);
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const rest = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = bytes ? Math.min(4, Math.floor(Math.log(bytes) / Math.log(1000))) : 0;
  return `${(bytes / (1000 ** index)).toLocaleString('de-DE', {maximumFractionDigits: index ? 1 : 0})} ${units[index]}`;
}

export function bindRevealButton(button, message) {
  button.onclick = async () => {
    button.disabled = true;
    try {
      await request('reveal', {jobId: button.dataset.jobId});
      showMessage(message, 'Datei im Explorer ausgewählt.');
    } catch (error) { showMessage(message, error.message, true); }
    finally { button.disabled = false; }
  };
}

export function renderJob(job, elements) {
  const {panel, label, progress, detail, metadata, reveal} = elements;
  const completed = job?.kind === 'download' && job.state === 'done' && !!job.path;
  reveal.hidden = !completed;
  reveal.dataset.jobId = completed ? job.id : '';
  const info = [];
  const duration = formatDuration(job?.durationSeconds);
  if (job?.kind === 'download' && duration) info.push(`Dauer: ${duration}`);
  if (completed) {
    const size = formatFileSize(job.sizeBytes);
    if (size) info.push(`Dateigröße: ${size}`);
  }
  metadata.textContent = info.join(' · ');
  metadata.hidden = !info.length;
  panel.hidden = !job;
  if (!job) return;
  label.textContent = job.title || (job.kind === 'install' ? 'Programme einrichten' : 'Download');
  detail.textContent = job.message || '';
  detail.classList.toggle('error', job.state === 'error');
  if (job.state === 'running' && !Number.isFinite(job.percent)) progress.removeAttribute('value');
  else progress.value = job.state === 'done' ? 100 : (job.percent || 0);
}
