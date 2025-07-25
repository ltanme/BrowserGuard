import { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell, systemPreferences } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { BlockListResponse } from '../shared/types';
import { getCurrentUrl } from './getUrlMac'; // macOS，后续根据平台切换
import { killBrowserProcess } from './killProcess';
import { setupTray } from './tray';
import { DebugServer } from './debugServer';

const ADMIN_PASSWORD = 'Admin1234';
const BLOCKLIST_URL = 'https://api.example.com/blocklist';
const LOG_PATH = process.platform === 'darwin'
  ? path.join(app.getPath('home'), 'Library/Logs/BrowserGuard/renderer.log')
  : path.join(app.getPath('appData'), 'BrowserGuard/logs/renderer.log');

const defaultBlocklist: BlockListResponse = {
  periods: [
    {
      start: '00:00',
      end: '23:59',
      domains: ['baidu.com']
    }
    // 可根据需要添加更多规则
  ]
};
let blocklist: BlockListResponse = defaultBlocklist;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let debugServer: DebugServer | null = null;
let pendingQuit = false;
let lastKillTime: { [browser: string]: number } = {};

function writeLog(msg: string) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  log.info(msg);
  
  // Add log to debug server
  if (debugServer) {
    debugServer.addLog({
      timestamp: new Date(),
      level: 'info',
      message: msg,
      source: 'main-process'
    });
  }
}

async function fetchBlockList() {
  try {
    const res = await fetch(BLOCKLIST_URL);
    const newBlocklist = await res.json();
    blocklist = newBlocklist;
    writeLog('Blocklist updated');
    
    // Emit debug event for blocklist update
    if (debugServer) {
      debugServer.updateState({
        blocklist: {
          data: blocklist,
          status: {
            lastUpdated: new Date(),
            nextUpdate: new Date(Date.now() + 30000),
            updateInterval: 30000,
            isActive: true,
            currentPeriod: getCurrentActivePeriod()
          },
          error: null
        }
      });
      
      debugServer.broadcastEvent({
        type: 'blocklist-update',
        timestamp: new Date(),
        data: { 
          blocklist, 
          periodsCount: blocklist.periods.length,
          source: 'remote-api'
        }
      });
    }
  } catch (e) {
    const errorMsg = 'Blocklist fetch error: ' + e;
    writeLog(errorMsg);
    // 用默认规则
    blocklist = defaultBlocklist;
    writeLog('Blocklist fetch failed, using defaultBlocklist');
    
    // Emit debug event for blocklist error
    if (debugServer) {
      debugServer.updateState({
        blocklist: {
          ...debugServer.getState().blocklist,
          error: errorMsg
        }
      });
      
      debugServer.broadcastEvent({
        type: 'blocklist-update',
        timestamp: new Date(),
        data: { 
          error: errorMsg,
          source: 'remote-api'
        }
      });
    }
  }
}

