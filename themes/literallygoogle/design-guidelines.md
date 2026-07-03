# LiterallyGoogle Design Guide

This theme should feel like modern Google Search, but a little denser and cleaner for self-hosted use. New work should follow these rules before adding one-off tweaks.

## Core tokens

- Font: `"Google Sans", sans-serif` for interface copy.
- Code font: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`.
- Radius scale:
  - `--theme-radius-xs`: `4px`
  - `--theme-radius-sm`: `8px`
  - `--theme-radius-md`: `12px`
  - `--theme-radius-lg`: `16px`
  - `--theme-radius-xl`: `20px`
  - `--theme-radius-search`: `24px`
  - `--theme-radius-pill`: `999px`
- Primary accent: `--primary` / `--primary-rgb`.
- Panels live on `--bg-light`.
- Nested rows and inset surfaces live on `--bg`.

## Layout

- Web results stay left-aligned with a stable content gutter. Do not invent new horizontal offsets for individual widgets.
- Media layouts use the tighter media gutter already defined in the theme. Image and video views should feel compact and edge-aligned.
- Desktop side content should read as a rail of stacked cards, not floating boxes with mixed spacing.
- Mobile panels should become drawers or stacked blocks. Do not keep desktop popovers on phone widths when the content is important.

## Radius and chrome

- Search bars use `--theme-radius-search`.
- Pills, chips, and compact toggles use `--theme-radius-pill`.
- Main cards, drawers, and menu shells use `--theme-radius-lg`.
- Expanded accordion tops can step down from `16px` outer corners to `4px` inner seams when the body opens.
- Row items inside cards should usually use `4px` top seams and `12px` or `16px` bottom corners on the last item.

## Controls

- Small controls should look like pills, not square buttons.
- The default control pattern is:
  - quiet surface
  - subtle border
  - rounded shape
  - stronger text on hover
- Important theme-authored controls should prefer inline SVG over icon fonts.
- Active rows and selected options should use the existing blue-tinted selection background and inset ring, not a brand new color treatment.

## Menus, drawers, and sidebars

- Desktop filter menus should feel like Google popovers: compact, rounded, light shadow, tight row spacing.
- Mobile image filters should open as a fixed drawer from the left.
- Drawer headers should be simple: title, close control, bottom border, no extra decoration.
- Engine performance, related searches, and knowledge cards should use the same card shell language even if the content differs.

## Spacing

- Tight control and row spacing should usually land on `0.35rem`, `0.5rem`, `0.75rem`, or `1rem`.
- Card rows should keep consistent vertical padding. `14px` is the current anchor for interactive rows.
- Avoid mixing many nearby values that visually collapse into the same size.

## Motion

- Hover and state transitions should stay quick: around `120ms`.
- Drawers and larger surface transitions can use `220ms` to `250ms`.
- Motion should support hierarchy, not call attention to itself.

## Text

- Primary actions and labels should be calm and direct.
- Secondary metadata should use `--text-secondary`.
- Do not overuse uppercase, letter spacing, or heavy font weights.

## What to avoid

- New one-off radii.
- Random shadows that do not match the search bar or card system.
- Critical controls that only work when an icon font loads.
- Desktop-only UI patterns reused unchanged on mobile.
- Big explanatory comments inside the theme files. Keep comments short and only where they save real time.
