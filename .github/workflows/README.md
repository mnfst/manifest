# GitHub Workflows

## Naming Convention

| Prefix | Package | Examples |
|--------|---------|----------|
| `manifest-*` | `packages/manifest` | manifest-ci.yml, manifest-release.yml |
| `manifest-ui-*` | `packages/manifest-ui` | manifest-ui-ci.yml |

## Workflows

| File | Trigger | Description |
|------|---------|-------------|
| `manifest-ci.yml` | PR to main | Tests, changeset check, Docker build |
| `manifest-release.yml` | Push to main | Version PRs, tags, GitHub releases, Docker publish |
| `manifest-publish.yml` | Tag or called by release | Docker Hub publish (reusable) |
| `manifest-ui-ci.yml` | PR to main | Tests, preview generation |

## Required Secrets

| Secret | Used By | Description |
|--------|---------|-------------|
| `APP_ID` | manifest-release.yml | GitHub App ID for triggering CI on version PRs |
| `APP_PRIVATE_KEY` | manifest-release.yml | GitHub App private key |
| `DOCKERHUB_USERNAME` | manifest-publish.yml | Docker Hub username |
| `DOCKERHUB_TOKEN` | manifest-publish.yml | Docker Hub access token |
