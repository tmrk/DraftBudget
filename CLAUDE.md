# DraftBudget

A hierarchical budget creator with currency conversion and overhead calculations.

@README.md
@package.json
@docs/PROJECT_OVERVIEW.md
@docs/DEV_COMMANDS.md
@docs/ARCHITECTURE.md
@docs/CURRENT_PRIORITIES.md
@docs/RECENT_CHANGES.md

## Working Rules

1. **Vanilla JS only** — no frameworks, no TypeScript
2. **Console-first** — all features must work via `window.*` API
3. **Keep diffs minimal** — edit existing code, don't rewrite modules
4. **Test in browser** — run `npm run dev`, test changes in console
5. **Build before commit** — run `npm run build` to verify production bundle

## Key Commands

```bash
npm run dev    # Dev server at localhost:8080
npm run build  # Production build to dist/
```

## Quick Reference

| What | Where |
|------|-------|
| Core model | `src/modules/Line.js` (Line + Overhead classes) |
| Entry point | `src/index.js` → `src/start.js` |
| Styles | `src/app.scss` |
| Config | `src/modules/config.js` |
| Window API | `src/modules/globals.js` |

## Console Examples

```javascript
budget.add()                              // Add child to root
budget.getLine('1.1').addOverhead({title:'VAT', percentage:0.2})
budget.getLine('1').move('2', 'after')   // Move line 1 after line 2
exportToJSON(budget)                      // Get JSON string
exportToExcel(budget)                     // Download Excel file
```
