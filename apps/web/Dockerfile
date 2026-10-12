# Run from pnpm workspace root (e.g. docker build -t ebook-reader -f apps/web/Dockerfile .)

FROM node:24-alpine AS builder

ENV HUSKY=0
RUN corepack enable

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-*.yaml ./

WORKDIR /workspace/apps/web
COPY apps/web/package.json ./

RUN pnpm install --frozen-lockfile

COPY apps/web ./
# No Calibre server in this image, so books live in the browser by default.
ARG VITE_DEFAULT_STORAGE_SOURCE=browser
RUN pnpm svelte-kit sync
RUN pnpm build


FROM nginx:1.31-alpine

COPY apps/web/nginx /etc/nginx
COPY --from=builder /workspace/apps/web/build /usr/share/nginx/html

EXPOSE 80
