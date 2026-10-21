/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { describe, expect, it } from 'vitest';
import {
  barrasDoGrafico,
  diasDaSemana,
  diasDoPeriodo,
  porLivro,
  somarPorDia,
  somarDias,
  type LinhaDeLeitura
} from './inicio';

const linhas: LinhaDeLeitura[] = [
  // Este aparelho (ttu) e outro aparelho, mesmo livro e mesmo dia: soma.
  { livro: '夢', dia: '2026-10-20', tempo: 600, caracteres: 3000 },
  { livro: '夢', dia: '2026-10-20', tempo: 300, caracteres: 1500 },
  { livro: '星', dia: '2026-10-20', tempo: 120, caracteres: 400 },
  { livro: '夢', dia: '2026-10-15', tempo: 60, caracteres: 200 },
  { livro: '星', dia: '2026-09-01', tempo: 10, caracteres: 50 }
];

describe('soma das linhas de cada aparelho (ADR 0002)', () => {
  it('soma por dia e por livro', () => {
    const porDia = somarPorDia(linhas);

    expect(porDia.get('2026-10-20')).toEqual({
      tempo: 1020,
      caracteres: 4900,
      livros: new Map([
        ['夢', { tempo: 900, caracteres: 4500 }],
        ['星', { tempo: 120, caracteres: 400 }]
      ])
    });
    expect(somarDias(porDia, ['2026-10-20', '2026-10-15', '2026-10-01'])).toEqual({
      tempo: 1080,
      caracteres: 5100
    });
  });
});

describe('calendário e períodos', () => {
  it('semana de segunda a domingo, com deslocamento', () => {
    // 2026-10-21 é uma quarta-feira.
    expect(diasDaSemana('2026-10-21', 0)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25'
    ]);
    expect(diasDaSemana('2026-10-25', 0)[0]).toBe('2026-10-19');
    expect(diasDaSemana('2026-10-21', -1)[0]).toBe('2026-10-12');
  });

  it('7 dias, 30 dias ou tudo (desde o primeiro dia lido)', () => {
    expect(diasDoPeriodo('2026-10-21', 7)).toEqual([
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21'
    ]);
    expect(diasDoPeriodo('2026-10-21', 30)).toHaveLength(30);
    expect(diasDoPeriodo('2026-10-21', 'tudo', '2026-09-01')).toHaveLength(51);
    expect(diasDoPeriodo('2026-10-21', 'tudo')).toEqual(['2026-10-21']);
  });

  it('virada do mês e do ano', () => {
    expect(diasDoPeriodo('2027-01-02', 3)).toEqual(['2026-12-31', '2027-01-01', '2027-01-02']);
  });
});

describe('lista por livro e gráfico', () => {
  it('livros do período, do maior para o menor, pela aba escolhida', () => {
    const porDia = somarPorDia(linhas);
    const dias = diasDoPeriodo('2026-10-21', 7);

    expect(porLivro(porDia, dias, 'tempo')).toEqual([
      { livro: '夢', valor: 960 },
      { livro: '星', valor: 120 }
    ]);
    expect(porLivro(porDia, dias, 'caracteres')[0]).toEqual({ livro: '夢', valor: 4700 });
  });

  it('uma barra por dia; acima de 60 dias, uma por semana', () => {
    const porDia = somarPorDia(linhas);
    const sete = barrasDoGrafico(porDia, diasDoPeriodo('2026-10-21', 7), 'tempo');

    expect(sete).toHaveLength(7);
    expect(sete[5]).toEqual({ rotulo: '2026-10-20', valor: 1020 });

    const muitos = barrasDoGrafico(
      porDia,
      diasDoPeriodo('2026-10-21', 'tudo', '2026-06-01'),
      'tempo'
    );

    expect(muitos.length).toBeLessThan(25);
    expect(muitos.reduce((soma, barra) => soma + barra.valor, 0)).toBe(1090);
  });

  it('somarDias sem dias é zero', () => {
    expect(somarDias(new Map(), [])).toEqual({ tempo: 0, caracteres: 0 });
  });
});
