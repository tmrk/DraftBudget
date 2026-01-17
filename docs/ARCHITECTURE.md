# Architecture

## Directory Structure

```
DraftBudget/
├── .claude/                 # Claude Code settings
│   └── settings.local.json  # Permission rules
├── .github/workflows/
│   └── deploy.yml          # GitHub Pages deployment
├── dist/                    # Build output (gitignored contents except fonts)
├── docs/                    # Project documentation
├── src/
│   ├── index.html          # HTML template (HtmlWebpackPlugin)
│   ├── index.js            # Entry point (imports SCSS, calls start())
│   ├── start.js            # Bootstrap: createBudget(), loadRates(), UI setup
│   ├── app.scss            # All styles (SCSS)
│   ├── fonts/              # JetBrains Mono woff2 files
│   └── modules/
│       ├── Line.js         # Core model: Line class + Overhead class
│       ├── fx.js           # FX service: Frankfurter API, caching, convert()
│       ├── dom.js          # DOM helper: n() element creator, formatN()
│       ├── serialize.js    # exportToJSON(), cloneLine()
│       ├── excel.js        # exportToExcel() using ExcelJS
│       ├── persistence.js  # localStorage save/load for budget
│       ├── config.js       # App configuration constants
│       ├── log.js          # Logging utilities, quietMode
│       └── globals.js      # window.* API exposure
├── webpack.common.js       # Shared webpack config
├── webpack.dev.js          # Dev config (style-loader, devServer)
├── webpack.prod.js         # Prod config (MiniCssExtractPlugin, Terser)
├── package.json
└── CLAUDE.md               # AI assistant instructions
```

## Entry Points

| File | Purpose |
|------|---------|
| `src/index.js` | Webpack entry. Imports SCSS, calls `start()` |
| `src/index.html` | HTML template for HtmlWebpackPlugin |
| `src/start.js` | Bootstrap: exposes globals, loads data, creates UI |

## Core Model: Line Class

The `Line` class (`src/modules/Line.js`) is the heart of the app. Each budget item is a Line instance.

**Key properties:**
- `title`, `unitNumber`, `unitType`, `unitCost`, `frequency`, `currency`
- `children` — array of child Line instances
- `overhead` — array of Overhead instances
- `parent` — reference to parent Line (via getter)
- `view` — DOM references for this line's UI

**Key computed getters:**
- `total` — calculated recursively (includes children + overhead)
- `totalWithoutOverhead` — base total before overhead
- `index` — hierarchical index string (e.g., "1.2.3")
- `level` — depth in tree (0 = root)
- `descendants`, `ancestors`, `siblings` — tree navigation

**Key methods:**
- `add(options)` — add child line
- `remove()` — delete this line
- `move(target, mode)` — move line in tree
- `addOverhead(options)` — add percentage-based overhead
- `viewUpdate(recursion, properties)` — update DOM

## Overhead Class

The `Overhead` class (also in `Line.js`) handles percentage-based cost additions.

**Compound calculation:** Each overhead's base = line's totalWithoutOverhead + sum of all previous overhead totals.

**Example:**
```
Line total: $1000
OH1 (20%): base = $1000, total = $200
OH2 (10%): base = $1000 + $200 = $1200, total = $120
```

## State ↔ View Flow

```
User action (click/keyboard)
    ↓
Line property setter (e.g., this.title = 'New')
    ↓
Setter calls this.viewUpdate()
    ↓
viewUpdate() updates DOM spans
    ↓
viewUpdate() may recurse up/down tree
    ↓
scheduleSave() queues localStorage write
```

For console changes, the same flow applies — setting a property triggers view updates.

## DOM Helper: n()

The `n()` function (`src/modules/dom.js`) creates DOM elements:

```javascript
n('div.className#id|attr=value', 'text content', { click: handler })
n('ul', [n('li', 'item 1'), n('li', 'item 2')])
```

All UI is built with `n()`. No innerHTML, no template literals.

## FX Service

`src/modules/fx.js` handles currency conversion:

1. `convert(amount, from, to)` — returns converted amount or NaN if rate missing
2. Missing rates trigger async fetch from Frankfurter API
3. Rates cached in localStorage by base currency
4. 24-hour cache TTL based on `fetchedAt` timestamp
5. In-flight guard prevents duplicate requests

## Adding a New Feature

1. **Model change?** → Edit `Line.js` (add property, getter, method)
2. **UI for it?** → Add view code in Line's constructor or view methods
3. **Styling?** → Add SCSS in `app.scss`
4. **New module?** → Create in `src/modules/`, import where needed
5. **Console API?** → Expose in `globals.js`
6. **Serialisation?** → Update `serialize.js` for JSON, `excel.js` for Excel
