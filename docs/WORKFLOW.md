# Workflow

This project is set up so multiple coding agents can work on it interchangeably. The repo (docs + code) is the shared memory.

## Start of any session

1. Read `CLAUDE.md`, `AGENTS.md`, and the docs they reference.
2. Run `git status` and `git log -5 --oneline`.
3. Update `docs/NOW.md` with the goal, branch, and a tight plan.

## Creating a branch

1. `git fetch --all --prune`
2. Switch to the default branch (`main` or `master`) and pull fast-forward only:
   - `git switch <default>`
   - `git pull --ff-only`
3. Create a feature branch:
   - `git switch -c feat/<short-kebab>`

## Working in checkpoints

Work in small, reviewable checkpoints. After each checkpoint:
- Ensure the code still builds (or at least you know exactly what’s broken).
- Update `docs/NOW.md` with what changed and what’s next.

If you are likely to hit a usage limit, bias towards smaller checkpoints.

## Verification

At minimum, run:
- `npm run build`

If you touched UI behaviour, also run:
- `npm run dev` and verify in the browser + console.

## Keeping project docs current

When a meaningful change lands:
- Add a factual entry to `docs/RECENT_CHANGES.md`.
- Update `docs/CURRENT_PRIORITIES.md` (tick off, reorder, add next tasks).

## Handover between coding agents

If you must switch tools/models mid-task:

1. Update `docs/NOW.md` with:
   - branch name
   - what changed (paths)
   - what’s next (concrete)
   - how to verify
   - intended SemVer bump
2. Prefer to leave the working tree in one of these states:
   - Clean (committed checkpoint), or
   - Only changes related to the current checkpoint (no unrelated edits).
3. Stop.

The next agent should start by reading `docs/NOW.md` and running `git status`.

## Semantic versioning (mandatory)

Every feature branch must bump `package.json` version once, near the end, before final push.

Rules and examples are in `docs/VERSIONING.md`.

Recommended approach:
- Decide bump (patch/minor/major).
- Run `npm version <patch|minor|major> --no-git-tag-version`.
- Commit the version bump (either as its own commit or together with the final change).
