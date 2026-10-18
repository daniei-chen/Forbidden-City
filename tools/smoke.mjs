#!/usr/bin/env node
/**
 * 冒烟测试：无头 Chrome 加载构建产物（或开发入口），验证启动 / 四时段 / 标注 / 巡礼 / 无异常，
 * 并输出关键截图。
 *
 * 用法（在 forbidden-city/ 目录）:
 *   node tools/smoke.mjs
 */
import { spawn } from 'node:child_process';
import { lowerPriorityLater } from './_lowprio.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const distFile = path.join(root, 'dist', 'forbidden-city.html');
const target = fs.existsSync(distFile) ? distFile : path.join(root, 'index.html');
const url = pathToFileURL(target).href;
const shotsDir = path.join(root, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });

const CHROME = process.env.CHROME_PATH || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });

if (!CHROME) {
  console.error('[smoke] 未找到 Chrome/Edge，可用 CHROME_PATH 环境变量指定');
  process.exit(2);
}

const port = 9338;
const profile = path.join(root, '.cache', 'smoke-profile');
fs.mkdirSync(path.join(root, '.cache'), { recursive: true });

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--num-raster-threads=2', '--renderer-process-limit=1',
  '--remote-debugging-port=' + port, '--remote-allow-origins=*',
  '--user-data-dir=' + profile, '--window-size=1600,900', 'about:blank'
], { stdio: 'ignore' });
lowerPriorityLater(profile);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const exceptions = [];

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) });
  console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail != null ? '  — ' + detail : ''));
}

async function getWs() {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await r.json();
      const page = list.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('无法连接 Chrome 调试端口');
}

console.log('[smoke] 目标: ' + target);
const ws = new WebSocket(await getWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id); pending.delete(msg.id);
    if (msg.error) p.rej(new Error(JSON.stringify(msg.error))); else p.res(msg.result);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    exceptions.push(d.exception ? (d.exception.description || d.exception.value) : d.text);
  }
};

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval 异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result && r.result.value;
};

const waitFor = async (expr, timeoutMs) => {
  const deadline = Date.now() + (timeoutMs || 20000);
  while (Date.now() < deadline) {
    const v = await evaluate(expr);
    if (v) return v;
    await sleep(300);
  }
  return null;
};

