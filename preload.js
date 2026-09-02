const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('margin', {
  openPdf:   ()          => ipcRenderer.invoke('open-pdf'),
  readPdf:   p           => ipcRenderer.invoke('read-pdf', p),
  argPath:   ()          => ipcRenderer.invoke('arg-path'),
  loadNotes: p           => ipcRenderer.invoke('load-notes', p),
  saveNotes: (p, data)   => ipcRenderer.invoke('save-notes', p, data),
  // real filesystem path for a dropped file, so notes land in the sidecar
  pathFor:   file => { try { return webUtils.getPathForFile(file); } catch { return null; } }
});
