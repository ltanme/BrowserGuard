import { Tray, Menu, BrowserWindow, App } from 'electron';
import path from 'path';

export function setupTray(app: App, mainWindow: BrowserWindow | null, ADMIN_PASSWORD: string, writeLog: (msg: string) => void): Tray {
  const tray = new Tray(path.join(__dirname, '../../build/icon.png'));
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
  return tray;
} 