# Building a screen with the core primitives

Import everything from `@/design/core`: these primitives, and with them the fields, sheets and feedback of
`forms` and the rings, timelines, document cards and map of `signature`. Read SPEC 3 and 4.0 first. Live reference:
`#/gallery`, `#/gallery?page=welcome` (a whole maroon screen) and `#/gallery?page=flow` (a step of a flow).

## The anatomy

A screen is made of four things only: **tiles** (full-bleed, the big moment), **card grids** and **lists in
cards** on the parchment page, and the **sticky action bar** (the one action of a flow). The pulse of a page:
hero tile → contained section → (a dark or white tile) → contained section. The shell adds the rest: the tab bar
on phones; from 834 px the global bar and the footer. Never render those, nor the «نسخة تجريبية» capsule.
From 834 px the global bar also carries search, the language switch and, for a signed-in visitor, the bell
with its unread count: a screen that puts search or the bell in its own bar hides them from that width
(`phoneOnly` on Home). The bar of a tab root is clear while its large title is in view and takes its frosted
material once content scrolls under it.

## Screen

`<Screen title="…">` gives the frosted bar (52 px), `<main>`, the one `<h1>`, focus on arrival and the action bar.

| Prop | Use |
|---|---|
| `title` | The name. In the bar (17 px on phones, 21 px from 735 px); visually hidden `<h1>` in the content. |
| `large`, `subtitle` | Tab roots: the 34 px title sits in the content and moves into the bar on scroll. |
| `hideTitle` | Keep the name out of the bar when the content shows it (the welcome). |
| `barTitle` | A short name for the bar when the large title is a sentence: Home's greeting collapses to «الرئيسية». The bar title keeps its 17 px at every text setting (as a navigation bar does) and ends in an ellipsis when a long name does not fit. |
| `nav` | `'none'` tab roots · `'back'` chevron (with `backTo`) · `'close'` circle for flows (`onNav` to confirm first). |
| `actions` | Inline end of the bar: `IconButton`s, `<Button variant="quiet" size="sm">`, a small primary pill. Two at most on phones. |
| `header` | A strip pinned under the bar, edge to edge: the flow's `<Stepper>` (no label). It replaces the hairline. |
| `footer`, `footerContext` | The sticky action bar: one `<Button block>`; one line of running context (amount, step, selection). |
| `width` | The column of bar, content and action bar: `'form'` 692 · `'content'` 980 (default) · `'grid'` 1440 px. |
| `bleed` | Children span the page: use only `Tile` and `Container` as direct children. Without it they sit in one contained column (lists, forms, detail pages). |
| `tone` | `'brand'` or `'dark'`: the whole screen, bar included, is that tile (the welcome). |

## Tile (full-bleed)

- `tone`: `'light'` white · `'parchment'` the page · `'dark'` near-black · `'brand'` maroon. No radius, border or shadow.
- Slots, top to bottom, all centred: `lead` (a glyph or the mark) · `eyebrow` (14 px, gold) · `headline` (34 px;
  `size="hero"` 40/56 px) · `tagline` (one line) · `actions` (one primary pill, plus a `secondary` beside it) ·
  `media` (a `<Render>` resting on the tile, 40 px of air above) · `children` (captions, a `Grid`, fine print).
- `mediaWidth`: `'default'` up to 560 px · `'small'` 280 px · `'wide'` the column (the `journey` render, a map).
- `fill` fills the viewport under the bars. `level` sets the heading (default `h2`; the screen owns the `h1`).
  Text in a tile is centred: anything start-aligned (a timeline, a form) goes in a `Card` inside `children`.

## data-tone

`Tile tone="dark"` and `tone="brand"` set `data-tone` for you: inside, ink, lines, status colours and the accent
switch (gold on dark, paper white on maroon), so every component reads without extra CSS. The maroon tile is the
one loud moment (the welcome, the next-step hero of Home; no status pills or rings on it); a dark tile at most
once per screenful; cards on both are `tone="plain"`. Set `data-tone="dark"` yourself only on a near-black
surface you build yourself (`background: var(--tile-1)`).

