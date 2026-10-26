const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openPath: (targetPath) => ipcRenderer.invoke('system:open-path', targetPath),
  openUrl: (targetUrl) => ipcRenderer.invoke('system:open-url', targetUrl),
  launchApp: (appName) => ipcRenderer.invoke('system:launch-app', appName),
  closeApp: (appName) => ipcRenderer.invoke('system:close-app', appName),
  whatsappPasteSend: (data) => ipcRenderer.invoke('system:whatsapp-paste-send', data),
  onHotkeyActivate: (callback) => ipcRenderer.on('zara:hotkey-activate', callback),
  onToggleMute: (callback) => ipcRenderer.on('zara:toggle-mute', callback),
});
