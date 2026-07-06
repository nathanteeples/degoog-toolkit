# LiterallyGoogle Design System

Authoritative reference for colors, radii, layout, and component styling in this theme. Derived from `style.css`, `4play.css`, and the reference snapshots in `examples/Settings – degoog.html` and `examples/serversettings – degoog.html`.

This theme should feel like modern Google Search — a little denser and cleaner for self-hosted use. New work should follow these rules before adding one-off tweaks.

## Typography

| Role | Value |
| --- | --- |
| UI font | `"Google Sans", sans-serif` |
| Monospace | `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` |
| Section headings | Normal weight, no forced uppercase |
| Secondary labels | `var(--text-secondary)` — dark `#80868b`, light `#70757a`; typically `0.8125rem` |
| Body / toggle labels | `0.875rem`, `var(--text-primary)` |

Primary actions and labels should be calm and direct. Do not overuse uppercase, letter spacing, or heavy font weights.

## Border radius scale

Defined on `:root` as `--theme-radius-*`:

| Token | Value | Use |
| --- | --- | --- |
| `--theme-radius-xs` | `4px` | Inner row seams inside stacked lists |
| `--theme-radius-sm` | `8px` | Generic buttons (results page), small controls |
| `--theme-radius-md` | `12px` | Glance boxes, compact cards |
| `--theme-radius-lg` | `16px` | Sidebar panels, drawers, result cards |
| `--theme-radius-xl` | `20px` | Stacked list outer corners (first/last row) |
| `--theme-radius-search` | `24px` | Search bars, store update panels |
| `--theme-radius-pill` | `999px` | Pills, chips, settings buttons, selects |

### Stacked list radius pattern (settings, store, engine lists)

Rows inside `.ext-cards`, `.settings-toggle-grid`, or `.store-updates-body` use a **2px gap** stack:

1. Each row: `--theme-radius-xs` (`4px`) on all corners by default.
2. First row: top corners `--theme-radius-xl` (`20px`).
3. Last row: bottom corners `--theme-radius-xl` (`20px`).
4. Single-row lists: full `--theme-radius-xl` pill-like block.

Expanded accordion tops can step down from `16px` outer corners to `4px` inner seams when the body opens. Do not mix ad-hoc values like `25px` or `100px` for these stacks.

## Color palette

Semantic tokens are set on `:root` (dark default), `[data-theme="dark"]`, `[data-theme="light"]`, and `@media (prefers-color-scheme: light)`.

### Dark mode

| Token | Value | When to use |
| --- | --- | --- |
| `--bg` | `#1f1f1f` | Page canvas, nested inset surfaces (store update rows) |
| `--bg-light` | `#303134` | **List rows**, panels, cards, inputs, preset/theme selects |
| `--bg-hover` | `#3c4043` | Hover states only — **never** list row or select fill |
| `--border` | `#5f6368` | Control outlines |
| `--border-light` | `#444746` | Subtle dividers |
| `--text-primary` | `#e8eaed` | Labels, titles |
| `--text-secondary` | `#80868b` | Descriptions, metadata |
| `--text-link` | `#99c3ff` | Links (e.g. spell-check “Search instead”) |
| `--primary` | `#4285f4` | Primary actions, focus rings |
| `--btn-bg` | `#303134` | Filled secondary buttons, select fills |
| `--btn-text` | `#e8eaed` | Secondary button and chip labels |
| `--search-bar-bg` | `#4d5156` | Search shells, nav filter fields |
| `--search-bar-focused` | `#303134` | Focused search/select shell |

### Light mode

| Token | Value | When to use |
| --- | --- | --- |
| `--bg` | `#fff` | Page canvas |
| `--bg-light` | `#f7f8fa` | Panels, cards |
| `--bg-hover` | `#e8eaed` | Hover states |
| `--border` | `#dadce0` | Control outlines |
| `--text-primary` | `#202124` | Labels, titles |
| `--text-secondary` | `#70757a` | Descriptions, metadata |
| `--text-link` | `#1a0dab` | Links |
| `--btn-bg` | `#f8f9fa` | Filled secondary buttons |
| `--btn-text` | `#3c4043` | Secondary button labels |
| `--search-bar-bg` | `#ebebeb` | Search shells |
| `--search-bar-focused` | `white` | Focused search shell |

### Settings-specific tokens

| Token | Dark | Light | When to use |
| --- | --- | --- | --- |
| `--lg-settings-row-bg` | `var(--bg-light)` → `#303134` | `white` | Engine/plugin rows, toggle rows |
| `--lg-settings-chip-btn-bg` | `#282a2c` | — | Configure / Apply pill on a row |
| `--lg-settings-chip-btn-bg-light` | — | `#d5dff0` | Configure / Apply in light mode |
| `--lg-settings-select-light` | — | `#dde3ea` | Theme / preset `<select>` fill |
| `--lg-settings-select-light-hover` | — | `#ced3da` | Theme / preset hover |
| `--lg-settings-page-bg-light` | — | `#f0f4f9` | Settings page body |
| `--lg-settings-apps-pocket-bg` | — | `#e9eef6` | Apps pocket panel |

