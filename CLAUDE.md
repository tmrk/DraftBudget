# DraftBudget

A budget creator app with hierarchical line items and currency conversion.

## Project Structure

```
src/
├── index.js           # Entry point
├── start.js           # Bootstrap (createBudget, start)
├── app.scss           # Styles (SCSS)
├── index.html         # HTML template
└── modules/
    ├── Line.js        # Line class (model)
    ├── fx.js          # FX service (Frankfurter API)
    ├── dom.js         # DOM helpers (n() function)
    ├── serialize.js   # exportToJSON, cloneLine
    ├── config.js      # Configuration
    ├── log.js         # Logging utilities
    └── globals.js     # Window API exposure
```

## Development

```bash
npm run dev    # Start dev server at localhost:8080
npm run build  # Production build to dist/
```

## Window API

Available in browser console:
- `window.budget` / `window.b` - Main budget Line instance
- `createBudget(name, options)` - Create new budget
- `exportToJSON(line)` - Export to JSON
- `cloneLine(line)` - Clone a line
- `convert(amount, from, to)` - Currency conversion
- `loadRates()` - Load FX rates
- `rates` - Cached exchange rates by base currency
- `symbols` - Currency symbols/names
- `config` - App configuration
- `quietMode` - Toggle logging (getter/setter)

## FX Module

Uses Frankfurter API (`api.frankfurter.dev/v1`) with per-base caching:
- Rates cached in localStorage as `ratesByBase`
- 24-hour cache TTL based on `fetchedAt` timestamp
- `convert()` returns NaN for missing rates (triggers async fetch)
- In-flight guard prevents duplicate requests
- Debounced re-render after async rate fetch

## Deployment

Automatic via GitHub Actions on push to `main` branch.
