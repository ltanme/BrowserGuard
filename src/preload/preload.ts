import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onShowWarning: (cb: (url: string) => void) => ipcRenderer.on('show-warning', (_e, url) => cb(url)),
  onShowAdminExit: (cb: () => void) => ipcRenderer.on('show-admin-exit', cb),
  adminExit: (pwd: string) => ipcRenderer.invoke('admin-exit', pwd),
  checkAdminPwd: (pwd: string) => ipcRenderer.invoke('check-admin-pwd', pwd),
  getBlocklist: () => ipcRenderer.invoke('get-blocklist')
}); 