function getCurrentActivePeriod() {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  
  for (const period of blocklist.periods) {
    if (currentTime >= period.start && currentTime <= period.end) {
      return period;
    }
  }
  return null;
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
  try {
    writeLog('--- 开始轮询浏览器状态 ---');
    const browsers: Array<'chrome' | 'edge' | 'safari' | 'firefox'> = ['chrome', 'edge', 'safari', 'firefox'];
    
    for (const browser of browsers) {
      writeLog(`[轮询] 检测浏览器: ${browser}`);
      const url = await getCurrentUrl(browser);
      const isRunning = url !== null;
      writeLog(`[轮询] ${browser} 当前URL: ${url || '未获取到/未运行'}`);
      
      // Update browser status in debug server
      if (debugServer) {
        debugServer.updateState({
          browsers: {
            ...debugServer.getState().browsers,
            [browser]: {
              browser,
              isRunning,
              currentUrl: url,
              lastChecked: new Date()
            }
          }
        });
        
        // Emit URL check event
        debugServer.broadcastEvent({
          type: 'url-check',
          timestamp: new Date(),
          data: {
            browser,
            url,
            isRunning,
            source: 'browser-polling'
          }
        });
      }
      
      if (url && isDomainBlocked(url)) {
        writeLog(`[检测] 命中拦截规则: ${url}`);
        
        // Emit blocking event
        if (debugServer) {
          debugServer.broadcastEvent({
            type: 'domain-blocked',
            timestamp: new Date(),
            data: {
              url,
              browser,
              domain: extractDomain(url),
              matchedRule: getCurrentActivePeriod(),
              action: 'warning-shown'
            }
          });
        }
        
        if (mainWindow) {
          writeLog(`[弹窗] 通知前端弹窗: ${url}`);
          mainWindow.webContents.send('show-warning', url);
        }
        
        const now = Date.now();
        if (!lastKillTime[browser] || now - lastKillTime[browser] > 30000) { // 30秒冷却
          setTimeout(() => {
            writeLog(`[KILL] 5秒后关闭浏览器进程: ${browser}`);
            killBrowserProcess(browser);
            lastKillTime[browser] = Date.now();
            
            // Emit browser kill event
            if (debugServer) {
              debugServer.broadcastEvent({
                type: 'browser-killed',
                timestamp: new Date(),
                data: {
                  browser,
                  url,
                  reason: 'blocked-domain'
                }
              });
            }
          }, 5000);
        } else {
          writeLog(`[KILL] 距离上次关闭${browser}不足30秒，跳过kill`);
        }
        break;
      } else if (url) {
        writeLog(`[检测] 未命中拦截规则: ${url}`);
      }
    }
    writeLog('--- 本轮轮询结束 ---');
  } catch (e) {
    writeLog('pollBrowsers error: ' + e);
  }
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
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
    width: 800,
    height: 600,
    show: true,
    frame: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  const rendererPath = app.isPackaged
    ? path.join(process.resourcesPath, 'renderer', 'index.html')
    : path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(rendererPath);
  mainWindow.on('close', (e) => {
    if (mainWindow) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

app.on('ready', async () => {
  try {
    writeLog('App started (from packaged app)');
    checkAccessibility();
    writeLog('After checkAccessibility');
    createWindow();
    writeLog('After createWindow');
    tray = setupTray(app, mainWindow, ADMIN_PASSWORD, writeLog, createWindow);
    writeLog('After setupTray');
    // Initialize debug server
    debugServer = new DebugServer({
      port: 3001,
      host: 'localhost',
      enabled: true
    }, writeLog);
    writeLog('After DebugServer creation');
    try {
      const debugPort = await debugServer.start();
      if (debugPort > 0) {
        writeLog(`Debug server available at http://localhost:${debugPort}`);
      }
    } catch (error) {
      writeLog(`Failed to start debug server: ${error}`);
    }
    fetchBlockList();
    writeLog('After fetchBlockList');
    setInterval(fetchBlockList, 30000);
    writeLog('After setInterval(fetchBlockList)');
    setInterval(pollBrowsers, 3000);
    writeLog('After setInterval(pollBrowsers)');
  } catch (e) {
    writeLog('app.on(ready) error: ' + e);
  }
});

app.on('window-all-closed', (e: Electron.Event) => {
  e.preventDefault(); // 禁止关闭
});

app.on('before-quit', (e) => {
  if (!pendingQuit) {
    e.preventDefault();
    if (mainWindow) {
      mainWindow.webContents.send('show-admin-exit');
    }
  }
});

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

ipcMain.handle('check-admin-pwd', async (_e, pwd) => {
  return pwd === ADMIN_PASSWORD;
});

ipcMain.handle('admin-exit', async (_e, pwd) => {
  if (pwd === ADMIN_PASSWORD) {
    writeLog('Admin exit success');
    pendingQuit = true;
    app.exit(0);
    return true;
  } else {
    writeLog('Admin exit failed');
    return false;
  }
}); 

ipcMain.handle('get-blocklist', async () => blocklist); 