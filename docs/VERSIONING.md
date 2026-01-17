# Versioning (SemVer)

This project uses Semantic Versioning: MAJOR.MINOR.PATCH.

Bump the version in `package.json` once per feature branch, near the end (when the work is stable), before the final push.

## How to decide the bump

### PATCH (x.y.Z)
Use for bug fixes and internal changes that do not add user-visible functionality and do not change behaviour in a way users would notice.

Examples:
- Fix a calculation bug
- Fix FX caching edge cases
- UI alignment/spacing tweaks
- Performance improvements that do not change outputs

### MINOR (x.Y.0)
Use when you add backwards-compatible functionality.

Examples:
- Add a new UI feature (e.g., “Add Overhead” button)
- Add a new export option that doesn’t break old exports
- Add a new optional field to JSON that older versions can ignore

### MAJOR (X.0.0)
Use when you introduce a breaking change.

Examples:
- Renaming/removing a `window.*` API that existing console usage relies on
- Making saved JSON incompatible with previous versions (old budgets can’t load)
- Changing core calculation semantics (e.g., overhead compounding rules)

## How to bump

Preferred command (updates `package.json` and any lock file, without creating a git tag):

```bash
npm version patch --no-git-tag-version
# or
npm version minor --no-git-tag-version
# or
npm version major --no-git-tag-version
```

Then commit the change.

## Commit message guidance

- If you do a separate version bump commit: `chore: bump version to X.Y.Z`
- If you bundle it with the feature: include the version bump as part of the final feature commit
