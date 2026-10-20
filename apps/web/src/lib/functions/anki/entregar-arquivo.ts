/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export type ResultadoEntrega = 'compartilhado' | 'baixado' | 'cancelado';

/**
 * Entrega o arquivo pela folha de compartilhamento (iPhone/iPad) ou, onde ela não aceita o arquivo
 * (Windows), por download. Chamar direto do clique: o Safari recusa navigator.share fora de um gesto
 * recente, então o arquivo precisa estar pronto antes do toque.
 */
export async function entregarArquivo(blob: Blob, nome: string): Promise<ResultadoEntrega> {
  const arquivo = new File([blob], nome, { type: 'application/octet-stream' });

  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo] });
      return 'compartilhado';
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'AbortError') return 'cancelado';
      throw erro;
    }
  }

  const url = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'baixado';
}
