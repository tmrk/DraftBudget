# Development Commands

## Installation

```bash
npm install
```

## Development Server

```bash
npm run dev
```

- Starts webpack-dev-server at `http://localhost:8080`
- Hot module replacement enabled
- Uses `webpack.dev.js` config (style-loader for inline CSS)
- Opens browser automatically

## Production Build

```bash
npm run build
```

- Outputs to `dist/` directory
- Uses `webpack.prod.js` config
- Extracts CSS to `dist/main.css` via MiniCssExtractPlugin
- Minifies JS with Terser (mangle: false to preserve console API)
- Copies fonts to `dist/fonts/`

## Build Output

```
dist/
├── index.html      # Generated from src/index.html template
├── main.js         # Bundled JavaScript
├── main.css        # Extracted styles
└── fonts/          # JetBrains Mono woff2 files
```

## Deployment

Deployment is automatic via GitHub Actions:

1. Push to `master` branch triggers workflow
2. Workflow runs `npm ci` then `npm run build`
3. Contents of `dist/` deployed to `gh-pages` branch
4. Live at: https://tmrk.github.io/DraftBudget/

Manual deployment is not needed.

## No Test Suite

There is currently no test suite configured:

```bash
npm test  # Exits with error (placeholder only)
```

Testing is done manually via browser console.

## Environment Variables

None required. The app runs entirely client-side.

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `budget` | Serialised budget data (JSON) |
| `ratesByBase` | Cached FX rates by base currency |
| `symbols` | Currency codes and names |

To clear all data: use the "Clear localStorage" button in the footer, or run `localStorage.clear()` in console.
