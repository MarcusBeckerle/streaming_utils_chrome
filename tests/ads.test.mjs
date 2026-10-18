import test from 'node:test';
import assert from 'node:assert/strict';
import '../extension/ad-controller.js';
const Controller = globalThis.YouTubeAdController;
function video(rate = 1) {
  return {playbackRate: rate, currentTime: 12, muted: false, style: {display: ''}};
}
test('ads use the real Chrome limit, restore the original rate and never seek/hide/mute', () => {
  const ad = new Controller(), v = video(1.75);
  ad.update(v, false, true, 20);
  ad.update(v, true, true, 20);
  assert.equal(v.playbackRate, 16);
  assert.equal(v.currentTime, 12);
  assert.equal(v.muted, false);
  assert.equal(v.style.display, '');
  ad.update(v, false, true, 20);
  assert.equal(v.playbackRate, 1.75);
});
test('disable during ad restores speed and reenable reapplies it', () => {
  const ad = new Controller(), v = video(1.5);
  ad.update(v, true, true, 8);
  assert.equal(v.playbackRate, 8);
  ad.update(v, true, false, 8);
  assert.equal(v.playbackRate, 1.5);
  ad.update(v, true, true, 4);
  assert.equal(v.playbackRate, 4);
  ad.update(v, false, true, 4);
  assert.equal(v.playbackRate, 1.5);
});
test('consecutive ads with a replaced element preserve the normal playback rate', () => {
  const ad = new Controller(), first = video(2), second = video(1);
  ad.update(first, true, true, 16);
  ad.update(second, true, true, 16);
  assert.equal(first.playbackRate, 2);
  assert.equal(second.playbackRate, 16);
  ad.update(second, false, true, 16);
  assert.equal(second.playbackRate, 2);
});
test('normal speed changes survive the next advertisement', () => {
  const ad = new Controller(), v = video();
  ad.update(v, false, true, 16);
  v.playbackRate = 1.25;
  ad.update(v, false, true, 16);
  ad.update(v, true, true, 16);
  v.playbackRate = 1;
  ad.update(v, true, true, 16);
  assert.equal(v.playbackRate, 16);
  ad.update(v, false, true, 16);
  assert.equal(v.playbackRate, 1.25);
});

test('loading and consecutive spots settle at normal speed before accelerating', () => {
  const ad = new Controller(), v = {...video(1.5), readyState: 0, currentSrc:'first', paused:false};
  ad.update(v, true, true, 16, 0);
  assert.equal(v.playbackRate, 1.5);
  v.readyState = 4; v.currentTime = 0;
  ad.update(v, true, true, 16, 1000);
  assert.equal(v.playbackRate, 1.5);
  v.currentTime = 1; ad.update(v, true, true, 16, 1700);
  assert.equal(v.playbackRate, 16);
  v.currentSrc = 'second'; v.currentTime = 0; v.readyState = 1;
  ad.update(v, true, true, 16, 1900);
  assert.equal(v.playbackRate, 1.5);
  v.readyState = 4; v.currentTime = 1; ad.update(v, true, true, 16, 2600);
  assert.equal(v.playbackRate, 16);
  ad.update(v, false, true, 16, 2700);
  assert.equal(v.playbackRate, 1.5);
});

test('skip restores speed before the click and holds it through the transition', () => {
  const ad = new Controller(), v = {...video(1.25), readyState:4, currentSrc:'spot', paused:false};
  ad.update(v, true, true, 16, 0);
  v.currentTime++; ad.update(v, true, true, 16, 700);
  assert.equal(v.playbackRate, 16);
  ad.beforeSkip(800); assert.equal(v.playbackRate, 1.25);
  v.currentTime++; ad.update(v, true, true, 16, 1000);
  assert.equal(v.playbackRate, 1.25);
  ad.update(v, false, true, 16, 1100);
  assert.equal(v.playbackRate, 1.25);
});

test('stalled playback falls back to 1x without unpausing, seeking or repeated acceleration', () => {
  const ad = new Controller(), v = {...video(1.25), readyState:4, currentSrc:'spot', paused:false};
  ad.update(v, true, true, 16, 0);
  v.currentTime++; ad.update(v, true, true, 16, 700);
  ad.update(v, true, true, 16, 2800);
  assert.equal(v.playbackRate, 1);
  v.currentTime++; ad.update(v, true, true, 16, 3100);
  assert.equal(v.playbackRate, 1);
  assert.equal(v.paused, false); assert.equal(v.currentTime, 14);
  ad.update(v, false, true, 16, 3200);
  assert.equal(v.playbackRate, 1.25);
});
