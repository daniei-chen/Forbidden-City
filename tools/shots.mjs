#!/usr/bin/env node
/**
 * 多机位截图（无头 Chrome）。
 *
 * 用法（在 forbidden-city/ 目录）:
 *   node tools/shots.mjs                       # 默认 9 个机位的白天截图
 *   node tools/shots.mjs --theme=night --views=0,1,6
 *   node tools/shots.mjs --theme=snow --views=0 --width=1920 --height=1080
 */
import { spawn } from 'node:child_process';
import { lowerPriorityLater } from './_lowprio.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find(x => x.startsWith('--' + name + '='));
  return a ? a.slice(a.indexOf('=') + 1) : def;
};
const theme = opt('theme', 'day');
const views = opt('views', '0,1,2,3,4,5,6,7,8').split(',').map(Number);
const extra = opt('extra', '');
const W = parseInt(opt('width', '1600'), 10);
const H = parseInt(opt('height', '900'), 10);
const shotsDir = path.join(root, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });

const CHROME = process.env.CHROME_PATH || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!CHROME) { console.error('未找到 Chrome/Edge，可用 CHROME_PATH 指定'); process.exit(2); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const target = opt('target', 'index') === 'dist'
  ? path.join(root, 'dist', 'forbidden-city.html')
  : path.join(root, 'index.html');
let port = 9340;

async function shootView(view) {
  const profile = path.join(root, '.cache', 'shot-profile-' + view);
  fs.mkdirSync(profile, { recursive: true });
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + port, '--remote-allow-origins=*',
    '--num-raster-threads=2', '--renderer-process-limit=1',
    '--user-data-dir=' + profile, '--window-size=' + W + ',' + H, 'about:blank'
  ], { stdio: 'ignore' });
  lowerPriorityLater(profile);

  const wsUrl = await (async () => {
    for (let i = 0; i < 150; i++) {
      try {
        const r = await fetch('http://127.0.0.1:' + port + '/json/list');
        const list = await r.json();
        const page = list.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      } catch (e) { /* retry */ }
      await sleep(200);
    }
    throw new Error('无法连接调试端口');
  })();

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.rej(new Error(JSON.stringify(m.error))); else p.res(m.result);
    }
  };
  try {
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    const url = pathToFileURL(target).href + '?still=1&view=' + view + '&theme=' + theme + (extra ? '&' + extra : '');
    await send('Page.navigate', { url });
    await sleep(24000);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const out = path.join(shotsDir, 'view-' + theme + '-' + view + '.png');
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log('[shot] view=' + view + ' theme=' + theme + ' -> ' + out);
  } finally {
    ws.close();
    try { proc.kill(); } catch (e) { /* ignore */ }
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch (e) { /* ignore lock */ }
  }
}

for (const v of views) {
  await shootView(v);
  await sleep(2500);
  port++;
}
console.log('[shots] 完成');
