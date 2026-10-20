/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import iniciarLindera, { TokenizerBuilder } from 'lindera-wasm-ipadic';

// Tokenizador lindera com IPADIC (ADR 0012). O wasm (~18 MB) fica num cache próprio, que o
// service worker não apaga a cada deploy; o nome do arquivo muda quando o pacote muda.

export const CACHE_TOKENIZADOR = 'dokusho-tokenizador';

export interface Pedaco {
  superficie: string;
  /** Forma de dicionário (ADR 0005); a própria superfície quando o IPADIC não conhece. */
  base: string;
  /** Leitura em hiragana; vazia quando o IPADIC não conhece. */
  leitura: string;
  /** Classe gramatical do IPADIC (名詞, 動詞, 助詞…). */
  classe: string;
  /** Posição do começo no texto, em unidades de string do JS. */
  inicio: number;
}

export interface Tokenizador {
  tokenizar(texto: string): Pedaco[];
}

const paraHiragana = (texto: string) =>
  texto.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

// Inicialização assíncrona: o Chrome recusa compilar wasm > 8 MB de forma síncrona na thread principal.
export async function criarTokenizador(wasm: BufferSource): Promise<Tokenizador> {
  await iniciarLindera({ module_or_path: wasm });
  const construtor = new TokenizerBuilder();
  construtor.setDictionary('embedded://ipadic');
  construtor.setMode('normal');
  construtor.setKeepWhitespace(true);
  const lindera = construtor.build();

  return {
    tokenizar(texto) {
      const pedacos: Pedaco[] = [];
      let cursor = 0;
      for (const token of lindera.tokenize(texto)) {
        const superficie = token.surface;
        const detalhes = token.details;
        token.free();
        const inicio = texto.indexOf(superficie, cursor);
        cursor = inicio + superficie.length;
        if (!superficie.trim()) continue;
        const base = detalhes[6] && detalhes[6] !== '*' ? detalhes[6] : superficie;
        const leitura = detalhes[7] && detalhes[7] !== '*' ? paraHiragana(detalhes[7]) : '';
        pedacos.push({ superficie, base, leitura, classe: detalhes[0] ?? '', inicio });
      }
      return pedacos;
    }
  };
}

export interface TokenizadorCarregado {
  tokenizador: Tokenizador;
  bytes: number;
  doCache: boolean;
}

/** Busca o wasm no cache próprio (ou na rede, guardando) e monta o tokenizador. */
export async function carregarTokenizador(): Promise<TokenizadorCarregado> {
  const { default: url } = await import('lindera-wasm-ipadic/lindera_wasm_ipadic_bg.wasm?url');
  const cache = await caches.open(CACHE_TOKENIZADOR);
  let resposta = await cache.match(url);
  const doCache = !!resposta;
  if (!resposta) {
    const daRede = await fetch(url);
    if (!daRede.ok) throw new Error(`Tokenizador: HTTP ${daRede.status}`);
    await cache.put(url, daRede.clone());
    for (const velho of await cache.keys()) {
      if (new URL(velho.url).pathname !== new URL(url, location.href).pathname)
        await cache.delete(velho);
    }
    resposta = daRede;
  }
  const wasm = await resposta.arrayBuffer();
  return { tokenizador: await criarTokenizador(wasm), bytes: wasm.byteLength, doCache };
}
