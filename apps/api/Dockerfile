# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/api/Dockerfile .

ARG NODE_IMAGE=node:24-alpine

# ---------- build: all dependencies + nest build
FROM ${NODE_IMAGE} AS build
WORKDIR /app

# Manifests first: the dependency layer is reused until the lock file changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace apps/api --no-audit --no-fund

COPY tsconfig.base.json ./
COPY apps/api/ apps/api/
RUN npm run build --workspace apps/api

# ---------- runtime: production dependencies + compiled JS only
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# --omit=optional: typeorm declares ts-node/typescript as optional peers.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace apps/api --omit=dev --omit=optional --no-audit --no-fund

COPY --from=build /app/apps/api/dist apps/api/dist

# Files stay owned by root (read-only for the app); the process runs as `node`.
USER node
WORKDIR /app/apps/api
EXPOSE 3000

# Exec form: node is PID 1 and receives SIGTERM from `docker stop`.
CMD ["node", "dist/main.js"]
