import { exec } from 'child_process';
import fs from 'fs';

function logKill(msg: string) {
  fs.appendFileSync(
    require('os').homedir() + '/Library/Logs/BrowserGuard/renderer.log',
    `[killProcess] [${new Date().toISOString()}] ${msg}\n`
  );
}

export function killBrowserProcess(browser: 'chrome' | 'edge' | 'safari') {
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
    }
  } else if (process.platform === 'win32') {
    switch (browser) {
      case 'chrome':
        cmd = 'taskkill /IM chrome.exe /F';
        break;
      case 'edge':
        cmd = 'taskkill /IM msedge.exe /F';
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