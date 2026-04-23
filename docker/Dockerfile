# Runtime is gcr.io/distroless/nodejs22-debian13 (no shell, no package
# manager, just node). Prod deps are staged on node:22-slim; the prod
# install uses --ignore-scripts so no native modules are compiled,
# which means the runtime's glibc version is invisible to node_modules.
# Build/dev stages stay on node:22-alpine — smallest base that still has
# a shell, which the build (turbo, nest) needs. All base images are
# pinned by digest.

# Stage 1: Install all dependencies (including dev deps) for the build.
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS deps
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/
COPY packages/backend/package.json packages/backend/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund --loglevel=error

# Stage 2: Build the frontend + backend + shared bundles.
FROM deps AS build
COPY packages/shared packages/shared
COPY packages/frontend packages/frontend
COPY packages/backend packages/backend
RUN npx turbo build --filter=manifest-backend --filter=manifest-frontend --filter=manifest-shared

# Stage 3: Production dependencies only. npm ci runs with --ignore-scripts
# so nothing is compiled — all runtime deps are pure JS, making the glibc
# of this stage irrelevant to the final image.
FROM node:22-slim@sha256:d415caac2f1f77b98caaf9415c5f807e14bc8d7bdea62561ea2fef4fbd08a73c AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/
COPY packages/backend/package.json packages/backend/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts \
           --prefer-offline --no-audit --no-fund --loglevel=error && \
    rm -rf node_modules/typescript node_modules/@types \
           node_modules/ts-node node_modules/acorn \
           node_modules/create-require node_modules/v8-compile-cache-lib && \
    find . -path "*/node_modules/vitest" -type d -exec rm -rf {} + 2>/dev/null; \
    find . -path "*/node_modules/vite-node" -type d -exec rm -rf {} + 2>/dev/null; \
    find . -path "*/node_modules/rollup" -type d -exec rm -rf {} + 2>/dev/null; \
    find . -path "*/node_modules/@vitest" -type d -exec rm -rf {} + 2>/dev/null; \
    find . -path "*/node_modules/*" \( -name "*.map" -o -name "README*" \
      -o -name "LICENSE*" -o -name "CHANGELOG*" -o -name "*.txt" \
      -o -name "*.md" -o -name "Makefile" -o -name "*.gyp" -o -name "*.gypi" \
      -o \( -name "*.ts" ! -name "*.d.ts" \) \) -delete 2>/dev/null; \
    find . -path "*/node_modules/*" -type d \( -name "__tests__" -o -name "test" \
      -o -name "tests" -o -name "docs" -o -name "example" \
      -o -name "examples" -o -name ".github" \) -exec rm -rf {} + 2>/dev/null; \
    true

# Stage 4: Distroless runtime. Runs as the built-in `nonroot` user (UID
# 65532) by default. No shell, no apk/apt, minimal CVE surface.
FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:559b13edb698d652d7852597747ebd691569d110f0a76132b870067b290e30bd AS runtime
WORKDIR /app

LABEL org.opencontainers.image.title="Manifest" \
      org.opencontainers.image.description="Open-source AI model router. Save up to 70% on LLM costs." \
      org.opencontainers.image.url="https://manifest.build" \
      org.opencontainers.image.documentation="https://manifest.build/docs" \
      org.opencontainers.image.source="https://github.com/mnfst/manifest" \
      org.opencontainers.image.vendor="MNFST Inc." \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.base.name="gcr.io/distroless/nodejs22-debian13:nonroot" \
      org.opencontainers.image.base.digest="sha256:559b13edb698d652d7852597747ebd691569d110f0a76132b870067b290e30bd"

ENV NODE_ENV=production
ENV BIND_ADDRESS=0.0.0.0
# Expose the distroless node binary on PATH so `node` in docker-compose
# healthchecks (and anything else invoked with a bare command name) resolves.
ENV PATH=/nodejs/bin:$PATH

COPY --from=prod-deps --chown=nonroot:nonroot /app/node_modules node_modules
COPY --from=prod-deps --chown=nonroot:nonroot /app/packages/backend/node_modules packages/backend/node_modules
COPY --from=prod-deps --chown=nonroot:nonroot /app/package.json package.json
COPY --from=build --chown=nonroot:nonroot /app/packages/shared/dist packages/shared/dist
COPY --from=build --chown=nonroot:nonroot /app/packages/backend/dist packages/backend/dist
COPY --from=build --chown=nonroot:nonroot /app/packages/frontend/dist packages/frontend/dist
COPY --chown=nonroot:nonroot packages/shared/package.json packages/shared/
COPY --chown=nonroot:nonroot packages/backend/package.json packages/backend/
# The telemetry sender reads the canonical Manifest version from this
# file at boot. Without it, readManifestVersion() falls back to "unknown"
# and the sender ends up posting invalid semver to the ingest endpoint.
COPY --chown=nonroot:nonroot packages/manifest/package.json packages/manifest/

EXPOSE 2099

# Distroless has no shell; use exec-form and a JS-only check.
# `node` resolves via the PATH we set above. We read PORT at runtime so
# the healthcheck follows whatever port the backend is actually using —
# the default is 3001 to match the backend's own fallback, which keeps
# legacy installs (no PORT env) working without a compose-file update.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD ["node", "-e", "const p=process.env.PORT||'3001';fetch(`http://127.0.0.1:${p}/api/v1/health`).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# The distroless image's ENTRYPOINT is already ["/nodejs/bin/node"],
# so CMD only needs the script path.
CMD ["packages/backend/dist/main.js"]
