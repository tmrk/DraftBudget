# Project Overview

## What DraftBudget Does

DraftBudget is a hierarchical budget creator application. Users build budgets as trees of line items, where each line can have children (sub-items). The app supports:

- **Hierarchical structure**: Budget → Heading → Sub-heading → Activity → Sub-activity (5 levels max)
- **Currency conversion**: Real-time FX rates via Frankfurter API with per-base caching
- **Overhead lines**: Percentage-based cost additions with compound calculations
- **Excel export**: Full budget export with formulas and currency conversion
- **JSON export/import**: Serialisation for persistence and sharing
- **localStorage persistence**: Auto-saves budget state

## Console-First Philosophy

This app is "console-first". The primary interface is JavaScript objects exposed on `window`:

```javascript
window.budget        // The root Line instance
window.b             // Alias for budget
budget.add()         // Add a child line
budget.getLine('1.1') // Navigate to line 1.1
exportToJSON(budget) // Export to JSON
exportToExcel(budget) // Export to Excel
```

The web UI is built on top of this model. State changes in JS propagate to the DOM via view methods, and UI interactions update the model which triggers view updates.

## Non-Negotiables

1. **Vanilla JavaScript only** — no React, Vue, or other frameworks
2. **ES modules** — all code uses `import`/`export`
3. **Webpack bundling** — separate dev and prod configs
4. **SCSS styling** — compiled via sass-loader
5. **Console API must remain functional** — changes must not break `window.*` access
6. **Hierarchical model** — the Line class is the core; everything else supports it

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | Vanilla JavaScript (ES modules) |
| Styling | SCSS → CSS |
| Bundler | Webpack 5 |
| FX API | Frankfurter (`api.frankfurter.dev/v1`) |
| Excel | ExcelJS library |
| Fonts | JetBrains Mono (self-hosted woff2) |
| CI/CD | GitHub Actions → GitHub Pages |

## Success Criteria

A working DraftBudget session means:

1. Budget loads (from localStorage or creates new with mock data)
2. Lines can be added, edited, moved, deleted via UI or console
3. Overheads can be added and calculate correctly (compound)
4. Currency conversion works (fetches rates if missing)
5. Export to JSON and Excel both produce valid files
6. Changes persist to localStorage automatically
