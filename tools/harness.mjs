#!/usr/bin/env node
/**
 * 自动化评测闭环（harness）
 *
 * 流程：构建 → 启动无头 Chrome → 按矩阵渲染固定机位截图（static=1 可复现）
 *      → 采集硬指标（fps/draws/tris/meshes）→ 与基线做感知对比（SSIM/MAE/亮度）
 *      → 生成 HTML 报告 + 阈值判定。
 *
 * 用法：
 *   node tools/harness.mjs                  常规评测（有基线则对比）
 *   node tools/harness.mjs --update-baseline 建立/更新基线
 *   node tools/harness.mjs --no-compare      只渲染与采集（CI 用）
 *   node tools/harness.mjs --no-build        跳过构建
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { lowerPriorityLater } from './_lowprio.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const distFile = path.join(root, 'dist', 'forbidden-city.html');
const outDir = path.join(root, 'harness', 'out');
const currentDir = path.join(outDir, 'current');
const baselineDir = path.join(root, 'harness', 'baselines');
const reportFile = path.join(outDir, 'report.html');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const args = process.argv.slice(2);
const UPDATE = args.includes('--update-baseline');
const NO_COMPARE = args.includes('--no-compare');
const NO_BUILD = args.includes('--no-build');
const LIMIT = (function () { const a = args.find(function (x) { return x.indexOf('--limit=') === 0; }); return a ? parseInt(a.split('=')[1], 10) : 0; })();

/* ---------- 配置 ---------- */
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'harness', 'matrix.json'), 'utf8'));
const thresholds = JSON.parse(fs.readFileSync(path.join(root, 'harness', 'thresholds.json'), 'utf8'));
const W = matrix.width || 1280;
const H = matrix.height || 720;

/* ---------- 构建 ---------- */
if (!NO_BUILD) {
  const build = spawnSync(process.execPath, [path.join(root, 'tools', 'build.mjs')], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error('[harness] 构建失败'); process.exit(1); }
}
if (!fs.existsSync(distFile)) { console.error('[harness] 缺少 dist 构建产物'); process.exit(1); }

/* ---------- Chrome ---------- */
function findChrome() {
  const env = process.env.CHROME_PATH;
  const candidates = [
    env,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch (e) {} }
  return null;
}
const chrome = findChrome();
if (!chrome) { console.error('[harness] 找不到 Chrome，请设置 CHROME_PATH'); process.exit(1); }

fs.mkdirSync(currentDir, { recursive: true });
for (const f of fs.readdirSync(currentDir)) { try { fs.unlinkSync(path.join(currentDir, f)); } catch (e) {} }

const chromePort = 9400 + Math.floor(Math.random() * 400);
const profile = path.join(root, '.cache', 'harness-profile-' + chromePort);
const proc = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
  '--num-raster-threads=2', '--renderer-process-limit=1',
  '--remote-debugging-port=' + chromePort, '--remote-allow-origins=*',
  '--user-data-dir=' + profile,
  '--window-size=' + W + ',' + H,
  'about:blank'
], { stdio: 'ignore' });
lowerPriorityLater(profile);

async function getWs() {
  for (let i = 0; i < 200; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + chromePort + '/json/list');
      const list = await r.json();
      const page = list.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('无法连接 Chrome');
}

