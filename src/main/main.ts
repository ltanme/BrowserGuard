import { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell, systemPreferences } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { BlockListResponse } from '../shared/types';
import { killBrowserProcess } from './killProcess';
import { setupTray } from './tray';
import { DebugServer } from './debugServer';
import { ConfigManager } from './config';

// 检查是否在安装/卸载模式下运行
const isInstallerMode = process.argv.some(arg => 
  arg.includes('--install') || 
  arg.includes('--uninstall') || 
  arg.includes('--update') ||
  process.env.ELECTRON_IS_DEV === 'true'
);

// 单实例检查 - 在安装/卸载模式下跳过
if (!isInstallerMode) {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    console.log('另一个实例正在运行，退出当前实例');
    // 使用更温和的退出方式
    app.quit();
    // 延迟退出，给进程一些时间清理
    setTimeout(() => {
      process.exit(0);
    }, 100);
  } else {
    // 确保在应用退出时释放锁
    app.on('before-quit', () => {
      // 这里可以添加清理逻辑
    });
  }
} else {
  console.log('安装/卸载模式，跳过单实例检查');
}

// 根据平台导入正确的 URL 获取函数
let getCurrentUrl: (browser: 'chrome' | 'edge' | 'safari' | 'firefox') => Promise<string | null>;
if (process.platform === 'darwin') {
  const { getCurrentUrl: getCurrentUrlMac } = require('./getUrlMac');
  getCurrentUrl = getCurrentUrlMac;
} else if (process.platform === 'win32') {
  const { getCurrentUrl: getCurrentUrlWin } = require('./getUrlWin');
  getCurrentUrl = getCurrentUrlWin;
} else {
  // Linux 或其他平台，暂时返回 null
  getCurrentUrl = async () => null;
}

// 配置管理器
const configManager = new ConfigManager();
const LOG_PATH = process.platform === 'darwin'
  ? path.join(app.getPath('home'), 'Library/Logs/BrowserGuard/renderer.log')
  : path.join(app.getPath('appData'), 'BrowserGuard', 'logs', 'renderer.log');

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

