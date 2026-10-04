const { contextBridge, ipcRenderer } = require('electron');

// The drawing pad talks to the Margin window through the main process
contextBridge.exposeInMainWorld('padBridge', {
  send: msg => ipcRenderer.send('pad', msg),
  on:   cb  => ipcRenderer.on('pad', (_e, msg) => cb(msg))
});
