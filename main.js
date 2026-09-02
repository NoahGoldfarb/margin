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

// ---- folder / file-tree (the "open a vault" side of the app) ----

ipcMain.handle('open-folder', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle('read-dir', async (_e, dir) => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => !e.name.startsWith('.'))
      .map(e => ({ name: e.name, path: path.join(dir, e.name), isDir: e.isDirectory() }))
      .sort((a, b) => a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name));
  } catch { return []; }
});

ipcMain.handle('read-text', async (_e, p) => {
  try { return await fs.readFile(p, 'utf8'); } catch { return null; }
});

ipcMain.handle('write-text', async (_e, p, content) => {
  await fs.writeFile(p + '.tmp', content, 'utf8');
  await fs.rename(p + '.tmp', p);
  return true;
});

ipcMain.handle('create-file', async (_e, dir, name) => {
  const target = path.join(dir, name);
  try { await fs.writeFile(target, '', { flag: 'wx' }); return target; }
  catch { return null; }
});

ipcMain.handle('create-folder', async (_e, dir, name) => {
  const target = path.join(dir, name);
  try { await fs.mkdir(target); return target; }
  catch { return null; }
});

ipcMain.handle('rename-path', async (_e, from, to) => {
  try { await fs.rename(from, to); return true; }
  catch { return false; }
});

ipcMain.handle('delete-path', async (_e, p, isDir) => {
  try { await fs.rm(p, { recursive: !!isDir }); return true; }
  catch { return false; }
});

// ---- search — recursively list every pdf/md/markdown/txt under a folder ----

const SEARCHABLE_EXT = new Set(['pdf', 'md', 'markdown', 'txt']);
const WALK_MAX_FILES = 4000;

ipcMain.handle('walk-dir', async (_e, root) => {
  const out = [];
  async function walk(dir) {
    if (out.length >= WALK_MAX_FILES) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (out.length >= WALK_MAX_FILES) return;
      if (e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else {
        const ext = path.extname(e.name).slice(1).toLowerCase();
        if (!SEARCHABLE_EXT.has(ext)) continue;
        const st = await fs.stat(p).catch(() => null);
        out.push({ path: p, name: e.name, ext, mtimeMs: st ? st.mtimeMs : 0 });
      }
    }
  }
  await walk(root);
  return out;
});