// 设置 second-instance 事件监听器
app.on('second-instance', (event, commandLine, workingDirectory) => {
  writeLog('检测到另一个实例启动，激活当前窗口');
  // 如果主窗口存在，显示它
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

async function fetchBlockList() {
  try {
    const blocklistUrl = configManager.getBlocklistUrl();
    const res = await fetch(blocklistUrl);
    const newBlocklist = await res.json();
    blocklist = newBlocklist;
    configManager.updateLastReloadTime();
    writeLog('Blocklist updated');
    // 主动推送到前端
    if (mainWindow) {
      mainWindow.webContents.send('blocklist-updated', blocklist);
    }
    
    // Emit debug event for blocklist update
    if (debugServer) {
      debugServer.updateState({
        blocklist: {
          data: blocklist,
          status: {
            lastUpdated: new Date(),
            nextUpdate: new Date(Date.now() + configManager.getAutoReloadInterval() * 1000),
            updateInterval: configManager.getAutoReloadInterval() * 1000,
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
    if (configManager.getDebug()) {
      writeLog('--- 开始轮询浏览器状态 ---');
    }
    // 根据平台选择要检测的浏览器
    const browsers: Array<'chrome' | 'edge' | 'safari' | 'firefox'> = 
      process.platform === 'darwin' 
        ? ['chrome', 'edge', 'safari', 'firefox']  // macOS 支持所有浏览器
        : ['chrome', 'edge', 'firefox'];           // Windows 不支持 Safari
    
    for (const browser of browsers) {
      if (configManager.getDebug()) {
        writeLog(`[轮询] 检测浏览器: ${browser}`);
      }
      const url = await getCurrentUrl(browser);
      const isRunning = url !== null;
      if (configManager.getDebug()) {
        writeLog(`[轮询] ${browser} 当前URL: ${url ?? '未获取到/未运行'}`);
      }
      
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
    if (configManager.getDebug()) {
      writeLog('--- 本轮轮询结束 ---');
    }
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
    
    // 设置托盘，如果失败则继续
    try {
      tray = setupTray(app, mainWindow, configManager.getConfig().adminPassword, writeLog, createWindow);
      writeLog('After setupTray');
    } catch (trayError) {
      writeLog(`Tray setup failed: ${trayError}, continuing without tray`);
    }
    
    // Initialize debug server
    try {
      debugServer = new DebugServer({
        port: 3001,
        host: 'localhost',
        enabled: true
      }, writeLog);
      writeLog('After DebugServer creation');
      
      const debugPort = await debugServer.start();
      if (debugPort > 0) {
        writeLog(`Debug server available at http://localhost:${debugPort}`);
      }
    } catch (error) {
      writeLog(`Failed to start debug server: ${error}, continuing without debug server`);
    }
    
    // 启动核心功能
    fetchBlockList();
    writeLog('After fetchBlockList');
    const reloadInterval = configManager.getAutoReloadInterval() * 1000;
    setInterval(fetchBlockList, reloadInterval);
    writeLog(`After setInterval(fetchBlockList) - ${reloadInterval}ms`);
    setInterval(pollBrowsers, 3000);
    writeLog('After setInterval(pollBrowsers)');
    
    writeLog('App initialization completed successfully');
  } catch (e) {
    writeLog('app.on(ready) error: ' + e);
  }
});

// 添加更好的进程清理
app.on('before-quit', (e) => {
  if (!pendingQuit) {
    e.preventDefault();
    if (mainWindow) {
      mainWindow.webContents.send('show-admin-exit');
    }
  }
});

// 确保进程完全退出
app.on('will-quit', () => {
  writeLog('Application will quit, cleaning up...');
  // 清理定时器 - 使用更安全的方式
  try {
    // 这里可以添加其他清理逻辑
    writeLog('Cleanup completed');
  } catch (error) {
    writeLog(`Cleanup error: ${error}`);
  }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  writeLog(`Uncaught Exception: ${error.message}`);
  writeLog(`Stack: ${error.stack}`);
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  writeLog(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  app.quit();
});

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

ipcMain.handle('check-admin-pwd', async (_e, pwd) => {
  return configManager.validateAdminPassword(pwd);
});

ipcMain.handle('admin-exit', async (_e, pwd) => {
  if (configManager.validateAdminPassword(pwd)) {
    writeLog('Admin exit success');
    pendingQuit = true;
    app.exit(0);
    return true;
  } else {
    writeLog('Admin exit failed');
    return false;
  }
});

// 配置管理相关的IPC处理器
ipcMain.handle('get-config', async () => {
  return configManager.getConfig();
});

ipcMain.handle('update-admin-password', async (_e, newPassword: string) => {
  configManager.updateAdminPassword(newPassword);
  writeLog('Admin password updated');
  return true;
});

ipcMain.handle('update-blocklist-url', async (_e, newUrl: string) => {
  configManager.updateBlocklistUrl(newUrl);
  writeLog(`Blocklist URL updated to: ${newUrl}`);
  return true;
});

ipcMain.handle('update-auto-reload-interval', async (_e, interval: number) => {
  configManager.updateAutoReloadInterval(interval);
  writeLog(`Auto reload interval updated to: ${interval}s`);
  return true;
});

ipcMain.handle('is-first-run', async () => {
  return configManager.isFirstRun();
});

ipcMain.handle('mark-not-first-run', async () => {
  configManager.markAsNotFirstRun();
  writeLog('Marked as not first run');
  return true;
});

ipcMain.handle('reset-config', async () => {
  configManager.resetToDefault();
  writeLog('Config reset to default');
  return true;
}); 

ipcMain.handle('get-blocklist', async () => blocklist); 
ipcMain.handle('get-debug', async () => configManager.getDebug());
ipcMain.handle('update-debug', async (_e, debug: boolean) => {
  configManager.updateDebug(debug);
  writeLog(`Debug模式已${debug ? '开启' : '关闭'}`);
  return true;
}); 