/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

// Contas da tela Início (ESCOPO "Tela inicial"): as estatísticas têm uma linha por livro, dia e
// aparelho (ADR 0002), e a tela soma as linhas na exibição. Dias são chaves 'AAAA-MM-DD' do ttu
// (já com a hora de virada do dia das configurações). Tempo em segundos, como no ttu.

export interface LinhaDeLeitura {
  livro: string;
  dia: string;
  tempo: number;
  caracteres: number;
}

export interface Valores {
  tempo: number;
  caracteres: number;
}

export interface Dia extends Valores {
  livros: Map<string, Valores>;
}

export type Medida = keyof Valores;
export type Periodo = 7 | 30 | 'tudo';

export function somarPorDia(linhas: Iterable<LinhaDeLeitura>) {
  const porDia = new Map<string, Dia>();

  for (const { livro, dia, tempo, caracteres } of linhas) {
    let doDia = porDia.get(dia);

    if (!doDia) {
      doDia = { tempo: 0, caracteres: 0, livros: new Map() };
      porDia.set(dia, doDia);
    }

    const doLivro = doDia.livros.get(livro) ?? { tempo: 0, caracteres: 0 };

    doLivro.tempo += tempo;
    doLivro.caracteres += caracteres;
    doDia.livros.set(livro, doLivro);
    doDia.tempo += tempo;
    doDia.caracteres += caracteres;
  }

  return porDia;
}

export function somarDias(porDia: Map<string, Dia>, dias: string[]): Valores {
  return dias.reduce(
    (soma, dia) => ({
      tempo: soma.tempo + (porDia.get(dia)?.tempo ?? 0),
      caracteres: soma.caracteres + (porDia.get(dia)?.caracteres ?? 0)
    }),
    { tempo: 0, caracteres: 0 }
  );
}

// Datas como dias do calendário, sem fuso: o meio-dia UTC nunca muda de dia.
const paraData = (dia: string) => new Date(`${dia}T12:00:00Z`);
const paraDia = (data: Date) => data.toISOString().slice(0, 10);

export function somarAoDia(dia: string, dias: number) {
  const data = paraData(dia);

  data.setUTCDate(data.getUTCDate() + dias);

  return paraDia(data);
}

/** Segunda a domingo da semana do dia, com `deslocamento` semanas para trás (negativo) ou frente. */
export function diasDaSemana(hoje: string, deslocamento: number) {
  const diaDaSemana = (paraData(hoje).getUTCDay() + 6) % 7;
  const segunda = somarAoDia(hoje, -diaDaSemana + 7 * deslocamento);

  return Array.from({ length: 7 }, (_, i) => somarAoDia(segunda, i));
}

/** Os dias do filtro, do mais antigo até hoje; "tudo" começa no primeiro dia lido. */
export function diasDoPeriodo(hoje: string, periodo: number | 'tudo', primeiroDia?: string) {
  let inicio = hoje;

  if (periodo === 'tudo') {
    if (primeiroDia && primeiroDia < hoje) inicio = primeiroDia;
  } else {
    inicio = somarAoDia(hoje, -(periodo - 1));
  }

  const dias: string[] = [];

  for (let dia = inicio; dia <= hoje; dia = somarAoDia(dia, 1)) dias.push(dia);

  return dias;
}

export function porLivro(porDia: Map<string, Dia>, dias: string[], medida: Medida) {
  const soma = new Map<string, number>();

  for (const dia of dias) {
    for (const [livro, valores] of porDia.get(dia)?.livros ?? []) {
      soma.set(livro, (soma.get(livro) ?? 0) + valores[medida]);
    }
  }

  return [...soma]
    .map(([livro, valor]) => ({ livro, valor }))
    .filter(({ valor }) => valor > 0)
    .sort((a, b) => b.valor - a.valor);
}

const MAX_BARRAS_DIARIAS = 60;

/** Uma barra por dia; acima de 60 dias, uma por semana (rótulo = primeiro dia da semana). */
export function barrasDoGrafico(porDia: Map<string, Dia>, dias: string[], medida: Medida) {
  if (dias.length <= MAX_BARRAS_DIARIAS) {
    return dias.map((dia) => ({ rotulo: dia, valor: porDia.get(dia)?.[medida] ?? 0 }));
  }

  const barras: { rotulo: string; valor: number }[] = [];

  dias.forEach((dia, i) => {
    if (i % 7 === 0) barras.push({ rotulo: dia, valor: 0 });
    barras[barras.length - 1].valor += porDia.get(dia)?.[medida] ?? 0;
  });

  return barras;
}

export function formatarTempo(segundos: number) {
  const minutos = Math.round(segundos / 60);

  if (minutos < 60) return `${minutos} min`;

  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}
