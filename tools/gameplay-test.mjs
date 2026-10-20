import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = 'D:/AI/DeepSeek/DeepSeek 1/forbidden-city';
const file = path.join(root, 'dist', 'forbidden-city.html');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9396;
const profile = path.join(root, '.cache', 'gameplay-profile-' + Date.now());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
await send('Page.navigate', { url: pathToFileURL(file).href + '?still=1&quality=low&theme=day&view=1&nomap=1' });

let ready = false;
for (let i = 0; i < 120; i++) {
  try { if (await evl('!!(window.__app && window.__app.ready)')) { ready = true; break; } } catch (e) {}
  await sleep(300);
}
if (!ready) { console.error('page not ready'); process.exit(1); }
await sleep(800);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' — ' + (detail == null ? '' : String(detail)));
}

/* 1. 清空存档并重载，保证从零开始 */
await evl(`(function(){
  try {
    ['forbidden-city-tutorial-v1','forbidden-city-achievements-v1','forbidden-city-travel-v1','forbidden-city-photos-v1','forbidden-city-quests-v1','forbidden-city-discoveries-v1'].forEach(function(k){ localStorage.removeItem(k); });
  } catch(e){}
  return true;
})()`);
await send('Page.reload', { ignoreCache: true });
ready = false;
for (let i = 0; i < 120; i++) {
  try { if (await evl('!!(window.__app && window.__app.ready)')) { ready = true; break; } } catch (e) {}
  await sleep(300);
}
if (!ready) { console.error('page not ready after reload'); process.exit(1); }
await sleep(600);
await evl('window.__app.startWalk()');
await sleep(300);
const tut = await evl('window.__app.tutorialInfo()');
check('新手引导自动弹出', tut && tut.active === true && tut.step === 0, JSON.stringify(tut));

/* 2. 移动手感：逐帧 2 秒 */
const move = await evl(`(function(){
  var W = window.WALK, p0 = W.pos.clone();
  W.keys['w'] = true;
  for (var i = 0; i < 120; i++) W.update(1/60);
  W.keys['w'] = false;
  return { dist: +p0.distanceTo(W.pos).toFixed(2) };
})()`);
check('移动手感（2 秒 > 6m）', move && move.dist > 6, JSON.stringify(move));

/* 3. 跳跃测试 */
const jump = await evl(`(function(){
  var W = window.WALK;
  W.pos.set(0, 0, 300); W.pos.y = W.groundAt(0, 300); W.onGround = true; W.vy = 0;
  var y0 = W.pos.y, maxY = y0;
  W.jump();
  for (var i = 0; i < 120; i++) { W.update(1/60); if (W.pos.y > maxY) maxY = W.pos.y; if (W.onGround && i > 5) break; }
  return { height: +(maxY - y0).toFixed(2), landed: W.onGround };
})()`);
check('跳跃高度 > 0.9m 且落地', jump && jump.height > 0.9 && jump.landed, JSON.stringify(jump));

/* 4. 探索：发现午门 */
await evl(`(function(){
  var W = window.WALK;
  W.pos.set(0, 0, 452); W.pos.y = W.groundAt(0, 452);
  window.__app.walkGameTick();
  return true;
})()`);
const disc = await evl(`({ count: document.getElementById('wgCount').textContent, hint: document.getElementById('wgHint').textContent })`);
check('宫城探索记录发现', disc && Number(disc.count) >= 1, JSON.stringify(disc));

/* 5. 任务线：中轴巡礼推进 */
const quest = await evl(`(function(){
  var A = window.__app, W = window.WALK;
  var spots = [[0,452],[0,300],[0,95],[0,5],[0,-50],[0,-196],[0,-244],[0,-470]];
  for (var i = 0; i < spots.length; i++) {
    W.pos.set(spots[i][0], 0, spots[i][1]); W.pos.y = W.groundAt(spots[i][0], spots[i][1]);
    A.walkGameTick(); A.questTick();
  }
  return A.questsInfo()[0];
})()`);
check('中轴巡礼任务可完成', quest && quest.done === true && quest.progress >= 8, JSON.stringify(quest));

