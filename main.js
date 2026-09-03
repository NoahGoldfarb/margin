const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');

// Notes live next to the PDF: lecture.pdf -> lecture.margin.json
const sidecar = p => p.replace(/\.pdf$/i, '') + '.margin.json';

// A path passed on the command line ("open with Margin")
const cliPath = process.argv.slice(1).find(a => /\.pdf$/i.test(a)) || null;

/* ------------------------------------------------------------------------ *
 *  Which folder to come back to, VS Code style: quitting keeps the
 *  workspace, closing the window ends it. Only the main process can tell
 *  those apart, so it owns the state rather than the page.
 * ------------------------------------------------------------------------ */
let workspace = { folder: null, tabs: [], active: null };
let isQuitting = false;
const statePath = () => path.join(app.getPath('userData'), 'window-state.json');

async function loadWindowState() {
  try {
    const saved = JSON.parse(await fs.readFile(statePath(), 'utf8'));
    workspace = {
      folder: saved.folder || null,
      tabs: Array.isArray(saved.tabs) ? saved.tabs : [],
      active: saved.active || null
    };
  } catch { workspace = { folder: null, tabs: [], active: null }; }
}
// written synchronously: this is called from window 'close', where the app may
// be on its way out and an awaited write could lose the race
function saveWindowState() {
  try { require('fs').writeFileSync(statePath(), JSON.stringify(workspace)); }
  catch { /* a lost workspace memory is not worth bothering anyone about */ }
}

function buildMenu() {
  // Without a menu macOS has nothing to drive Cmd+Q or Cmd+W at all. Only the
  // standard roles, so none of the app's own keys are shadowed.
  const mac = process.platform === 'darwin';
  const template = [
    ...(mac ? [{ role: 'appMenu' }] : [{
      label: 'File',
      submenu: [{ role: 'close' }, { role: 'quit' }]
    }]),
    { role: 'editMenu' },
    {
      // built by hand: the windowMenu role has no Close item, and Cmd+W has to
      // close the open tab first, the way every editor and browser does
      label: 'Window',
      submenu: [
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: (item, win) => {
            if (win) win.webContents.send('close-request');
            else if (!mac) app.quit();
          }
        },
        { role: 'close', label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W' },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'zoom' },
        ...(mac ? [{ type: 'separator' }, { role: 'front' }] : [])
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 940,
    backgroundColor: '#151A22',
    title: 'Margin',
    autoHideMenuBar: true, // keeps the chrome-free look off macOS
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.on('close', () => {
    if (isQuitting) return;
    // where closing the last window quits the app, that close *is* the quit
    if (process.platform !== 'darwin' && BrowserWindow.getAllWindows().length <= 1) return;
    workspace = { folder: null, tabs: [], active: null };
    saveWindowState();
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.on('before-quit', () => { isQuitting = true; });

app.whenReady().then(async () => {
  await loadWindowState();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-workspace', () => workspace);
ipcMain.handle('set-workspace', (_e, patch) => {
  workspace = { ...workspace, ...patch };
  saveWindowState();
  return true;
});
ipcMain.handle('close-window', e => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.close();
  return true;
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

// ---- lecture audio: lecture.pdf -> lecture.margin.webm, alongside the notes ----

const AUDIO_EXTS = ['webm', 'ogg', 'm4a', 'mp3', 'wav'];
const audioBase = p => p.replace(/\.pdf$/i, '') + '.margin.';

ipcMain.handle('audio-path', async (_e, p) => {
  for (const ext of AUDIO_EXTS) {
    const target = audioBase(p) + ext;
    try { await fs.access(target); return target; } catch { }
  }
  return null;
});

ipcMain.handle('save-audio', async (_e, p, bytes, ext) => {
  const target = audioBase(p) + (AUDIO_EXTS.includes(ext) ? ext : 'webm');
  await fs.writeFile(target + '.tmp', Buffer.from(bytes));
  await fs.rename(target + '.tmp', target);
  return target;
});

ipcMain.handle('read-audio', async (_e, p) => {
  try { return new Uint8Array(await fs.readFile(p)); } catch { return null; }
});

// ---- folder / file-tree (the "open a vault" side of the app) ----

ipcMain.handle('open-folder', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

// Margin's own storage for a PDF (notes sidecar, lecture recording) sits next
// to it on disk on purpose, but it is not a document — keep it out of the tree.
const isSidecar = name => /\.margin\.(json|webm|ogg|m4a|mp3|wav)$/i.test(name);

// null (not []) when the directory is gone or unreadable, so the caller can
// tell "empty folder" apart from "that folder isn't there any more"
ipcMain.handle('read-dir', async (_e, dir) => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => !e.name.startsWith('.') && !isSidecar(e.name))
      .map(e => ({ name: e.name, path: path.join(dir, e.name), isDir: e.isDirectory() }))
      .sort((a, b) => a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name));
  } catch { return null; }
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

// Prefer the system Trash so a mistaken delete is recoverable; fall back to a
// real delete only where there is no trash implementation.
async function discard(target, { mustExist = true } = {}) {
  try { await fs.access(target); }
  catch { if (mustExist) throw new Error('not found'); return; }
  try { await shell.trashItem(target); }
  catch { await fs.rm(target, { recursive: true, force: true }); }
}

ipcMain.handle('delete-path', async (_e, p, isDir) => {
  try {
    await discard(p);
    // a PDF's notes and recording are hidden from the tree, so they would be
    // invisible litter if left behind — they go with the document
    if (!isDir && /\.pdf$/i.test(p)) {
      await discard(sidecar(p), { mustExist: false });
      for (const ext of AUDIO_EXTS) await discard(audioBase(p) + ext, { mustExist: false });
    }
    return true;
  } catch { return false; }
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
