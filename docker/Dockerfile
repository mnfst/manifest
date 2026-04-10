# Stage 1: Install dependencies
# Base image pinned by digest (multi-arch manifest list). Updated via Dependabot.
FROM node:22-alpine@sha256:4d64b49e6c891c8fc821007cb1cdc6c0db7773110ac2c34bf2e6960adef62ed3 AS deps
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/
COPY packages/backend/package.json packages/backend/
COPY packages/openclaw-plugins/manifest/package.json packages/openclaw-plugins/manifest/
COPY packages/openclaw-plugins/manifest-model-router/package.json packages/openclaw-plugins/manifest-model-router/
RUN --mount=type=cache,target=/root/.npm npm ci

# Stage 2: Build the application
FROM deps AS build
COPY packages/shared packages/shared
COPY packages/frontend packages/frontend
COPY packages/backend packages/backend
RUN npx turbo build --filter=manifest-backend --filter=manifest-frontend --filter=manifest-shared

# Stage 3: Production dependencies only
FROM node:22-alpine@sha256:4d64b49e6c891c8fc821007cb1cdc6c0db7773110ac2c34bf2e6960adef62ed3 AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/
COPY packages/backend/package.json packages/backend/
COPY packages/openclaw-plugins/manifest/package.json packages/openclaw-plugins/manifest/
COPY packages/openclaw-plugins/manifest-model-router/package.json packages/openclaw-plugins/manifest-model-router/
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts && \
    rm -rf node_modules/typescript node_modules/@types \
           node_modules/ts-node node_modules/acorn \
           node_modules/create-require node_modules/v8-compile-cache-lib \
           node_modules/sql.js/dist/sql-asm* \
           node_modules/sql.js/dist/worker.* \
           node_modules/sql.js/dist/sql-wasm-browser* \
           node_modules/sql.js/dist/sql-wasm-debug* && \
    find . -path "*/node_modules/vitest" -type d -exec rm -rf {} + 2>/dev/null; \
    find . -path "*/node_modules/vite-node" -type d -exec rm -rf {} + 2>/dev/null; \
    find . -path "*/node_modules/rollup" -type d -exec rm -rf {} + 2>/dev/null; \
    find . -path "*/node_modules/@vitest" -type d -exec rm -rf {} + 2>/dev/null; \
    find . -path "*/node_modules/*" \( -name "*.map" -o -name "*.md" \
      -o -name "LICENSE*" -o -name "CHANGELOG*" -o -name "*.txt" \
      -o -name "Makefile" -o -name "*.gyp" -o -name "*.gypi" \
      -o \( -name "*.ts" ! -name "*.d.ts" \) \) -delete 2>/dev/null; \
    find . -path "*/node_modules/*" -type d \( -name "__tests__" -o -name "test" \
      -o -name "tests" -o -name "docs" -o -name "example" \
      -o -name "examples" \) -exec rm -rf {} + 2>/dev/null; \
    true

# Stage 4: Production runtime
FROM node:22-alpine@sha256:4d64b49e6c891c8fc821007cb1cdc6c0db7773110ac2c34bf2e6960adef62ed3 AS runtime
WORKDIR /app

LABEL org.opencontainers.image.title="Manifest" \
      org.opencontainers.image.description="Open-source AI model router. Save up to 70% on LLM costs." \
      org.opencontainers.image.url="https://manifest.build" \
      org.opencontainers.image.documentation="https://manifest.build/docs" \
      org.opencontainers.image.source="https://github.com/mnfst/manifest" \
      org.opencontainers.image.vendor="MNFST Inc." \
      org.opencontainers.image.licenses="MIT"

RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

ENV NODE_ENV=production
ENV BIND_ADDRESS=0.0.0.0

COPY --from=prod-deps /app/node_modules node_modules
COPY --from=prod-deps /app/packages/backend/node_modules packages/backend/node_modules
COPY --from=prod-deps /app/package.json package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/backend/dist packages/backend/dist
COPY --from=build /app/packages/frontend/dist packages/frontend/dist
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

RUN mkdir -p /home/node/.openclaw/manifest && chown -R node:node /home/node/.openclaw

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/v1/health || exit 1

USER node

CMD ["node", "packages/backend/dist/main.js"]
