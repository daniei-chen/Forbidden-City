import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/* NPC 行为专项检查：舞龙观众 / 灯会观灯 / 锣鼓队 / 放河灯宫女（fresh page，小步模拟） */
const root = 'D:/AI/DeepSeek/DeepSeek 1/forbidden-city';
const file = path.join(root, 'dist', 'forbidden-city.html');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9400;
const profile = path.join(root, '.cache', 'npc-profile-' + Date.now());
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
await send('Page.navigate', { url: pathToFileURL(file).href + '?still=1&quality=low&theme=day&view=1&nomap=1' });
let ready = false;
for (let i = 0; i < 160; i++) {
  try { if (await evl('!!(window.__app && window.__app.ready)')) { ready = true; break; } } catch (e) {}
  await sleep(300);
}
check('页面加载', ready, 'ready=' + ready);
if (ready) {
  await evl('window.__app.startWalk()');
  await sleep(500);

  /* 1. 舞龙观众 */
  const spect = await evl(`(function(){
    var A = window.__app, N = window.__NPC;
    A.dragonSet(true);
    N.dragon.t = 50;
    for (var i = 0; i < 20; i++) N.update(1 / 60);
    var p = N.patrols[3];
    p.t = 70; p.watchCd = 0;
    N.update(1 / 60);
    var st = N.spectatorInfo();
    var off = A.dragonSet(false);
    return { active: st.active, events: st.events, off: off && off.active };
  })()`);
  check('舞龙观众驻足', spect && spect.events >= 1 && spect.active >= 1 && spect.off === false, JSON.stringify(spect));

  /* 2. 灯会观灯 */
  const lamp = await evl(`(function(){
    var A = window.__app, N = window.__NPC;
    A.lanternNpcSet(true);
    var p = N.patrols[3];
    p.t = 70; p.lampCd = 0;
    N.update(1 / 60);
    var st = N.lanternInfo();
    A.lanternNpcSet(false);
    for (var k = 0; k < N.patrols.length; k++) N.patrols[k].lampT = 0;
    for (var m = 0; m < N.maids.length; m++) N.maids[m].lampT = 0;
    return { active: st.active, events: st.events, after: N.lanternInfo().active };
  })()`);
  check('灯会 NPC 观灯', lamp && lamp.events >= 1 && lamp.active >= 1 && lamp.after === 0, JSON.stringify(lamp));

  /* 3. 锣鼓队 */
  const band = await evl(`(function(){
    var A = window.__app, N = window.__NPC;
    A.drumBandSet(true);
    N.drumBand.t = 0.62;
    for (var i = 0; i < 8; i++) N.update(1 / 60);
    var on = A.drumBandInfo();
    A.drumBandSet(false);
    N.update(1 / 60);
    return { on: on, off: A.drumBandInfo() };
  })()`);
  check('灯会锣鼓队节拍', band && band.on && band.on.beats >= 1 && band.off && band.off.visible === false, JSON.stringify({ beats: band && band.on && band.on.beats }));

  /* 4. 放河灯宫女（单步） */
  const maid = await evl(`(function(){
    var A = window.__app, N = window.__NPC;
    var s0 = EFFECTS.riverLanternSpawns || 0;
    A.riverLampMaidSet(true);
    if (N.riverLampMaid) N.riverLampMaid.t = 0.001;
    N.update(1 / 60);
    var info = A.riverLampMaidInfo();
    A.riverLampMaidSet(false);
    return { info: info, spawned: (EFFECTS.riverLanternSpawns || 0) - s0 };
  })()`);
  check('放河灯宫女', maid && maid.info && maid.info.released >= 1 && maid.spawned >= 1, JSON.stringify({ released: maid && maid.info && maid.info.released, spawned: maid && maid.spawned }));
}

const pass = results.filter(r => r.ok).length;
const total = results.length;
const md = [
  '# NPC 行为专项检查报告',
  '',
  '> 由 `tools/npc-check.mjs` 生成 · ' + new Date().toISOString(),
  '> 独立页面、小步模拟（避免长循环导致 headless 卡顿）',
  '',
  '结果：**' + pass + ' / ' + total + ' 通过**',
  '',
  '| # | 检查项 | 结果 | 详情 |',
  '| --- | --- | --- | --- |',
  ...results.map((r, i) => '| ' + (i + 1) + ' | ' + r.name + ' | ' + (r.ok ? '✅ 通过' : '❌ 失败') + ' | ' + String(r.detail).replace(/\|/g, '\\|').slice(0, 160) + ' |'),
  ''
].join('\n');
fs.writeFileSync(path.join(root, 'NPC_CHECK.md'), md, 'utf8');
console.log('\n[npc-check] ' + pass + '/' + total + ' 通过，报告写入 NPC_CHECK.md');

try { ws.close(); } catch (e) {}
try { proc.kill(); } catch (e) {}
setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(pass === total ? 0 : 1); }, 800);
