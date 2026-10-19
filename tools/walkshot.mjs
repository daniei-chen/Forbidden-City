import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = 'D:/AI/DeepSeek/DeepSeek 1/forbidden-city';
const file = path.join(root, 'dist', 'forbidden-city.html');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9394;
const profile = path.join(root, '.cache', 'walkshot-profile');
const out = path.join(root, 'shots', process.argv[2] || 'walk-game.jpg');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const proc = spawn(chrome, [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--remote-debugging-port=' + port, '--remote-allow-origins=*',
  '--user-data-dir=' + profile, '--window-size=1600,900',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', 'about:blank'
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 150; i++) {
  try {
    const r = await fetch('http://127.0.0.1:' + port + '/json/list');
    const list = await r.json();
    const page = list.find(t => t.type === 'page');
    if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch (e) {}
  await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
};
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
async function evl(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval error');
  return r.result && r.result.value;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: pathToFileURL(file).href + '?still=1&quality=high&theme=day&view=1&nomap=1' });

let ready = false;
for (let i = 0; i < 120; i++) {
  try { if (await evl('!!(window.__app && window.__app.ready)')) { ready = true; break; } } catch (e) {}
  await sleep(300);
}
if (!ready) { console.error('not ready'); process.exit(1); }
await sleep(1200);

const setup = await evl(`(function(){
  var A = window.__app, W = window.WALK;
  A.startWalk();
  W.pos.set(-6, 0, 150);
  W.yaw = 0.25;
  W.pitch = 0.06;
  W.avatarYaw = Math.PI;
  W.thirdPerson = true;
  W.camDist = 5.2;
  return { active: W.active, zone: document.getElementById('wgCount').textContent, hint: document.getElementById('wgHint').textContent };
})()`);
console.log('walk setup', JSON.stringify(setup));
await sleep(2500);

const shot = await evl(`(function(){
  var A = window.__app;
  if (A.pause) A.pause();
  if (A.drawOnce) { A.drawOnce(); A.drawOnce(); }
  var c = document.querySelector('canvas');
  return c.toDataURL('image/jpeg', 0.9);
})()`);
if (typeof shot === 'string' && shot.indexOf('data:image') === 0) {
  fs.writeFileSync(out, Buffer.from(shot.split(',')[1], 'base64'));
  console.log('saved', out);
} else {
  console.error('capture failed', typeof shot);
}
try { ws.close(); } catch (e) {}
try { proc.kill(); } catch (e) {}
setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 800);
