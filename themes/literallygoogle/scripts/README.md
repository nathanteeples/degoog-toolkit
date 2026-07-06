# LiterallyGoogle search scripts

`search.html` loads these in order. Each file is an IIFE; shared DOM helpers live in `lib/search-shared.js`.

| File | Section | Responsibility |
| --- | --- | --- |
| `lib/search-shared.js` | — | Constants, `onReady`, `getResultsPage`, `getActiveSearchType`, translation helpers |
| `search-scroll-chaining.js` | 5d | Sticky sidebar + image preview pane wheel scroll chaining |
| `search-web-layout.js` | 5e | Web tab fluid two-column layout, single-column stack (`lg-results-layout-single`) |
| `search-image-grid.js` | 5b | Image grid column fold when a desktop side preview opens, recompute base columns on resize, scroll selected card into view |
| `search.js` | 1–5c, 6–8 | Everything else (pagination, filters FAB, mp2 preview bar, engine pills, sidebar accordions, …) |

When debugging a specific behaviour, start in the matching file above before editing `search.js`.

Custom events used across modules:

- `lg-sync-sidebar-row` — sidebar `grid-row` after layout changes
- `lg-results-layout-changed` — web single-column toggle; sidebar accordion mobile/desktop mode
- `lg-sync-sidebar-chrome` — image filter bar chrome sync
