# Changesets

Every pull request that changes the published package adds a changeset describing the change for the changelog:

```bash
npx changeset
```

Pick the bump (`patch` for fixes, `minor` for features; while the version is 0.x, `minor` is also used for breaking
changes) and write a one-line, user-facing summary. On `main`, the release workflow keeps a "Version Packages" pull
request up to date; merging it bumps the version and updates `CHANGELOG.md`. Publishing to npm is started manually
from the Actions tab (Release → Run workflow).
