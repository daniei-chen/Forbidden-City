import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/* 灯会专项检查：夜游导览 / 宫灯串 / 地面光池 / 夜间湿光（fresh page） */
const root = 'D:/AI/DeepSeek/DeepSeek 1/forbidden-city';
const file = path.join(root, 'dist', 'forbidden-city.html');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9401;
const profile = path.join(root, '.cache', 'festival-profile-' + Date.now());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' — ' + (detail == null ? '' : String(detail)));
}

const proc = spawn(chrome, [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--remote-debugging-port=' + port, '--remote-allow-origins=*',
  '--user-data-dir=' + profile, '--window-size=1280,720',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', 'about:blank'
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
await send('Page.navigate', { url: pathToFileURL(file).href + '?still=1&quality=low&theme=dusk&view=1&nomap=1' });
let ready = false;
for (let i = 0; i < 160; i++) {
  try { if (await evl('!!(window.__app && window.__app.ready)')) { ready = true; break; } } catch (e) {}
  await sleep(300);
}
check('页面加载', ready, 'ready=' + ready);
if (ready) {
  await evl('window.__app.startWalk()');
  await sleep(600);

  /* 灯会统一开启（dusk 主题下） */
  const open = await evl('(function(){ var A=window.__app; A.setFestival(true); return A.festivalInfo(); })()');
  check('灯会开启', open && open.visible === true, JSON.stringify(open));

  /* 1. 夜游导览五站 */
  const tour = await evl(`(function(){
    var A = window.__app, W = window.WALK;
    A.resetFestivalTour();
    var st = A.festivalTourInfo();
    var stops = [[0,430],[30,296],[0,320],[30,370],[-44,-300]];
    for (var i = 0; i < stops.length; i++) {
      W.pos.set(stops[i][0], 0, stops[i][1]); W.pos.y = W.groundAt(W.pos.x, W.pos.z);
      A.festivalTourTick();
    }
    A.walkGameTick();
    var en = A.festivalTourInfo();
    return { start: st.got, got: en.got, total: en.total, hint: document.getElementById('wgHint').textContent };
  })()`);
  check('灯会夜游导览五站', tour && tour.start === 0 && tour.got === 5 && tour.total === 5, JSON.stringify({ got: tour && tour.got }));

  /* 2. 宫灯串 */
  const strings = await evl('(function(){ var A=window.__app; A.festivalStringsTick(); return A.festivalStringsInfo(); })()');
  check('灯会宫灯串', strings && strings.count === 40 && strings.anchors === 40 && strings.visible === true, JSON.stringify({ count: strings && strings.count }));

  /* 3. 地面光池 */
  const glow = await evl(`(function(){
    var A = window.__app;
    A.setTheme('dusk'); A.festivalStringsTick();
    var dusk = A.festivalGlowInfo();
    return { dusk: dusk };
  })()`);
  check('灯会地面光池', glow && glow.dusk && glow.dusk.opacity >= 0.3 && glow.dusk.count >= 100, JSON.stringify(glow && glow.dusk));

  /* 4. 夜间湿光 */
  const sheen = await evl(`(function(){
    var A = window.__app;
    A.setFestival(false); A.setTheme('day'); A.setWeather('clear');
    for (var i = 0; i < 5; i++) A.weatherTick(1 / 60);
    var dry = A.wetInfo();
    A.setFestival(true); A.setTheme('dusk');
    for (var k = 0; k < 200; k++) A.weatherTick(1 / 60);
    var wet = A.wetInfo();
    A.setFestival(false); A.setTheme('day');
    for (var m = 0; m < 5; m++) A.weatherTick(1 / 60);
    var back = A.wetInfo();
    return { dry: dry, wet: wet, back: back };
  })()`);
  check('灯会夜间地面湿光', sheen && sheen.wet && sheen.wet.sheen === 0.3 && sheen.wet.pavingRough < sheen.dry.pavingRough && sheen.back && Math.abs(sheen.back.pavingRough - sheen.dry.pavingRough) < 0.01, JSON.stringify({ dry: sheen && sheen.dry, wet: sheen && sheen.wet }));
}

const pass = results.filter(r => r.ok).length;
const total = results.length;
const md = [
  '# 灯会专项检查报告',
  '',
  '> 由 `tools/festival-check.mjs` 生成 · ' + new Date().toISOString(),
  '> 独立页面、fresh state；quality=low，dusk 主题',
  '',
  '结果：**' + pass + ' / ' + total + ' 通过**',
  '',
  '| # | 检查项 | 结果 | 详情 |',
  '| --- | --- | --- | --- |',
  ...results.map((r, i) => '| ' + (i + 1) + ' | ' + r.name + ' | ' + (r.ok ? '✅ 通过' : '❌ 失败') + ' | ' + String(r.detail).replace(/\|/g, '\\|').slice(0, 160) + ' |'),
  ''
].join('\n');
fs.writeFileSync(path.join(root, 'FESTIVAL_CHECK.md'), md, 'utf8');
console.log('\n[festival-check] ' + pass + '/' + total + ' 通过，报告写入 FESTIVAL_CHECK.md');

try { ws.close(); } catch (e) {}
try { proc.kill(); } catch (e) {}
setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(pass === total ? 0 : 1); }, 800);
