import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/* 移动端低画质专项检查：触屏 UI / safe-area / 摇杆移动 / 帧率 / 截图 */
const root = 'D:/AI/DeepSeek/DeepSeek 1/forbidden-city';
const file = path.join(root, 'dist', 'forbidden-city.html');
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9398;
const profile = path.join(root, '.cache', 'mobile-profile-' + Date.now());
const outDir = path.join(root, 'docs', 'mobile');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(outDir, { recursive: true });

const results = [];
function check(name, ok, detail, skipped) {
  results.push({ name, ok: !!ok, skipped: !!skipped, detail: detail == null ? '' : String(detail) });
  console.log((skipped ? 'SKIP ' : ok ? 'PASS ' : 'FAIL ') + name + ' — ' + (detail == null ? '' : String(detail)));
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
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval error');
  return r.result && r.result.value;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

const url = pathToFileURL(file).href + '?quality=low&theme=day&view=4&nomap=1';
await send('Page.navigate', { url });
let ready = false;
for (let i = 0; i < 160; i++) {
  try { if (await evl('!!(window.__app && window.__app.ready)')) { ready = true; break; } } catch (e) {}
  await sleep(250);
}
check('移动端页面加载', ready, ready ? 'ready=true' : 'not ready');

if (ready) {
  await sleep(600);
  const boot = await evl('({ version: window.__app.version || (window.__app.state && window.__app.state.version) || "", renderer: (function(){ try { var c=document.getElementById("c"); var gl=c.getContext("webgl2")||c.getContext("webgl"); var d=gl.getExtension("WEBGL_debug_renderer_info"); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER); } catch(e){ return "unknown"; } })() })');
  check('WebGL 渲染器可用', !!boot.renderer && boot.renderer !== 'unknown', String(boot.renderer).slice(0, 80));

  /* safe-area CSS */
  const safe = await evl('(function(){ var ss=document.querySelectorAll("style"); for (var i=0;i<ss.length;i++){ if ((ss[i].textContent||"").indexOf("safe-area-inset") >= 0) return true; } return false; })()');
  check('移动端安全区 CSS', safe === true, 'safe-area-inset 存在');

  /* 进入漫游：触屏 UI 出现 */
  await evl('window.__app.startWalk()');
  await sleep(900);
  const touch = await evl('(function(){ var t=document.getElementById("touchui"); if(!t) return null; var st=document.getElementById("stick"); var r=st?st.getBoundingClientRect():null; var cs=getComputedStyle(t); return { display: cs.display, opacity: cs.opacity, stickW: r?Math.round(r.width):0, buttons: document.querySelectorAll("#touchui .tbtn").length }; })()');
  check('触屏摇杆与按钮', touch && touch.display !== 'none' && touch.stickW >= 40 && touch.buttons >= 5, JSON.stringify(touch));

  if (process.env.MOBILE_DEBUG) {
    const dbg = await evl('(function(){ function info(el){ if(!el) return null; var r=el.getBoundingClientRect(); var cs=getComputedStyle(el); return { id:el.id, cls:el.className, rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], pos:cs.position, right:cs.right, bottom:cs.bottom, left:cs.left, top:cs.top, display:cs.display, z:cs.zIndex }; } return { photo: info(document.getElementById("tbPhoto")), jump: info(document.getElementById("tbJump")), tutorial: info(document.getElementById("tutorial")), wg: info(document.getElementById("walkgame")), quests: info(document.querySelector(".wg-quests")), bodycls: document.body.className }; })()');
    console.log('[mobile-debug]', JSON.stringify(dbg, null, 1));
  }

  /* HUD 与触控区不重叠 */
  const layout = await evl('(function(){ var wg=document.getElementById("walkgame"); var wr=wg?wg.getBoundingClientRect():null; var els=[document.getElementById("stick")].concat(Array.prototype.slice.call(document.querySelectorAll("#touchui .tbtn"))); var overlaps=[]; if (wr) { for (var i=0;i<els.length;i++){ var e=els[i]; if(!e) continue; var r=e.getBoundingClientRect(); var ox=Math.max(0, Math.min(wr.right,r.right)-Math.max(wr.left,r.left)); var oy=Math.max(0, Math.min(wr.bottom,r.bottom)-Math.max(wr.top,r.top)); if (ox>2 && oy>2) overlaps.push({ id: e.id, ox: Math.round(ox), oy: Math.round(oy) }); } } return { overlaps: overlaps, walkgame: wr?{ top: Math.round(wr.top), bottom: Math.round(wr.bottom), left: Math.round(wr.left), right: Math.round(wr.right) }:null }; })()');
  check('HUD 与触控区不重叠', layout && layout.walkgame && layout.overlaps.length === 0, JSON.stringify(layout));

  /* 引导卡与触控区/HUD 不重叠 */
  const tutLayout = await evl('(function(){ var t=document.getElementById("tutorial"); var tr=t?t.getBoundingClientRect():null; var els=[document.getElementById("stick"), document.getElementById("walkgame")].concat(Array.prototype.slice.call(document.querySelectorAll("#touchui .tbtn"))); var overlaps=[]; if (tr) { for (var i=0;i<els.length;i++){ var e=els[i]; if(!e) continue; var r=e.getBoundingClientRect(); var ox=Math.max(0, Math.min(tr.right,r.right)-Math.max(tr.left,r.left)); var oy=Math.max(0, Math.min(tr.bottom,r.bottom)-Math.max(tr.top,r.top)); if (ox>2 && oy>2) overlaps.push({ id: e.id || e.className, ox: Math.round(ox), oy: Math.round(oy) }); } } return { overlaps: overlaps, tutorial: tr?{ top: Math.round(tr.top), bottom: Math.round(tr.bottom), left: Math.round(tr.left), right: Math.round(tr.right) }:null }; })()');
  check('引导卡与触控区不重叠', tutLayout && tutLayout.tutorial && tutLayout.overlaps.length === 0, JSON.stringify(tutLayout));

  /* 摇杆拖动 → 角色移动 */
  const rect = await evl('(function(){ var r=document.getElementById("stick").getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()');
  const p0 = await evl('({ x: window.WALK.pos.x, z: window.WALK.pos.z })');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x, y: rect.y, id: 1 }] });
  await sleep(80);
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: rect.x, y: rect.y - 70, id: 1 }] });
  await sleep(450);
  const mid = await evl('({ touch: window.WALK.touchMove, x: window.WALK.pos.x, z: window.WALK.pos.z })');
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(150);
  const moved = Math.hypot(mid.x - p0.x, mid.z - p0.z);
  check('摇杆驱动移动', mid.touch && moved > 0.15, JSON.stringify({ touch: mid.touch, moved: Math.round(moved * 100) / 100 }));

  /* 帧率采样（2.5 秒 rAF） */
  const fps = await evl('(function(){ return new Promise(function(resolve){ var n=0; var t0=performance.now(); function tick(){ n++; if (performance.now()-t0 < 2500) requestAnimationFrame(tick); else resolve({ frames:n, ms: Math.round(performance.now()-t0), fps: Math.round(n/((performance.now()-t0)/1000)) }); } requestAnimationFrame(tick); }); })()');
  const isSoftware = /swiftshader|software/i.test(String(boot.renderer));
  if (isSoftware) check('移动端低画质帧率', true, JSON.stringify(fps) + ' (软件渲染，跳过阈值)', true);
  else check('移动端低画质帧率', fps && fps.fps >= 30, JSON.stringify(fps));

  /* 截图：竖屏 + 横屏 */
  const shotP = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85, fromSurface: true });
  fs.writeFileSync(path.join(outDir, 'portrait.jpg'), Buffer.from(shotP.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true, screenOrientation: { type: 'landscapePrimary', angle: 90 } });
  await sleep(900);
  const landLayout = await evl('(function(){ var wg=document.getElementById("walkgame"); var wr=wg?wg.getBoundingClientRect():null; var els=[document.getElementById("stick")].concat(Array.prototype.slice.call(document.querySelectorAll("#touchui .tbtn"))); var overlaps=[]; if (wr) { for (var i=0;i<els.length;i++){ var e=els[i]; if(!e) continue; var r=e.getBoundingClientRect(); var ox=Math.max(0, Math.min(wr.right,r.right)-Math.max(wr.left,r.left)); var oy=Math.max(0, Math.min(wr.bottom,r.bottom)-Math.max(wr.top,r.top)); if (ox>2 && oy>2) overlaps.push({ id: e.id, ox: Math.round(ox), oy: Math.round(oy) }); } } var topH = document.querySelector("header.top") ? Math.round(document.querySelector("header.top").getBoundingClientRect().height) : 0; return { overlaps: overlaps, walkgame: wr?{ top: Math.round(wr.top), bottom: Math.round(wr.bottom), left: Math.round(wr.left), right: Math.round(wr.right) }:null, headerH: topH }; })()');
  check('横屏布局不重叠', landLayout && landLayout.walkgame && landLayout.overlaps.length === 0 && landLayout.headerH < 70, JSON.stringify(landLayout));
  const shotL = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85, fromSurface: true });
  fs.writeFileSync(path.join(outDir, 'landscape.jpg'), Buffer.from(shotL.data, 'base64'));
  const pSize = fs.statSync(path.join(outDir, 'portrait.jpg')).size;
  const lSize = fs.statSync(path.join(outDir, 'landscape.jpg')).size;
  check('竖屏/横屏截图', pSize > 20000 && lSize > 20000, 'portrait=' + pSize + 'B landscape=' + lSize + 'B');
}

