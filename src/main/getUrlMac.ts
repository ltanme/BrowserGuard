import { exec } from 'child_process';
import fs from 'fs';

function logGetUrl(msg: string) {
  fs.appendFileSync(
    require('os').homedir() + '/Library/Logs/BrowserGuard/renderer.log',
    `[getUrlMac] [${new Date().toISOString()}] ${msg}\n`
  );
}

function isBrowserRunning(browser: 'chrome' | 'edge' | 'safari' | 'firefox'): boolean {
  try {
    let processName = '';
    switch (browser) {
      case 'chrome': processName = 'Google Chrome'; break;
      case 'edge': processName = 'Microsoft Edge'; break;
      case 'safari': processName = 'Safari'; break;
      case 'firefox': processName = 'Firefox'; break;
    }
    require('child_process').execSync(`pgrep -x "${processName}"`);
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentUrl(browser: 'chrome' | 'edge' | 'safari' | 'firefox'): Promise<string | null> {
  if (!isBrowserRunning(browser)) {
    logGetUrl(`[${browser}] 未运行，跳过 AppleScript`);
    return null;
  }
  let script = '';
  switch (browser) {
    case 'chrome':
      script = 'tell application "Google Chrome" to return URL of active tab of front window';
      break;
    case 'edge':
      script = 'tell application "Microsoft Edge" to return URL of active tab of front window';
      break;
    case 'safari':
      script = 'tell application "Safari" to return URL of front document';
      break;
    case 'firefox':
      script = 'tell application "Firefox" to return URL of active tab of front window';
      break;
    default:
      logGetUrl(`[${browser}] 不支持的浏览器类型`);
      return null;
  }
  logGetUrl(`[${browser}] 执行 AppleScript: ${script}`);
  return new Promise((resolve) => {
    exec(`osascript -e '${script}'`, (err, stdout) => {
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