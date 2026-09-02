// Copies pdf.js, KaTeX and marked into vendor/ so the app runs with no network.
// Run: npm i pdfjs-dist@3.11.174 katex@0.16.9 marked@12.0.2 && npm run vendor
const fs = require('fs');
const path = require('path');

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

console.log(missing ? `\n${missing} file(s) missing — install the packages first.`
                    : '\nvendor/ ready. The app now runs offline.');