### Surface color rationale (`#303134`, `#3c4043`, `#37393b`)

| Hex | Role |
| --- | --- |
| `#303134` | Canonical dark list row, panel, button, and **preset/theme select** fill (`--bg-light` / `--btn-bg` dark) |
| `#3c4043` | Hover only (`--bg-hover` dark) — slightly lighter than `#303134` |
| `#282a2c` | Dark chip button on a row (`--lg-settings-chip-btn-bg`) — darker inset on a row |
| `#37393b` | **Legacy** hard-code from older LiterallyGoogle snapshots — do **not** use; replaced by `#303134` via `--lg-settings-row-bg` |
| `#3d4041` | **Not used** in this theme. Closest legitimate neighbors are `#3c4043` (hover) and `#303134` (row fill). If you see `#3d4041` in a mockup, map it to the correct token above. |

**Rule:** list rows and settings selects in dark mode both resolve to `#303134` through `var(--lg-settings-row-bg)` or `var(--btn-bg)`. Hover uses `var(--bg-hover)` (`#3c4043`). Never substitute hover gray for row/select fill.

## Layout

- Web results stay left-aligned with a stable content gutter. Do not invent new horizontal offsets for individual widgets.
- Media layouts use the tighter media gutter already defined in the theme. Image and video views should feel compact and edge-aligned.
- Desktop side content should read as a rail of stacked cards, not floating boxes with mixed spacing.
- Mobile panels should become drawers or stacked blocks. Do not keep desktop popovers on phone widths when the content is important.

## List styles

### Settings / store / engine rows

```css
background: var(--lg-settings-row-bg);  /* #303134 dark, white light */
padding: 17px;
border: none;
border-radius: var(--theme-radius-xs);  /* stack rules adjust corners */
gap: 2px;  /* between stacked rows */
```

| State | Dark | Light |
| --- | --- | --- |
| Default | `--lg-settings-row-bg` (`#303134`) | `white` |
| Hover (nav items) | `--bg-hover` (`#3c4043`) | `--bg-hover` (`#e8eaed`) |
| Active nav item | default hover | `white`, no border/shadow |
| Selected / active (filters) | Blue-tinted `--lg-selection-active-bg` + inset ring | same |

### Store update rows

Use `var(--bg)` (page inset), not `--bg-light`, when nested inside the updates panel.

## Button styles

| Variant | Dark | Light | Notes |
| --- | --- | --- | --- |
| Primary (`.btn--primary`) | `var(--primary)` bg, white text | same | Pill on settings page |
| Secondary (`.settings-page`) | `var(--btn-bg)` / `var(--btn-text)` | `var(--btn-bg)` / `var(--btn-text)` | Filled pill with border — matches reference snapshots |
| Secondary hover | `var(--bg-hover)` / `var(--text-primary)` | same | |
| Configure / Apply chip | `--lg-settings-chip-btn-bg` | `--lg-settings-chip-btn-bg-light` | Neutral text, not blue |
| Results generic `.btn` | core defaults | core defaults | `1px solid var(--border)`, `--theme-radius-sm` |
| Links in copy | `var(--text-link)` | `var(--text-link)` | Blue — e.g. spell-check “Search instead for …” |

**Blue text is for links and primary actions only.** Settings secondary buttons, Configure/Apply chips, and preset controls use neutral `var(--btn-text)` / `var(--text-primary)`.

**Regression note:** commit `9f54156` briefly made global `.btn--secondary` transparent with `color: var(--primary)`. That was wrong for settings. The fix scopes filled secondary styling to `.settings-page` and leaves core degoog neutral secondary styling everywhere else (`color: var(--text-secondary)` per bundled core CSS).

**Never** make settings secondary buttons transparent with blue text.

## Inputs and selects

| Control | Dark | Light | Radius |
| --- | --- | --- | --- |
| `.theme-select`, `.settings-server-preset-select` | `var(--btn-bg)` → `#303134`; hover `var(--bg-hover)` | `--lg-settings-select-light` / `-hover` | pill |
| Settings search fields | `var(--search-bar-bg)` shell | `var(--bg)` shell with search shadow | pill |
| Core `.degoog-input` (generic) | `var(--bg-light)` | same | `0.375rem` (core) |

Preset dropdowns and theme selectors share the same fill tokens as list rows in dark mode (`#303134`), not the lighter search-bar gray (`#4d5156`).

## Controls (general)

- Small controls should look like pills, not square buttons.
- Default pattern: quiet surface, subtle border, rounded shape, stronger text on hover.
- Prefer inline SVG over icon fonts for theme-authored controls.
- Active rows and selected options use the existing blue-tinted selection background and inset ring.

