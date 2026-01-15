# DraftBudget modernisation – Plan first

Work mode: PLAN FIRST. Do not edit code until the plan is approved by me in-chat.

Context:
- Current app is vanilla JS (scrambled but working) with `app.js`, `index.html`, `style.css`.
- Repo already uses webpack (possibly dated).
- App must remain a STATIC site deployable to GitHub Pages.

Hard requirements (do not violate):
1) Preserve existing core logic and UX behaviour:
   - hierarchical lines (parents sum children), totals computed on the fly
   - overhead logic preserved
   - keyboard editing behaviour preserved
   - DOM layout stays functionally the same (columns, alignment, etc.)
2) Preserve console-first control:
   - keep a stable window-level API (globals) so everything can be controlled from DevTools.
   - keep `window.budget` + an alias `window.b`
   - expose at least: createBudget, exportToJSON, cloneLine, convert, loadRates, symbols, rates
3) Replace the FX backend (api.exchangerate.host is not suitable):
   - use a free, keyless service (Frankfurter is acceptable)
   - must be deterministic: FX init completes before UI starts
   - conversion returns numbers (or NaN), never strings
4) Convert `style.css` → SCSS and integrate into webpack build.
5) Provide local dev workflow:
   - `npm run dev` via webpack-dev-server
   - Claude must use Chrome integration to visually verify alignment, right-justified columns, and editing.
6) Provide GitHub Pages deploy via Actions:
   - build to `dist/`
   - deploy `dist/` as Pages artifact

Plan deliverables required before any edits:
- Proposed target file/folder structure (justified)
- Dependency changes (exact npm packages)
- Webpack changes (dev + prod, SCSS pipeline, asset paths for Pages)
- FX module design + caching scheme (localStorage keys, update frequency)
- Global window API design (exact names, what’s on window vs under namespace)
- Migration steps in small commits, with checkpoints and rollback strategy
- Verification checklist (commands + Chrome visual checks)

After plan approval:
- Implement in small commits. After each commit run build + dev and verify in Chrome.
