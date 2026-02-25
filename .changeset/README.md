# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets).

## Adding a changeset

When you make a change to a publishable package (`manifest`), run:

```bash
npx changeset
```

Follow the prompts to select the affected packages and the semver bump type (patch / minor / major). This creates a markdown file in this folder describing the change.

Commit the changeset file along with your code changes.

## How releases work

1. PRs that include changeset files get merged into `main`.
2. The release workflow opens a "Version Packages" PR that bumps versions and updates changelogs.
3. When that PR is merged, the workflow publishes the new versions to npm.
