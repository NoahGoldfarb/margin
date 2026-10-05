const { app, BrowserWindow, ipcMain, dialog, Menu, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { execFile, spawn } = require('child_process');
const { pathToFileURL, fileURLToPath } = require('url');

// Notes live next to the PDF: lecture.pdf -> lecture.margin.json
const sidecar = p => p.replace(/\.pdf$/i, '') + '.margin.json';

// A path passed on the command line ("open with Margin")
const cliPath = process.argv.slice(1).find(a => /\.pdf$/i.test(a)) || null;

/* ------------------------------------------------------------------------ *
 *  Which folder to come back to, VS Code style: quitting keeps the
 *  workspace, closing the window ends it. Only the main process can tell
 *  those apart, so it owns the state rather than the page.
 * ------------------------------------------------------------------------ */
let workspace = { folder: null, tabs: [], active: null, expanded: [] };
let isQuitting = false;
const statePath = () => path.join(app.getPath('userData'), 'window-state.json');

async function loadWindowState() {
  try {
    const saved = JSON.parse(await fs.readFile(statePath(), 'utf8'));
    workspace = {
      folder: saved.folder || null,
      tabs: Array.isArray(saved.tabs) ? saved.tabs : [],
      active: saved.active || null,
      expanded: Array.isArray(saved.expanded) ? saved.expanded : []
    };
  } catch { workspace = { folder: null, tabs: [], active: null, expanded: [] }; }
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
    workspace = { folder: null, tabs: [], active: null, expanded: [] };
    saveWindowState();
  });
  // the pad belongs to a Margin window; it goes when the last one does
  win.on('closed', () => {
    if (!BrowserWindow.getAllWindows().some(w => w !== padWin)) closePad();
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.on('before-quit', () => { isQuitting = true; });

app.whenReady().then(async () => {
  await loadWindowState();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().some(w => w !== padWin)) createWindow();
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
// Same for pictures pasted into notes (lecture.assets/) and LaTeX's build files.
const isSidecar = name => /\.margin\.(json|webm|ogg|m4a|mp3|wav)$/i.test(name);
const isBuildFile = name =>
  /\.(aux|log|fls|fdb_latexmk|synctex\.gz|synctex|synctex\(busy\)|out|toc|lof|lot|bbl|blg|bcf|run\.xml|nav|snm|vrb|xdv|thm|pdf_tex)$/i.test(name);
const isHidden = e => e.name.startsWith('.') || isSidecar(e.name) || isBuildFile(e.name) ||
  (e.isDirectory() && /\.assets$/i.test(e.name));

// null (not []) when the directory is gone or unreadable, so the caller can
// tell "empty folder" apart from "that folder isn't there any more"
ipcMain.handle('read-dir', async (_e, dir) => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    // a figure's .pdf is Inkscape's export of its .svg, not a document
    const names = new Set(entries.map(e => e.name));
    const isExport = e => /\.pdf$/i.test(e.name) && names.has(e.name.slice(0, -4) + '.svg') && names.has(e.name + '_tex');
    return entries
      .filter(e => !isHidden(e) && !isExport(e))
      .map(e => ({ name: e.name, path: path.join(dir, e.name), isDir: e.isDirectory() }))
      // numeric so lecture2 sorts before lecture10, which is the whole point
      // of numbering your lectures
      .sort((a, b) => a.isDir !== b.isDir ? (a.isDir ? -1 : 1)
        : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
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

// pictures pasted into notes (GeoGebra snapshots) — into a folder that may not exist yet
ipcMain.handle('write-binary', async (_e, p, bytes) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p + '.tmp', Buffer.from(bytes));
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

// Used for both the rename UI and drag-to-move in the sidebar — either way,
// landing on an existing name should refuse, not silently overwrite it.
ipcMain.handle('rename-path', async (_e, from, to) => {
  if (from === to) return true;
  const collides = await fs.access(to).then(() => true).catch(() => false);
  if (collides) return false;
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

const SEARCHABLE_EXT = new Set(['pdf', 'md', 'markdown', 'txt', 'tex']);
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
      if (isHidden(e)) continue;
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

// ---- LaTeX: compile with latexmk, the PDF lands next to the .tex ----

// An app started from the Dock gets a bare PATH; TeX Live and Homebrew live here
const TEX_PATH = ['/Library/TeX/texbin', '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH].join(':');

// Which file actually gets compiled. A "% !TEX root = master.tex" comment wins;
// otherwise a file without \documentclass is a chapter, and its root is the
// .tex next to it that \input's or \include's it (lec_03.tex -> master.tex).
async function texRoot(p) {
  let text = '';
  try { text = await fs.readFile(p, 'utf8'); } catch { return p; }
  const magic = /^\s*%\s*!TEX\s+root\s*=\s*(.+?)\s*$/im.exec(text);
  if (magic) return path.resolve(path.dirname(p), magic[1]);
  if (/\\documentclass/.test(text)) return p;
  const stem = path.basename(p, '.tex');
  const dir = path.dirname(p);
  let names = [];
  try { names = (await fs.readdir(dir)).filter(n => n.endsWith('.tex') && n !== path.basename(p)); } catch { }
  for (const name of names) {
    const other = await fs.readFile(path.join(dir, name), 'utf8').catch(() => '');
    const uses = new RegExp(`\\\\(input|include)\\{(\\./)?${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.tex)?\\}`);
    if (/\\documentclass/.test(other) && uses.test(other)) return path.join(dir, name);
  }
  return p;
}

ipcMain.handle('tex-info', async (_e, p) => {
  const root = await texRoot(p);
  const pdf = root.replace(/\.tex$/i, '') + '.pdf';
  const st = await fs.stat(pdf).catch(() => null);
  return { root, pdf, mtime: st ? st.mtimeMs : 0 };
});

ipcMain.handle('tex-compile', async (_e, p) => {
  const root = await texRoot(p);
  const dir = path.dirname(root), file = path.basename(root);
  const pdf = root.replace(/\.tex$/i, '') + '.pdf';
  const head = (await fs.readFile(root, 'utf8').catch(() => '')).slice(0, 2000);
  const program = (/^\s*%\s*!TEX\s+(?:TS-)?program\s*=\s*(\w+)/im.exec(head) || [])[1] || '';
  const engine = /^xelatex$/i.test(program) ? '-xelatex' : /^lualatex$/i.test(program) ? '-lualatex' : '-pdf';
  const started = Date.now();
  const result = await new Promise(resolve => {
    execFile('latexmk', [engine, '-interaction=nonstopmode', '-file-line-error', '-synctex=1', file],
      { cwd: dir, env: { ...process.env, PATH: TEX_PATH }, timeout: 90000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => resolve({ err, stdout, stderr }));
  });
  if (result.err && result.err.code === 'ENOENT')
    return { ok: false, root, pdf, missing: true, errors: [{ line: 0, message: 'latexmk not found — install MacTeX (tug.org/mactex)' }] };
  // file:line: message, as -file-line-error writes them
  const log = await fs.readFile(root.replace(/\.tex$/i, '') + '.log', 'utf8').catch(() => '');
  const errors = [];
  for (const m of log.matchAll(/^(.*?\.tex):(\d+): (.*)$/gm)) {
    const file = path.resolve(dir, m[1]);
    if (!errors.some(e => e.file === file && e.line === +m[2])) errors.push({ file, line: +m[2], message: m[3] });
    if (errors.length >= 8) break;
  }
  if (result.err && !errors.length) {
    const fatal = /^! (.*)$/m.exec(log);
    errors.push({ line: 0, message: fatal ? fatal[1] : (result.err.killed ? 'Compilation timed out' : 'Compilation failed') });
  }
  const st = await fs.stat(pdf).catch(() => null);
  return { ok: !result.err && !errors.length, root, pdf, mtime: st ? st.mtimeMs : 0, errors, ms: Date.now() - started };
});

// ---- LaTeX templates: "!name" + Tab in a .tex file inserts templates/name.tex ----

const templatesDir = () => path.join(app.getPath('userData'), 'templates');

// first use: start the user's folder with the templates that ship with Margin
async function ensureTemplates() {
  const dir = templatesDir();
  try { await fs.access(dir); return dir; } catch { }
  await fs.mkdir(dir, { recursive: true });
  const bundled = path.join(__dirname, 'templates');
  for (const name of await fs.readdir(bundled).catch(() => []))
    await fs.copyFile(path.join(bundled, name), path.join(dir, name));
  return dir;
}

ipcMain.handle('tex-template', async (_e, name) => {
  if (!/^[\w-]+$/.test(name)) return null;
  const dir = await ensureTemplates();
  return fs.readFile(path.join(dir, name + '.tex'), 'utf8').catch(() => null);
});

ipcMain.handle('tex-templates', async () => {
  const dir = await ensureTemplates();
  const names = (await fs.readdir(dir).catch(() => [])).filter(n => n.endsWith('.tex'));
  return { dir, names: names.map(n => n.slice(0, -4)).sort() };
});

ipcMain.handle('open-templates', async () => shell.openPath(await ensureTemplates()));

// ---- LaTeX language server: TexLab, spoken to over stdio (LSP) ----
// Completion, diagnostics and go-to-definition for .tex files. Started the
// first time a .tex file opens; restarted on the next request if it dies.

function texlabBinary() {
  // a binary can't run from inside app.asar, so the build unpacks it beside it
  const bundled = path.join(__dirname, 'vendor', 'texlab', 'texlab').replace('app.asar', 'app.asar.unpacked');
  return require('fs').existsSync(bundled) ? bundled : 'texlab'; // else PATH (brew install texlab)
}

let lsp = null;

function startLsp(root) {
  const proc = spawn(texlabBinary(), [], { env: { ...process.env, PATH: TEX_PATH } });
  const server = { proc, seq: 0, pending: new Map(), docs: new Map(), buf: Buffer.alloc(0), dead: false };
  const send = msg => {
    if (server.dead) return;
    const body = JSON.stringify({ jsonrpc: '2.0', ...msg });
    proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  };
  server.notify = (method, params) => send({ method, params });
  server.request = (method, params) => new Promise(resolve => {
    if (server.dead) return resolve(null);
    const id = ++server.seq;
    server.pending.set(id, resolve);
    send({ id, method, params });
  });
  proc.stdout.on('data', chunk => {
    server.buf = Buffer.concat([server.buf, chunk]);
    for (;;) {
      const head = server.buf.indexOf('\r\n\r\n');
      if (head < 0) return;
      const length = +(/Content-Length: (\d+)/i.exec(server.buf.slice(0, head).toString()) || [])[1];
      if (server.buf.length < head + 4 + length) return;
      const msg = JSON.parse(server.buf.slice(head + 4, head + 4 + length).toString());
      server.buf = server.buf.slice(head + 4 + length);
      if (msg.id != null && !msg.method) {           // an answer to us
        const done = server.pending.get(msg.id);
        server.pending.delete(msg.id);
        if (done) done(msg.result ?? null);
      } else if (msg.method === 'textDocument/publishDiagnostics') {
        let file; try { file = fileURLToPath(msg.params.uri); } catch { continue; }
        const diagnostics = msg.params.diagnostics.map(d => ({
          line: d.range.start.line, character: d.range.start.character, severity: d.severity || 1, message: d.message
        }));
        for (const win of BrowserWindow.getAllWindows()) win.webContents.send('lsp-diagnostics', { path: file, diagnostics });
      } else if (msg.id != null) {                    // a question from the server
        const result = msg.method === 'workspace/configuration' ? (msg.params.items || []).map(() => null) : null;
        send({ id: msg.id, result });
      }
    }
  });
  proc.on('error', () => { server.dead = true; });
  proc.on('exit', () => {
    server.dead = true;
    for (const done of server.pending.values()) done(null);
    if (lsp === server) lsp = null;
  });
  server.ready = server.request('initialize', {
    processId: process.pid,
    rootUri: pathToFileURL(root).href,
    capabilities: {
      textDocument: {
        completion: { completionItem: { snippetSupport: false, documentationFormat: ['plaintext'] } },
        definition: {}, publishDiagnostics: {}
      },
      workspace: { configuration: true }
    }
  }).then(result => { if (result) server.notify('initialized', {}); return !!result; });
  return server;
}

async function lspFor(p, text) {
  if (!lsp) lsp = startLsp(path.dirname(p));
  const server = lsp;
  if (!await server.ready) return null;
  const uri = pathToFileURL(p).href;
  if (text != null) {
    const version = (server.docs.get(uri) || 0) + 1;
    if (version === 1) server.notify('textDocument/didOpen', { textDocument: { uri, languageId: path.extname(p) === '.bib' ? 'bibtex' : 'latex', version, text } });
    else server.notify('textDocument/didChange', { textDocument: { uri, version }, contentChanges: [{ text }] });
    server.docs.set(uri, version);
  }
  return { server, uri };
}

ipcMain.handle('lsp-sync', async (_e, p, text) => { await lspFor(p, text); return true; });

ipcMain.handle('lsp-completion', async (_e, p, line, character) => {
  const at = await lspFor(p);
  if (!at) return [];
  const res = await at.server.request('textDocument/completion', { textDocument: { uri: at.uri }, position: { line, character } });
  const items = Array.isArray(res) ? res : (res && res.items) || [];
  return items.slice(0, 60).map(i => ({
    label: i.label,
    detail: i.detail || (i.filterText && i.filterText !== i.label ? i.filterText.slice(i.label.length).trim() : ''),
    edit: i.textEdit ? { start: i.textEdit.range.start, end: i.textEdit.range.end, text: i.textEdit.newText } : null,
    insert: i.insertText || i.label
  }));
});

ipcMain.handle('lsp-definition', async (_e, p, line, character) => {
  const at = await lspFor(p);
  if (!at) return [];
  const res = await at.server.request('textDocument/definition', { textDocument: { uri: at.uri }, position: { line, character } });
  return (Array.isArray(res) ? res : res ? [res] : []).map(l => {
    const uri = l.targetUri || l.uri, range = l.targetSelectionRange || l.range;
    try { return { path: fileURLToPath(uri), line: range.start.line, character: range.start.character }; } catch { return null; }
  }).filter(Boolean);
});

app.on('will-quit', () => { if (lsp) lsp.proc.kill(); });

// ---- SyncTeX: from a spot in the PDF to the source line, and back ----

function synctex(args) {
  return new Promise(resolve => execFile('synctex', args, { env: { ...process.env, PATH: TEX_PATH }, timeout: 10000 },
    (err, stdout) => resolve(err ? '' : stdout)));
}
const field = (out, name) => (new RegExp(`^${name}:(.*)$`, 'm').exec(out) || [])[1];

// source line -> where it was typeset: page and box in PDF points from the top left
ipcMain.handle('synctex-view', async (_e, tex, line, column, pdf) => {
  const out = await synctex(['view', '-i', `${line}:${Math.max(1, column)}:${tex}`, '-o', pdf]);
  if (!field(out, 'Page')) return null;
  return { page: +field(out, 'Page'), h: +field(out, 'h'), v: +field(out, 'v'), W: +field(out, 'W'), H: +field(out, 'H') };
});

// a point on a PDF page -> the source file and line it came from
ipcMain.handle('synctex-edit', async (_e, pdf, page, x, y) => {
  const out = await synctex(['edit', '-o', `${page}:${x}:${y}:${pdf}`]);
  const input = field(out, 'Input'), line = +field(out, 'Line');
  if (!input || !line) return null;
  return { path: path.resolve(path.dirname(pdf), input), line };
});

// ---- the drawing pad: a window on the iPad (Sidecar) that draws into the note ----
// The pad never takes the keyboard (focusable: false), so the caret stays in
// the note while the Pencil draws — put it down and keep typing. Messages go
// pad <-> main process <-> the Margin window that owns the pad.

let padWin = null, padOwner = null;

// Sidecar's screen is named after the iPad ("… iPad", "Sidecar Display")
const isPadDisplay = d => /ipad|sidecar/i.test(d.label || '');

function padDisplay() {
  const primary = screen.getPrimaryDisplay();
  const all = screen.getAllDisplays();
  return all.find(isPadDisplay) || all.find(d => d.id !== primary.id) || null;
}

function sendToOwner(channel, msg) {
  const owner = padOwner && !padOwner.isDestroyed() ? padOwner : BrowserWindow.getAllWindows().find(w => w !== padWin);
  if (owner && !owner.isDestroyed()) owner.webContents.send(channel, msg);
}

function openPad(display = padDisplay()) {
  if (padWin) { padWin.showInactive(); return; }
  // on the iPad: the whole screen, no frame. Without one: a window to try it
  // out, floating above Margin so it never ends up hidden behind it
  const place = display ? { ...display.workArea, frame: false } : { width: 1000, height: 720, alwaysOnTop: true };
  padWin = new BrowserWindow({
    ...place,
    title: 'Margin Pad',
    backgroundColor: '#ffffff',
    focusable: false,
    acceptFirstMouse: true,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'pad-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false // a covered pad must still take every stroke
    }
  });
  padWin.padDisplayId = display ? display.id : null;
  padWin.loadFile(path.join(__dirname, 'pad.html'));
  padWin.once('ready-to-show', () => padWin && padWin.showInactive());
  padWin.on('closed', () => { padWin = null; sendToOwner('pad-state', { open: false }); });
  sendToOwner('pad-state', { open: true });
}

function closePad() { if (padWin) padWin.close(); }

ipcMain.handle('pad-toggle', e => {
  padOwner = BrowserWindow.fromWebContents(e.sender);
  if (padWin) closePad(); else openPad();
  return !!padWin;
});
ipcMain.handle('pad-open', () => !!padWin);

ipcMain.on('pad', (e, msg) => {
  if (padWin && e.sender === padWin.webContents) sendToOwner('pad', msg);
  else {
    padOwner = BrowserWindow.fromWebContents(e.sender);
    if (padWin) padWin.webContents.send('pad', msg);
  }
});

// plug the iPad in (Sidecar) and the pad is there; unplug it and it goes
function watchDisplays() {
  screen.on('display-added', (_e, d) => { if (isPadDisplay(d)) openPad(d); });
  screen.on('display-removed', (_e, d) => { if (padWin && padWin.padDisplayId === d.id) closePad(); });
  const ipad = screen.getAllDisplays().find(isPadDisplay);
  if (ipad) openPad(ipad);
}
app.whenReady().then(() => setTimeout(watchDisplays, 800)); // after the main window

// ---- figures: saved as SVG; in LaTeX also exported to .pdf + .pdf_tex by Inkscape ----

function inkscapeBinary() {
  const bundle = '/Applications/Inkscape.app/Contents/MacOS/inkscape';
  return require('fs').existsSync(bundle) ? bundle : 'inkscape'; // else PATH (brew install inkscape)
}

const lastWritten = new Map();   // figure path -> the text Margin last wrote there
const exportTimers = new Map();  // figure path -> pending export

function exportFigure(svgPath) {
  const pdf = svgPath.replace(/\.svg$/i, '.pdf');
  return new Promise(resolve => {
    execFile(inkscapeBinary(), [svgPath, '--export-area-page', '--export-dpi', '300',
      '--export-type=pdf', '--export-latex', '--export-filename', pdf],
    { env: { ...process.env, PATH: TEX_PATH }, timeout: 60000 },
    err => resolve(err ? (err.code === 'ENOENT' ? 'Inkscape not found — install it from inkscape.org' : err.message) : null));
  });
}

// Castel's file watcher: after a save, the pdf + pdf_tex follow on their own
function scheduleExport(svgPath, { delay = 400 } = {}) {
  clearTimeout(exportTimers.get(svgPath));
  exportTimers.set(svgPath, setTimeout(async () => {
    exportTimers.delete(svgPath);
    const error = await exportFigure(svgPath);
    sendToOwner('figure-exported', { path: svgPath, error });
  }, delay));
}

ipcMain.handle('figure-save', async (_e, p, svg, opts = {}) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p + '.tmp', svg, 'utf8');
  await fs.rename(p + '.tmp', p);
  lastWritten.set(p, svg);
  if (opts.tex) {
    if (opts.now) { // the first save: \incfig needs the pdf_tex before it compiles
      clearTimeout(exportTimers.get(p)); exportTimers.delete(p);
      return { error: await exportFigure(p) };
    }
    scheduleExport(p);
  }
  return { error: null };
});

// a GeoGebra picture the pad draws on: its bytes, to embed in the figure
ipcMain.handle('read-binary', async (_e, p) => {
  try { return new Uint8Array(await fs.readFile(p)); } catch { return null; }
});

ipcMain.handle('figure-exists', async (_e, p) => fs.access(p).then(() => true).catch(() => false));

// Polishing a figure afterwards: open it in Inkscape and follow its saves
const watched = new Map(); // figure path -> { tex }
ipcMain.handle('figure-inkscape', async (_e, p, tex) => {
  const known = watched.get(p);
  watched.set(p, { tex: !!tex });
  if (!known) {
    let timer = 0;
    try {
      require('fs').watch(path.dirname(p), (_ev, name) => {
        if (name !== path.basename(p)) return;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const text = await fs.readFile(p, 'utf8').catch(() => null);
          if (text == null || text === lastWritten.get(p)) return; // our own write
          lastWritten.set(p, text);
          if (watched.get(p).tex) scheduleExport(p, { delay: 0 });
          sendToOwner('figure-changed', { path: p, svg: text });
        }, 300);
      });
    } catch { /* the folder is gone; nothing to follow */ }
  }
  const bin = inkscapeBinary();
  if (process.platform === 'darwin' && bin.startsWith('/Applications/'))
    execFile('open', ['-a', 'Inkscape', p], () => { });
  else spawn(bin, [p], { detached: true, stdio: 'ignore', env: { ...process.env, PATH: TEX_PATH } }).unref();
  return true;
});
