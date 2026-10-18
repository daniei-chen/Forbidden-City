#!/usr/bin/env node
/**
 * 单文件构建：把 index.html + 全部 js + three.min.js 内联为可直接双击打开的单个 HTML。
 *
 * 用法（在 forbidden-city/ 目录）:
 *   node tools/build.mjs              仅生成 dist/
 *   node tools/build.mjs --desktop    同时复制一份到桌面
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const distDir = path.join(root, 'dist');
const srcHtml = path.join(root, 'index.html');

/* ---------- 0. 语法预检 ---------- */
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'));
for (const f of jsFiles) {
  execFileSync(process.execPath, ['--check', path.join(root, 'js', f)], { stdio: 'inherit' });
}
console.log('[build] 语法检查通过 (' + jsFiles.length + ' 个模块)');

/* ---------- 1. 读取入口 ---------- */
let html = fs.readFileSync(srcHtml, 'utf8');
const inlined = [];
const scriptRe = /<script src="([^"]+)"><\/script>/g;
let m;
while ((m = scriptRe.exec(html)) !== null) inlined.push(m[1]);

/* ---------- 2. 逐个内联 ---------- */
let out = html;
for (const rel of inlined) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error('缺少脚本: ' + rel);
  const code = fs.readFileSync(file, 'utf8');
  if (/<\/script/i.test(code)) throw new Error(rel + ' 包含 </script，无法安全内联');
  out = out.replace(
    `<script src="${rel}"></script>`,
    `<script data-src="${rel}">\n/* ==== ${rel} ==== */\n${code}\n</script>`
  );
}

/* ---------- 2.5 内联真实素材（CC0）为 base64 ---------- */
const assetFiles = [
  'hdri/chinese_garden_equirect.png',
  'textures/roof/diff.jpg', 'textures/roof/nor.jpg', 'textures/roof/rough.jpg',
  'textures/marble/diff.jpg', 'textures/marble/nor.jpg', 'textures/marble/rough.jpg',
  'textures/stone/diff.jpg', 'textures/stone/nor.jpg', 'textures/stone/rough.jpg',
  'textures/plaster/diff.jpg', 'textures/plaster/nor.jpg', 'textures/plaster/rough.jpg'
];
const assetData = {};
let assetBytes = 0;
for (const rel of assetFiles) {
  const abs = path.join(root, 'assets', rel);
  if (!fs.existsSync(abs)) { console.log('[build] 跳过缺失素材: ' + rel); continue; }
  const buf = fs.readFileSync(abs);
  assetBytes += buf.length;
  const ext = path.extname(rel).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  assetData[rel] = 'data:' + mime + ';base64,' + buf.toString('base64');
}
if (Object.keys(assetData).length) {
  const assetScript = '<script>window.__ASSET_DATA__ = ' + JSON.stringify(assetData) + ';</script>';
  out = out.replace('<body>', '<body>\n' + assetScript);
  console.log('[build] 内联素材 ' + Object.keys(assetData).length + ' 个，' +
    (assetBytes / 1048576).toFixed(2) + ' MB（base64 后约 ' +
    (out.length / 1048576).toFixed(1) + ' MB HTML）');
}

/* ---------- 3. 构建信息 ---------- */
const stamp = new Date().toISOString();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version + '.' + stamp.slice(0, 10).replace(/-/g, '') + '.' + stamp.slice(11, 16).replace(':', '');
const banner = [
  '<!--',
  '  紫禁城 · 数字复原 — 单文件构建',
  '  build: ' + stamp,
  '  version: ' + version,
  '  three.js r149 (MIT License, https://threejs.org)',
  '  所有几何与贴图均由代码程序化生成，无外部资源。',
  '-->'
].join('\n');

out = out.replace(
  '<head>',
  '<head>\n<meta name="generator" content="forbidden-city-build ' + version + '">\n' +
  '<meta name="build-time" content="' + stamp + '">\n' + banner
);
out = out.replace(
  '</body>',
  '<script>window.__BUILD__ = ' + JSON.stringify({ version, time: stamp, files: inlined }) + ';</script>\n</body>'
);

fs.mkdirSync(distDir, { recursive: true });
const outFile = path.join(distDir, 'forbidden-city.html');
fs.writeFileSync(outFile, out, 'utf8');

const hash = crypto.createHash('sha256').update(out).digest('hex').slice(0, 16);
const info = {
  version,
  buildTime: stamp,
  files: inlined,
  assets: Object.keys(assetData),
  sizeBytes: Buffer.byteLength(out, 'utf8'),
  sha256_16: hash
};
fs.writeFileSync(path.join(distDir, 'build-info.json'), JSON.stringify(info, null, 2));

/* ---------- 4. 桌面副本（可选） ---------- */
let desktopFile = null;
if (process.argv.includes('--desktop')) {
  const desktop = path.join(process.env.USERPROFILE || 'C:\\Users\\Administrator', 'Desktop');
  if (fs.existsSync(desktop)) {
    desktopFile = path.join(desktop, '紫禁城·数字复原.html');
    fs.copyFileSync(outFile, desktopFile);
  }
}

console.log(JSON.stringify({ ...info, desktopFile }, null, 2));
