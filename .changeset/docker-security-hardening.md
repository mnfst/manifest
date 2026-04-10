---
"manifest": patch
---

Harden the published Docker image and compose stack without changing the upgrade path:

- Pin `node:22-alpine` and `postgres:16-alpine` base images by multi-arch digest
- Fix HEALTHCHECK to use `127.0.0.1` instead of `localhost` (IPv6 resolution was causing spurious unhealthy status)
- Add container hardening to `docker-compose.yml`: read-only root filesystem with tmpfs for `/tmp`, dropped all Linux capabilities, `no-new-privileges`, 1 GB memory limit, 256 pids limit
- Isolate Postgres on an `internal: true` network with no egress; expose only Manifest on the `frontend` network
- Sign published images with cosign keyless signing (Sigstore); verification command documented in `docker/DOCKER_README.md`
- Add Dependabot config for weekly Docker base image updates