/* 6. 图鉴解锁 */
const codex = await evl(`(function(){
  var A = window.__app;
  A.unlockCodex('vat'); A.unlockCodex('sundial'); A.unlockCodex('cat');
  return A.codexInfo();
})()`);
check('图鉴可收录', codex && codex.got >= 3 && codex.total === 16, JSON.stringify({ got: codex && codex.got, total: codex && codex.total }));

/* 6b. 御猫图鉴：走近七只猫即可收录 */
const catCodex = await evl(`(async function(){
  var A = window.__app, W = window.WALK, N = window.__NPC;
  for (var i = 0; i < N.cats.length; i++) {
    var cp = N.cats[i].obj.group.position;
    W.pos.set(cp.x + 1.2, 0, cp.z + 1.2); W.pos.y = W.groundAt(W.pos.x, W.pos.z);
    for (var k = 0; k < 50; k++) A.catCodexTick(1 / 60);
    await new Promise(function(r){ setTimeout(r, 120); });
  }
  return A.catCodexInfo();
})()`);
check('御猫图鉴可收集', catCodex && catCodex.total === 7 && catCodex.got === 7, JSON.stringify({ got: catCodex && catCodex.got, total: catCodex && catCodex.total }));

/* 7. 成就日志 */
const log = await evl(`(function(){
  var A = window.__app;
  A.setTravel(5200, 700, 60);
  A.syncAchievementLog(false);
  return { n: A.achievementLog().length, last: A.achievementLog().slice(-1)[0] };
})()`);
check('成就解锁记录', log && log.n >= 1, JSON.stringify(log));

/* 8. 拍照 + 相册 + 灯箱 */
const photo = await evl(`(async function(){
  var A = window.__app, W = window.WALK;
  W.pos.set(0, 0, 95); W.pos.y = W.groundAt(0, 95);
  A.takePhoto();
  A.openAlbum(true);
  var info1 = A.albumFilterInfo();
  A.openLightbox(0);
  var lb1 = A.lightboxInfo();
  A.lightboxNav(1);
  var lb2 = A.lightboxInfo();
  A.closeLightbox(); A.openAlbum(false);
  return { total: info1.total, lbShown: lb1.shown, lbActive: lb2.active };
})()`);
check('拍照/相册/灯箱', photo && photo.total >= 1 && photo.lbShown === true, JSON.stringify(photo));

/* 9. 投壶小游戏 */
const pot = await evl(`(function(){
  var A = window.__app, W = window.WALK;
  W.pos.set(18, 0, -379); W.pos.y = W.groundAt(18, -379);
  A.interact();
  var info = A.minigameInfo();
  A.setMinigamePower(0.5); A.minigameThrow();
  A.setMinigamePower(0.5); A.minigameThrow();
  return { started: info.active, score: A.minigameInfo().score };
})()`);
check('投壶小游戏可玩', pot && pot.started === true && pot.score >= 2, JSON.stringify(pot));

/* 10. 灯谜 */
const riddle = await evl(`(function(){
  var A = window.__app, W = window.WALK;
  W.pos.set(0, 0, -160); W.pos.y = W.groundAt(0, -160);
  var opened = A.openRiddle();
  var ans = A.answerRiddle(0);
  return { opened: opened, ok: ans && ans.ok };
})()`);
check('宫灯谜题可作答', riddle && riddle.opened === true && riddle.ok === true, JSON.stringify(riddle));

/* 11. 许愿 / 上香 / 喂猫 */
const interact = await evl(`(async function(){
  var A = window.__app, W = window.WALK, N = window.__NPC;
  W.pos.set(13.8, 0, 170); W.pos.y = W.groundAt(13.8, 170);
  A.interact();
  await new Promise(function(r){ setTimeout(r, 850); });
  A.interact();
  W.pos.set(20, 0, 100); W.pos.y = W.groundAt(20, 100);
  A.interact();
  await new Promise(function(r){ setTimeout(r, 1250); });
  A.interact();
  var cat = N.cats[0], cp = cat.obj.group.position;
  W.pos.set(cp.x + 1.5, 0, cp.z + 1.5); W.pos.y = W.groundAt(W.pos.x, W.pos.z);
  A.interact();
  return { wishes: A.wishInfo().wishes, incense: A.incenseInfo().count };
})()`);
check('许愿/上香/投喂互动', interact && interact.wishes >= 2 && interact.incense >= 2, JSON.stringify(interact));

