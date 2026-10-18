// Local UI fixture: the shipped pages run unchanged with a fake Chrome API.
// This server is not part of the extension or the release ZIP.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const root = path.resolve('extension');
const mock = `
const listeners = [];
let settings = {adEnabled:true,adSpeed:20,defaultFormat:'mp3',mp3Bitrate:128,audioFolder:'D:\\\\Musik',videoFolder:'D:\\\\Videos'};
const missing = new URL(location.href).searchParams.has('missing');
const toolMissing = new URL(location.href).searchParams.has('toolsMissing');
window.chrome = {
  storage: {local: {get: async key => key === 'settings' ? {settings} : {}, set: async value => {if(value.settings) settings=value.settings; for(const fn of listeners)fn(Object.fromEntries(Object.entries(value).map(([key,newValue])=>[key,{newValue}])),'local');}}, onChanged: {addListener: fn => listeners.push(fn)}},
  tabs: {query: async () => [{id:1,url:'https://www.youtube.com/watch?v=abcdefghI_1',title:'Ein Tag in den Bergen – Natur in 8K - YouTube'}], sendMessage: async () => ({title:'Ein Tag in den Bergen – Natur in 8K'})},
  runtime: {openOptionsPage: () => {location.href='/options.html';}, sendMessage: async msg => {
    if(msg.action === 'status') return missing ? {ok:false,error:'Windows-Helfer nicht erreichbar: Specified native messaging host not found.'} : {ok:true,result:{ready:!toolMissing,features:['fileDetails','reveal','videoQuality'],defaults:{audioFolder:'C:\\\\Users\\\\Test\\\\Music\\\\YouTube',videoFolder:'C:\\\\Users\\\\Test\\\\Videos\\\\YouTube'},tools:['yt-dlp','ffmpeg','ffprobe','deno'].map(name=>({name,ok:!toolMissing,path:'C:\\\\YouTubeUtils\\\\bin\\\\'+name+'.exe',version:'Testversion'}))}};
    if(msg.action === 'browse') return {ok:true,result:{folder:'D:\\\\Downloads\\\\YouTube'}};
    if(msg.action === 'download' || msg.action === 'install') return {ok:true,result:{kind:msg.action,state:'running',title:'Ein Tag in den Bergen – Natur in 8K',message:'Download: 42.5 % (aktuelle Spur)',percent:42.5}};
    return {ok:true,result:{}};
  }}
};`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/test-mock.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); return res.end(mock); }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  try {
    let body = readFileSync(file);
    const ext = path.extname(file);
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[ext] || 'application/octet-stream');
    if (ext === '.html') body = body.toString().replace('<head>', '<head><script src="/test-mock.js"></script>');
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
const port = Number(process.env.YTU_PREVIEW_PORT || 8765);
server.listen(port, '127.0.0.1', () => console.log(`UI preview: http://127.0.0.1:${server.address().port}/options.html`));