## Highlight / focus / active

- Focus rings: `outline: 2px solid var(--primary)` with offset where core defines it.
- Toggle switches: inset `box-shadow` ring on track, not border (avoids knob gap).
- Filter / sidebar selection: `--lg-selection-accent` blue tint + `--lg-selection-active-ring`.
- Links: `var(--text-link)`; visited `var(--text-link-visited)`.

## Spell-check (theme behavior)

The official spell-check plugin (`examples/official-extensions/plugins/spell-check/`) uses:

- An **interceptor** that corrects queries via Yandex Speller (all search types at the server).
- An **at-a-glance slot** that renders `.spell-check-notice` when a correction was applied.

Theme JS (`scripts/search.js`) hoists the notice into `#results-meta` **only on the Web tab** (`getActiveSearchType() === "web"`). On Images, Videos, or News tabs the theme clears any hoisted notice. The “Search instead for …” link inside the notice correctly uses `var(--text-link)` (blue).

## Sticky behavior

- `#results-header`: `position: relative`, `z-index: 120`, `background: var(--bg)`.
- Image filter FAB / drawer: fixed positioning with morph transitions (`--lg-drawer-duration` 400ms).
- Engine performance rail: sticky with width calc when preview overlaps.
- Media preview bar: panel scroll moved to body; header stays pinned via flex layout.

## Scrolling

- Results layout: `scrollbar-gutter: stable` where chrome needs it.
- Drawers / preview panel: `overflow-y: auto`, thin scrollbar when open and idle.
- **FAB drawer close:** while morphing closed (`lg-image-drawer-animating`), dragging (`lg-drawer-dragging`), or snap-back (`lg-drawer-drag-snap`), hide **both** horizontal and vertical scrollbars on `#image-filters-bar` and its sidebar body.
- Skeleton / loading rows: no scroll hijacking.

## Motion

| Duration | Easing | Use |
| --- | --- | --- |
| `120ms` | ease | Hover, toggle, pill state |
| `180ms` | ease | Toasts |
| `220–250ms` | ease / custom cubic | Drawer open |
| `320ms` | `--lg-drawer-ease-open` | FAB morph |
| `400ms` | `--lg-drawer-ease-open/close` | Full drawer slide |

Philosophy: quick feedback on controls; slower only for spatial hierarchy (drawers, FAB morph). Motion should support hierarchy, not call attention to itself.

## Spacing

- Tight control and row spacing: `0.35rem`, `0.5rem`, `0.75rem`, or `1rem`.
- Card rows: consistent vertical padding; `14px`–`17px` for interactive rows.
- Avoid mixing many nearby values that visually collapse to the same size.

## Menus, drawers, and sidebars

- Desktop filter menus: Google-like popovers — compact, rounded, light shadow, tight row spacing.
- Mobile image filters: fixed drawer from the left.
- Drawer headers: title, close control, bottom border — no extra decoration.
- Engine performance, related searches, and knowledge cards share the same card shell language.

## Settings panels and modals

- **Page body (light):** `--lg-settings-page-bg-light` (`#f0f4f9`).
- **Section wrapper (`.settings-section`):** transparent — chrome lives on inner rows/cards.
- **Stacked cards:** 2px gap, xl outer radius — see list pattern above.
- **Server presets block:** preset `<select>` matches theme select styling (`#303134` dark); preview block uses core `var(--bg)` inset; Apply uses primary button.
- **Modals (`.ext-modal`):** inherit core degoog modal structure; theme adds pill radius on actions where `.settings-page .btn` applies.

## FAB (image filters)

- Size: `--lg-fab-size` (`3.5rem`).
- Shape: circle → morphs to drawer corner radius (`clamp(1.5rem, 5vw, 2rem)`).
- Surface: `--lg-sidebar-row-surface` / `--bg-light`.
- Pull tab: `--lg-drawer-handle-width` × `--lg-drawer-handle-height`, high contrast in light mode.
- No visible scrollbars during handle drag or shrink animation (desktop and mobile).

## Results page panels

Scoped to `#results-page` only — do not leak to settings:

```css
#results-page .degoog-panel,
#results-page .sidebar-panel,
#results-page .results-slot-panel { … background: var(--bg-light); border-radius: var(--theme-radius-lg); }
```

Sidebar row surfaces use `--lg-sidebar-row-surface` (alias of `--bg-light`).

## 4play plugin chrome

See `4play.css` — scoped under `.lg-fourplay-*`, uses semantic vars with transparent borders on cards.

## What to avoid

- New one-off radii or hex colors outside the token table.
- `#37393b` or ad-hoc grays for list rows — use `--lg-settings-row-bg`.
- Blue text on settings buttons or chips.
- Random shadows that do not match the search bar or card system.
- Critical controls that only work when an icon font loads.
- Desktop-only UI patterns reused unchanged on mobile.
- Big explanatory comments inside theme files.
