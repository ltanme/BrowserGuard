import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

function getLogPath(): string {
  return process.platform === 'darwin'
    ? path.join(require('os').homedir(), 'Library/Logs/BrowserGuard/renderer.log')
    : path.join(app.getPath('appData'), 'BrowserGuard', 'logs', 'renderer.log');
}

function logKill(msg: string) {
  const logPath = getLogPath();
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(
    logPath,
    `[killProcess] [${new Date().toISOString()}] ${msg}\n`
  );
}

export function killBrowserProcess(browser: 'chrome' | 'edge' | 'safari' | 'firefox') {
  let cmd = '';
  if (process.platform === 'darwin') {
    switch (browser) {
      case 'chrome':
        cmd = 'pkill "Google Chrome"';
        break;
      case 'edge':
        cmd = 'pkill "Microsoft Edge"';
        break;
      case 'safari':
        cmd = 'pkill Safari';
        break;
      case 'firefox':
        cmd = 'pkill Firefox';
        break;
    }
  } else if (process.platform === 'win32') {
    switch (browser) {
      case 'chrome':
        cmd = 'taskkill /IM chrome.exe /F';
        break;
      case 'edge':
        cmd = 'taskkill /IM msedge.exe /F';
        break;
      case 'firefox':
        cmd = 'taskkill /IM firefox.exe /F';
        break;
      case 'safari':
        // Windows 无 Safari
        return;
    }
  }
  if (cmd) {
    logKill(`[${browser}] 执行 kill 命令: ${cmd}`);
    exec(cmd, (err) => {
      if (err) logKill(`[${browser}] kill 失败: ${err.message}`);
    });
  }
} 