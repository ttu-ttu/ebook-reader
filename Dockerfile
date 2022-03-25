FROM node:16-alpine as builder

RUN wget -qO- https://get.pnpm.io/v6.16.js | node - add --global pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build


FROM nginx:1.21-alpine

COPY nginx /etc/nginx/

WORKDIR /app
COPY --from=builder /app/dist/ebook-reader ./

EXPOSE 80
