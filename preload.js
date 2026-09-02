const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('margin', {
  openPdf:   ()          => ipcRenderer.invoke('open-pdf'),
  readPdf:   p           => ipcRenderer.invoke('read-pdf', p),
  argPath:   ()          => ipcRenderer.invoke('arg-path'),
  loadNotes: p           => ipcRenderer.invoke('load-notes', p),
  saveNotes: (p, data)   => ipcRenderer.invoke('save-notes', p, data),
  // real filesystem path for a dropped file, so notes land in the sidecar
  pathFor:   file => { try { return webUtils.getPathForFile(file); } catch { return null; } },

  // folder / file-tree
  openFolder:   ()            => ipcRenderer.invoke('open-folder'),
  readDir:      dir           => ipcRenderer.invoke('read-dir', dir),
  readText:     p             => ipcRenderer.invoke('read-text', p),
  writeText:    (p, content)  => ipcRenderer.invoke('write-text', p, content),
  createFile:   (dir, name)   => ipcRenderer.invoke('create-file', dir, name),
  createFolder: (dir, name)   => ipcRenderer.invoke('create-folder', dir, name),
  renamePath:   (from, to)    => ipcRenderer.invoke('rename-path', from, to),
  deletePath:   (p, isDir)    => ipcRenderer.invoke('delete-path', p, isDir),

  // search
  walkDir:      root          => ipcRenderer.invoke('walk-dir', root),

  // lecture audio
  audioPath:    p                  => ipcRenderer.invoke('audio-path', p),
  saveAudio:    (p, bytes, ext)    => ipcRenderer.invoke('save-audio', p, bytes, ext),
  readAudio:    p                  => ipcRenderer.invoke('read-audio', p)
});
