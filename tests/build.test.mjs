import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('packaged installer contains current native sources and the exact Chrome extension ID', () => {
  const manifest = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
  const hash = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32);
  const id = [...hash].map(char => String.fromCharCode(97 + parseInt(char, 16))).join('');
  assert.equal(readFileSync('extension-id.txt', 'utf8').trim(), id);
  const setup = readFileSync('extension/setup/YouTubeUtils-Setup.cmd', 'utf8');
  const marker = '#--YTU-PAYLOAD--';
  const payload = Buffer.from(setup.slice(setup.lastIndexOf(marker) + marker.length).trim(), 'base64').toString('utf8');
  assert.ok(payload.startsWith(`$ExtensionId = '${id}'`));
  for (const file of ['core.ps1', 'host.ps1', 'install-tools.ps1']) {
    const encoded = payload.match(new RegExp(`'${file.replace('.', '\\.')}['] = '([^']+)'`))?.[1];
    assert.ok(encoded, file);
    assert.deepEqual(Buffer.from(encoded, 'base64'), readFileSync('native/' + file));
  }
  for (const file of [manifest.action.default_popup, manifest.background.service_worker, manifest.options_ui.page, ...Object.values(manifest.icons)]) assert.ok(existsSync('extension/' + file), file);
});