## Container, Grid, Section

- `<Container width pad>`: the centred column with gutters, between tiles. `width` as on `Screen`;
  `pad="section"` (default) adds the vertical air of a page section, `pad="none"` only sets the width.
- `<Grid columns compact as>`: card grid, 1 column on phones, 2 from 735 px, `columns` (2, 3 default, 4) from
  1069 px. `compact` starts at 2 on phones (shortcuts, option tiles) while each tile keeps a word-sized width (`--tile-min`, 8.5em; 7em in Arabic) and drops to 1 when it cannot, so a title never splits a word. Gaps are built in. `as="ul"` with `<Card as="li">`.
- `<Section title hint action level>`: a 21 px head with an optional quiet link, then the content. Sections space
  themselves (32 px, 48 from 735 px): never wrap them in a gap container, never separate them with rules.

## Card, List

- `<Card tone pad to onClick selected media as>`: white, hairline, 18 px corners, never a shadow, never nested.
  `to` makes it a link; `onClick` an option with `selected` (2 px border); `media` heads it with a small render
  (180 px, the same in every card). `tone="parchment"` for a card on a white tile; `'sunken'` for a quiet note.
- `<List>` + `<Row title subtitle eyebrow leading trailing to onClick chevron wrap>`: rows in one card with inset
  dividers. `leading` is a plain `<Icon>` (never in a tinted shape). `variant="plain"` inside a sheet or a card.
  The words (title and subtitle) never get narrower than `--row-measure` (6.5em, set on `List`) nor than their
  longest word, date or code: when the `trailing` value does not fit beside them it wraps under them, at the inline
  end; the chevron never wraps. Do not give a trailing value a fixed width or `white-space: nowrap` on its wrapper
  (a pill, an amount or a date is kept whole already). A title breaks only between words.
- `wrap` lets the subtitle run over as many lines as it needs (never clamped). It is on by default when the
  subtitle is a string with a date, a time or a code in it (`hasWhole`); pass it when you build the subtitle
  yourself (JSX) and it shows a date or a reference. Without it the subtitle is one line with an ellipsis.

## Keeping text whole, and breaking it well

The body has `overflow-wrap: anywhere` as a safety net against page overflow: it lets a flex or grid column shrink
to one letter, so a layout that squeezes words splits them mid-word. Use these instead of fixing widths:

| Need | Use |
|---|---|
| A code, date or time inside a string | `keepWhole(text)` / `<Whole>` (Row, Lines and DocCard apply it for you) |
| A reference or code inside Arabic | `fmt.ltr(code)` or `<span className="ltr">` (left to right, never breaks) |
| A date, an amount or a short value in the reading direction | `fmt.date` / `fmt.money` (no-break spaces) inside `<span className="nowrap">` |
| A title in a narrow tile (a 2-column grid on phones) | `className="mq-words"`: breaks only between words; a word wider than the whole box is hyphenated where the language allows; its column never shrinks below the longest word |

## Buttons and choices

- `<Button>`: `primary` accent pill (one per screen) · `secondary` ghost pill (the second of two) · `quiet` text
  link (a chevron is added when it has `to`) · `utility` dark 8 px rectangle · `pearl` light capsule · `danger`,
  or `tone="danger"` on `secondary` / `quiet`. Sizes: `md` (default) · `sm` · `lg` (the rare hero pill).
  `block` is full width (420 px at most from 735 px). `loading` keeps the width. Pressed is a scale, never a colour.
- `<IconButton icon label>`: 44 px target. `variant="soft"` (a circle) on imagery; `size="sm"` for a close circle.
- `<Pill tone icon>` status (never the accent: that is for what you can press or have chosen) · `<Segmented>`
  (the full column on phones, at most 420 px and start-aligned on wider screens; `inline` inside a row or a bar;
  `size="sm"`) · `<Chip selected detail>` · `<ChipRow wrap>`. A screen never sets its own width for a segmented control.

## Example: a tab root with a hero tile and a card grid

