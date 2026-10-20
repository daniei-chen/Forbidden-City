import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

/* 统一测试入口：串行运行所有专项套件，生成 TEST_ALL.md 汇总 */
const root = 'D:/AI/DeepSeek/DeepSeek 1/forbidden-city';
const logsDir = path.join(root, 'logs');
fs.mkdirSync(logsDir, { recursive: true });

const suites = [
  { id: 'gameplay', name: '联动测试', script: 'tools/gameplay-test.mjs', report: 'GAMEPLAY_TEST.md' },
  { id: 'npc', name: 'NPC 行为', script: 'tools/npc-check.mjs', report: 'NPC_CHECK.md' },
  { id: 'festival', name: '灯会专项', script: 'tools/festival-check.mjs', report: 'FESTIVAL_CHECK.md' },
  { id: 'hud', name: '桌面 HUD', script: 'tools/hud-check.mjs', report: 'HUD_CHECK.md' },
  { id: 'mobile', name: '移动端', script: 'tools/mobile-check.mjs', report: 'MOBILE_CHECK.md' },
  { id: 'smoke', name: '冒烟检查', script: 'tools/smoke.mjs', report: null }
];
if (process.argv.includes('--with-harness')) {
  suites.push({ id: 'harness', name: '视觉回归', script: 'tools/harness.mjs', args: ['--no-build'], report: 'harness/out/report.html' });
}

function runSuite(s) {
  return new Promise((resolve) => {
    const logPath = path.join(logsDir, 'test-all-' + s.id + '.log');
    const out = fs.createWriteStream(logPath);
    const started = Date.now();
    const child = spawn(process.execPath, [s.script].concat(s.args || []), { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    child.stdout.on('data', (d) => { out.write(d); tail = (tail + d.toString()).slice(-4000); });
    child.stderr.on('data', (d) => { out.write(d); tail = (tail + d.toString()).slice(-4000); });
    child.on('close', (code) => {
      out.end();
      const ms = Date.now() - started;
      let summary = '';
      const lines = tail.split(/\r?\n/).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/全部通过|通过 \(\d+ 项检查\)|\d+\/\d+ 通过|判定=PASS|baseline-created/.test(lines[i])) { summary = lines[i].trim(); break; }
      }
      resolve({ id: s.id, name: s.name, ok: code === 0, code: code, ms: ms, summary: summary, log: path.relative(root, logPath), report: s.report });
      console.log((code === 0 ? 'PASS ' : 'FAIL ') + s.name + ' (' + Math.round(ms / 1000) + 's) ' + summary);
    });
  });
}

const results = [];
for (const s of suites) {
  console.log('\n[test-all] running ' + s.name + ' ...');
  results.push(await runSuite(s));
}

const pass = results.filter(r => r.ok).length;
const total = results.length;
const md = [
  '# 全量测试汇总',
  '',
  '> 由 `tools/test-all.mjs` 生成 · ' + new Date().toISOString(),
  '',
  '结果：**' + pass + ' / ' + total + ' 套件通过**',
  '',
  '| # | 套件 | 结果 | 用时 | 摘要 | 报告/日志 |',
  '| --- | --- | --- | --- | --- | --- |'
];
results.forEach((r, i) => {
  const link = r.report ? '`' + r.report + '`' : '`' + r.log + '`';
  md.push('| ' + (i + 1) + ' | ' + r.name + ' | ' + (r.ok ? '✅ 通过' : '❌ 失败') + ' | ' + Math.round(r.ms / 1000) + 's | ' + String(r.summary).replace(/\|/g, '\\|').slice(0, 120) + ' | ' + link + ' |');
});
md.push('');
md.push('日志目录：`logs/test-all-*.log`');
md.push('');
fs.writeFileSync(path.join(root, 'TEST_ALL.md'), md.join('\n'), 'utf8');
console.log('\n[test-all] ' + pass + '/' + total + ' 套件通过 → TEST_ALL.md');
process.exit(pass === total ? 0 : 1);
