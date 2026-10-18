#!/usr/bin/env node
/**
 * 静态检查：JS 语法 + 入口脚本引用完整性 + 资源存在性。
 * 用法（在 forbidden-city/ 目录）: node tools/check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
let failed = 0;

function ok(msg) { console.log('  PASS ' + msg); }
function bad(msg) { failed++; console.log('  FAIL ' + msg); }

/* 1. JS 语法 */
const jsDir = path.join(root, 'js');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', path.join(jsDir, f)], { stdio: 'pipe' });
    ok('语法 ' + f);
  } catch (e) {
    bad('语法 ' + f);
  }
}

/* 2. 入口脚本引用 */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const refs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
for (const rel of refs) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) ok('引用 ' + rel);
  else bad('引用缺失 ' + rel);
}

/* 3. 必要文件 */
for (const f of ['three.min.js', 'index.html', 'README.md', 'REFERENCE.md']) {
  if (fs.existsSync(path.join(root, f))) ok('文件 ' + f);
  else bad('文件缺失 ' + f);
}

/* 4. 构建产物 */
const dist = path.join(root, 'dist', 'forbidden-city.html');
if (fs.existsSync(dist)) ok('构建产物存在 (' + (fs.statSync(dist).size / 1024).toFixed(0) + ' KB)');
else console.log('  INFO 尚无构建产物，可运行 npm run build');

console.log('\n[check] ' + (failed === 0 ? '通过' : failed + ' 项失败'));
process.exit(failed === 0 ? 0 : 1);
