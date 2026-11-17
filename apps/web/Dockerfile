# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f apps/web/Dockerfile .

# ---------- build: Vite bundle
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace apps/web --no-audit --no-fund

COPY tsconfig.base.json ./
COPY apps/web/ apps/web/
RUN npm run build --workspace apps/web

# ---------- runtime: Caddy serving static files from /srv
FROM caddy:2-alpine AS runtime

# Caddy writes certificates/state to /data and autosaved config to /config.
RUN addgroup -S caddy && adduser -S -D -H -G caddy caddy \
    && chown -R caddy:caddy /data /config

COPY --from=build /app/apps/web/dist /srv

USER caddy
EXPOSE 80

# Plain static server for now; the reverse proxy config (Caddyfile) arrives with the compose stack.
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":80"]
