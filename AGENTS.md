# AGENTS.md

This repository is the source of truth. Do not rely on previous chat history.

## Always read first

- `CLAUDE.md`
- `.claude/rules/frontend.md`
- `.claude/rules/webpack.md`
- `docs/NOW.md`
- `docs/WORKFLOW.md`
- `docs/VERSIONING.md`
- `docs/PROJECT_OVERVIEW.md`
- `docs/DEV_COMMANDS.md`
- `docs/ARCHITECTURE.md`
- `docs/CURRENT_PRIORITIES.md`
- `docs/RECENT_CHANGES.md`
- `package.json`

## Non-negotiables

- Vanilla JavaScript only (no frameworks, no TypeScript)
- UI is `index.html`
- Webpack + npm workflow
- Console-first: core features must work via the `window.*` API
- `.claude/rules/*.md` are normative project rules; follow them even if you are not Claude.

## The baton: NOW.md

`docs/NOW.md` is the handover baton. Keep it current so another coding agent can take over mid-task.

Minimum cadence:
- At session start: update NOW with branch + goal + plan.
- After each meaningful checkpoint: update NOW with what changed and what’s next.
- If you hit a usage limit or must stop: update NOW, ensure the working tree is consistent, and stop.

## Workflow contract (do this every time)

1) Rehydrate: read the “Always read first” files and run `git status` + `git log -5 --oneline`.

2) Branch: fetch, switch to default branch (main/master), pull, then create a feature branch:
- `feat/<short-kebab>` for features
- `fix/<short-kebab>` for bug fixes
- `chore/<short-kebab>` for maintenance

3) Implement in small diffs; avoid rewriting modules.

4) Verify: run `npm run build` (and `npm run dev` if UI behaviour needs checking).

5) Keep docs current:
- Update `docs/RECENT_CHANGES.md` (factual entry)
- Update `docs/CURRENT_PRIORITIES.md` (tick/reorder/next tasks)

6) SemVer bump: bump the version in `package.json` based on `docs/VERSIONING.md`.
- Do this once per feature branch, near the end (after changes are stable), before the final push.

7) Commit + push branch.

If assumptions conflict with the repo, trust the repo.
