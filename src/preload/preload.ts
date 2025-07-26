import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onShowWarning: (cb: (url: string) => void) => ipcRenderer.on('show-warning', (_e, url) => cb(url)),
  onShowAdminExit: (cb: () => void) => ipcRenderer.on('show-admin-exit', cb),
  adminExit: (pwd: string) => ipcRenderer.invoke('admin-exit', pwd),
  checkAdminPwd: (pwd: string) => ipcRenderer.invoke('check-admin-pwd', pwd),
  getBlocklist: () => ipcRenderer.invoke('get-blocklist'),
  // 配置管理API
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateAdminPassword: (newPassword: string) => ipcRenderer.invoke('update-admin-password', newPassword),
  updateBlocklistUrl: (newUrl: string) => ipcRenderer.invoke('update-blocklist-url', newUrl),
  updateAutoReloadInterval: (interval: number) => ipcRenderer.invoke('update-auto-reload-interval', interval),
  isFirstRun: () => ipcRenderer.invoke('is-first-run'),
  markNotFirstRun: () => ipcRenderer.invoke('mark-not-first-run'),
  resetConfig: () => ipcRenderer.invoke('reset-config')
}); 