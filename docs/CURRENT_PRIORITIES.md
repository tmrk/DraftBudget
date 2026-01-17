# Current Priorities

## Current State

### Implemented ✓

- Hierarchical Line model with 5 levels (Budget → Sub-activity)
- Full CRUD for lines (add, edit, delete, move)
- Currency per line with real-time FX conversion (Frankfurter API)
- Unit currency separate from line currency
- Overhead lines with compound percentage calculations
- JSON export/import with full fidelity
- Excel export with formulas and Rates sheet
- localStorage persistence with auto-save
- Console-first API (all functions on `window`)
- SCSS styling with level-based colours
- GitHub Actions deployment to Pages

### Not Yet Implemented

- Test suite (no automated tests)
- Categories/tagging system (stubs exist but incomplete)
- Date range handling (start/end dates exist but no UI)
- Undo/redo
- Multiple budgets (only one at a time)
- Import from Excel
- Print stylesheet

## Decisions (Do Not Re-Litigate)

1. **Vanilla JS only** — no frameworks, no build-time transpilation beyond SCSS
2. **Line class is the model** — no separate "store" or state management
3. **Console-first** — UI is a view layer; model must work independently
4. **Frankfurter API** — free, no API key, per-base caching strategy
5. **Compound overheads** — each overhead's base = line total + all previous overheads
6. **5 levels max** — enforced by `config.levelNames.length`
7. **JetBrains Mono** — self-hosted fonts, no external font loading

## Next Tasks (Ordered)

1. **Add UI for overhead creation** — currently console-only; need an "Add Overhead" button
2. **Category system** — finish `listCategory()`, add UI for assigning categories
3. **Date range UI** — expose start/end dates in the view, add date picker
4. **Print stylesheet** — `@media print` rules in `app.scss`
5. **Keyboard shortcuts** — common actions (new line, delete, move up/down)
6. **Responsive layout** — currently desktop-only; add mobile breakpoints
7. **Test suite** — at minimum, unit tests for Line calculations

## Known Issues / Sharp Edges

1. **No "Add Overhead" button** — must use console: `budget.getLine('1').addOverhead({title:'VAT', percentage:0.2})`
2. **FX rates may be stale** — 24h cache; no manual refresh button
3. **Large budgets slow** — resizeColumns() runs on every update; could debounce more aggressively
4. **No validation** — entering invalid currency code silently fails
5. **Excel formulas are static** — overhead totals are values, not formulas
6. **`npm test` fails** — placeholder only, no actual tests
