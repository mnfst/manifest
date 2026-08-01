# Phoenix-compatible healing service (bundled Auto-fix healer).
# Built from docker/docker-compose.yml as the `healer` service; also runs
# standalone: docker build -t phoenix-healer healer && docker run -p 3100:3100 phoenix-healer
FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

# Copy manifests first so dependency layers cache independently of source edits.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY heal.mjs ./

# Run as an unprivileged user (node:22-alpine ships one). Nothing in the app
# writes outside /tmp, so the container can run read-only (compose sets
# read_only: true + tmpfs /tmp).
USER node

EXPOSE 3100
CMD ["node", "heal.mjs"]
