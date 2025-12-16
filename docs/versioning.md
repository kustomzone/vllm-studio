# Versioning and Releases

This repo uses:

- Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- `semantic-release` on `main` to determine the next SemVer version, tag it, and update `CHANGELOG.md`

## How it works

- Commit messages drive the bump:
  - `fix:` → patch
  - `feat:` → minor
  - `feat!:` or `BREAKING CHANGE:` → major
- Tags are formatted as `vX.Y.Z`.

## Files

- Release workflow: `.github/workflows/release.yml`
- Semantic Release config: `.releaserc.json`
- Changelog: `CHANGELOG.md`

## Bootstrap (first time only)

```bash
git tag v0.0.0
git push origin v0.0.0
```

## Notes

- Standard SemVer allows patch versions to grow beyond one digit (`0.0.9 → 0.0.10`).
- If you want non-standard “digit rollover” behavior, it must be implemented as a custom version script (not `semantic-release` defaults).

