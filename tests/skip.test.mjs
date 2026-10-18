import test from 'node:test';
import assert from 'node:assert/strict';
import '../extension/ad-skipper.js';
globalThis.getComputedStyle = node => ({display:'block',visibility:'visible',opacity:'1',pointerEvents:'auto',...node.style});
function fixture() {
  const player = {ad:true,style:{},getAttribute:()=>null,parentElement:null,classList:{contains:()=>player.ad},querySelectorAll:()=>[button]};
  const button = {disabled:false,attrs:{},style:{},parentElement:player,clicks:0,
    matches:()=>true,
    hasAttribute(key){return key in this.attrs;},getAttribute(key){return this.attrs[key] ?? null;},getClientRects:()=>[{}],click(){this.clicks++;}};
  return {player,button,skipper:new globalThis.YouTubeAdSkipper()};
}
test('waits for a visible enabled skip button, then clicks and debounces', () => {
  const {player,button,skipper}=fixture();
  button.disabled=true;
  assert.equal(skipper.update(player,true,0),false);
  button.disabled=false; button.style.display='none';
  assert.equal(skipper.update(player,true,250),false);
  button.style.display='block';
  assert.equal(skipper.update(player,true,500),true);
  assert.equal(skipper.update(player,true,750),false);
  assert.equal(button.clicks,1);
  assert.equal(skipper.update(player,true,1500),true);
});
test('never clicks outside ads, when disabled, or inside hidden containers', () => {
  const {player,button,skipper}=fixture();
  assert.equal(skipper.update(player,false),false);
  player.ad=false;
  assert.equal(skipper.update(player,true),false);
  player.ad=true; player.style.opacity='0';
  assert.equal(skipper.update(player,true),false);
  player.style.opacity='1'; button.attrs['aria-disabled']='true';
  assert.equal(skipper.update(player,true),false);
  delete button.attrs['aria-disabled']; button.getClientRects=()=>[];
  assert.equal(skipper.update(player,true),false);
  assert.equal(button.clicks,0);
});

test('a clickable button can override pointer-events on an overlay container', () => {
  const {player,button,skipper}=fixture();
  player.style.pointerEvents='none';
  button.style.pointerEvents='auto';
  assert.equal(skipper.update(player,true,0),true);
  button.style.pointerEvents='none';
  assert.equal(skipper.update(player,true,2000),false);
});

test('transition preparation runs only for an available button, before clicking', () => {
  const {player,button,skipper}=fixture();
  const calls=[]; button.click=()=>calls.push('click');
  button.disabled=true;
  skipper.update(player,true,0,()=>calls.push('prepare'));
  assert.deepEqual(calls,[]);
  button.disabled=false;
  skipper.update(player,true,250,()=>calls.push('prepare'));
  assert.deepEqual(calls,['prepare','click']);
});

test('recognizes renamed skip controls by exact labels, excluding countdowns and other controls', () => {
  const {player,button,skipper}=fixture();
  button.matches=()=>false;
  button.textContent='Überspringen';
  assert.equal(skipper.update(player,true,0),true);
  button.textContent=''; button.attrs['aria-label']='Skip ads';
  assert.equal(skipper.update(player,true,1500),true);
  button.textContent='Skip ads in 3';
  assert.equal(skipper.update(player,true,3000),false);
  button.matches=()=>true;
  assert.equal(skipper.update(player,true,3000),false);
  button.matches=()=>false; button.textContent='Nächstes Video'; delete button.attrs['aria-label'];
  assert.equal(skipper.update(player,true,3000),false);
  player.ad=false; button.textContent='Überspringen';
  assert.equal(skipper.update(player,true,3000),false);
});
