import { Tray, Menu, BrowserWindow, App } from 'electron';
import path from 'path';
import fs from 'fs';

export function setupTray(app: App, mainWindow: BrowserWindow | null, ADMIN_PASSWORD: string, writeLog: (msg: string) => void, createWindow: () => void): Tray {
  let iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'icon.png')
    : path.join(__dirname, '../../build/icon.png');
  
  // 检查图标文件是否存在，如果不存在则使用默认图标
  if (!fs.existsSync(iconPath)) {
    writeLog(`图标文件不存在: ${iconPath}`);
    // 使用系统默认图标
    if (process.platform === 'darwin') {
      iconPath = '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns';
    } else if (process.platform === 'win32') {
      // Windows 默认图标路径
      iconPath = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'shell32.dll');
    }
    writeLog(`使用默认图标: ${iconPath}`);
  }
  
  const tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '管理员退出',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('show-admin-exit');
        }
      }
    }
    // 普通用户无退出按钮
  ]);
  tray.setToolTip('BrowserGuard');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
  return tray;
} 