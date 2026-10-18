import test from 'node:test';
import assert from 'node:assert/strict';
import '../extension/ad-controller.js';
import '../extension/amazon-ads.js';
import {DEFAULTS, normalizeSettings} from '../extension/shared.js';
globalThis.getComputedStyle = node => ({display:'block', visibility:'visible', opacity:'1', pointerEvents:'auto', ...node.style});
function node(text = '') {
  return {textContent:text, style:{}, attrs:{}, parentElement:null, clicks:0,
    getClientRects(){return this.detached ? [] : [{}];}, getAttribute(key){return this.attrs[key] ?? null;},
    hasAttribute(key){return key in this.attrs;}, click(){this.clicks++;}};
}
function fixture() {
  const video = Object.assign(node(), {playbackRate:1.5, paused:false, currentTime:20, muted:false});
  const timer = node('Werbung 0:15'), button = node('Überspringen'), player = node();
  player.querySelectorAll = selector => selector === 'video' ? [video] : selector.startsWith('.atvwebplayersdk-ad-timer') ? [timer] : [button];
  for (const item of [video, timer, button]) item.parentElement = player;
  return {player, video, timer, button, ads:new globalThis.StreamingAmazonAds(), config:{...DEFAULTS}};
}
test('Prime ads accelerate, skip only when ready, and restore on ad end', () => {
  const f = fixture(); f.button.disabled = true;
  assert.equal(f.ads.update(f.player, f.config, 0), false);
  assert.equal(f.video.playbackRate, 16);
  f.button.disabled = false;
  assert.equal(f.ads.update(f.player, f.config, 250), true);
  assert.equal(f.ads.update(f.player, f.config, 500), false);
  assert.equal(f.button.clicks, 1);
  f.timer.hidden = true;
  assert.equal(f.ads.update(f.player, f.config, 1500), false);
  assert.equal(f.video.playbackRate, 1.5);
  assert.equal(f.video.currentTime, 20); assert.equal(f.video.muted, false);
});
test('Prime master switch restores immediately and preserves independent preferences', () => {
  const f = fixture(); f.config.amazonAutoSkip = false;
  f.ads.update(f.player, f.config);
  assert.equal(f.video.playbackRate, 16); assert.equal(f.button.clicks, 0);
  f.config.amazonEnabled = false; f.ads.update(f.player, f.config);
  assert.equal(f.video.playbackRate, 1.5);
  f.config.amazonEnabled = true; f.config.amazonAdEnabled = false; f.config.amazonAutoSkip = true;
  assert.equal(f.ads.update(f.player, f.config), true);
  assert.equal(f.video.playbackRate, 1.5);
});
test('Prime ignores hidden ads, normal intro/recap/next controls and countdown text', () => {
  const f = fixture();
  for (const text of ['Intro überspringen', 'Skip intro', 'Rückblick überspringen', 'Nächste Folge', 'Skip ad in 5', 'Überspringen in 3']) {
    f.button.textContent = text;
    assert.equal(f.ads.update(f.player, f.config), false, text);
  }
  f.button.attrs['aria-label'] = 'Skip ad'; f.button.textContent = 'Überspringen in 3';
  assert.equal(f.ads.update(f.player, f.config), false);
  delete f.button.attrs['aria-label'];
  f.timer.style.opacity = '0'; f.button.textContent = 'Überspringen';
  f.ads.update(f.player, f.config);
  assert.equal(f.video.playbackRate, 1.5); assert.equal(f.button.clicks, 0);
  f.timer.style.opacity = '1'; f.player.hidden = true; f.ads.update(f.player, f.config);
  assert.equal(f.video.playbackRate, 1.5); assert.equal(f.button.clicks, 0);
});
test('explicit trailer skip works without a timer, but requires an available button', () => {
  const f = fixture(); f.timer.hidden = true; f.button.textContent = 'Trailer überspringen';
  f.button.attrs['aria-disabled'] = 'true';
  assert.equal(f.ads.update(f.player, f.config, 0), false);
  delete f.button.attrs['aria-disabled']; f.button.style.pointerEvents = 'none';
  assert.equal(f.ads.update(f.player, f.config, 250), false);
  f.button.style.pointerEvents = 'auto';
  assert.equal(f.ads.update(f.player, f.config, 500), true);
  f.ads.update(null, f.config); assert.equal(f.video.playbackRate, 1.5);
});
test('legacy settings retain YouTube choices and gain independent Amazon defaults', () => {
  const config = normalizeSettings({adEnabled:false, autoSkip:false, adSpeed:8, audioFolder:'D:\\Audio'});
  assert.equal(config.adEnabled, false); assert.equal(config.autoSkip, false);
  assert.equal(config.amazonEnabled, true); assert.equal(config.amazonAutoSkip, true);
  assert.equal(config.amazonAdSpeed, 16); assert.equal(config.audioFolder, 'D:\\Audio');
  assert.equal(normalizeSettings({amazonAdSpeed:100}).amazonAdSpeed, 16);
});