let ws, msgId = 0, pending = new Map();
let dead = false;
async function connect() {
  ws = new WebSocket(await getWs());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onclose = () => {
    dead = true;
    pending.forEach(function (p) { try { p.rej(new Error('chrome disconnected')); } catch (e) {} });
    pending.clear();
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.rej(new Error(JSON.stringify(m.error))); else p.res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      errors.push((m.params && m.params.exceptionDetails && m.params.exceptionDetails.text) || 'exception');
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
}
function send(method, params = {}) {
  return new Promise((res, rej) => {
    if (dead) { rej(new Error('chrome disconnected')); return; }
    const id = ++msgId; pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(function () {
      if (pending.has(id)) { pending.delete(id); rej(new Error('timeout: ' + method)); }
    }, 30000);
  });
}
function withTimeout(p, ms, label) {
  return Promise.race([p, new Promise(function (res, rej) {
    setTimeout(function () { rej(new Error('timeout: ' + label)); }, ms);
  })]);
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result && r.result.value;
}
const errors = [];
await connect();

/* ---------- 渲染矩阵 ---------- */
const items = [];
const t0 = Date.now();

/* 单页加载 + 暂停 rAF + 页面内同步渲染截图（软件渲染下稳定且快） */
const bootUrl = pathToFileURL(distFile).href +
  '?still=1&static=1&quality=' + encodeURIComponent(matrix.quality || 'high') +
  '&theme=day&view=0&nomap=1';
await send('Page.navigate', { url: bootUrl });
let bootReady = false;
for (let bi = 0; bi < 240; bi++) {
  try {
    const r = await evaluate('(function(){ if(!window.__app||!window.__app.ready) return 0; if(typeof ASSETS!=="undefined" && ASSETS.started && !ASSETS.ready) return 0; return 1; })()');
    if (r === 1) { bootReady = true; break; }
  } catch (e) { /* retry */ }
  await sleep(250);
}
if (!bootReady) { console.error('[harness] 页面未就绪（60s 超时）'); process.exit(1); }
await sleep(600);
const bootInfo = await evaluate('({version: window.__app.version, quality: window.__app.state.quality})');
await evaluate('window.__app.pause(true)');

for (const theme of matrix.themes) {
  for (const view of matrix.views) {
    if (LIMIT && items.length >= LIMIT) break;
    const key = theme + '-v' + view;
    const ts0 = Date.now();
    try {
      const dataUrl = await withTimeout(evaluate('(function(){ window.__app.snapTheme(' + JSON.stringify(theme) + '); window.__app.showView(' + view + ', true); return window.__app.capture(); })()'), 120000, 'capture');
      if (!dataUrl || dataUrl.indexOf('base64,') < 0) throw new Error('capture 返回空');
      const b64 = dataUrl.split('base64,')[1];
      const file = key + '.jpg';
      const abs = path.join(currentDir, file);
      fs.writeFileSync(abs, Buffer.from(b64, 'base64'));
      const metrics = await evaluate('(function(){ var b = window.__app.bench(1) || {}; return { meshes: (window.__sceneInfo && window.__sceneInfo.meshes) || 0, benchMs: b.msPerFrame, fps: b.fps, draws: b.draws, tris: b.tris, assets: (typeof ASSETS !== "undefined") && !!ASSETS.ready }; })()');
      items.push({ key, theme, view, file, bytes: fs.statSync(abs).size, metrics });
      console.log('[harness] ' + key + '  ' + (metrics && metrics.benchMs != null ? metrics.benchMs + 'ms ' + metrics.draws + ' draws' : 'no-metrics') + '  ' + (Date.now() - ts0) + 'ms');
    } catch (e) {
      console.error('[harness] 失败 ' + key + ': ' + String(e).slice(0, 200));
      if (dead) break;
    }
  }
  if (dead) break;
}
try { ws.close(); } catch (e) {}
try { proc.kill(); } catch (e) {}
process.on('exit', function () { try { proc.kill(); } catch (e) {} });

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const first = items.find(x => x.metrics && x.metrics.benchMs != null) || { metrics: {} };
const metricsDoc = {
  generatedAt: new Date().toISOString(),
  elapsedSec: Number(elapsed),
  matrix,
  thresholds,
  renderer: 'headless chrome / swiftshader',
  version: (bootInfo && bootInfo.version) || 'unknown',
  quality: (bootInfo && bootInfo.quality) || 'unknown',
  perf: {
    benchMs: first.metrics.benchMs != null ? first.metrics.benchMs : null,
    fps: first.metrics.fps != null ? first.metrics.fps : null,
    draws: first.metrics.draws != null ? first.metrics.draws : null,
    tris: first.metrics.tris != null ? first.metrics.tris : null,
    meshes: first.metrics.meshes != null ? first.metrics.meshes : null
  },
  items
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(metricsDoc, null, 2), 'utf8');

/* ---------- 基线 / 对比 ---------- */
const baselineMetricsFile = path.join(baselineDir, 'metrics.json');
let comparison = null;
let verdict = 'baseline';
if (UPDATE || !fs.existsSync(baselineMetricsFile)) {
  fs.mkdirSync(baselineDir, { recursive: true });
  for (const it of items) fs.copyFileSync(path.join(currentDir, it.file), path.join(baselineDir, it.file));
  fs.writeFileSync(baselineMetricsFile, JSON.stringify(metricsDoc, null, 2), 'utf8');
  console.log('[harness] 基线已建立/更新：' + items.length + ' 张 → harness/baselines/');
  verdict = 'baseline-created';
} else if (!NO_COMPARE) {
  const py = findPython();
  const scoreFile = path.join(outDir, 'scores.json');
  const r = spawnSync(py, [path.join(root, 'harness', 'score.py'),
    '--current', currentDir, '--baseline', baselineDir, '--out', scoreFile], { stdio: 'inherit' });
  if (r.status !== 0 || !fs.existsSync(scoreFile)) {
    console.error('[harness] 感知评分失败（python?）');
    verdict = 'score-error';
  } else {
    comparison = JSON.parse(fs.readFileSync(scoreFile, 'utf8'));
    const base = JSON.parse(fs.readFileSync(baselineMetricsFile, 'utf8'));
    const perfDrop = base.perf && base.perf.benchMs && metricsDoc.perf.benchMs
      ? (metricsDoc.perf.benchMs - base.perf.benchMs) / base.perf.benchMs : 0;
    const s = comparison.summary || {};
    const pass = (s.minSsim == null || s.minSsim >= thresholds.ssimMin) &&
      (s.maeMean == null || s.maeMean <= thresholds.maeMax) &&
      (perfDrop <= thresholds.perfDropMax);
    verdict = pass ? 'pass' : 'fail';
    metricsDoc.comparison = comparison;
    metricsDoc.perfDrop = perfDrop;
    fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(metricsDoc, null, 2), 'utf8');
  }
}

