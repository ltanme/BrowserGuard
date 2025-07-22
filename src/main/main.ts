import { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell, systemPreferences } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { BlockListResponse } from '../shared/types';
import { getCurrentUrl } from './getUrlMac'; // macOS，后续根据平台切换
import { killBrowserProcess } from './killProcess';
import { setupTray } from './tray';

const ADMIN_PASSWORD = 'Admin1234';
const BLOCKLIST_URL = 'https://api.example.com/blocklist';
const LOG_PATH = process.platform === 'darwin'
  ? path.join(app.getPath('home'), 'Library/Logs/BrowserGuard/renderer.log')
  : path.join(app.getPath('appData'), 'BrowserGuard/logs/renderer.log');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let blocklist: BlockListResponse = { periods: [] };

function writeLog(msg: string) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  log.info(msg);
}

async function fetchBlockList() {
  try {
    const res = await fetch(BLOCKLIST_URL);
    blocklist = await res.json();
    writeLog('Blocklist updated');
  } catch (e) {
    writeLog('Blocklist fetch error: ' + e);
  }
}

function isDomainBlocked(url: string): boolean {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const cur = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  for (const period of blocklist.periods) {
    if (cur >= period.start && cur <= period.end) {
      if (period.domains.some(domain => url.includes(domain))) return true;
    }
  }
  return false;
}

async function pollBrowsers() {
  const browsers: Array<'chrome' | 'edge' | 'safari'> = ['chrome', 'edge', 'safari'];
  for (const browser of browsers) {
    const url = await getCurrentUrl(browser);
    if (url && isDomainBlocked(url)) {
      writeLog(`Blocked domain detected: ${url}`);
      if (mainWindow) {
        mainWindow.webContents.send('show-warning', url);
      }
      setTimeout(() => killBrowserProcess(browser), 5000);
      break;
    }
  }
}

function checkAccessibility() {
  if (process.platform === 'darwin') {
    const trusted = systemPreferences.isTrustedAccessibilityClient(true);
    if (!trusted) {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
      writeLog('Accessibility permission required');
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 220,
    show: false,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.on('ready', () => {
  checkAccessibility();
  createWindow();
  tray = setupTray(app, mainWindow, ADMIN_PASSWORD, writeLog);
  fetchBlockList();
  setInterval(fetchBlockList, 30000);
  setInterval(pollBrowsers, 3000);
});

app.on('window-all-closed', (e: Electron.Event) => {
  e.preventDefault(); // 禁止关闭
});

ipcMain.handle('admin-exit', async (_e, pwd) => {
  if (pwd === ADMIN_PASSWORD) {
    writeLog('Admin exit success');
    app.exit(0);
    return true;
  } else {
    writeLog('Admin exit failed');
    return false;
  }
}); 