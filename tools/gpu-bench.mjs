import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = 'D:/AI/DeepSeek/DeepSeek 1/forbidden-city';
const file = path.join(root, 'dist', 'forbidden-city.html');
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9392;
const profile = path.join(root, '.cache', 'gpu-profile');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const proc = spawn(chrome, [
  '--headless=new',
  '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + port, '--remote-allow-origins=*',
  '--user-data-dir=' + profile, '--window-size=1600,900',
  'about:blank'
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 150; i++) {
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
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });

const results = {};
for (const quality of ['high', 'medium', 'low']) {
  const url = pathToFileURL(file).href + '?still=1&snap=1&quality=' + quality + '&theme=day&view=0&nomap=1';
  await send('Page.navigate', { url });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if (await evl('!!(window.__app && window.__app.ready)')) { ready = true; break; } } catch (e) {}
    await sleep(300);
  }
  if (!ready) { results[quality] = { error: 'not ready' }; continue; }
  await sleep(1500);
  const info = await evl(`(function(){
    const app = window.__app;
    const gl = app.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererName = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const b = app.bench(40);
    return { renderer: rendererName, vendor: vendor, fps: b.fps, msPerFrame: b.msPerFrame, draws: b.draws, tris: b.tris, quality: app.state.quality, dpr: window.devicePixelRatio };
  })()`);
  results[quality] = info;
  console.log(quality, JSON.stringify(info));
}

/* 真实浏览器常见 1.5x DPR 复测 high */
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1.5, mobile: false });
{
  const url = pathToFileURL(file).href + '?still=1&snap=1&quality=high&theme=day&view=0&nomap=1';
  await send('Page.navigate', { url });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if (await evl('!!(window.__app && window.__app.ready)')) { ready = true; break; } } catch (e) {}
    await sleep(300);
  }
  if (ready) {
    await sleep(1500);
    results['high@1.5x'] = await evl(`(function(){
      const app = window.__app;
      const gl = app.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererName = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const b = app.bench(40);
      return { renderer: rendererName, fps: b.fps, msPerFrame: b.msPerFrame, draws: b.draws, tris: b.tris, quality: app.state.quality, dpr: window.devicePixelRatio };
    })()`);
    console.log('high@1.5x', JSON.stringify(results['high@1.5x']));
  }
}

fs.writeFileSync(path.join(root, 'GPU_BENCH.json'), JSON.stringify(results, null, 2), 'utf8');
console.log('[gpu-bench] saved GPU_BENCH.json');

/* 生成 Markdown 摘要 */
const md = ['# 真实 GPU 帧率基准（headless Chrome，硬件加速）', '', '> 由 `tools/gpu-bench.mjs` 生成。若 renderer 为 SwiftShader 说明本机无可用 GPU 加速。', ''];
md.push('| 画质 | 渲染器 | FPS | ms/帧 | draw calls | 三角面 |');
md.push('| --- | --- | --- | --- | --- | --- |');
for (const q of ['high', 'medium', 'low', 'high@1.5x']) {
  const r = results[q] || {};
  md.push(`| ${q} | ${r.renderer || '?'} | ${r.fps != null ? r.fps : '?'} | ${r.msPerFrame != null ? r.msPerFrame : '?'} | ${r.draws || '?'} | ${r.tris ? (r.tris / 1e6).toFixed(2) + ' M' : '?'} |`);
}
md.push('');
fs.writeFileSync(path.join(root, 'GPU_BENCH.md'), md.join('\n'), 'utf8');
console.log('[gpu-bench] saved GPU_BENCH.md');

try { ws.close(); } catch (e) {}
try { proc.kill(); } catch (e) {}
setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 800);
