import { describe, expect, it, vi } from 'vitest';
import { comReserva, ErroGemini, lerLista, usuarioPermitido } from './modelos.ts';

describe('lerLista', () => {
  it('separa por vírgula e ignora vazios', () => {
    expect(lerLista('NOME', ' a , b,,c ')).toEqual(['a', 'b', 'c']);
  });

  it('erra quando a configuração falta', () => {
    expect(() => lerLista('GEMINI_MODELOS_TEXTO', undefined)).toThrow('GEMINI_MODELOS_TEXTO');
    expect(() => lerLista('GEMINI_MODELOS_TEXTO', ' , ')).toThrow('GEMINI_MODELOS_TEXTO');
  });
});

describe('usuarioPermitido', () => {
  it('só o usuário configurado', () => {
    expect(usuarioPermitido('u1', 'u1')).toBe(true);
    expect(usuarioPermitido('u2', 'u1')).toBe(false);
  });

  it('ignora espaços e aspas nas pontas do secret', () => {
    expect(usuarioPermitido('u1', ' "u1"\n')).toBe(true);
    expect(usuarioPermitido('u1', "'u1'")).toBe(true);
  });

  it('ninguém quando a configuração falta', () => {
    expect(usuarioPermitido('u1', undefined)).toBe(false);
    expect(usuarioPermitido('', '')).toBe(false);
  });
});

describe('comReserva', () => {
  const semEspera = { esperar: async () => {} };

  it('usa o primeiro modelo quando dá certo', async () => {
    const chamar = vi.fn(async (modelo: string) => `ok ${modelo}`);
    expect(await comReserva(['a', 'b'], chamar, semEspera)).toEqual({
      valor: 'ok a',
      modelo: 'a'
    });
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it('passa para o modelo de reserva em 404, 429 e 5xx', async () => {
    for (const status of [404, 429, 500, 503]) {
      const chamar = vi.fn(async (modelo: string) => {
        if (modelo === 'a') throw new ErroGemini(status, 'falhou');
        return 'ok';
      });
      expect((await comReserva(['a', 'b'], chamar, semEspera)).modelo).toBe('b');
    }
  });

  it('erro de pedido (400, 401, 403) não tenta de novo', async () => {
    const chamar = vi.fn(async () => {
      throw new ErroGemini(400, 'pedido ruim');
    });
    await expect(comReserva(['a', 'b'], chamar, semEspera)).rejects.toThrow('pedido ruim');
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it('faz 3 tentativas com espera crescente e devolve o último erro', async () => {
    const esperas: number[] = [];
    const chamar = vi.fn(async (modelo: string) => {
      throw new ErroGemini(503, `fora ${modelo}`);
    });
    await expect(
      comReserva(['a', 'b'], chamar, { esperar: async (ms) => void esperas.push(ms) })
    ).rejects.toThrow('fora b');
    expect(chamar).toHaveBeenCalledTimes(6);
    expect(esperas.length).toBe(2);
    expect(esperas[1]).toBeGreaterThan(esperas[0]);
  });

  it('erro que não é do Gemini (rede, resposta inválida) conta como falha do modelo', async () => {
    const chamar = vi.fn(async (modelo: string) => {
      if (modelo === 'a') throw new TypeError('fetch failed');
      return 'ok';
    });
    expect((await comReserva(['a', 'b'], chamar, semEspera)).modelo).toBe('b');
  });

  it('erro marcado como final (teto) para tudo na hora', async () => {
    const chamar = vi.fn(async () => {
      throw new ErroGemini(0, 'teto diário atingido', true);
    });
    await expect(comReserva(['a', 'b'], chamar, semEspera)).rejects.toThrow('teto');
    expect(chamar).toHaveBeenCalledTimes(1);
  });
});
