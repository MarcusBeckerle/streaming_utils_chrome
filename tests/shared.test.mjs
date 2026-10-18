import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeUrl, normalizeSettings, DEFAULTS, formatDuration, formatFileSize, renderJob} from '../extension/shared.js';

test('canonicalizes single videos and strips playlist/tracking parameters', () => {
  const expected = 'https://www.youtube.com/watch?v=abcdefghI_1';
  for (const url of [expected + '&list=PL123', 'https://youtu.be/abcdefghI_1?t=30', 'https://www.youtube.com/shorts/abcdefghI_1', 'https://m.youtube.com/live/abcdefghI_1']) assert.equal(youtubeUrl(url), expected);
});
test('rejects other hosts, credentials, protocols, playlists and malformed IDs', () => {
  for (const url of ['https://youtube.com.evil.test/watch?v=abcdefghI_1', 'https://www.youtube.com/playlist?list=PL123', 'https://user@youtube.com/watch?v=abcdefghI_1', 'http://youtu.be/abcdefghI_1', 'https://youtu.be/short', 'file:///C:/test', 'https://youtube.com:123/watch?v=abcdefghI_1']) assert.equal(youtubeUrl(url), null, url);
});
test('settings preserve the defaults and validate values', () => {
  assert.deepEqual(normalizeSettings(), DEFAULTS);
  assert.deepEqual(normalizeSettings({adSpeed: 500, mp3Bitrate: 999, defaultFormat: 'invalid', audioFolder: ' D:\\Audio '}), {...DEFAULTS, adSpeed: 100, audioFolder: 'D:\\Audio'});
  assert.equal(normalizeSettings({adEnabled: false, adSpeed: 3.5}).adEnabled, false);
  assert.equal(normalizeSettings({videoQuality:'1080'}).videoQuality,'1080');
  assert.equal(normalizeSettings({videoQuality:'999'}).videoQuality,'best');
});

test('file details format short videos, long videos, bytes and unknown values', () => {
  assert.equal(formatDuration(19.25), '0:19');
  assert.equal(formatDuration(3661), '1:01:01');
  assert.equal(formatDuration(null), '');
  assert.equal(formatDuration(Infinity), '');
  assert.equal(formatFileSize(1536000), '1,5 MB');
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(undefined), '');
});

test('Explorer appears only for completed downloads and details survive rerendering', () => {
  const element = () => ({hidden:false,textContent:'',dataset:{},classList:{toggle(){}},removeAttribute(){}});
  const elements = Object.fromEntries(['panel','label','progress','detail','metadata','reveal'].map(key=>[key,element()]));
  const job = {id:'saved',kind:'download',state:'running',percent:100,durationSeconds:125};
  renderJob(job,elements);
  assert.equal(elements.reveal.hidden,true);
  assert.equal(elements.metadata.textContent,'Dauer: 2:05');
  Object.assign(job,{state:'done',path:'D:\\Music\\Test.mp3',sizeBytes:2048000});
  renderJob(job,elements);
  assert.equal(elements.reveal.hidden,false);
  assert.equal(elements.reveal.dataset.jobId,'saved');
  assert.equal(elements.metadata.textContent,'Dauer: 2:05 · Dateigröße: 2 MB');
  renderJob({kind:'install',state:'done'},elements);
  assert.equal(elements.reveal.hidden,true);
  assert.equal(elements.metadata.hidden,true);
  renderJob(null,elements);
  assert.equal(elements.panel.hidden,true);
});
