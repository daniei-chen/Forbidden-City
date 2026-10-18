/**
 * 降低我们自己启动的无头 Chrome 进程优先级（仅 Windows 生效）。
 * 目的：跑评测/截图时把 CPU 让给用户的前台程序，避免系统卡顿。
 * 只匹配命令行里包含我们 profile 路径的 chrome 进程，绝不触碰用户浏览器。
 */
import { execFile } from 'node:child_process';

function lowerOnce(profilePath) {
  if (process.platform !== 'win32' || !profilePath) return;
  const safe = profilePath.replace(/'/g, "''");
  const ps = [
    "$p='" + safe + "';",
    "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" -ErrorAction SilentlyContinue |",
    "Where-Object { $_.CommandLine -and $_.CommandLine.Contains($p) } |",
    "ForEach-Object { try { (Get-Process -Id $_.ProcessId -ErrorAction Stop).PriorityClass = 'BelowNormal' } catch {} }"
  ].join(' ');
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true }, function () {});
}

export function lowerPriorityLater(profilePath) {
  if (process.platform !== 'win32') return;
  setTimeout(function () { lowerOnce(profilePath); }, 1200);
  setTimeout(function () { lowerOnce(profilePath); }, 4500);
  setTimeout(function () { lowerOnce(profilePath); }, 12000);
}
