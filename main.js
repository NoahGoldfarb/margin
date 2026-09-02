const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');

// Notes live next to the PDF: lecture.pdf -> lecture.margin.json
const sidecar = p => p.replace(/\.pdf$/i, '') + '.margin.json';

// A path passed on the command line ("open with Margin")
const cliPath = process.argv.slice(1).find(a => /\.pdf$/i.test(a)) || null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 940,
    backgroundColor: '#151A22',
    title: 'Margin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  Menu.setApplicationMenu(null); // the app is keyboard-driven; no menu chrome
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

async function readPdf(p) {
  const buf = await fs.readFile(p);
  return { path: p, name: path.basename(p), bytes: new Uint8Array(buf) };
}

ipcMain.handle('open-pdf', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return readPdf(res.filePaths[0]);
});

ipcMain.handle('read-pdf', async (_e, p) => {
  try { return await readPdf(p); } catch { return null; }
});

ipcMain.handle('arg-path', () => cliPath);

ipcMain.handle('load-notes', async (_e, p) => {
  try { return JSON.parse(await fs.readFile(sidecar(p), 'utf8')); }
  catch { return null; }
});

ipcMain.handle('save-notes', async (_e, p, data) => {
  const target = sidecar(p);
  // write to a temp file first so a crash mid-lecture can't truncate the notes
  await fs.writeFile(target + '.tmp', JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(target + '.tmp', target);
  return true;
});
