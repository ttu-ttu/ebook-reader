// Teste do R5: gera cartas pela Edge Function gemini e grava um relatório para ouvir e ler.
// Uso (na raiz): node tools/gerar-cartas-teste.ts [pasta]   (padrão: dicts/r5)
// Lê <pasta>/cartas.json ([{ word, reading, sentence (com <b>), before, after }]) e, se existir,
// <pasta>/precos.json ({ "<modelo>": { "entrada": US$/1M, "saida": US$/1M } }). Pede e-mail e senha
// no terminal; lê a URL e a anon key de apps/web/.env. Grava em <pasta>/<data-hora>/: os WAV,
// medidas.json e relatorio.html. No fim, marca as cartas como apagadas e tira os áudios do bucket
// (--manter deixa tudo lá). Fora do git: as frases são do livro.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { argv, stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

const raiz = join(import.meta.dirname, '..');
const doApp = createRequire(join(raiz, 'apps/web/package.json'));
const { createClient } = await import(pathToFileURL(doApp.resolve('@supabase/supabase-js')).href);

const env = Object.fromEntries(
  readFileSync(join(raiz, 'apps/web/.env'), 'utf8')
    .split(/\r?\n/)
    .map((linha) => linha.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
    .filter((m) => m)
    .map((m) => [m![1], m![2].replace(/^["']|["']$/g, '')])
);

const manter = argv.includes('--manter');
const pasta = join(raiz, argv.slice(2).find((a) => !a.startsWith('--')) ?? 'dicts/r5');
type Entrada = {
  word: string;
  reading: string;
  sentence: string;
  before?: string | null;
  after?: string | null;
};
const cartas: Entrada[] = JSON.parse(readFileSync(join(pasta, 'cartas.json'), 'utf8'));
const precos: Record<string, { entrada: number; saida: number }> = existsSync(
  join(pasta, 'precos.json')
)
  ? JSON.parse(readFileSync(join(pasta, 'precos.json'), 'utf8'))
  : {};

async function perguntar(texto: string, oculto = false) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  if (oculto) {
    // Não ecoa a senha.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      if (s.startsWith(texto)) stdout.write(texto);
    };
  }
  const resposta = await rl.question(texto);
  rl.close();
  if (oculto) stdout.write('\n');
  return resposta.trim();
}

const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});
const email = await perguntar('E-mail: ');
const senha = await perguntar('Senha: ', true);
const { error: erroLogin } = await supabase.auth.signInWithPassword({ email, password: senha });
if (erroLogin) throw erroLogin;

const saida = join(pasta, new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
mkdirSync(saida, { recursive: true });

type Uso = { entrada: number; saida: number; total: number };
type Medida = {
  modelo: string;
  uso: Uso;
  bytes?: number;
  segundos?: number;
  // Voz da palavra: a cadeia dica → conferência → kana devolve as chamadas em partes.
  partes?: Medida[];
  via?: 'dica' | 'kana' | 'confira';
  tentativas?: { via: string; ouvido?: string; erro?: string }[];
};
type Resultado = Entrada & {
  id: string;
  estado: string;
  motivo?: string;
  segundosGeracao: number;
  significado?: string;
  traducao?: string;
  audioPalavra?: string;
  audioFrase?: string;
  medidas: Record<string, Medida>;
};

const custo = (m?: Medida): number => {
  if (m?.partes) return m.partes.reduce((s, parte) => s + custo(parte), 0);
  const p = m && precos[m.modelo];
  return p ? (m.uso.entrada * p.entrada + (m.uso.total - m.uso.entrada) * p.saida) / 1e6 : 0;
};

// Sobras de uma rodada interrompida.
{
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from('batch_items')
    .update({ deleted_at: agora, modified_at: agora })
    .eq('book_id', 'r5-teste')
    .is('deleted_at', null);
  if (error) throw error;
}

// Corpo do erro HTTP da função (o supabase-js só diz "non-2xx").
async function corpoDoErro(erro: { context?: Response; message: string } | null) {
  if (!erro) return undefined;
  try {
    const corpo = await erro.context?.json();
    return `${erro.context?.status} ${corpo?.erro ?? corpo?.message ?? JSON.stringify(corpo)}`;
  } catch {
    return erro.message;
  }
}

const resultados: Resultado[] = [];
let errosSeguidos = 0;
for (const [i, carta] of cartas.entries()) {
  const { data: linha, error } = await supabase
    .from('batch_items')
    .insert({
      book_id: 'r5-teste',
      word: carta.word,
      word_reading: carta.reading,
      sentence: carta.sentence,
      sentence_before: carta.before ?? null,
      sentence_after: carta.after ?? null,
      notes: 'R5'
    })
    .select('id')
    .single();
  if (error) throw error;

  const inicio = Date.now();
  const { data, error: erroFuncao } = await supabase.functions.invoke('gemini', {
    body: { action: 'generate', id: linha.id }
  });
  const segundosGeracao = (Date.now() - inicio) / 1000;
  const resultado: Resultado = {
    ...carta,
    id: linha.id,
    estado: data?.estado ?? 'erro',
    motivo: data?.motivo ?? (await corpoDoErro(erroFuncao)),
    segundosGeracao,
    significado: data?.campos?.word_meaning,
    traducao: data?.campos?.sentence_meaning,
    medidas: data?.medidas ?? {}
  };

  for (const [campo, chave] of [
    ['word_audio_path', 'audioPalavra'],
    ['sentence_audio_path', 'audioFrase']
  ] as const) {
    const caminho: string | undefined = data?.campos?.[campo];
    if (!caminho) continue;
    const { data: blob, error: erroAudio } = await supabase.storage.from('audio').download(caminho);
    if (erroAudio) throw erroAudio;
    const nome = caminho.split('/').at(-1)!;
    writeFileSync(join(saida, nome), new Uint8Array(await blob.arrayBuffer()));
    resultado[chave] = nome;
  }

  resultados.push(resultado);
  const total = Object.values(resultado.medidas).reduce((s, m) => s + custo(m), 0);
  console.log(
    `${i + 1}/${cartas.length} ${carta.word} ${resultado.estado} ${segundosGeracao.toFixed(1)} s` +
      (total ? ` US$ ${total.toFixed(5)}` : '') +
      (resultado.medidas.palavra?.via ? ` voz da palavra: ${resultado.medidas.palavra.via}` : '') +
      (resultado.motivo ? ` (${resultado.motivo})` : '')
  );
  if (resultado.motivo?.startsWith('403')) {
    const { data: login } = await supabase.auth.getUser();
    console.log(
      '\nO secret ALLOWED_USER_ID não é o seu usuário. Na raiz, rode e depois este script de novo:\n' +
        `npx supabase secrets set ALLOWED_USER_ID=${login.user.id}`
    );
    break;
  }
  errosSeguidos = resultado.estado === 'gerada' ? 0 : errosSeguidos + 1;
  if (errosSeguidos === 3) {
    console.log('3 erros seguidos; parando.');
    break;
  }
}

if (!manter) {
  const ids = resultados.map((r) => r.id);
  const agora = new Date().toISOString();
  await supabase
    .from('batch_items')
    .update({ deleted_at: agora, modified_at: agora })
    .in('id', ids);
  const { data: login } = await supabase.auth.getUser();
  const caminhos = [
    ...new Set(
      resultados.flatMap((r) =>
        [r.audioPalavra, r.audioFrase].filter(Boolean).map((n) => `${login.user.id}/${n}`)
      )
    )
  ];
  if (caminhos.length) await supabase.storage.from('audio').remove(caminhos);
}

// Resumo: médias por carta gerada.
const geradas = resultados.filter((r) => r.estado === 'gerada');
const media = (f: (r: Resultado) => number) =>
  geradas.length ? geradas.reduce((s, r) => s + f(r), 0) / geradas.length : 0;
const resumo = {
  cartas: resultados.length,
  geradas: geradas.length,
  segundosGeracao: media((r) => r.segundosGeracao),
  bytesPalavra: media((r) => r.medidas.palavra?.bytes ?? 0),
  bytesFrase: media((r) => r.medidas.frase?.bytes ?? 0),
  segundosPalavra: media((r) => r.medidas.palavra?.segundos ?? 0),
  segundosFrase: media((r) => r.medidas.frase?.segundos ?? 0),
  tokensTexto: media((r) => r.medidas.texto?.uso.total ?? 0),
  tokensPalavra: media((r) => r.medidas.palavra?.partes?.reduce((s, m) => s + m.uso.total, 0) ?? 0),
  tokensFrase: media((r) => r.medidas.frase?.uso.total ?? 0),
  custoPorCarta: media((r) => Object.values(r.medidas).reduce((s, m) => s + custo(m), 0)),
  modelos: [
    ...new Set(
      geradas.flatMap((r) =>
        Object.values(r.medidas).flatMap((m) => (m.partes ?? [m]).map((p) => p.modelo))
      )
    )
  ],
  vias: Object.fromEntries(
    (['dica', 'kana', 'confira'] as const).map((v) => [
      v,
      geradas.filter((r) => r.medidas.palavra?.via === v).length
    ])
  )
};
writeFileSync(join(saida, 'medidas.json'), JSON.stringify({ resumo, resultados }, null, 1));

const html = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const negrito = (s: string) => html(s).replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>');
const kb = (b: number) => `${(b / 1024).toFixed(0)} KB`;
const linhas = resultados
  .map(
    (r, i) => `<tr>
<td>${i + 1}</td>
<td class="ja"><b>${html(r.word)}</b><br>${html(r.reading)}</td>
<td>${html(r.significado)}${r.motivo ? `<p class="erro">${html(r.motivo)}</p>` : ''}</td>
<td><span class="ja">${negrito(r.sentence)}</span><br>${html(r.traducao)}</td>
<td>${r.audioPalavra ? `<audio controls preload="none" src="${r.audioPalavra}"></audio>` : ''}${vozDaPalavra(r.medidas.palavra)}</td>
<td>${r.audioFrase ? `<audio controls preload="none" src="${r.audioFrase}"></audio>` : ''}</td>
</tr>`
  )
  .join('\n');
const por100 = (x: number) => x * 100;
function vozDaPalavra(m?: Medida) {
  if (!m?.via) return '';
  const passos = (m.tentativas ?? [])
    .map((t) => `${t.via}: ${t.erro ? 'erro' : 'ouviu ' + t.ouvido}`)
    .join('; ');
  return `<br><span class="${m.via === 'confira' ? 'erro' : ''}">${m.via}</span> <small>(${html(passos)})</small>`;
}
writeFileSync(
  join(saida, 'relatorio.html'),
  `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>R5 · cartas de teste</title>
<style>
body{font-family:system-ui,sans-serif;margin:16px;line-height:1.4}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ccc;padding:6px;vertical-align:top;text-align:left}
.ja{font-family:"Noto Sans JP","Meiryo",sans-serif;font-size:1.1em}b{color:#5586cd}.erro{color:#c00}
audio{width:160px}
</style>
<h1>R5 · ${resumo.geradas} de ${resumo.cartas} cartas geradas</h1>
<ul>
<li>Áudio médio: palavra ${kb(resumo.bytesPalavra)} (${resumo.segundosPalavra.toFixed(1)} s), frase ${kb(resumo.bytesFrase)} (${resumo.segundosFrase.toFixed(1)} s); por 100 cartas: ${(por100(resumo.bytesPalavra + resumo.bytesFrase) / 1024 / 1024).toFixed(1)} MB</li>
<li>Tokens médios: texto ${resumo.tokensTexto.toFixed(0)}, voz da palavra ${resumo.tokensPalavra.toFixed(0)}, voz da frase ${resumo.tokensFrase.toFixed(0)}</li>
<li>Custo médio por carta: US$ ${resumo.custoPorCarta.toFixed(5)}; por 100 cartas: US$ ${por100(resumo.custoPorCarta).toFixed(3)}${Object.keys(precos).length ? '' : ' (sem precos.json)'}</li>
<li>Voz da palavra: dica ${resumo.vias.dica}, kana ${resumo.vias.kana}, confira ${resumo.vias.confira}</li>
<li>Geração: ${resumo.segundosGeracao.toFixed(1)} s por carta; modelos: ${html(resumo.modelos.join(', '))}</li>
</ul>
<table><tr><th>#</th><th>Palavra</th><th>Significado</th><th>Frase e tradução</th><th>Voz da palavra</th><th>Voz da frase</th></tr>
${linhas}
</table></html>`
);

console.log(`\nRelatório: ${join(saida, 'relatorio.html')}`);