```tsx
<Screen title={t('zones')} bleed actions={<IconButton icon={Search} label={t('search')} to="/search" />}>
  <Tile tone="dark" size="hero" eyebrow={t('eyebrow')} headline={t('headline')} tagline={t('tagline')}
    actions={<><Button to="/eligibility">{t('check')}</Button><Button variant="secondary" to="/solutions">{t('prices')}</Button></>}
    media={<Render name="zone" eager decorative />} />
  <Container width="grid">
    <Section title={t('allZones')} action={{ label: t('seeAll'), to: '/zones' }}>
      <Grid as="ul">
        {zones.map((zone) => (
          <Card as="li" key={zone.code} to={`/zones/${zone.code}`} media={<Render name="zone" decorative />}>
            <h3 className="type-body"><strong>{pick(zone.name)}</strong></h3>
            <p className="type-callout">{pick(zone.typeLabel)}</p>
          </Card>
        ))}
      </Grid>
    </Section>
  </Container>
</Screen>
```

## Example: a step of a flow with the action bar

```tsx
<Screen title={t('title')} nav="close" onNav={confirmDiscard} width="form"
  header={<Stepper current={2} total={4} label={t('step', { n: 2, m: 4 })} />}
  footerContext={<>{t('estimate')} <strong>{fmt.money(total)}</strong></>}
  footer={<Button block onClick={next}>{t('continue')}</Button>}>
  <h2 className="type-title"><strong>{t('question')}</strong></h2>
  <ChipRow label={t('solution')} wrap>
    {options.map((o) => <Chip key={o.key} selected={o.key === value} onClick={() => choose(o.key)}>{o.label}</Chip>)}
  </ChipRow>
</Screen>
```

## Rules that are easy to break

- One accent per surface, through the tokens only (`--accent`, `--accent-ink`, `--focus`). No second colour for
  actions, no gradients, no shadows (a `Render` carries the only one; sheets and toasts the float shadow).
- Weights 300 / 400 / 600 / 700, never 500. Text outside a component uses the type classes of `base.css`:
  `type-hero` · `type-display` · `type-title` · `type-heading` · `type-body` · `type-callout` · `type-foot`
  (each sets size, weight, leading and tracking together). Wrap in `<strong>` for 600.
- Radii: 0, `--r-tile`, `--r-control`, `--r-card`, `--r-pill`. Logical properties only, never left or right.
- A render rests on a tile or heads a card: never boxed, cropped, tinted or rotated; one large one per screenful.
- What you pin to the bottom must clear `var(--chrome-bottom)`; sticky tops use `var(--chrome-top)`.
- The document's scroll padding already clears the pinned bars (top: `--chrome-top`; end: tab bar plus the action
  bar's `--actionbar-h`), so `element.focus()` and `scrollIntoView()` bring a field into view above the action bar.
  Do not add your own offsets for that.
- `PassCard` status: `active` · `upcoming` · `expired` · `revoked`. A pass that starts on a later day is `upcoming`
  (the caller tells it from the dates): its badge says so and the line under the code says from when the code
  opens the gate. Never draw such a pass as active, and do not repeat its state in a pill beside the card.
- Timeline states: `done` · `current` · `upcoming` · `skipped` · `stopped` (the step that was open when the request
  was withdrawn: hollow neutral marker, muted words, "Stopped:" for screen readers, no time shown).
- `fmt.relative` says tomorrow / yesterday only for days; then always a number: days up to 60, months up to 24,
  then years ("in 15 months", never "next year").
- A sheet that shows "processing" before its confirmation (`PaySheet`, `SignSheet`, a request's payment) runs
  what the person confirmed through `useConfirmedTask` (`Sheet/useConfirmedTask.ts`), never through a timer of
  its own. Pressing "Pay" or "Sign" was the decision: the task is carried out and reported exactly once, also
  when the sheet goes away first (Back, a link, the page closing), and `onPaid(away)` / `onSigned(away)` then get
  `away = true` so the caller can tell the person on the screen they went to. A signature that does not finish
  its task (a payment follows) passes `then` to `SignSheet`: its confirmation says what is left instead of
  saying the document is saved.
