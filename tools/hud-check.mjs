import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/* 桌面端 HUD 视觉巡检：元素存在性/布局重叠/截图取证 */
const root = 'D:/AI/DeepSeek/DeepSeek 1/forbidden-city';
const file = path.join(root, 'dist', 'forbidden-city.html');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9399;
const profile = path.join(root, '.cache', 'hud-profile-' + Date.now());
const outDir = path.join(root, 'docs', 'desktop');
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
  if (r.exceptionDetails) { var ed = r.exceptionDetails; throw new Error((ed.exception && ed.exception.description) || ed.text || 'eval error'); }
  return r.result && r.result.value;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const url = pathToFileURL(file).href + '?quality=high&theme=day&view=4&nomap=0';
await send('Page.navigate', { url });
let ready = false;
for (let i = 0; i < 160; i++) {
  try { if (await evl('!!(window.__app && window.__app.ready)')) { ready = true; break; } } catch (e) {}
  await sleep(250);
}
check('页面加载', ready, 'ready=' + ready);

if (ready) {
  await evl('window.__app.startWalk()');
  await sleep(1000);
  /* 打开性能 HUD 并到陈设旁触发互动提示 */
  await evl('(function(){ var A=window.__app; if (!A.perfHud().enabled) A.togglePerfHud(); for (var i=0;i<40;i++) A.perfHudTick(1/60); A.WALK && 0; window.WALK.pos.set(13.8, 0, 170); window.WALK.pos.y = window.WALK.groundAt(13.8, 170); if (A.promptTick) A.promptTick(); return true; })()');
  await sleep(700);
  const hud = await evl(`(function(){
    function rect(sel){ var el=document.querySelector(sel); if(!el) return null; var cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden') return null; var r=el.getBoundingClientRect(); return { l:Math.round(r.left), t:Math.round(r.top), r:Math.round(r.right), b:Math.round(r.bottom), w:Math.round(r.width), h:Math.round(r.height) }; }
    function overlap(a,b){ if(!a||!b) return false; var ox=Math.max(0, Math.min(a.r,b.r)-Math.max(a.l,b.l)); var oy=Math.max(0, Math.min(a.b,b.b)-Math.max(a.t,b.t)); return ox>2 && oy>2; }
    var header = rect('header.top'), mini = rect('#minimap'), walk = rect('#walkgame'), perf = rect('#perfhud'), tut = rect('#tutorial'), inter = rect('#interact'), hint = rect('.walkhint');
    return {
      header: header, mini: mini, walk: walk, perf: perf, tut: tut, inter: inter, hint: hint,
      overlapMiniWalk: overlap(mini, walk),
      overlapTutInter: overlap(tut, inter),
      overlapWalkPerf: overlap(walk, perf),
      perfText: (document.getElementById('perfhud')||{}).innerText || '',
      interactText: (document.getElementById('interactLabel')||{}).textContent || '',
      tutorialOn: document.body.classList.contains('tutorialOn')
    };
  })()`);
  check('顶栏/小地图/探索面板存在', !!(hud.header && hud.mini && hud.walk), JSON.stringify({ headerH: hud.header && hud.header.h, minimap: hud.mini, walkgame: hud.walk }));
  check('小地图与探索面板不重叠', hud.mini && hud.walk && !hud.overlapMiniWalk, 'overlap=' + hud.overlapMiniWalk);
  check('探索面板与性能 HUD 不重叠', !hud.overlapWalkPerf, 'overlap=' + hud.overlapWalkPerf);
  check('性能 HUD 显示', /FPS/.test(hud.perfText), hud.perfText.replace(/\n/g, ' | ').slice(0, 80));
  check('引导卡与互动提示不重叠', hud.tutorialOn ? !hud.overlapTutInter : true, JSON.stringify({ tutorialOn: hud.tutorialOn, tut: hud.tut, inter: hud.inter }));
  check('互动提示可用', !!hud.inter && hud.interactText !== '' && hud.inter.t > 0, JSON.stringify({ text: hud.interactText, rect: hud.inter }));

  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88, fromSurface: true });
  fs.writeFileSync(path.join(outDir, 'walk-hud.jpg'), Buffer.from(shot.data, 'base64'));

  /* NPC 气泡：靠近侍卫、面向 NPC，等相机矩阵刷新后再取状态 */
  await evl(`(function(){
    var N = window.__NPC; if(!N || !N.patrols || !N.patrols.length) return false;
    var g = N.patrols[0].obj.group.position;
    window.WALK.pos.set(g.x, 0, g.z + 5); window.WALK.pos.y = window.WALK.groundAt(window.WALK.pos.x, window.WALK.pos.z);
    window.WALK.yaw = 0; window.WALK.pitch = 0;
    N.update(1 / 60);
    if (window.__app.npcBubbleTick) window.__app.npcBubbleTick(1 / 60);
    return true;
  })()`);
  await sleep(900);
  const bubble = await evl(`(function(){
    try {
      if (window.__app.npcBubbleTick) window.__app.npcBubbleTick(1 / 60);
      var el = document.getElementById('npcBubble');
      var cs = el ? getComputedStyle(el) : null;
      return { display: cs ? cs.display : 'none', text: el ? el.innerText.slice(0, 80) : '' };
    } catch (e) { return { error: String(e && e.message || e) }; }
  })()`);
  check('NPC 气泡显示', bubble && bubble.display !== 'none' && /(侍卫|宫女)/.test(bubble.text), JSON.stringify(bubble));
  const shot2 = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88, fromSurface: true });
  fs.writeFileSync(path.join(outDir, 'walk-npc.jpg'), Buffer.from(shot2.data, 'base64'));
  const pSize = fs.statSync(path.join(outDir, 'walk-hud.jpg')).size;
  const qSize = fs.statSync(path.join(outDir, 'walk-npc.jpg')).size;
  check('桌面截图取证', pSize > 30000 && qSize > 30000, 'hud=' + pSize + 'B npc=' + qSize + 'B');
}

const pass = results.filter(r => r.ok).length;
const total = results.length;
const md = [
  '# 桌面端 HUD 视觉巡检报告',
  '',
  '> 由 `tools/hud-check.mjs` 生成 · ' + new Date().toISOString(),
  '> 视口 1440×900 · quality=high · 漫游模式（引导 + 性能 HUD + 互动提示 + NPC 气泡）',
  '',
  '结果：**' + pass + ' / ' + total + ' 通过**',
  '',
  '| # | 检查项 | 结果 | 详情 |',
  '| --- | --- | --- | --- |',
  ...results.map((r, i) => '| ' + (i + 1) + ' | ' + r.name + ' | ' + (r.ok ? '✅ 通过' : '❌ 失败') + ' | ' + String(r.detail).replace(/\|/g, '\\|').slice(0, 160) + ' |'),
  '',
  '截图：`docs/desktop/walk-hud.jpg` · `docs/desktop/walk-npc.jpg`',
  ''
].join('\n');
fs.writeFileSync(path.join(root, 'HUD_CHECK.md'), md, 'utf8');
console.log('\n[hud-check] ' + pass + '/' + total + ' 通过，报告写入 HUD_CHECK.md');

try { ws.close(); } catch (e) {}
try { proc.kill(); } catch (e) {}
setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(pass === total ? 0 : 1); }, 800);
