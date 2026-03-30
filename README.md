# ッツ Ebook Reader

A revival fork of ttsu reader.

Currently hosted on [kamperemu.github.io/ebook-reader](https://kamperemu.github.io/ebook-reader)

## Development

1. Have [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/installation) installed
2. Run the commands below

```sh
cd apps/web
pnpm install --frozen-lockfile
pnpm svelte-kit sync
pnpm build
```

3. Have your server (such as [http-server](https://www.npmjs.com/package/http-server)) point towards `apps/web/build`
