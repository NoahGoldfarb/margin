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
| `!` + `Tab` | In a `.tex` file: insert a whole document from a template — Castel's lecture notes (`!plain` for a bare article) |
| `ggb` + `Tab` | Open GeoGebra for a graph; `Cmd+Enter` (`Ctrl+Enter`), then drag over it to insert that area as a picture |
| iPad button | Open the drawing pad (on the iPad with Sidecar); the Pencil draws into a figure at the caret |
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
  VS Code: lecture notes the way Gilles Castel set them up — boxed definitions
  and theorems numbered through the notes, a chapter per topic,
  `\lecture{n}{date}{title}` with the date in the margin, the lecture at the top
  of each page and the chapter and page number at the foot, `\incfig` for
  figures. Tab steps through title, chapter, lecture title and the text.
  `!plain` + Tab gives a bare article instead (`!castel` still works too).
  Templates are plain `.tex` files — **LaTeX › Open templates folder** to change
  them or add your own; `!name` + Tab picks `name.tex`. In a template, `$0`,
  `$1`, … are Tab stops, `{{date}}` and `{{file}}` are filled in. A template
  you never changed follows Margin's updates; one you edited stays yours.
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

### Figures drawn on the iPad

Connect the iPad with Sidecar (Control Center › Screen Mirroring › the iPad;
a Lightning or USB-C cable works without any network) and Margin puts its
drawing pad on the iPad's screen by itself. The **iPad** button in the top bar
opens and closes it by hand; without a second screen it opens as a floating
window to try it out.

There is nothing to start or name: pick up the Pencil and draw. The figure goes
where the caret is in your note.

- **The first stroke** puts a new figure into the note, on its own line —
  `![Figure](lecture.assets/fig-01.svg)` in Markdown (also in the notes on a
  PDF), and in a `.tex` file Castel's
  `\begin{figure}[ht] \centering \incfig{fig-01} \end{figure}`.
- **Later strokes** go into the same figure while the caret is on its line or
  on the empty line right below it — which is where the caret lands, so you
  can draw, put the Pencil down and draw on. Once you type a new paragraph,
  the next stroke starts the next figure. Click next to an older figure to
  draw into it again.
- **The pad** says at the top what it is drawing into, and the Mac shows the
  figure live in the bottom-right corner.
- **On a GeoGebra picture**: with the pad open, tap a `ggb` picture in the
  note and the Pencil draws on top of the graph — to mark a point, shade an
  area, add an arrow. The graph sits underneath, locked: the eraser and Select
  leave it alone. With the first stroke `ggb-….png` becomes `ggb-….svg` with
  the graph inside, at the same size in the note (the PNG stays where it
  was). Without the pad, tapping a picture does what it always did.

On the pad:

- **Hold the Pencil still** at the end of a stroke and it is corrected fully:
  a straight line (snapped to 0°/45°/90° when close), circle, ellipse,
  rectangle, triangle, quadrilateral or a few joined straight pieces — and a
  curve that is none of these becomes a clean, smooth curve. Only strokes
  with real corners become straight pieces; a wave stays a wave. Draw on
  after holding and it is freehand again. A tap is a point.
- **Zoom in for the fine work**: pinch with two fingers (up to 8×), move
  around with two fingers; or **− / % / +** in the bottom-right corner, where
  tapping the percentage goes back to the whole width. Joining up, shape
  snapping and the tidying of strokes go by how things look on screen, so
  detail drawn zoomed in stays as fine as you drew it. While the Pencil is
  down the page never moves, so a resting palm cannot drag it away.
- **Freehand strokes stay as you drew them**, only a little neater: the
  wobble of curves is smoothed a little, straight pieces and corners stay as
  drawn, the little flick the Pencil leaves as it lands or lifts is cut off,
  and a loop closes without a seam. Small strokes, like a letter written by
  hand, keep their shape.
- **Lines join up by themselves**: a stroke that starts or ends near another
  end, a corner or a point lands exactly on it (a small ring shows it), so
  triangles close and lines meet. **Grid** also puts shapes on the dot grid.
- **Thick, Dashed, Dotted, Arrow, Fill** — Castel's style table, cut down to
  the buttons that matter; **Arrow** goes none → at the end → at both ends,
  with LaTeX's curved arrow heads. Four colours: black, blue, red, green.
- **Fill** goes none → **Fill** → **Hatch**. A fill is the shape's own colour,
  see-through, so where filled shapes overlap the overlap comes out darker
  (and two colours mix); **Hatch** shades the shape with thin diagonal lines
  in its colour. Fills always go underneath the lines; a fill changes colour
  with its shape. The gray fills of older figures turn into the see-through
  kind and look the same until they overlap.
- **Select** — tap a stroke, or draw a loop around several. Drag them
  anywhere; **Duplicate** or **Delete** them; and any style button or colour
  now changes them, so you can draw first and style afterwards.
- **Change a shape afterwards**: select one shape and it shows handles — a
  circle its centre and a point on it (drag the point onto another point and
  the circle goes through it), an ellipse its centre and both radii, a
  rectangle its corners, a line, polyline or polygon each of its corners.
  Handles snap to other points and to the grid.
- **Axes** — press at the origin and drag: both axes with arrows and `$x$`,
  `$y$` labels in one go. Drag in one direction only for a number line.
- **Text** — tap where the label goes and type it on the Mac, with the
  snippets; `Enter` places it, `Esc` cancels. Write math as `$x$`: on the pad
  and in a note KaTeX typesets it, in a `.tex` file LaTeX does, in your
  document's font. The pad typesets it as you type, so you see the label as
  it will be. Tap an existing label with Text to change it, drag it with Text
  to move it; the label you are typing can be dragged with the Pencil
  straight away.
- **Eraser** — strikes through whole strokes.
- **Undo / Redo**, or `⌘Z` on the Mac when the last thing you did was a
  stroke. Undo or erase back to nothing and the figure leaves the note again.
- **New** starts a new figure below the current one; **Copy prev.** starts
  it as a copy of the last one, for a picture the lecture builds up step by
  step.

The page is the width of your note (or of `\columnwidth`) and as long as you
like; a figure is saved cropped to the height it uses, with its left, middle
and right where you drew them.

Figures are plain SVG that Inkscape opens as its own:
`lecture.assets/fig-01.svg` next to a note, `figures/fig-01.svg` next to the
root `.tex`. For LaTeX, Margin runs Inkscape after every change to write the
`.pdf` + `.pdf_tex` that `\incfig` imports (both hidden in the sidebar), and
recompiles. A document without `\incfig` gets it added before
`\begin{document}`, together with `import`, `transparent` and `xcolor`. To
polish a figure afterwards, click next to it and press **Inkscape** in the
corner preview; what you save in Inkscape comes back into the note and the PDF.

Needs [Inkscape](https://inkscape.org) for `.tex` files (Markdown notes don't).
On the iPad, Settings › Displays › the iPad › *Show Sidebar* off gives the pad
the whole screen.

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