const screenshot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(shotsDir, name), Buffer.from(s.data, 'base64'));
};

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(16000);

  const state = await evaluate(`(function(){
    return {
      err: window.__err || null,
      errors: (window.__errors || []).slice(0, 3),
      loaderHidden: !!document.getElementById('loader') && document.getElementById('loader').classList.contains('hide'),
      ready: !!(window.__app && window.__app.ready),
      version: window.__app ? window.__app.version : null,
      build: window.__app ? window.__app.build : null,
      theme: window.__app ? window.__app.state.theme : null,
      quality: window.__app ? window.__app.state.quality : null,
      meshes: window.__sceneInfo ? window.__sceneInfo.meshes : 0,
      buildMs: window.__buildMs || null,
      perf: window.__app ? { fps: window.__app.perf.fps, draws: window.__app.perf.draws } : null
    };
  })()`);

  console.log('[smoke] 启动状态: ' + JSON.stringify(state));
  check('应用启动无异常', !state.err && exceptions.length === 0, state.err || exceptions[0] || '');
  check('加载层已隐藏', state.loaderHidden);
  check('构建成功 (ready)', state.ready);
  check('场景规模正常', state.meshes > 500, 'meshes=' + state.meshes);
  check('构建耗时 < 15s', state.buildMs != null && state.buildMs < 15000, 'buildMs=' + state.buildMs);

  await evaluate("window.__app.setQuality('high')");
  await sleep(700);
  const ssaoOk = await evaluate("typeof POST !== 'undefined' && POST.ssao === true");
  check('环境光遮蔽', ssaoOk === true, String(ssaoOk));
  await screenshot('smoke-01-day.png');

  for (const theme of ['dusk', 'night', 'snow']) {
    await evaluate(`window.__app.setTheme('${theme}')`);
    await sleep(2200);
    const st = await evaluate(`window.__app.state.theme`);
    check('切换主题: ' + theme, st === theme, st);
    await screenshot('smoke-02-' + theme + '.png');
  }

  await evaluate(`window.__app.setTheme('day')`);
  await sleep(1600);

  const labelsBefore = await evaluate('window.__app.state.labels');
  await evaluate('window.__app.toggleLabels()');
  await sleep(600);
  const labelsAfter = await evaluate('window.__app.state.labels');
  check('标注开关', labelsBefore !== labelsAfter, labelsBefore + ' -> ' + labelsAfter);

  await evaluate('window.__app.startTour()');
  await sleep(2600);
  const tourOn = await evaluate('window.__app.state.tour');
  check('巡礼启动', tourOn === true);
  await screenshot('smoke-03-tour.png');
  await evaluate('window.__app.stopTour()');
  await sleep(500);
  const tourOff = await evaluate('window.__app.state.tour');
  check('巡礼退出', tourOff === false);

  await evaluate(`window.__app.setQuality('medium')`);
  await sleep(1800);
  const q = await evaluate('window.__app.state.quality');
  check('画质切换', q === 'medium', q);
  await screenshot('smoke-04-medium.png');
  await evaluate('window.__app.showView(9)');
  await sleep(2200);
  const view9 = await evaluate('window.__app.state.view');
  check('殿内机位', view9 === 9, String(view9));
  const regCount = await evaluate('INTERIOR.registry.length');
  check('殿内系统', regCount >= 7, 'interiors=' + regCount);
  await screenshot('smoke-05-interior.png');
  await evaluate('window.__app.showView(0)');

  /* 低画质下测试交互（无头软渲染帧率较低） */
  await evaluate("window.__app.setQuality('low')");
  await sleep(1200);

  const avatarOk = await evaluate("typeof AVATAR !== 'undefined' && !!AVATAR.group && AVATAR.group.children.length > 3");
  check('小人模型', avatarOk === true, String(avatarOk));

  const npcOk = await evaluate("typeof NPC !== 'undefined' && !!NPC.group && NPC.group.children.length >= 12");
  check('宫廷侍卫', npcOk === true, String(npcOk));

  const snapOk = await evaluate("typeof window.__app.snapshot === 'function'");
  check('拍照接口', snapOk === true, String(snapOk));

  await evaluate('window.__app.startWalk()');
  await waitFor('window.__app.state.walking === true', 5000);
  const walking = await evaluate('window.__app.state.walking');
  check('漫游模式进入', walking === true, String(walking));

  const third = await evaluate('window.__app.state.thirdPerson');
  check('第三人称相机', third === true, String(third));

  const jumpRes = await evaluate(`(function(){
    if (!window.__app || !window.__app.state.walking) return null;
    WALK.jump();
    var airborne = !WALK.onGround;
    var groundY = WALK.groundAt(WALK.pos.x, WALK.pos.z);
    var maxY = WALK.pos.y, frames = 0;
    for (var i = 0; i < 80; i++) {
      WALK.update(0.05);
      frames++;
      if (WALK.pos.y > maxY) maxY = WALK.pos.y;
      if (WALK.onGround) break;
    }
    return { airborne: airborne, landed: WALK.onGround, frames: frames, height: +(maxY - groundY).toFixed(2) };
  })()`);
  check('小人跳跃起跳', jumpRes && jumpRes.airborne === true, JSON.stringify(jumpRes));
  check('小人跳跃落地', jumpRes && jumpRes.landed === true, JSON.stringify(jumpRes));
  await evaluate("WALK.keys['w'] = true");
  await waitFor('WALK.pos.z < 429', 12000);
  await evaluate("WALK.keys['w'] = false");
  const walked = await evaluate('WALK.pos.z');
  check('漫游移动', walked < 429, 'z=' + walked);
  await screenshot('smoke-06-walk.png');
  await evaluate('window.__app.stopWalk()');
  await sleep(600);
  const walkingOff = await evaluate('window.__app.state.walking');
  check('漫游模式退出', walkingOff === false, String(walkingOff));

  await evaluate(`window.__app.setTheme('snow')`);
  const snowReady = await waitFor('EFFECTS.snowAmount > 0.5', 30000);
  check('雪景过渡', !!snowReady, 'snow=' + await evaluate('EFFECTS.snowAmount'));
  await evaluate('window.__app.startWalk()');
  await sleep(500);
  await evaluate("WALK.keys['w'] = true");
  const fpReady = await waitFor('EFFECTS.footprints.filter(function(f){return f.mesh.visible;}).length >= 1', 20000);
  await evaluate("WALK.keys['w'] = false");
  const fp = await evaluate('EFFECTS.footprints.filter(function(f){return f.mesh.visible;}).length');
  check('雪地脚印生成', !!fpReady, 'count=' + fp);
  await screenshot('smoke-07-walk-snow.png');
  await evaluate('window.__app.stopWalk()');
  await evaluate(`window.__app.setTheme('day')`);
  await sleep(1000);

  await evaluate(`window.__app.setQuality('high')`);
  await sleep(800);

  const finalErr = await evaluate('(window.__errors || []).length');
  check('运行期无 JS 异常', finalErr === 0, 'errors=' + finalErr);
} catch (err) {
  check('测试执行', false, err && err.message);
} finally {
  const failed = results.filter(r => !r.ok);
  console.log('\n[smoke] ' + (failed.length === 0 ? '全部通过' : '失败 ' + failed.length + ' 项') +
    ' (' + results.length + ' 项检查)');
  ws.close();
  try { proc.kill(); } catch (e) { /* ignore */ }
  try { fs.rmSync(path.join(root, '.cache'), { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch (e) { /* Chrome 可能仍持有锁，忽略 */ }
  process.exit(failed.length === 0 ? 0 : 1);
}
