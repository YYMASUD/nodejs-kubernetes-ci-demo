# ---------------------------------------------------------------------------
# nodejs-kubernetes-ci-demo — production image
#
# Single-stage production image for the Express demo app. The node:22-alpine
# base keeps the image small, and we only ship the runtime artifacts (app code
# + production dependencies), never dev tooling, tests, or source control data.
#
# Build:  docker build -t ghcr.io/yymasud/nodejs-kubernetes-ci-demo:latest .
# ---------------------------------------------------------------------------

# Alpine-based Node.js 22 LTS: small footprint and widely cached in CI
FROM node:22-alpine

# Run the app in production mode (disables dev behaviors, enables optimizations)
ENV NODE_ENV=production

# All application files live under /app inside the container
WORKDIR /app

# Copy only the dependency manifests first. Because package.json /
# package-lock.json change far less often than application source, this split
# lets Docker's layer cache reuse the npm install layer on most builds and
# only reinstall dependencies when the manifests actually change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code as the unprivileged "node" user so the files are
# readable/writable by the runtime user and not owned by root
COPY --chown=node:node server.js ./
COPY --chown=node:node public ./public

# Drop privileges: the "node" user ships with the official node base image,
# so no user creation is needed. Never run production containers as root.
USER node

# The Express server listens on 3000 (see server.js)
EXPOSE 3000

# Container-level health check: hit the /health endpoint periodically so the
# Docker engine can detect and restart an unhealthy container.
# wget is available in the alpine base image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

# Start the server directly (PID 1) — no npm wrapper process
CMD ["node", "server.js"]
