---
'manifest': patch
---

Four small Docker-compose quality-of-life fixes, all verified against an existing install without data loss:

- **Project name pinned to `mnfst`.** Docker Compose used to infer the project name from the install directory's basename (typically `manifest`), so two unrelated projects both happening to live in a `manifest/` directory would silently share container namespace — the user who reported this saw a `Found orphan containers` warning from a completely unrelated container. Added `name: mnfst` at the top of `docker/docker-compose.yml`. Container names move from `manifest-manifest-1` / `manifest-postgres-1` to `mnfst-manifest-1` / `mnfst-postgres-1`.

- **`pgdata` volume name pinned to `manifest_pgdata`.** With the project rename, Docker would have created a fresh empty `mnfst_pgdata` volume on next `up`, orphaning every existing self-hoster's database. Pinning `volumes.pgdata.name` to the historical `manifest_pgdata` keeps the new compose file attaching to the existing data. Verified locally: tore down an existing `manifest` stack, booted the new file from a different directory, confirmed the `mnfst-postgres-1` container mounted `manifest_pgdata` with all 51 migrations intact.

- **Healthcheck `start_period` 45s → 90s.** On a cold first pull, Docker was flipping the container to `unhealthy` before the backend had finished pulling images + running migrations + warming the pricing cache. The 90s grace gives real installs room to boot.

- **Log rotation.** Default Docker `json-file` logging is unbounded — a long-running install can silently fill the host disk. Both services now cap at 5 × 10 MB per container (~50 MB ceiling each).

**CI:** added an `install-script` job in `docker-smoke.yml` that runs the actual `docker/install.sh` end-to-end against the PR-built image. Caught the `${p}` healthcheck-escape regression retroactively — and will catch the next one before it ships. The installer now reads its source from `MANIFEST_INSTALLER_SOURCE` (defaults to `main` on GitHub), so the CI job can point it at a local HTTP server serving the branch under test.
