# DraftBudget

A hierarchical budget creator with currency conversion and overhead calculations.

@README.md
@package.json
@AGENTS.md
@docs/NOW.md
@docs/WORKFLOW.md
@docs/VERSIONING.md
@docs/PROJECT_OVERVIEW.md
@docs/DEV_COMMANDS.md
@docs/ARCHITECTURE.md
@docs/CURRENT_PRIORITIES.md
@docs/RECENT_CHANGES.md

## Working rules

1. Vanilla JS only — no frameworks, no TypeScript.
2. Console-first — features must work via the `window.*` API.
3. Keep diffs minimal — extend existing code; avoid large refactors.
4. Verify in browser when UI changes — `npm run dev` and test in the console.
5. Build before pushing — `npm run build`.
6. Keep the baton updated — keep `docs/NOW.md` current during work.
7. Versioning is part of the workflow — bump `package.json` using SemVer rules before final push.

## Quick reference

| What | Where |
|------|-------|
| Core model | `src/modules/Line.js` (Line + Overhead classes) |
| Entry point | `src/index.js` → `src/start.js` |
| Styles | `src/app.scss` |
| Config | `src/modules/config.js` |
| Window API | `src/modules/globals.js` |

## Console sanity checks

```js
budget.add()
budget.getLine('1.1').addOverhead({ title: 'VAT', percentage: 0.2 })
budget.getLine('1').move('2', 'after')
exportToJSON(budget)
exportToExcel(budget)
```
