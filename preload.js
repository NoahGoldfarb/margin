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
  writeBinary:  (p, bytes)    => ipcRenderer.invoke('write-binary', p, bytes),
  createFile:   (dir, name)   => ipcRenderer.invoke('create-file', dir, name),
  createFolder: (dir, name)   => ipcRenderer.invoke('create-folder', dir, name),
  renamePath:   (from, to)    => ipcRenderer.invoke('rename-path', from, to),
  deletePath:   (p, isDir)    => ipcRenderer.invoke('delete-path', p, isDir),

  // LaTeX: compile next to the .tex, and "!name" templates
  texInfo:       p    => ipcRenderer.invoke('tex-info', p),
  texCompile:    p    => ipcRenderer.invoke('tex-compile', p),
  texTemplate:   name => ipcRenderer.invoke('tex-template', name),
  texTemplates:  ()   => ipcRenderer.invoke('tex-templates'),
  openTemplates: ()   => ipcRenderer.invoke('open-templates'),

  // search
  walkDir:      root          => ipcRenderer.invoke('walk-dir', root),

  // the workspace to come back to — folder and open tabs (owned by main)
  getWorkspace:  ()      => ipcRenderer.invoke('get-workspace'),
  setWorkspace:  patch   => ipcRenderer.invoke('set-workspace', patch),
  closeWindow:   ()      => ipcRenderer.invoke('close-window'),
  // Cmd+W: close the open tab, or the window when none are left
  onCloseRequest: cb => ipcRenderer.on('close-request', () => cb()),

  // lecture audio
  audioPath:    p                  => ipcRenderer.invoke('audio-path', p),
  saveAudio:    (p, bytes, ext)    => ipcRenderer.invoke('save-audio', p, bytes, ext),
  readAudio:    p                  => ipcRenderer.invoke('read-audio', p)
});
