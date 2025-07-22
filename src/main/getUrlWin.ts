import { exec } from 'child_process';
import path from 'path';

export async function getCurrentUrl(browser: 'chrome' | 'edge'): Promise<string | null> {
  let script = '';
  switch (browser) {
    case 'chrome':
      script = path.join(__dirname, '../../scripts/getChromeUrl.ps1');
      break;
    case 'edge':
      script = path.join(__dirname, '../../scripts/getEdgeUrl.ps1');
      break;
    default:
      return null;
  }
  return new Promise((resolve) => {
    exec(`powershell -ExecutionPolicy Bypass -File \"${script}\"`, (err, stdout) => {
      if (err) return resolve(null);
      const url = stdout.trim();
      resolve(url && url.startsWith('http') ? url : null);
    });
  });
} 