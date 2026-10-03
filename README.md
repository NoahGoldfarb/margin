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
GeoGebra is not on npm; `npm run vendor -- --geogebra` downloads it once
(about 50 MB) into `vendor/geogebra`.

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
| `Cmd+W` / `Ctrl+W` | Close the tab, then the window when none are left |
| `Ctrl+Tab` | Next tab (`Ctrl+Shift+Tab` for the previous) |
| `Cmd+1…9` | Jump to a tab by position |
| `Cmd+\` / `Ctrl+\` | Split the view in two |
| `Cmd+Alt+←/→` | Move between the two halves |
| `Tab` | Expand a snippet, jump to the next `$0` slot, or step out of `}` |
| `tbl` + `Tab` | Insert a table; `Tab` / `Shift+Tab` move between cells, `Enter` adds a row |
| `!` + `Tab` | In a `.tex` file: insert a whole document from a template (`!castel` for another one) |
| `ggb` + `Tab` | Open GeoGebra for a graph; `Cmd+Enter` (`Ctrl+Enter`), then drag over it to insert that area as a picture |
| `geo` + `Tab` | The same for geometry: a blank sheet without a coordinate system |
| `/` | In math: turn what you just typed into a fraction |
| `Ctrl+O` | Open a PDF |
| `Ctrl+Shift+O` | Open a folder in the sidebar |
| `Ctrl+F` | Search filenames, PDF text and notes across the folder |
| `Ctrl+,` | Settings — theme, accent colour, note text size |
| `Ctrl+=` `Ctrl+-` `Ctrl+0` | Zoom in, out, reset to fit the page to the window |
| `Ctrl+E` | Export all notes as one Markdown file |
| `?` | Key list |

Ctrl-click (Cmd-click on macOS) anywhere on a rendered PDF page to split it at
that exact position and start a note.

## LaTeX files

Open a `.tex` file from the sidebar and it shows as source on the left with
its compiled PDF on the right, the way Gilles Castel keeps Zathura next to
Vim. Margin compiles it with `latexmk` when you open it and again every time it
saves (a moment after you stop typing); `Esc` compiles right away. The PDF keeps
its scroll position across rebuilds. Errors show above the PDF with their line
number — click one to jump there. The editor numbers its lines (a wrapped line
keeps one number, level with its first row); the caret's line stands out and
lines with errors turn red.

- In an empty file, `!` + Tab inserts a whole document, like `!` for HTML in
  VS Code. `!castel` + Tab uses Castel's lecture-notes setup instead (boxed
  theorems, `\lecture{n}{date}{title}`, `\incfig`). Templates are plain `.tex`
  files — **LaTeX › Open templates folder** to change them or add your own;
  `!name` + Tab picks `name.tex`. In a template, `$0`, `$1`, … are Tab stops,
  `{{date}}` and `{{file}}` are filled in.
- The LaTeX snippets work as in notes, and know LaTeX's math: inside
  `align`, `equation` and friends counts as math, `%` comments do not.
- A file without `\documentclass` (say `lec_03.tex`) compiles the `.tex` next
  to it that `\input`s it (`master.tex`) and shows that PDF;
  `% !TEX root = ../master.tex` names the root explicitly.
  `% !TEX program = xelatex` (or `lualatex`) switches the engine.
- LaTeX's build files (`.aux`, `.log`, `.synctex.gz`, …) and the `.assets`
  folders with pictures are hidden from the sidebar.

The editor works like Overleaf's (minus the AI):

- **Syntax colours** for commands, environments, math and comments.
- **Pairs close themselves**: `$` gives `$|$` (a second `$` makes `$$|$$`),
  `{`, `[`, `(` close too, `\{` gives `\{|\}`, `\[` gives `\[|\]`; typing the
  closer steps over it, Backspace removes an empty pair, and with text selected
  the pair goes around it.
- **Completion while you type**, from [TexLab](https://github.com/latex-lsp/texlab),
  the LaTeX language server — after `\` for commands (the common ones first),
  and inside `\ref{…}`, `\cite{…}` (with title and author from your `.bib`),
  `\begin{…}`, `\usepackage{…}`, `\input{…}`. `↑`/`↓` to choose, `Enter` or
  `Tab` to take it, `Esc` to close. `\frac` comes with `{|}{}` and Tab to the
  next argument, `\section` with `{|}` (also your own `\newcommand`s with
  `[n]` arguments); an environment from `\begin{`, picked or typed out, brings its `\end{…}`.
  Once the word is complete, `Enter` just starts a new line.
- **Problems in the line numbers** — red for errors, amber for warnings; hover
  a number for the message.
- `Enter` keeps the indentation (one step more after `\begin{…}`), `⌘/`
  comments lines in and out, `⌘B` / `⌘I` wrap in `\textbf{}` / `\textit{}`,
  `⌘F` finds and replaces in the file, `⌘↩` recompiles, `⌘Z` undoes snippets
  and completions like any other typing.
- **SyncTeX** — double-click the PDF to jump to that line of source; `⌘⌥J`
  shows where the caret's line is in the PDF.
- **Go to definition** — `⌘`-click or `F12` on a `\ref`, `\cite` or command.
- The snippets work as in notes and know LaTeX's math (inside `align`,
  `equation` and friends counts as math, `%` comments don't); `dm` gives
  `\[ … \]` here.

Needs a TeX installation with `latexmk` ([MacTeX](https://tug.org/mactex/)).
TexLab ships with the app; from a source checkout, `npm run vendor -- --texlab`
downloads it once (or `brew install texlab`).

## Writing

Normal Markdown, with math in `$…$` inline or `$$…$$` on its own line.
`\(…\)` and `\[…\]` work too. Click a note once to edit its complete text as
a normal Markdown file; the caret lands on the spot you clicked. Press `Esc` to compile it back to the rendered
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

### Graphs with GeoGebra

Type `ggb` on its own line and press Tab. GeoGebra opens over the note with
just the graph, an input line and a few tools; the cursor is already in the
input line, so type `f(x)=x^2` and Enter. `geo` + Tab opens it for geometry
instead: no axes, no grid, and tools for constructions — midpoint,
parallels and perpendiculars, bisectors, circles and arcs, regular polygons,
angles, reflections. The **Graph** / **Geometry** switch at the top changes
mode at any time; each mode keeps its own construction. Press `Cmd+Enter` (or click
**Insert area**) and drag over the part you want — a click takes the whole
graph. That area is saved as a picture next to the document (`lecture.pdf` →
`lecture.assets/ggb-….png`) and linked into the note at the size you dragged,
at most 400 px wide. It is a picture, not a live graph. GeoGebra keeps your
construction until you quit, so the next `ggb` picks up where you left off.
`Esc` goes back to the note.

### Picture size

Hover over a picture in a rendered note and drag the dot at its bottom-right
corner to resize it. The width is kept in the Markdown, Obsidian-style:
`![GeoGebra|300](…)` shows the picture 300 px wide. Without `|width` a picture
is shown at its own size, never wider than the note.

## Tables

Type `tbl` on an empty line and press Tab for a table with 3 columns and 2
rows, or `tbl4x5` for 4 columns and 5 rows. The caret lands in the first
header cell. Inside any table:

- `Tab` moves to the next cell, and past the last cell it adds a new row.
  `Shift+Tab` goes back one cell.
- `Enter` adds an empty row below and jumps into it. `Enter` on an empty last
  row removes it and leaves the table. `Shift+Enter` is a plain line break.
- Every step re-aligns the columns, so the source stays readable.

You can also just type a header line like `| Name | Value |` and press Enter
— the `---` row is added for you. Math works in cells, and `$|x|$` does not
split a cell.

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

## Tabs, windows and the open folder

Files open as tabs, the way they do in a browser, Obsidian or VS Code. Opening
a file that is already open — in any pane — goes to its tab rather than
opening it twice. Switch with a click, `Ctrl+Tab`, or `Cmd+1…9`; close with
the `×`, a middle click, or `Cmd+W`.

Each tab keeps its own document: a PDF holds its own notes, highlights, zoom
level, rendered pages and scroll position, so coming back to a lecture is
instant and lands exactly where you left it.

A PDF you have never opened before starts fit to the width of whatever pane
it opens in — a wide slide deck or a poster-sized page never forces you to
scroll sideways, and a half-width split pane fits its own width, not the
full window's. Zoom manually (`Ctrl+=`/`Ctrl+-`) and that choice is
remembered for that document from then on; `Ctrl+0` goes back to fit-width.

`Cmd+\` pops the current tab out into a new pane beside it — the textbook next
to the lecture slides, or the slides next to your notes. The tab *moves*: it
leaves the pane it was in, so it is never open in both halves at once, the
same rule that governs opening a file anywhere else in the app. Any other
tabs stay right where they were, and the old half stays open too — ready for
you to put something else there, or showing whichever of its other tabs was
next in line if it had more than one open.

Whichever half you last clicked or scrolled is the live one: it takes your
typing, Ctrl-clicks and highlights, and is marked with an accent line under
its tab bar while the other half dims. `Cmd+Alt+←/→` moves between them, and
closing the last tab in a half collapses it back to a single view.

Margin follows VS Code for the window itself. `Cmd+W` closes the current tab,
and once no tabs are left it closes the window; `Cmd+Shift+W` closes the window
outright. `Cmd+Q` quits with the workspace intact — the next launch comes back
to the same folder *and* the same tabs. Closing the window instead ends the
workspace: on macOS the app stays running with no window, and the next window
you open starts empty.

Restored tabs are empty shells until you click them, so a workspace of twenty
lectures still starts instantly.

The workspace is therefore remembered by the app itself, in `window-state.json`
under the user data directory, since only the main process can tell a quit
apart from a window close.

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

Drag a file or folder onto another folder in the sidebar to move it there —
or onto the empty space below the tree (or the folder-name header) to send it
back to the workspace root. A move never overwrites an existing file with the
same name; it refuses instead. Any open tab, and the sidecar notes and
recording that belong to a moved PDF, follow it automatically.

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
