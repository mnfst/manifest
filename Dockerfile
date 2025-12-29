# ============================================================================
# ChatGPT App Builder - Multi-Stage Dockerfile
# ============================================================================
# Memory-optimized build for CI/CD environments (GitHub Actions, etc.)
#
# Build stages:
#   1. deps      - Install npm dependencies with limited concurrency
#   2. build     - Build all packages sequentially to reduce memory usage
#   3. production - Minimal runtime image with only production artifacts
#
# Memory optimization strategies:
#   - npm ci with --maxsockets=2 to limit parallel downloads
#   - NODE_OPTIONS=--max-old-space-size=1536 for TypeScript compilation
#   - Sequential package builds instead of parallel
#   - Alpine base image for minimal footprint
#   - Multi-stage to exclude devDependencies from final image
# ============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# Install all npm dependencies (cached layer for faster rebuilds)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3, sharp)
RUN apk add --no-cache python3 make g++ vips-dev

# Copy package files for dependency installation
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies with limited concurrency to reduce memory usage
# --maxsockets=2: Limit parallel HTTP connections
# --prefer-offline: Use cache when possible
RUN npm ci --maxsockets=2 --prefer-offline

# -----------------------------------------------------------------------------
# Stage 2: Build
# Build all packages sequentially to minimize peak memory usage
# -----------------------------------------------------------------------------
FROM deps AS build

WORKDIR /app

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/
COPY packages/frontend/ ./packages/frontend/
COPY tsconfig.base.json ./

# Set Node.js memory limit for TypeScript compilation
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Build packages sequentially (shared → backend → frontend)
# This reduces peak memory compared to parallel turbo builds

# 1. Build shared package first (dependency of backend and frontend)
RUN echo "Building shared package..." && \
    cd packages/shared && npm run build

# 2. Build backend (depends on shared)
RUN echo "Building backend package..." && \
    cd packages/backend && npm run build

# 3. Build frontend (depends on shared)
# Note: Frontend build needs the backend API URL set for production
ENV VITE_API_URL=""
RUN echo "Building frontend package..." && \
    cd packages/frontend && npm run build

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

# Copy package files
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install production dependencies only
# --omit=dev: Skip devDependencies
# --maxsockets=2: Limit parallel connections
RUN npm ci --omit=dev --maxsockets=2 --prefer-offline && \
    npm cache clean --force

# Copy built artifacts from build stage
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --from=build /app/packages/frontend/dist ./packages/frontend/dist

# Copy backend templates (required for MCP functionality)
COPY packages/backend/src/mcp/templates ./packages/backend/dist/mcp/templates

# Create directories for runtime data
RUN mkdir -p /app/data /app/packages/backend/uploads && \
    chown -R appuser:nodejs /app/data /app/packages/backend/uploads

# Switch to non-root user
USER appuser

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV FRONTEND_DIST_PATH=/app/packages/frontend/dist

# Expose the application port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/apps || exit 1

# Start the application
CMD ["node", "packages/backend/dist/main.js"]
