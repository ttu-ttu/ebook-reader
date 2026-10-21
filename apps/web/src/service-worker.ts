/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

import { pagePath } from '$lib/data/env';
import { toSearchParams } from '$lib/functions/to-search-params';
import { userFontsCacheName } from '$lib/data/fonts';

// eslint-disable-next-line no-restricted-globals
const worker = self as unknown as ServiceWorkerGlobalScope;
const BUILD_CACHE_NAME = `build:${version}`;

const prerenderedSet = new Set(prerendered);

// O wasm do tokenizador (~18 MB) fica fora do cache de build: o app o guarda no cache próprio
// `dokusho-tokenizador`, que sobrevive aos deploys (ADR 0012).
const assetsToCache = build
  .filter((path) => !path.includes('lindera_wasm'))
  .concat(files)
  .concat(prerendered);
const cachedAssets = new Set(assetsToCache);

// Sem skipWaiting automático (ADR 0011): a versão nova espera até você tocar em "Nova versão:
// atualizar" (fora do leitor) ou até o app abrir do zero. Trocar no meio da leitura deixaria o
// código ainda não carregado (o painel da palavra) sem arquivo no cache nem na Vercel.
worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(BUILD_CACHE_NAME).then((cache) => cache.addAll(assetsToCache)));
});

worker.addEventListener('message', (event) => {
  if (event.data?.type === 'ATUALIZAR') worker.skipWaiting();
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      const keysWithOldCache = keys.filter(
        (key) =>
          key !== BUILD_CACHE_NAME && key !== userFontsCacheName && !key.startsWith('dokusho-')
      );
      return Promise.all(keysWithOldCache.map((key) => caches.delete(key)));
    })
  );
});

worker.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.headers.has('range')) return;

  const url = new URL(event.request.url);

  // don't try to handle e.g. data: URIs
  const isHttp = url.protocol.startsWith('http');
  const isDevServerRequest =
    url.hostname === worker.location.hostname && url.port !== worker.location.port;
  const isSelfHost = url.host === worker.location.host;
  const isBuildAsset = isSelfHost && cachedAssets.has(url.pathname);
  const skipBecauseUncached = event.request.cache === 'only-if-cached' && !isBuildAsset;

  if (!isHttp || isDevServerRequest || skipBecauseUncached) return;

  if (isSelfHost && prerenderedSet.has(url.pathname)) {
    const requestWithoutParams = new Request(url.pathname);
    event.respondWith(
      networkFirstRaceCache(event.request, false, BUILD_CACHE_NAME, requestWithoutParams)
    );
    return;
  }

  if (isSelfHost && url.pathname.startsWith('/userfonts/')) {
    event.respondWith(
      caches
        .match(url.pathname)
        .then((r) => r ?? createRedirectResponse('/fonts/noto-serif-v21-regular.woff2'))
    );
    return;
  }

  if (isSelfHost) {
    const response = isBuildAsset
      ? caches.match(url.pathname).then((r) => r ?? fetch(event.request))
      : selfHostParameterizedUrlResponse(event.request);
    if (response) {
      event.respondWith(response);
      return;
    }
  }

  if (url.host === 'fonts.googleapis.com') {
    event.respondWith(networkFirstRaceCache(event.request));
  }
});

async function networkFirstRaceCache(
  request: Request,
  storeResponse = true,
  fallbackCacheName?: string,
  fallbackCacheRequest?: Request
) {
  const cache = await caches.open(`other:${version}`);
  const controller = new AbortController();

  let cachedResponse: Response | undefined;

  let done = false;
  let attempted = false;

  const retrieveFromFallbackCache = () =>
    fallbackCacheName
      ? caches.match(fallbackCacheRequest ?? request, { cacheName: fallbackCacheName })
      : undefined;

  const retrieveFromCache = async () => {
    if (!storeResponse) return retrieveFromFallbackCache();
    const response = await cache.match(request);
    if (response) return response;
    if (!fallbackCacheName) return undefined;
    return retrieveFromFallbackCache();
  };

  try {
    const handle = setTimeout(async () => {
      cachedResponse = await retrieveFromCache();
      attempted = true;
      if (!cachedResponse || done) return;
      controller.abort();
    }, 1000);
    const response = await fetch(request, { signal: controller.signal });
    done = true; // avoid Cache.put() was aborted exception
    clearTimeout(handle);
    if (storeResponse) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (!attempted) {
      cachedResponse = await retrieveFromCache();
    }
    if (cachedResponse) return cachedResponse;

    throw err;
  }
}

function selfHostParameterizedUrlResponse(request: Request) {
  const url = new URL(request.url);

  const readerRegex = /\/b\/(?<id>\d+)\/?(\?|$)/;
  const readerRegexResult = readerRegex.exec(url.pathname);
  if (readerRegexResult?.groups) {
    return createRedirectResponse(`${[[pagePath]]}/b?${toSearchParams(readerRegexResult.groups)}`);
  }
  return undefined;
}

function createRedirectResponse(location: string) {
  return new Response(null, {
    status: 302,
    headers: {
      location
    }
  });
}
