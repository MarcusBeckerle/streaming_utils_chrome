import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {mkdirSync, writeFileSync} from 'node:fs';

const powershell = process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe') : null;
function exchange(messages, throughLauncher = false) {
  return new Promise((resolve, reject) => {
    let command = powershell;
    let args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('native/host.ps1')];
    if (throughLauncher) {
      mkdirSync('tests/.runtime', {recursive:true});
      const launcher = path.resolve('tests/.runtime/test-host.cmd');
      writeFileSync(launcher, `@echo off\r\n"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File "${path.resolve('native/host.ps1')}" %*\r\n`);
      command = path.join(process.env.SystemRoot, 'System32/cmd.exe');
      args = ['/d', '/c', launcher, 'chrome-extension://test/'];
    }
    const child = spawn(command, args, {windowsHide: true});
    const chunks = [], errors = [];
    child.stdout.on('data', data => chunks.push(data));
    child.stderr.on('data', data => errors.push(data));
    child.on('error', reject);
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Native host timed out')); }, 30000);
    child.on('close', code => {
      clearTimeout(timeout);
      try {
        assert.equal(code, 0, Buffer.concat(errors).toString());
        const bytes = Buffer.concat(chunks), responses = [];
        for (let offset = 0; offset < bytes.length;) {
          const length = bytes.readUInt32LE(offset); offset += 4;
          responses.push(JSON.parse(bytes.subarray(offset, offset + length).toString('utf8')));
          offset += length;
        }
        resolve(responses);
      } catch (error) { reject(error); }
    });
    for (const message of messages) {
      const body = Buffer.from(JSON.stringify(message));
      const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
      // Deliberately fragment the header and payload to exercise stream reads.
      child.stdin.write(header.subarray(0, 2));
      child.stdin.write(header.subarray(2));
      child.stdin.write(body);
    }
    child.stdin.end();
  });
}
test('native binary framing, status and error response work under Windows PowerShell 5.1', {skip: !powershell}, async () => {
  const replies = await exchange([{id: 'one', action: 'status'}, {id: 'two', action: 'bad-action'}]);
  assert.equal(replies.length, 2);
  assert.equal(replies[0].id, 'one');
  assert.equal(replies[0].ok, true, JSON.stringify(replies[0]));
  assert.deepEqual(replies[0].result.tools.map(t => t.name), ['yt-dlp', 'ffmpeg', 'ffprobe', 'deno']);
  assert.equal(replies[1].ok, false);
  assert.equal(replies[1].id, 'two');
});

test('Windows CMD launcher preserves the binary native messaging protocol', {skip: !powershell}, async () => {
  const replies = await exchange([{id:'launcher',action:'bad-action'}], true);
  assert.equal(replies.length,1);
  assert.equal(replies[0].id,'launcher');
  assert.equal(replies[0].ok,false);
});
