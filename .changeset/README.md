# Changesets

Releases are automatic: every push to `main` that changes the package publishes a new version (see "Releasing" in
the README). Without a changeset, that is the next patch version, with the commit subjects as the changelog entry.

Add a changeset to a pull request to choose a minor or major bump, or to write the changelog entry yourself:

```bash
npx changeset
```

While the version is 0.x, use `minor` for breaking changes and `patch` for everything else. The release consumes the
changesets and updates `CHANGELOG.md`.
