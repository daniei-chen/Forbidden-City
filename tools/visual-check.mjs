import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/* 全端视觉布局巡检：桌面 1440×900 与手机 390×844@2x 同场景对照 */
const root = 'D:/AI/DeepSeek/DeepSeek 1/forbidden-city';
const file = path.join(root, 'dist', 'forbidden-city.html');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9402;
const profile = path.join(root, '.cache', 'visual-profile-' + Date.now());
const outDir = path.join(root, 'docs', 'consistency');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(outDir, { recursive: true });

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' — ' + (detail == null ? '' : String(detail)));
}

const proc = spawn(chrome, [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + port, '--remote-allow-origins=*',
  '--user-data-dir=' + profile, '--hide-scrollbars',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  'about:blank'
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
if (!wsUrl) { console.error('chrome not ready'); process.exit(1); }
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  const to = setTimeout(() => { pending.delete(i); rej(new Error('CDP timeout: ' + method)); }, 60000);
  pending.set(i, { res: (v) => { clearTimeout(to); res(v); }, rej: (e) => { clearTimeout(to); rej(e); } });
  ws.send(JSON.stringify({ id: i, method, params }));
});
async function evl(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text || 'eval error');
  return r.result && r.result.value;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Page.bringToFront');

async function load(w, h, dpr, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: !!mobile, maxTouchPoints: mobile ? 5 : 1 });
  await send('Page.navigate', { url: pathToFileURL(file).href + '?quality=low&theme=day&view=4&nomap=0' });
  for (let i = 0; i < 160; i++) {
    try { if (await evl('!!(window.__app && window.__app.ready)')) break; } catch (e) {}
    await sleep(300);
  }
  await sleep(600);
  await evl('window.__app.startWalk()');
  await sleep(900);
}

async function metrics() {
  return await evl(`(function(){
    function rect(el){ if(!el) return null; var r=el.getBoundingClientRect(); return { l:Math.round(r.left), t:Math.round(r.top), r:Math.round(r.right), b:Math.round(r.bottom), w:Math.round(r.width), h:Math.round(r.height) }; }
    function fs(el){ return el ? parseFloat(getComputedStyle(el).fontSize) : -1; }
    function overflow(el){ if(!el) return 0; return Math.max(0, el.scrollWidth - el.clientWidth); }
    var header=rect(document.querySelector('header.top'));
    var wg=rect(document.getElementById('walkgame'));
    var mini=rect(document.getElementById('minimap'));
    var tut=rect(document.getElementById('tutorial'));
    var stick=rect(document.getElementById('stick'));
    var btns=Array.prototype.map.call(document.querySelectorAll('#touchui .tbtn'), function(b){ return rect(b); });
    var touchDisplay=getComputedStyle(document.getElementById('touchui')).display;
    return {
      header: header, walkgame: wg, minimap: mini, tutorial: tut, stick: stick,
      touchDisplay: touchDisplay,
      btnSizes: btns.map(function(b){ return b ? [b.w,b.h] : null; }),
      touchTargetsOk: btns.every(function(b){ return b && b.w >= 44 && b.h >= 44; }),
      fontSizeHint: fs(document.querySelector('.wg-hint')),
      fontSizeTitle: fs(document.querySelector('.wg-label')),
      overflowHint: overflow(document.getElementById('wgHint')),
      overflowWg: overflow(document.getElementById('walkgame')),
      safeAreaUsed: (function(){ var ss=document.querySelectorAll('style'); for(var i=0;i<ss.length;i++){ if((ss[i].textContent||'').indexOf('safe-area-inset')>=0) return true; } return false; })(),
      bodyClass: document.body.className,
      theme: (window.__app.state && window.__app.state.theme) || 'day'
    };
  })()`);
}

/* Desktop */
await load(1440, 900, 1, false);
const d = await metrics();
const shotD = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88, fromSurface: true });
fs.writeFileSync(path.join(outDir, 'desktop.jpg'), Buffer.from(shotD.data, 'base64'));
check('桌面端加载与漫游', d && d.theme === 'day' && d.walkgame && d.walkgame.w > 150, JSON.stringify({ theme: d && d.theme, walkgame: d && d.walkgame }));
check('桌面端触控 UI 隐藏', d && d.touchDisplay === 'none', 'display=' + (d && d.touchDisplay));
check('桌面端小地图与面板', d && d.minimap && d.minimap.w >= 150 && d.walkgame && d.minimap.b <= d.walkgame.t, JSON.stringify({ minimap: d && d.minimap, walkgameTop: d && d.walkgame && d.walkgame.t }));

/* Mobile */
await load(390, 844, 2, true);
const m = await metrics();
const shotM = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88, fromSurface: true });
fs.writeFileSync(path.join(outDir, 'mobile.jpg'), Buffer.from(shotM.data, 'base64'));
check('移动端加载与安全区', m && m.safeAreaUsed === true && m.touchDisplay === 'block', JSON.stringify({ safe: m && m.safeAreaUsed, touch: m && m.touchDisplay }));
check('触控目标 ≥44px', m && m.touchTargetsOk === true && m.btnSizes.length >= 5, JSON.stringify(m && m.btnSizes));
check('探秘面板文字无溢出', m && m.overflowWg <= 2 && m.overflowHint <= 2, JSON.stringify({ overflowWg: m && m.overflowWg, overflowHint: m && m.overflowHint }));
check('移动端字号可读（≥9px）', m && m.fontSizeHint >= 9 && m.fontSizeTitle >= 9, JSON.stringify({ hint: m && m.fontSizeHint, title: m && m.fontSizeTitle }));
check('引导卡与触控区不重叠', m && m.tutorial && m.walkgame && m.tutorial.b <= m.walkgame.t + 1, JSON.stringify({ tutorial: m && m.tutorial, walkgame: m && m.walkgame }));

const pD = fs.statSync(path.join(outDir, 'desktop.jpg')).size;
const pM = fs.statSync(path.join(outDir, 'mobile.jpg')).size;
check('双端截图取证', pD > 30000 && pM > 30000, 'desktop=' + pD + 'B mobile=' + pM + 'B');

const pass = results.filter(r => r.ok).length;
const total = results.length;
const md = [
  '# 全端视觉布局巡检报告',
  '',
  '> 由 `tools/visual-check.mjs` 生成 · ' + new Date().toISOString(),
  '> 桌面 1440×900 @1x / 手机 390×844 @2x，同场景（午门视角、漫游模式、quality=low）',
  '',
  '结果：**' + pass + ' / ' + total + ' 通过**',
  '',
  '| # | 检查项 | 结果 | 详情 |',
  '| --- | --- | --- | --- |',
  ...results.map((r, i) => '| ' + (i + 1) + ' | ' + r.name + ' | ' + (r.ok ? '✅ 通过' : '❌ 失败') + ' | ' + String(r.detail).replace(/\|/g, '\\|').slice(0, 160) + ' |'),
  '',
  '截图：`docs/consistency/desktop.jpg` · `docs/consistency/mobile.jpg`',
  ''
].join('\n');
fs.writeFileSync(path.join(root, 'VISUAL_CHECK.md'), md, 'utf8');
console.log('\n[visual-check] ' + pass + '/' + total + ' 通过，报告写入 VISUAL_CHECK.md');

try { ws.close(); } catch (e) {}
try { proc.kill(); } catch (e) {}
setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(pass === total ? 0 : 1); }, 800);