/* ---------- HTML 报告 ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const verdictColor = verdict === 'fail' ? '#c0392b' : (verdict === 'pass' ? '#2e8b57' : '#b8860b');
const s = (comparison && comparison.summary) || {};
const rows = items.map(function (it) {
  const pair = comparison && comparison.pairs && comparison.pairs[it.key];
  const baseImg = fs.existsSync(path.join(baselineDir, it.file)) ? '../baselines/' + it.file : null;
  return `<tr>
    <td class="k">${esc(it.key)}</td>
    <td>${baseImg ? `<img loading="lazy" src="${esc(baseImg)}">` : '<span class="na">新机位</span>'}</td>
    <td><img loading="lazy" src="current/${esc(it.file)}"></td>
    <td>${pair ? pair.ssim.toFixed(4) : '—'}</td>
    <td>${pair ? pair.mae.toFixed(2) : '—'}</td>
    <td>${pair ? pair.bright.toFixed(2) : '—'}</td>
    <td>${it.metrics && it.metrics.msPerFrame != null ? it.metrics.msPerFrame + ' ms' : '—'}</td>
    <td>${it.metrics && it.metrics.draws != null ? it.metrics.draws : '—'}</td>
  </tr>`;
}).join('\n');

const perfRows = [
  ['版本', metricsDoc.version + ' / ' + metricsDoc.quality],
  ['渲染耗时', (metricsDoc.perf.benchMs != null ? metricsDoc.perf.benchMs + ' ms（软件渲染）' : '—')],
  ['Draw calls', metricsDoc.perf.draws],
  ['三角面', metricsDoc.perf.tris],
  ['Mesh 数', metricsDoc.perf.meshes],
  ['SSIM 均值', s.ssimMean != null ? s.ssimMean.toFixed(4) : '—'],
  ['SSIM 最低', s.minSsim != null ? s.minSsim.toFixed(4) : '—'],
  ['MAE 均值', s.maeMean != null ? s.maeMean.toFixed(2) : '—'],
  ['阈值', 'SSIM≥' + thresholds.ssimMin + ' · MAE≤' + thresholds.maeMax + '% · 性能回退≤' + Math.round(thresholds.perfDropMax * 100) + '%']
].map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('\n');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>紫禁城 · 自动化评测报告</title>
<style>
body{margin:0;background:#0d1117;color:#e6edf3;font:13px/1.5 -apple-system,"Microsoft YaHei",sans-serif;padding:24px}
h1{font-size:20px;letter-spacing:2px;margin:0 0 4px}
.sub{color:#8b949e;margin-bottom:18px}
.verdict{display:inline-block;padding:4px 12px;border-radius:4px;background:${verdictColor};color:#fff;font-weight:600;letter-spacing:1px}
.panel{display:flex;gap:18px;flex-wrap:wrap;margin:18px 0}
.panel table{border-collapse:collapse;background:#161b22;border:1px solid #30363d;min-width:320px}
.panel th,.panel td{padding:7px 12px;border-bottom:1px solid #21262d;text-align:left;font-weight:400}
.panel th{color:#8b949e;width:130px}
table.shots{width:100%;border-collapse:collapse;background:#161b22;border:1px solid #30363d}
table.shots th{background:#1f2630;color:#8b949e;font-weight:500;padding:8px;font-size:12px;text-align:left}
table.shots td{padding:8px;border-top:1px solid #21262d;vertical-align:top}
table.shots img{max-width:100%;width:300px;display:block;border:1px solid #30363d;border-radius:3px}
td.k{font-family:ui-monospace,Consolas,monospace;color:#79c0ff;white-space:nowrap}
.na{color:#8b949e}
.foot{margin-top:18px;color:#8b949e;font-size:12px}
</style></head><body>
<h1>紫禁城 · 自动化评测报告</h1>
<div class="sub">${esc(metricsDoc.generatedAt)} · 渲染 ${esc(metricsDoc.renderer)} · 耗时 ${esc(elapsed)}s · 版本 ${esc(metricsDoc.version)}</div>
<div class="verdict">${esc(verdict.toUpperCase())}</div>
<div class="panel"><table>${perfRows}</table>
<table><tr><th>说明</th><td>static=1 固定机位可复现；SSIM/MAE 为当前 vs 基线；源码 harness/thresholds.json</td></tr></table></div>
<table class="shots"><thead><tr><th>机位</th><th>基线</th><th>当前</th><th>SSIM</th><th>MAE %</th><th>Δ亮度</th><th>ms/帧</th><th>draws</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="foot">由 tools/harness.mjs 生成；截图位于 harness/out/current/，基线位于 harness/baselines/。CI 使用 --no-compare 仅产出报告与工件。</div>
</body></html>`;
fs.writeFileSync(reportFile, html, 'utf8');

/* ---------- 控制台摘要 ---------- */
console.log('\n[harness] 完成 ' + items.length + ' 张 / ' + elapsed + 's  版本=' + metricsDoc.version);
if (comparison) {
  console.log('[harness] SSIM 均值=' + (s.ssimMean || 0).toFixed(4) + ' 最低=' + (s.minSsim || 0).toFixed(4) +
    ' MAE=' + (s.maeMean || 0).toFixed(2) + '% 判定=' + verdict.toUpperCase());
} else {
  console.log('[harness] 判定=' + verdict);
}
console.log('[harness] 报告: ' + path.relative(root, reportFile));
process.exit(verdict === 'fail' || verdict === 'score-error' ? 1 : 0);

/* ---------- python 探测 ---------- */
function findPython() {
  const env = process.env.PYTHON;
  const candidates = [env, 'python', 'python3',
    'C:\\Users\\Administrator\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe'];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const r = spawnSync(c, ['-c', 'import numpy,PIL;print(1)'], { stdio: 'ignore' });
      if (r.status === 0) return c;
    } catch (e) { /* next */ }
  }
  return 'python';
}
