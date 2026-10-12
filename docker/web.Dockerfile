# The reader (static build) served by nginx with the Calibre/account locations.
# Built by docker-compose.yml from the repository root.

# The build output is static files, so build on the machine's own platform (no
# emulation when publishing arm64 images).
FROM --platform=$BUILDPLATFORM node:24-slim AS build
ENV HUSKY=0
RUN corepack enable
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
# The HTTPS address the plain-HTTP page links to for signing in (optional).
ARG VITE_HTTPS_URL=
ARG VERSION=docker
WORKDIR /src/apps/web
RUN pnpm svelte-kit sync && pnpm build \
  && echo "$VERSION" > build/version.txt \
  && cp /src/themes.md build/themes.md

FROM nginx:1.29-alpine
COPY --from=build /src/apps/web/build /srv/www
COPY scripts/calibre/nginx-ebook-reader.conf.template scripts/calibre/render-nginx.sh /opt/ebook-reader/
COPY docker/40-ebook-reader.sh /docker-entrypoint.d/
# Checked every second while starting, so the services (which wait for this) follow
# quickly: until the account service is up, every access check fails.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=1s CMD wget -q -O /dev/null http://127.0.0.1/version.txt || exit 1
