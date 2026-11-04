const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dawgerUpdater', {
  startUpdate: (url) => ipcRenderer.invoke('dawger:start-update', url),
  installUpdate: () => ipcRenderer.invoke('dawger:install-update'),
});
