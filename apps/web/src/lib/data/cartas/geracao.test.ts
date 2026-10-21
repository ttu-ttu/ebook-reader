/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import type { LinhaCarta } from '$lib/data/supabase/sincronizacao/regras';
import { criarGeracao, type RespostaGerar } from './geracao';

const carta = (id: string, state: string): LinhaCarta =>
  ({
    id,
    state,
    word: id,
    word_reading: id,
    modified_at: '2026-10-21T10:00:00.000Z',
    deleted_at: null
  }) as LinhaCarta;

function montar(cartas: LinhaCarta[], respostas: Record<string, RespostaGerar> = {}) {
  const banco = new Map(cartas.map((c) => [c.id, c]));
  const chamadas: { id: string; refazer?: string[] }[] = [];
  const sincronizacoes: number[] = [];
  let online = true;

  const geracao = criarGeracao({
    listar: async () => [...banco.values()].filter((c) => !c.deleted_at),
    ler: async (id) => banco.get(id),
    salvar: async (c) => {
      banco.set(c.id, c);
    },
    sincronizar: async () => {
      sincronizacoes.push(Date.now());
    },
    invocar: async (id, refazer) => {
      chamadas.push({ id, refazer });

      const resposta = respostas[id] ?? { estado: 'gerada' };

      // A função grava no servidor; a sincronização traz de volta.
      if (resposta.estado === 'gerada' || resposta.estado === 'erro') {
        banco.set(id, { ...banco.get(id)!, state: resposta.estado });
      }

      return resposta;
    },
    online: () => online,
    agora: () => '2026-10-21T11:00:00.000Z'
  });

  return {
    geracao,
    banco,
    chamadas,
    sincronizacoes,
    desligar: () => {
      online = false;
    }
  };
}

describe('geração das cartas (ADR 0010)', () => {
  it('gera as pendentes uma por vez; erro e gerada ficam como estão', async () => {
    const { geracao, chamadas, banco } = montar([
      carta('a', 'pendente'),
      carta('b', 'gerada'),
      carta('c', 'erro'),
      carta('d', 'pendente')
    ]);

    await geracao.processarFila();

    expect(chamadas.map((c) => c.id)).toEqual(['a', 'd']);
    expect(banco.get('a')?.state).toBe('gerada');
    expect(banco.get('c')?.state).toBe('erro');
  });

  it('sincroniza antes (a carta tem que estar no servidor) e depois (traz os campos)', async () => {
    const { geracao, sincronizacoes } = montar([carta('a', 'pendente')]);

    await geracao.processarFila();

    expect(sincronizacoes.length).toBeGreaterThanOrEqual(2);
  });

  it('sem rede não chama a função', async () => {
    const { geracao, chamadas, desligar } = montar([carta('a', 'pendente')]);

    desligar();
    await geracao.processarFila();

    expect(chamadas).toEqual([]);
  });

  it('"Tentar de novo" volta a carta com erro para pendente e gera', async () => {
    const { geracao, chamadas, banco } = montar([carta('c', 'erro')]);

    await geracao.tentarDeNovo('c');

    expect(chamadas).toEqual([{ id: 'c', refazer: undefined }]);
    expect(banco.get('c')?.state).toBe('gerada');
  });

  it('"Refazer áudio" volta a gerada para pendente e pede só o áudio', async () => {
    const { geracao, chamadas, banco } = montar([carta('b', 'gerada')]);

    await geracao.refazerAudio('b');

    expect(chamadas).toEqual([{ id: 'b', refazer: ['audio'] }]);
    expect(banco.get('b')?.modified_at).toBe('2026-10-21T11:00:00.000Z');
  });

  it('carta ocupada (outra chamada gerando) fica para depois sem erro', async () => {
    const { geracao, banco } = montar([carta('a', 'pendente')], { a: { estado: 'ocupada' } });

    await geracao.processarFila();

    expect(banco.get('a')?.state).toBe('pendente');
  });

  it('duas chamadas ao mesmo tempo não geram duas vezes', async () => {
    const { geracao, chamadas } = montar([carta('a', 'pendente')]);

    await Promise.all([geracao.processarFila(), geracao.processarFila()]);

    expect(chamadas).toHaveLength(1);
  });
});
