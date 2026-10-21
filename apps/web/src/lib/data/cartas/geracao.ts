/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import type { LinhaCarta } from '$lib/data/supabase/sincronizacao/regras';

// Geração das Cartas (ADR 0010): a parte do Gemini é feita pela ação `generate` da Edge Function,
// que trava a carta (pendente/erro → gerando), grava áudios e campos e devolve o estado. As três
// tentativas com espera ficam na função (R5). Aqui: uma carta por vez, só com rede, e a
// sincronização antes (a carta tem que estar no servidor) e depois (traz os campos).

export interface RespostaGerar {
  estado: 'gerada' | 'erro' | 'ocupada';
  motivo?: string;
}

export interface DependenciasGeracao {
  listar(): Promise<LinhaCarta[]>;
  ler(id: string): Promise<LinhaCarta | undefined>;
  salvar(carta: LinhaCarta): Promise<void>;
  sincronizar(): Promise<unknown>;
  invocar(id: string, refazer?: ('texto' | 'audio')[]): Promise<RespostaGerar>;
  online(): boolean;
  /** ISO do horário do aparelho. */
  agora(): string;
}

export function criarGeracao(dep: DependenciasGeracao) {
  let rodando: Promise<void> | undefined;
  let deNovo = false;

  async function gerar(id: string, refazer?: ('texto' | 'audio')[]) {
    await dep.sincronizar();

    const resposta = await dep.invocar(id, refazer);

    await dep.sincronizar();

    return resposta;
  }

  async function rodada() {
    const pendentes = (await dep.listar()).filter((carta) => carta.state === 'pendente');

    for (const carta of pendentes) {
      if (!dep.online()) return;

      await gerar(carta.id);
    }
  }

  /** Gera as cartas pendentes, uma por vez; um pedido no meio roda outra rodada depois. */
  function processarFila(): Promise<void> {
    if (!dep.online()) return Promise.resolve();

    if (rodando) {
      deNovo = true;
      return rodando;
    }

    rodando = (async () => {
      do {
        deNovo = false;
        await rodada();
      } while (deNovo && dep.online());
    })().finally(() => {
      rodando = undefined;
    });

    return rodando;
  }

  async function voltarParaPendente(id: string, mudancas: Partial<LinhaCarta> = {}) {
    const carta = await dep.ler(id);

    if (!carta) throw new Error('Carta não encontrada');

    await dep.salvar({
      ...carta,
      ...mudancas,
      state: 'pendente',
      error_reason: null,
      modified_at: dep.agora()
    });
  }

  return {
    processarFila,

    /** "Tentar de novo" de uma carta com erro: o que já deu certo fica (R5). */
    async tentarDeNovo(id: string) {
      await voltarParaPendente(id);
      await rodando;

      return gerar(id);
    },

    /** "Refazer áudio": gera os dois áudios de novo (com o "Texto para a voz", se houver). */
    async refazerAudio(id: string, mudancas: Partial<LinhaCarta> = {}) {
      await voltarParaPendente(id, mudancas);
      await rodando;

      return gerar(id, ['audio']);
    }
  };
}
