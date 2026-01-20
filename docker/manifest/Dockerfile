# ============================================================================
# ChatGPT App Builder - Multi-Stage Dockerfile
# ============================================================================
# Memory-optimized build for CI/CD environments (GitHub Actions, Railway, etc.)
#
# Build stages:
#   1. deps      - Install pnpm dependencies
#   2. build     - Build all packages sequentially to reduce memory usage
#   3. production - Minimal runtime image with only production artifacts
#
# Memory optimization strategies:
#   - pnpm for efficient dependency management
#   - NODE_OPTIONS=--max-old-space-size=4096 for TypeScript compilation
#   - Sequential package builds instead of parallel
#   - Alpine base image for minimal footprint
#   - Multi-stage to exclude devDependencies from final image
# ============================================================================

# Version metadata build arguments (passed from CI/CD)
ARG BUILD_DATE="unknown"
ARG GIT_SHA="unknown"
ARG GIT_BRANCH="unknown"
ARG VERSION="unknown"

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# Install all pnpm dependencies (cached layer for faster rebuilds)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3, sharp)
RUN apk add --no-cache python3 make g++ vips-dev

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/nodes/package.json ./packages/nodes/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Build
# Build all packages sequentially to minimize peak memory usage
# -----------------------------------------------------------------------------
FROM deps AS build

WORKDIR /app

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY packages/nodes/ ./packages/nodes/
COPY packages/backend/ ./packages/backend/
COPY packages/frontend/ ./packages/frontend/
COPY tsconfig.base.json ./

# Set Node.js memory limit for TypeScript compilation
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build packages sequentially (shared → nodes → backend → frontend)
# This reduces peak memory compared to parallel turbo builds

# 1. Build shared package first (dependency of nodes, backend, and frontend)
RUN echo "Building shared package..." && \
    cd packages/shared && pnpm run build

# 2. Build nodes package (depends on shared, required by backend)
RUN echo "Building nodes package..." && \
    cd packages/nodes && pnpm run build

# 3. Build backend (depends on shared and nodes)
RUN echo "Building backend package..." && \
    cd packages/backend && pnpm run build

# 4. Build frontend (depends on shared)
# Note: For production builds in this image, VITE_API_URL is set to empty
#       so the frontend uses relative URLs to a same-origin backend API.
ENV VITE_API_URL=""
RUN echo "Building frontend package..." && \
    cd packages/frontend && pnpm run build

# -----------------------------------------------------------------------------
# Stage 3: Production
# Minimal runtime image with only production artifacts
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache vips

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Install pnpm in production stage
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files (for runtime metadata and tooling)
# Note: frontend package.json is intentionally not copied here. The frontend is
# built as static assets in /packages/frontend/dist and has no Node runtime
# dependencies in the production image.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/nodes/package.json ./packages/nodes/
COPY packages/backend/package.json ./packages/backend/

# Copy node_modules from deps stage and prune devDependencies for production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/nodes/node_modules ./packages/nodes/node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
RUN pnpm prune --prod

# Copy built artifacts from build stage
COPY --chown=appuser:nodejs --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --chown=appuser:nodejs --from=build /app/packages/nodes/dist ./packages/nodes/dist
COPY --chown=appuser:nodejs --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --chown=appuser:nodejs --from=build /app/packages/frontend/dist ./packages/frontend/dist

# Copy backend templates (required for MCP functionality)
COPY --chown=appuser:nodejs packages/backend/src/mcp/templates ./packages/backend/dist/mcp/templates

# Create directories for runtime data
RUN mkdir -p /app/data /app/packages/backend/uploads && \
    chown -R appuser:nodejs /app/data /app/packages/backend/uploads

# Switch to non-root user
USER appuser

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV FRONTEND_DIST_PATH=/app/packages/frontend/dist

# Re-declare build args for use in labels (ARGs are stage-scoped)
ARG BUILD_DATE
ARG GIT_SHA
ARG GIT_BRANCH
ARG VERSION

# OCI Image Labels for version tracking
# See: https://github.com/opencontainers/image-spec/blob/main/annotations.md
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="https://github.com/mnfst/manifest" \
      org.opencontainers.image.title="Manifest" \
      org.opencontainers.image.description="The simplest BaaS for AI-generated full-stack apps" \
      org.opencontainers.image.vendor="MNFST, Inc" \
      com.mnfst.git.branch="${GIT_BRANCH}"

# Expose the application port
EXPOSE 3001

# Health check (use node since wget is not available in Alpine by default)
# Uses PORT env var which Railway sets dynamically
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "const port = process.env.PORT || 3001; require('http').get('http://localhost:' + port + '/api/apps', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application
CMD ["node", "packages/backend/dist/main.js"]