/* 报告 */
const pass = results.filter(r => r.ok && !r.skipped).length;
const total = results.filter(r => !r.skipped).length;
const skip = results.filter(r => r.skipped).length;
const now = new Date();
const md = [
  '# 移动端低画质专项检查报告',
  '',
  '> 由 `tools/mobile-check.mjs` 生成 · ' + now.toISOString(),
  '> 设备模拟：390×844 @2x（竖屏）/ 844×390 @2x（横屏），touch 开启，quality=low',
  '',
  '结果：**' + pass + ' / ' + total + ' 通过**' + (skip ? '（另有 ' + skip + ' 项跳过）' : ''),
  '',
  '| # | 检查项 | 结果 | 详情 |',
  '| --- | --- | --- | --- |',
  ...results.map((r, i) => '| ' + (i + 1) + ' | ' + r.name + ' | ' + (r.skipped ? '⏭ 跳过' : r.ok ? '✅ 通过' : '❌ 失败') + ' | ' + String(r.detail).replace(/\|/g, '\\|').slice(0, 160) + ' |'),
  '',
  '截图：`docs/mobile/portrait.jpg` · `docs/mobile/landscape.jpg`',
  ''
].join('\n');
fs.writeFileSync(path.join(root, 'MOBILE_CHECK.md'), md, 'utf8');
console.log('\n[mobile-check] ' + pass + '/' + total + ' 通过，报告写入 MOBILE_CHECK.md');

try { ws.close(); } catch (e) {}
try { proc.kill(); } catch (e) {}
setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(pass === total ? 0 : 1); }, 800);
