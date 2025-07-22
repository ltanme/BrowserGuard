import { exec } from 'child_process';

export async function getCurrentUrl(browser: 'chrome' | 'edge' | 'safari'): Promise<string | null> {
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
    default:
      return null;
  }
  return new Promise((resolve) => {
    exec(`osascript -e '${script}'`, (err, stdout) => {
      if (err) return resolve(null);
      const url = stdout.trim();
      resolve(url && url.startsWith('http') ? url : null);
    });
  });
} 