// Copies pdf.js, KaTeX and marked into vendor/ so the app runs with no network.
// Run: npm i pdfjs-dist@3.11.174 katex@0.16.9 marked@12.0.2 && npm run vendor
// Add GeoGebra (about 50 MB, downloaded once): npm run vendor -- --geogebra
// Add the LaTeX language server TexLab (about 15 MB): npm run vendor -- --texlab
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const out = path.join(__dirname, 'vendor');
fs.mkdirSync(out, { recursive: true });

const files = [
  ['pdfjs-dist/build/pdf.min.js',              'pdf.min.js'],
  ['pdfjs-dist/build/pdf.worker.min.js',       'pdf.worker.min.js'],
  ['katex/dist/katex.min.js',                  'katex.min.js'],
  ['katex/dist/katex.min.css',                 'katex.min.css'],
  ['katex/dist/contrib/auto-render.min.js',    'auto-render.min.js'],
  ['marked/marked.min.js',                     'marked.min.js']
];

let missing = 0;
for (const [src, dest] of files) {
  const from = path.join(__dirname, 'node_modules', src);
  if (!fs.existsSync(from)) { console.warn('missing:', src); missing++; continue; }
  fs.copyFileSync(from, path.join(out, dest));
  console.log('copied:', dest);
}

// KaTeX loads its own fonts relative to the stylesheet
const fontsFrom = path.join(__dirname, 'node_modules/katex/dist/fonts');
if (fs.existsSync(fontsFrom)) {
  fs.cpSync(fontsFrom, path.join(out, 'fonts'), { recursive: true });
  console.log('copied: fonts/');
}

// GeoGebra is not on npm — take what the applet needs from its offline bundle
if (process.argv.includes('--geogebra')) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'margin-ggb-'));
  const zip = path.join(tmp, 'ggb.zip'), to = path.join(out, 'geogebra');
  try {
    console.log('downloading GeoGebra…');
    execFileSync('curl', ['-fsSL', '-o', zip, 'https://download.geogebra.org/package/geogebra-math-apps-bundle']);
    execFileSync('unzip', ['-q', zip, 'GeoGebra/deployggb.js', 'GeoGebra/HTML5/5.0/web3d/*',
      'GeoGebra/HTML5/5.0/css/*', '-d', tmp]);
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(path.join(tmp, 'GeoGebra'), to, { recursive: true });
    console.log('copied: geogebra/');
  } catch (e) { console.warn('GeoGebra download failed:', e.message); missing++; }
  fs.rmSync(tmp, { recursive: true, force: true });
}

// TexLab, the LaTeX language server — a single binary from its GitHub releases
if (process.argv.includes('--texlab')) {
  const version = 'v5.26.0';
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'margin-texlab-'));
  const tgz = path.join(tmp, 'texlab.tar.gz'), to = path.join(out, 'texlab');
  try {
    console.log(`downloading TexLab ${version}…`);
    execFileSync('curl', ['-fsSL', '-o', tgz,
      `https://github.com/latex-lsp/texlab/releases/download/${version}/texlab-${arch}-macos.tar.gz`]);
    fs.mkdirSync(to, { recursive: true });
    execFileSync('tar', ['xzf', tgz, '-C', to]);
    fs.chmodSync(path.join(to, 'texlab'), 0o755);
    console.log('copied: texlab/');
  } catch (e) { console.warn('TexLab download failed:', e.message); missing++; }
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(missing ? `\n${missing} file(s) missing — install the packages first.`
                    : '\nvendor/ ready. The app now runs offline.');
