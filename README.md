# Margin

Open a lecture PDF, point at the line you care about, press one key. The page
splits at exactly that point and a Markdown + LaTeX editor opens in the gap.
The rest of the page stays where it was, above and below.

## Run it

```bash
npm install      # electron
npm start
```

Then press `Ctrl+O`, or drag a PDF onto the window.

For lecture halls with no usable wifi, bundle the libraries locally once:

```bash
npm i pdfjs-dist@3.11.174 katex@0.16.9 marked@12.0.2
npm run vendor
```

The app checks `vendor/` first and only falls back to a CDN if it is missing.

To build an installer: `npx electron-builder` (or `npm run dist`).

## macOS app

On Apple Silicon, build the native app with:

```bash
npm run app
```

Then open `dist/mac-arm64/Margin.app`, drag it to `Applications`, and choose
`Options > Keep in Dock` from its Dock icon.

`index.html` also runs on its own in a browser if you just want to try it —
in that mode notes are kept in the browser's local storage instead of a file.

## Keys

| Key | What it does |
| --- | --- |
| `Ctrl-click` / `Cmd-click` | Split the page where you click and start a note there |
| `Esc` | Leave the note, back to the page. An empty note is discarded |
| `Alt+↑` / `Alt+↓` | Previous / next note, anywhere in the document |
| `Alt+Enter` | Hide the source, keep only the rendered note |
| `Ctrl+Shift+⌫` | Delete the note you are in |
| `Cmd+⌫` / `Ctrl+⌫` | Move the open file to the Trash |
| `Tab` | Expand a snippet, jump to the next `$0` slot, or step out of `}` |
| `/` | In math: turn what you just typed into a fraction |
| `Ctrl+O` | Open a PDF |
| `Ctrl+Shift+O` | Open a folder in the sidebar |
| `Ctrl+F` | Search filenames, PDF text and notes across the folder |
| `Ctrl+,` | Settings — theme, accent colour, note text size |
| `Ctrl+=` `Ctrl+-` `Ctrl+0` | Zoom |
| `Ctrl+E` | Export all notes as one Markdown file |
| `?` | Key list |

Ctrl-click (Cmd-click on macOS) anywhere on a rendered PDF page to split it at
that exact position and start a note.

## Writing

Normal Markdown, with math in `$…$` inline or `$$…$$` on its own line.
`\(…\)` and `\[…\]` work too. Click a note once to edit its complete text as
a normal Markdown file. Press `Esc` to compile it back to the rendered
preview. `Enter` inserts a normal new line while editing. Dollar amounts like
$5 are left alone.

LaTeX Suite snippets are available while editing: type a trigger such as `mk`
or `frac`, then press Tab. Open the `LaTeX` button to customize the
trigger and template. Use `$0`, `$1`, `$2` in a template for Tab positions.
Tab moves between snippet placeholders and never moves focus to another note;
without an active snippet it inserts two spaces.

Around 150 snippets ship by default, covering Greek letters (`al`, `Om`),
number sets (`RR`, `ZZ`), operators (`sum`, `int`, `lim`, `pd`), accents,
delimiters and environments (`mat`, `cases`, `align`). Each one is tagged
**math**, **text** or **both**: math snippets only fire inside `$…$`, so `in`
stays the English word in prose and becomes `\in` in an equation. The `LaTeX`
panel has a filter box for finding one quickly.

Three more things happen automatically inside math:

- `/` turns whatever you just typed — or whatever you have selected — into a
  fraction. `2x/` gives `\frac{2x}{▮}`, and it understands `(a+b)/` and
  `\sqrt{x}/` as single terms.
- Tab steps out past a closing `}`, `)` or `$` instead of indenting, so you can
  type straight through a nested expression without reaching for the arrow keys.
- Brackets pair themselves, typing the closing one steps over it, and
  backspace between an empty pair removes both halves.

## Recording the lecture

Press `Record` while a PDF is open and Margin records the class through your
microphone. Every note and highlight you make while it runs is stamped with the
moment it was made, and its header gets a `▶ 12:34` button that replays the
lecture from exactly that point — for the derivation you couldn't keep up with.

The recording is saved beside the PDF as `lecture.margin.webm`, so it moves with
the document and can be deleted on its own. Drop your own `lecture.margin.m4a`
(or `.mp3`, `.ogg`, `.wav`) next to a PDF and Margin will pick it up too.

If you don't want any of this, turn **Lecture recording** off in `Ctrl+,` —
the Record button, the player and the note timestamps all disappear. Nothing
already on disk is deleted, and switching it back on brings it all back.

## Themes

`Ctrl+,` opens Settings: eleven themes, an accent colour, and note text size.

| | |
| --- | --- |
| Dark | Ink (default), Midnight, Mocha, Nord, Gruvbox, Rosé Pine, Tokyo Night |
| Light | Paper, Sepia, Latte, Solarized |

Each theme sets both the app chrome and the note surface, so Midnight, Mocha,
Nord, Gruvbox, Rosé Pine and Tokyo Night give you genuinely dark note-taking
rather than a dark toolbar wrapped around a white page. The borrowed palettes
carry their signature accent with them when picked; the accent row overrides it
afterwards if you'd rather have something else. Every theme's body text clears
WCAG AA contrast against its own background.

```
By **Green's theorem**, $\oint_C P\,dx + Q\,dy = \iint_D (Q_x - P_y)\,dA$.

$$\frac{\partial u}{\partial t} = \alpha \nabla^2 u$$
```

## Where notes live

Each note stores the page number and its position on that page as a fraction
of the page height, so it stays on the right line at any zoom level.

Deleting a file — `Cmd+⌫`, or right-click in the sidebar — moves it to the
system Trash rather than erasing it, and a PDF takes its notes and recording
along with it so nothing is left orphaned.

Notes are written next to the PDF as `lecture.margin.json` while you type
(debounced, written atomically). Move the PDF and the notes travel with it;
delete the JSON and the PDF is untouched. Notes and highlights made while
recording also carry a `t`, their offset in seconds into `lecture.margin.webm`.
These `*.margin.*` files are hidden from the sidebar — they are storage, not
documents.

```json
{
  "version": 1,
  "pdf": "lecture.pdf",
  "notes": [
    { "id": "n1x…", "page": 4, "y": 0.612, "x": 0.33,
      "md": "so $A$ is not diagonalisable here" }
  ]
}
```

## Notes on the design

- Page rendering is lazy — pages render when they come near the viewport, so
  a 400-page script opens instantly.
- Each page is drawn once to an offscreen canvas, then blitted into slices.
  Adding a note re-slices only that page, so splitting stays instant mid-lecture.
- Markdown is applied only to the non-math parts of your text, so `$x_i$` never
  turns into italics and `\\` survives inside a matrix.
