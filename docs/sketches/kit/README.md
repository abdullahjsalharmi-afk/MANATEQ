# Sketch kit

Hand-drawn wireframes without drawing by hand. A board is ordinary HTML laid out with CSS (so Arabic
text wraps and aligns properly); `sketch.js` then draws every outline with [rough.js](https://roughjs.com)
(MIT). Drawing is seeded: the same HTML always gives the same sketch.

## A board

```html
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>…</title>
  <link rel="stylesheet" href="../kit/sketch.css">
</head>
<body>
<article class="board" id="b04">
  <header class="board-head">
    <span class="board-no" data-sk="circle">04</span>
    <div>
      <h2>العنوان — <span data-sk="hl">الفكرة</span></h2>
      <p>سطر يشرح ما تجيب عنه الشاشة.</p>
    </div>
  </header>
  <div class="stage">
    <div class="col"> … notes … </div>
    <div class="phone" data-sk="phone"> … wireframe … </div>
    <div class="col"> … notes … </div>
  </div>
  <p class="board-foot"><b>القاعدة:</b> …</p>
</article>
<script src="../kit/rough.js"></script>
<script src="../kit/sketch.js"></script>
</body>
</html>
```

A board is 1000 px wide and as tall as its content. Typical layouts: one phone with a notes column on
each side; two phones side by side with a `.flow` arrow between them and one notes column; or a
full-width diagram (`.dia`).

## Layout helpers (no outline)

`stage` (row of columns/phones, centred) · `stage wide` · `col` (flexible notes column) · `col narrow` ·
`phone` (284 × 600; add `tall` for 680) · inside a phone: `rowx` (row), `rowx sp` (space-between),
`colx` (column), `grow` (spacer), `gap4 gap12 gap16`, `pad`, `pad-s`, `center`, `end` ·
text sizes `t-xl t-l t-m t-s`, colours `t-a` (accent) `t-g` (gold) `t-ok`.

## Drawn pieces — add `data-sk="…"`

| `data-sk` | Use with class | Draws |
|---|---|---|
| `phone` | `phone` | the phone outline with notch |
| `card` · `card-a` · `card-fill` · `card-dash` | `w-card` | card: pencil · accent · accent with tint · dashed |
| `btn` · `btn-ink` · `btn2` | `w-btn` (`ghost` for text colour on `btn2`, `sm`) | filled accent · filled ink · outlined |
| `chip` · `chip-on` · `chip-a` | `w-chip` (`on` for white text) | pill outline · filled ink · filled accent |
| `badge` | `w-badge` | small filled accent dot with a number |
| `circle` · `circle-fill` | `w-ico` (`sm`, `lg`), `n`, `board-no` | circle outline · tinted circle |
| `icon` + `data-icon="…"` | `w-icon` (`sm`, `lg`) | a line icon; `data-c="a"` accent, `"p"` pencil, `"w"` white |
| `img` · `hatch` | `w-img` | image placeholder (crossed box) · hatched box |
| `lines` + `data-n="3"` | `w-lines` | placeholder text lines |
| `row` | `w-row` | list row with a rule under it |
| `hr` · `sep` | any · `w-sep` | rule under · rule through the middle |
| `underline` · `hl` · `strike` | inline `span` | accent underline · highlighter · strike-through |
| `field` · `field-a` | `w-field` | input · focused input |
| `progress` + `data-v="0.6"` | `w-progress` | progress bar (`data-c="ok"` for green) |
| `step` | `w-step > i` (`on`) | one segment of a stepper |
| `ring` + `data-v="0.7"` | `w-ring` | progress ring; put the label inside |
| `toggle` | `w-toggle` (`off`) | switch |
| `sheet` | `w-sheet` | a bottom sheet rising inside a phone |
| `grip` | `w-grip` | the sheet's handle |
| `tabbar` | `w-tabbar` with `w-tab` children (`on`) | the rule above the tab bar |
| `qr` | `w-qr` | a QR-like square |
| `map` + `data-pins="13"` `data-hot="2"` | `w-map` | outline of Qatar with zone pins, one highlighted |
| `plots` + `data-cols` `data-rows` `data-sel="2,1"` | any sized box | a grid of plots, one selected |
| `bars` + `data-v="0.4,0.7,0.5"` | any sized box | small bar chart |
| `signature` | any sized box | a signature on a line |
| `check` | `w-icon` | a green tick |
| `arrow-l` · `arrow-r` · `arrow-d` | `flow`, `dia-arrow` | an arrow across the element |

Timelines: `<ol class="w-tl"><li class="done">…<small>…</small></li><li class="now">…</li><li class="todo">…</li></ol>`
— dots and connectors are drawn automatically.

Icons available: home, grid, list, pin, user, bell, search, camera, doc, card, key, check, cross, back,
fwd, plus, wrench, shield, clock, chat, pen, factory, truck, globe, bolt, star, mic, upload, alert,
wallet, calendar, phone, layers, spark, lock, eye.

## Notes and arrows

```html
<p class="note" data-to="#target-id"><b class="n" data-sk="circle">1</b>النص<small>سطر توضيحي</small></p>
```

`note` (accent) · `note ink` · `note gold`. `data-to` draws an arrow from the note to the element with
that id. Keep each note level with its target (use `style="margin-top:…px"`) so arrows stay short and
do not cross. `data-bend="-0.2"` changes the curve.

## Diagrams

`dia` is a row of `dia-node` boxes (give them `data-sk="card"`) separated by `dia-arrow` elements
(`data-sk="arrow-l"` — in Arabic the flow runs right to left). `dia-row` is a row of equal boxes;
`legend` a row of small labels.

## Rendering

```
node scripts/render-sketches.mjs docs/sketches/boards/04-home.html docs/sketches/png 2
```

writes one PNG per `.board` (named after the board's `id`) at 2× scale.
