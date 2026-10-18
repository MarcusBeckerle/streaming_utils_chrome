import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {youtubeUrl, DEFAULTS, BITRATES, VIDEO_QUALITIES} from '../extension/shared.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(initial = {}) {
  const data = {...initial}, ports = [], downloadRequests = [];
  let downloadItem = {id:10,state:'in_progress',filename:'C:\\Downloads\\YouTubeUtils-Setup.cmd'};
  let listener;
  const event = () => ({handlers: [], addListener(fn) { this.handlers.push(fn); }});
  const base = 'chrome-extension://test-id/';
  const chrome = {
    storage: {local: {get: async key => ({[key]: data[key]}), set: async value => Object.assign(data, structuredClone(value))}},
    contextMenus: {onClicked: event(), removeAll: fn => fn(), create: () => {}},
    tabs: {query: async () => [{id:1,url:'https://www.youtube.com/watch?v=abcdefghI_1&list=abc',title:'Example - YouTube'}]},
    downloads: {onChanged:event(), download: async options => {downloadRequests.push(options); return 10;}, search:async () => [downloadItem]},
    runtime: {id:'test-id', getURL: file => base + file, onInstalled:event(), onMessage:{addListener: fn => {listener=fn;}},
      connectNative: () => {
        const port = {onMessage:event(),onDisconnect:event(),postMessage(message){this.message=message;},disconnect(){}};
        ports.push(port); return port;
      }}
  };
  const source = readFileSync('extension/background.js','utf8').replace(/^import .*?;\s*/, '');
  vm.runInNewContext(source, {chrome, settings:async()=>DEFAULTS, youtubeUrl, BITRATES, VIDEO_QUALITIES, crypto:webcrypto,setTimeout,clearTimeout,console,btoa,
    fetch:async () => ({ok:true,text:async ()=>'@echo off\r\necho setup\r\n'})});
  const send = (message, sender={id:'test-id',url:base+'popup.html'}) => new Promise(resolve => {
    const kept = listener(message, sender, resolve);
    if (!kept) resolve(undefined);
  });
  return {data,ports,send,downloadRequests, setDownload(item) {downloadItem={...downloadItem,...item};},
    notifyDownload(delta) {chrome.downloads.onChanged.handlers[0]({id:10,...delta});}};
}

test('content scripts cannot invoke native installation', async () => {
  const app = fixture();
  assert.equal(await app.send({action:'install'}, {id:'test-id',url:'https://www.youtube.com/watch?v=abcdefghI_1'}), undefined);
  assert.equal(app.ports.length, 0);
});

test('selected video quality reaches a capable helper and is rejected by old helpers', async () => {
  for (const supported of [true, false]) {
    const app = fixture();
    const pending = app.send({action:'download',format:'video',videoQuality:'720'});
    await tick();
    const statusPort = app.ports[0];
    assert.equal(statusPort.message.action,'status');
    statusPort.onMessage.handlers[0]({id:statusPort.message.id,event:'result',ok:true,result:{features:supported ? ['videoQuality'] : []}});
    const response = await pending;
    assert.equal(response.ok,supported);
    if (supported) {
      assert.equal(app.ports[1].message.videoQuality,'720');
      assert.equal(app.ports[1].message.format,'video');
      const port = app.ports[1];
      port.onMessage.handlers[0]({id:port.message.id,event:'result',ok:true,result:{path:'D:\\Video\\Test.mkv'}});
      await tick();
    } else { assert.match(response.error,/Helfer-Update/); assert.equal(app.ports.length,1); }
  }
  const app = fixture();
  assert.equal((await app.send({action:'download',format:'video',videoQuality:'1080]+best'})).ok,false);
  assert.equal(app.ports.length,0);
});

test('worker canonicalizes a download, prevents duplicate jobs and persists native progress and success', async () => {
  const app = fixture();
  const first = await app.send({action:'download',format:'mp3',bitrate:128});
  assert.equal(first.ok, true);
  assert.equal(app.ports[0].message.url, 'https://www.youtube.com/watch?v=abcdefghI_1');
  assert.equal((await app.send({action:'download',format:'video'})).ok, false);
  const port = app.ports[0], id=port.message.id;
  port.onMessage.handlers[0]({id,event:'progress',percent:42,message:'Downloading',durationSeconds:120});
  await tick();
  assert.equal(app.data.job.percent, 42);
  assert.equal(app.data.job.durationSeconds,120);
  port.onMessage.handlers[0]({id,event:'result',ok:true,result:{path:'D:\\Music\\Example.mp3',sizeBytes:2000000,durationSeconds:120.05}});
  await tick();
  assert.equal(app.data.job.state, 'done');
  assert.equal(app.data.job.path, 'D:\\Music\\Example.mp3');
  assert.equal(app.data.job.sizeBytes,2000000);
  assert.equal(app.data.job.durationSeconds,120.05);
});

test('Explorer uses only the persisted completed download path and rejects stale buttons', async () => {
  const app = fixture({job:{id:'latest',kind:'download',state:'done',path:'D:\\Music\\Example.mp3'}});
  assert.equal((await app.send({action:'reveal',jobId:'stale'})).ok,false);
  assert.equal(app.ports.length,0);
  const pending = app.send({action:'reveal',jobId:'latest',path:'C:\\Windows\\cmd.exe'});
  await tick();
  const port = app.ports[0];
  assert.equal(port.message.action,'reveal');
  assert.equal(port.message.path,'D:\\Music\\Example.mp3');
  port.onMessage.handlers[0]({id:port.message.id,event:'result',ok:true,result:{}});
  assert.equal((await pending).ok,true);
});

test('worker surfaces native errors and marks interrupted persisted jobs', async () => {
  const app = fixture({job:{state:'running',title:'Old download'}});
  await tick();
  assert.equal(app.data.job.state,'error');
  await app.send({action:'install'});
  const port=app.ports[0];
  port.onMessage.handlers[0]({id:port.message.id,event:'result',ok:false,error:'Checksum mismatch'});
  await tick();
  assert.equal(app.data.job.state,'error');
  assert.equal(app.data.job.message,'Checksum mismatch');
});

test('setup downloads bundled bytes instead of a private extension URL and only reports completion after Chrome confirms it', async () => {
  const app = fixture();
  const response = await app.send({action:'setup'});
  assert.equal(response.ok,true);
  assert.ok(app.downloadRequests[0].url.startsWith('data:application/octet-stream;base64,'));
  assert.equal(Buffer.from(app.downloadRequests[0].url.split(',')[1],'base64').toString(),'@echo off\r\necho setup\r\n');
  assert.equal(app.data.setupDownload.state,'in_progress');
  app.setDownload({state:'complete'});
  app.notifyDownload({state:{current:'complete'}});
  await tick();
  assert.equal(app.data.setupDownload.state,'complete');
});

test('setup detects immediate and later interrupted downloads instead of claiming success', async () => {
  const app = fixture();
  app.setDownload({state:'interrupted',error:'NETWORK_FAILED'});
  await app.send({action:'setup'});
  assert.equal(app.data.setupDownload.state,'interrupted');
  assert.equal(app.data.setupDownload.error,'NETWORK_FAILED');
  app.setDownload({state:'in_progress',error:''});
  await app.send({action:'setup'});
  app.setDownload({state:'interrupted',error:'USER_CANCELED'});
  app.notifyDownload({state:{current:'interrupted'}});
  await tick();
  assert.equal(app.data.setupDownload.error,'USER_CANCELED');
});
