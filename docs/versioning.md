# Versioning

- Uses Conventional Commits + `semantic-release` on `main`
- Generates tags `vX.Y.Z` and updates `CHANGELOG.md`
- Bump rules: `fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE:` → major

Bootstrap (once):

```bash
git tag v0.0.0 && git push origin v0.0.0
```
