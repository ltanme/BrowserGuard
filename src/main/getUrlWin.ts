import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

function getLogPath(): string {
  return process.platform === 'darwin'
    ? path.join(require('os').homedir(), 'Library/Logs/BrowserGuard/renderer.log')
    : path.join(app.getPath('appData'), 'BrowserGuard', 'logs', 'renderer.log');
}

function logGetUrl(msg: string) {
  const logPath = getLogPath();
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(
    logPath,
    `[getUrlWin] [${new Date().toISOString()}] ${msg}\n`
  );
}

function getScriptPath(scriptName: string): string {
  // 在打包后的应用中，脚本在 resources/scripts 目录下
  // 在开发模式下，脚本在项目根目录的 scripts 目录下
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'scripts', scriptName);
  } else {
    return path.join(__dirname, '../../scripts', scriptName);
  }
}

export async function getCurrentUrl(browser: 'chrome' | 'edge' | 'safari' | 'firefox'): Promise<string | null> {
  // Windows 不支持 Safari
  if (browser === 'safari') {
    logGetUrl(`[${browser}] Windows 不支持 Safari`);
    return null;
  }

  let scriptName = '';
  switch (browser) {
    case 'chrome':
      scriptName = 'getChromeUrl.ps1';
      break;
    case 'edge':
      scriptName = 'getEdgeUrl.ps1';
      break;
    case 'firefox':
      scriptName = 'getFirefoxUrl.ps1';
      break;
    default:
      logGetUrl(`[${browser}] 不支持的浏览器类型`);
      return null;
  }

  const scriptPath = getScriptPath(scriptName);
  logGetUrl(`[${browser}] 执行 PowerShell 脚本: ${scriptPath}`);
  
  // 检查脚本文件是否存在
  if (!fs.existsSync(scriptPath)) {
    logGetUrl(`[${browser}] 脚本文件不存在: ${scriptPath}`);
    return null;
  }

  return new Promise((resolve) => {
    exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (err, stdout) => {
      if (err) {
        logGetUrl(`[${browser}] 执行失败: ${err.message}`);
        return resolve(null);
      }
      const url = stdout.trim();
      logGetUrl(`[${browser}] 获取到URL: ${url}`);
      resolve(url && url.startsWith('http') ? url : null);
    });
  });
} 