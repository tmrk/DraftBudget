# Recent Changes

## Latest: Overhead Lines Implementation (7e0223f)

**What was added:**

- `Overhead` class in `src/modules/Line.js` with:
  - Properties: `_title`, `_percentage`, `_currency`
  - Computed: `baseTotal`, `total`, `index` (e.g., "OH1-1.2")
  - View methods: `createView()`, `viewEdit()`, `viewUpdate()`
  - Move up/down buttons in UI

- Line class methods for overhead management:
  - `addOverhead(options)` — creates and attaches Overhead
  - `removeOverhead(overhead)` — removes by reference or index
  - `moveOverheadUp/Down(overhead)` — reorder calculation sequence
  - `moveOverheadTo(overhead, targetLine)` — transfer between lines

- Compound calculation logic:
  - Each overhead's `baseTotal` = line's `totalWithoutOverhead` + sum of all previous overhead totals
  - Supports currency conversion between overhead and line currency

- Serialisation updates:
  - `exportToJSON()` includes overhead array
  - `cloneLine()` restores overheads from saved data
  - Excel export shows overhead rows with italic styling

- SCSS styling for overhead lines (opacity, italic index, move button hovers)

## Previous Changes

| Commit | Summary |
|--------|---------|
| 19986db | Made row gaps transparent to show page background |
| 52773e0 | Robust `Line.move()` method with validation |
| 318b351 | UI improvements: buttons, tooltips, column order |
| 95ca4de | Number formatting respects `config.decimals` |
| e0e2d25 | Excel export with SUM formulas for parent rows |
| 8aa48f8 | v2.0.0 major UI overhaul and modernisation |
| 608435f | Split monolithic `app.js` into ES modules |
| 3641438 | Complete SCSS migration from `style.css` |

## Migrations Already Done

1. **app.js → ES modules** — code split into `src/modules/*.js`
2. **style.css → app.scss** — full SCSS with variables and nesting
3. **webpack.config.js → split configs** — common/dev/prod separation
4. **Plain objects → Overhead class** — old `{ title, rate, cost }` replaced
5. **gh-pages npm package → GitHub Actions** — deployment via workflow

## Do Not Accidentally Undo

1. **Overhead class** — must use `new Overhead()`, not plain objects
2. **Compound calculation** — `baseTotal` includes previous overhead totals
3. **ES module structure** — imports/exports must remain consistent
4. **`mangle: false` in Terser** — preserves console API function names
5. **Level colours in config** — not hardcoded in SCSS
6. **`refreshLevels()` after load** — fixes level classes on restored data
