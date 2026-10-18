import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {createHash, generateKeyPairSync} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const license = readFileSync(path.join(root, 'LICENSE'));
writeFileSync(path.join(root, 'extension/LICENSE.txt'), license);
const manifestFile = path.join(root, 'extension/manifest.json');
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
if (!manifest.key) {
  const {publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  manifest.key = publicKey.export({type: 'spki', format: 'der'}).toString('base64');
  // No signing/private key is needed for an unpacked extension.
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
}
const hash = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32);
const id = [...hash].map(char => String.fromCharCode(97 + parseInt(char, 16))).join('');
writeFileSync(path.join(root, 'extension-id.txt'), id + '\n');
let payload = `$ExtensionId = '${id}'\r\n$Bundle = @{\r\n`;
for (const name of ['core.ps1', 'host.ps1', 'install-tools.ps1']) {
  payload += `  '${name}' = '${readFileSync(path.join(root, 'native', name)).toString('base64')}'\r\n`;
}
payload += `  'LICENSE.txt' = '${license.toString('base64')}'\r\n`;
payload += '}\r\n';
// param() must be first in a PowerShell script. Standalone setup uses default flags.
payload += readFileSync(path.join(root, 'native/install.ps1'), 'utf8').replace(/^param\([^\n]+\)\r?\n/, '$SkipTools = $false\n$UpdateTools = $false\n');
const marker = '#--YTU-PAYLOAD--';
const setup = [
  '@echo off',
  'rem Streaming Utils by mbeckerle - https://github.com/MarcusBeckerle/streaming_utils_chrome',
  'rem Noncommercial use with attribution; commercial use requires a separate paid license.',
  'rem The full license is embedded below and installed as LICENSE.txt beside the helper.',
  'set "YTU_SETUP_FILE=%~f0"',
  `"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:YTU_SETUP_FILE); $p=$t.Substring($t.LastIndexOf('${marker}')+${marker.length}); & ([scriptblock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p.Trim()))))"`,
  'echo.', 'pause', 'exit /b', marker,
  Buffer.from(payload, 'utf8').toString('base64'), ''
].join('\r\n');
mkdirSync(path.join(root, 'extension/setup'), {recursive: true});
writeFileSync(path.join(root, 'extension/setup/YouTubeUtils-Setup.cmd'), setup);
for (const size of [16, 32, 48, 128]) {
  if (!existsSync(path.join(root, `extension/icons/icon${size}.png`))) throw new Error('Icons fehlen. Zuerst python scripts/icons.py ausführen.');
}
console.log(`Build fertig. Chrome-ID: ${id}`);
