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
| `Ctrl+O` | Open a PDF |
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

```
By **Green's theorem**, $\oint_C P\,dx + Q\,dy = \iint_D (Q_x - P_y)\,dA$.

$$\frac{\partial u}{\partial t} = \alpha \nabla^2 u$$
```

## Where notes live

Each note stores the page number and its position on that page as a fraction
of the page height, so it stays on the right line at any zoom level.

Notes are written next to the PDF as `lecture.margin.json` while you type
(debounced, written atomically). Move the PDF and the notes travel with it;
delete the JSON and the PDF is untouched.

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
