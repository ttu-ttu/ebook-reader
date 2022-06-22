# Run from pnpm workspace root (e.g. docker build -t ebook-reader -f apps/web/Dockerfile .)

FROM node:16-alpine as builder

RUN wget -qO- https://get.pnpm.io/v6.16.js | node - add --global pnpm

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-*.yaml ./

WORKDIR /workspace/apps/web
COPY apps/web/package.json ./

RUN pnpm install --frozen-lockfile

COPY apps/web ./
RUN pnpm build


FROM nginx:1.23-alpine

COPY apps/web/nginx /etc/nginx
COPY --from=builder /workspace/apps/web/build /usr/share/nginx/html

EXPOSE 80
