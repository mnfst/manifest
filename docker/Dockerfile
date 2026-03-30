# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/
COPY packages/backend/package.json packages/backend/
COPY packages/openclaw-plugins/manifest/package.json packages/openclaw-plugins/manifest/
COPY packages/openclaw-plugins/manifest-model-router/package.json packages/openclaw-plugins/manifest-model-router/
RUN npm ci

# Stage 2: Build the application
FROM deps AS build
COPY packages/shared packages/shared
COPY packages/frontend packages/frontend
COPY packages/backend packages/backend
RUN npx turbo build --filter=manifest-backend --filter=manifest-frontend --filter=manifest-shared

# Stage 3: Production runtime
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV BIND_ADDRESS=0.0.0.0

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/
COPY packages/backend/package.json packages/backend/
COPY packages/openclaw-plugins/manifest/package.json packages/openclaw-plugins/manifest/
COPY packages/openclaw-plugins/manifest-model-router/package.json packages/openclaw-plugins/manifest-model-router/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force && \
    # Remove transitive deps not needed at runtime (typeorm→ts-node→typescript)
    rm -rf node_modules/typescript node_modules/@types \
           node_modules/ts-node node_modules/acorn \
           node_modules/create-require node_modules/v8-compile-cache-lib && \
    # Remove sql.js debug/asm/worker builds (only sql-wasm.js + sql-wasm.wasm needed)
    cd node_modules/sql.js/dist && \
    rm -f sql-asm* worker.* sql-wasm-browser* sql-wasm-debug* && \
    cd /app && \
    # Remove unnecessary files from node_modules
    find node_modules -type f \( \
      -name "*.ts" ! -name "*.d.ts" -o \
      -name "*.map" -o \
      -name "*.md" -o \
      -name "LICENSE*" -o \
      -name "CHANGELOG*" -o \
      -name "*.txt" -o \
      -name "Makefile" -o \
      -name "*.gyp" -o \
      -name "*.gypi" \
    \) -delete 2>/dev/null; \
    find node_modules -type d \( \
      -name "__tests__" -o -name "test" -o -name "tests" -o \
      -name "docs" -o -name "example" -o -name "examples" \
    \) -exec rm -rf {} + 2>/dev/null; \
    true

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/backend/dist packages/backend/dist
COPY --from=build /app/packages/frontend/dist packages/frontend/dist

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

USER node

CMD ["node", "packages/backend/dist/main.js"]