/* 11b. 彩蛋互动：摸铜狮 / 撒米喂雀 */
const extras = await evl(`(async function(){
  var A = window.__app, W = window.WALK;
  W.pos.set(13, 0, 306); W.pos.y = W.groundAt(13, 306);
  A.interact();
  await new Promise(function(r){ setTimeout(r, 900); });
  A.interact();
  W.pos.set(40, 0, 184); W.pos.y = W.groundAt(40, 184);
  A.interact();
  await new Promise(function(r){ setTimeout(r, 1000); });
  A.interact();
  return A.petInfo();
})()`);
check('彩蛋互动（摸铜狮/喂雀）', extras && extras.petLions >= 2 && extras.feedBirds >= 2, JSON.stringify(extras));

/* 12. 氛围预设 */
const preset = await evl(`(function(){
  var A = window.__app;
  A.preset('night_rain');
  return { theme: A.state.theme, weather: A.weatherInfo().mode, festival: A.festivalInfo().visible };
})()`);
check('氛围预设切换', preset && preset.theme === 'night' && preset.weather === 'rain' && preset.festival === true, JSON.stringify(preset));

/* 13. NPC 生态统计 */
const npc = await evl(`(function(){
  var A = window.__app, N = window.__NPC;
  A.setWeather('rain');
  for (var i = 0; i < 30; i++) A.weatherTick(0.2);
  N.update(1 / 60);
  N.startCeremony();
  for (var k = 0; k < 60; k++) N.update(1 / 60);
  return {
    umbrellas: N.umbrellaInfo(),
    ceremony: N.ceremonyStats(),
    life: N.lifeNpcInfo(),
    admire: N.admireStats(),
    greet: N.greetStats(),
    pounce: N.pounceStats()
  };
})()`);
check('NPC 生态（伞/仪式/生活/寒暄）', npc && npc.umbrellas.total > 0 && npc.ceremony.cycles >= 1 && npc.life.eunuch && npc.life.sweeper, JSON.stringify({ umb: npc && npc.umbrellas, cyc: npc && npc.ceremony.cycles }));

/* 14. 设置与 HUD */
const ui = await evl(`(function(){
  var A = window.__app;
  A.togglePerfHud();
  A.startWalk();
  for (var i = 0; i < 40; i++) A.perfHudTick(1/60);
  var ph = A.perfHud();
  A.togglePerfHud();
  return { perfText: ph.text, settings: A.settingsInfo() };
})()`);
check('性能 HUD / 设置系统', ui && ui.perfText.indexOf('FPS') >= 0 && ui.settings, JSON.stringify({ text: ui && ui.perfText.slice(0, 40) }));

/* 15. 氛围预设清理 & 稳定性 */
const final = await evl(`(function(){
  var A = window.__app;
  A.preset('day_clear');
  A.stopWalk();
  return { errors: (window.__errors || []).length, app: !!window.__app };
})()`);
check('无运行时错误', final && final.errors === 0, JSON.stringify(final));

/* 生成报告 */
const pass = results.filter(r => r.ok).length;
const total = results.length;
const now = new Date();
const md = [];
md.push('# 游戏化联动自动测试报告');
md.push('');
md.push('> 由 `tools/gameplay-test.mjs` 生成 · ' + now.toISOString());
md.push('');
md.push('结果：**' + pass + ' / ' + total + ' 通过**');
md.push('');
md.push('| # | 检查项 | 结果 | 详情 |');
md.push('| --- | --- | --- | --- |');
results.forEach((r, i) => {
  md.push('| ' + (i + 1) + ' | ' + r.name + ' | ' + (r.ok ? '✅ 通过' : '❌ 失败') + ' | ' + r.detail.replace(/\|/g, '\\|').slice(0, 160) + ' |');
});
md.push('');
fs.writeFileSync(path.join(root, 'GAMEPLAY_TEST.md'), md.join('\n'), 'utf8');
console.log('\n[gameplay-test] ' + pass + '/' + total + ' 通过，报告已写入 GAMEPLAY_TEST.md');

try { ws.close(); } catch (e) {}
try { proc.kill(); } catch (e) {}
setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(pass === total ? 0 : 1); }, 800);
