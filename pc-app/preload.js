const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dawgerUpdater', {
  startUpdate: (url) => ipcRenderer.invoke('dawger:start-update', url),
  installUpdate: () => ipcRenderer.invoke('dawger:install-update'),
});

contextBridge.exposeInMainWorld('dawgerDisplay', {
  getMode: () => ipcRenderer.invoke('dawger:get-display-mode'),
  setMode: (mode) => ipcRenderer.invoke('dawger:set-display-mode', mode),
});

contextBridge.exposeInMainWorld('dawgerWatchState', {
  read: () => ipcRenderer.invoke('dawger:watch-state-read'),
  write: (data) => ipcRenderer.invoke('dawger:watch-state-write', data),
});
