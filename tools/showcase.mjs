import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/* 生成 v7.x 展示画廊：6 张策展截图 + docs/showcase.html */
const root = 'D:/AI/DeepSeek/DeepSeek 1/forbidden-city';
const file = path.join(root, 'dist', 'forbidden-city.html');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9397;
const profile = path.join(root, '.cache', 'showcase-profile-' + Date.now());
const outDir = path.join(root, 'docs', 'showcase-img');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(outDir, { recursive: true });

const ITEMS = [
  { id: 'day-hall', view: 4, theme: 'day', festival: 0, title: '晴日宫城', desc: '午后的三台之上，重檐庑殿顶在日光里泛着金光。' },
  { id: 'dusk-lantern', view: 4, theme: 'dusk', festival: 1, title: '黄昏灯会', desc: '黄昏点灯，71 组宫灯沿廊悬挂，幡旗随风轻摆。' },
  { id: 'night-festival', view: 0, theme: 'night', festival: 1, title: '灯会之夜', desc: '烟花、舞龙、锣鼓队与观灯的人群，把宫城变成不夜的节日。' },
  { id: 'night-inner', view: 9, theme: 'night', festival: 0, title: '内廷夜色', desc: '穿过廊柱望向乾清宫，银河与流星在殿顶之上。' },
  { id: 'rain-eave', view: 4, theme: 'day', weather: 'rain', festival: 0, title: '雨 · 檐水成串', desc: '大雨落在琉璃瓦上，檐口垂下成串水线，地面泛起涟漪。' },
  { id: 'snow-palace', view: 4, theme: 'snow', festival: 0, title: '雪落宫城', desc: '雪覆黄瓦与丹陛，脚印在广场上留下漫游的痕迹。' }
];

const proc = spawn(chrome, [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + port, '--remote-allow-origins=*',
  '--user-data-dir=' + profile, '--window-size=1280,720',
  '--hide-scrollbars', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', 'about:blank'
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 200; i++) {
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
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

const shots = [];
for (const it of ITEMS) {
  const params = new URLSearchParams();
  params.set('quality', 'high');
  params.set('theme', it.theme);
  params.set('view', String(it.view));
  params.set('nomap', '1');
  if (it.festival) params.set('festival', '1');
  if (it.weather) params.set('weather', it.weather);
  const url = pathToFileURL(file).href + '?' + params.toString();
  await send('Page.navigate', { url });
  let ready = false;
  for (let i = 0; i < 160; i++) {
    try { if (await evl('!!(window.__app && window.__app.ready)')) { ready = true; break; } } catch (e) {}
    await sleep(250);
  }
  if (!ready) { console.error('[showcase] not ready:', it.id); continue; }
  /* 隐藏 DOM 级 HUD，只保留 canvas 画面 */
  await evl("(function(){ try { if (document.getElementById('showcase-hide')) return true; var s = document.createElement('style'); s.id = 'showcase-hide'; s.textContent = 'header.top,aside.panel,nav.views,.hint,#walkhint,#minimap,#npcBubble,#walkgame,#crosshair,#interactPrompt,#perfhud,#touchui,#toast{display:none!important}'; document.head.appendChild(s); } catch(e){} return true; })()");
  /* 让动态元素（烟花/舞龙/雨幕）进入画面 */
  await sleep(it.theme === 'night' || it.festival ? 4200 : 2200);
  if (it.weather === 'rain') {
    await evl('(function(){ try { window.__app.setWeather("rain"); for (var i=0;i<80;i++) window.__app.weatherTick(0.1); } catch(e){} return true; })()');
    await sleep(1200);
  }
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88, fromSurface: true });
  const buf = Buffer.from(shot.data, 'base64');
  const dest = path.join(outDir, it.id + '.jpg');
  fs.writeFileSync(dest, buf);
  shots.push({ id: it.id, title: it.title, desc: it.desc, file: 'showcase-img/' + it.id + '.jpg', bytes: buf.length });
  console.log('[showcase] saved', it.id + '.jpg', buf.length, 'bytes');
}

/* 生成展示页 */
const cards = shots.map((s, i) => `      <figure class="shot${i === 0 ? ' hero' : ''}">
        <img src="${s.file}" alt="${s.title}" loading="lazy">
        <figcaption><h3>${s.title}</h3><p>${s.desc}</p></figcaption>
      </figure>`).join('\n');
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>紫禁城 · 数字复原 — v7 展示画廊</title>
<style>
  :root { --gold: #d8b45f; --ink: #0b0d12; --paper: #f7f2e6; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: radial-gradient(1200px 600px at 50% -10%, #1a1f2b 0%, var(--ink) 60%);
    color: var(--paper); font-family: "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif;
  }
  header { text-align: center; padding: 64px 24px 36px; }
  header .kicker { letter-spacing: 10px; font-size: 12px; color: rgba(216,180,95,.8); margin-bottom: 14px; }
  header h1 { margin: 0 0 10px; font-size: clamp(30px, 5vw, 52px); font-weight: 500; letter-spacing: 6px; }
  header h1 span { color: var(--gold); }
  header p { margin: 0 auto; max-width: 680px; font-size: 14px; line-height: 1.9; color: rgba(247,242,230,.6); }
  main { max-width: 1180px; margin: 0 auto; padding: 20px 24px 80px; }
  .shot { margin: 0 0 26px; border: 1px solid rgba(216,180,95,.22); background: rgba(255,255,255,.02); overflow: hidden; }
  .shot img { display: block; width: 100%; height: auto; }
  .shot figcaption { padding: 16px 20px 20px; }
  .shot h3 { margin: 0 0 8px; font-size: 17px; letter-spacing: 3px; color: var(--gold); font-weight: 500; }
  .shot p { margin: 0; font-size: 13px; line-height: 1.8; color: rgba(247,242,230,.62); }
  .shot.hero h3 { font-size: 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 26px; }
  footer { text-align: center; padding: 0 24px 64px; font-size: 12px; letter-spacing: 2px; color: rgba(247,242,230,.35); }
  footer a { color: var(--gold); text-decoration: none; }
  @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } header { padding-top: 40px; } }
</style>
</head>
<body>
  <header>
    <div class="kicker">FORBIDDEN CITY · DIGITAL RESTORATION</div>
    <h1>紫禁城 · <span>数字复原</span></h1>
    <p>v7 展示画廊 · 程序化重建的宫城，可自由漫游、探索、拍照与过节。<br>
    以下机位由 tools/showcase.mjs 自动拍摄，覆盖晴日、黄昏灯会、灯会之夜、内廷夜色、雨中檐水与雪景。</p>
  </header>
  <main>
    <div class="grid">
${cards}
    </div>
  </main>
  <footer>
    <a href="../">返回项目首页 / README</a> · <a href="gallery.html">评测画廊（harness）</a>
  </footer>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'docs', 'showcase.html'), html, 'utf8');

/* 写一份清单供文档引用 */
fs.writeFileSync(path.join(root, 'docs', 'showcase.json'), JSON.stringify({ generatedAt: new Date().toISOString(), shots }, null, 2), 'utf8');
console.log('[showcase] docs/showcase.html + showcase.json written');

try { ws.close(); } catch (e) {}
try { proc.kill(); } catch (e) {}
setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 800);
