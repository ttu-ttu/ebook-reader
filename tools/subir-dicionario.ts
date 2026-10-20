// Sobe o dicionário preparado para o bucket privado `dicts` (ADR 0004), logado como você.
// Uso (na raiz, depois de node tools/preparar-dicionario.ts): node tools/subir-dicionario.ts [versao]
// Pede e-mail e senha no terminal; lê a URL e a anon key de apps/web/.env.
// Grava <user_id>/dicionario/<versao>/{dicionario.ndjson.gz,manifesto.json} e, por último,
// <user_id>/dicionario/atual.json, que diz ao app qual versão baixar.

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { stdin, stdout } from 'node:process';
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

const pastaSaida = join(raiz, 'dicts', 'saida');
const versao = process.argv[2] ?? readdirSync(pastaSaida).sort().at(-1);
if (!versao) throw new Error('Nada em dicts/saida; rode node tools/preparar-dicionario.ts');
const pasta = join(pastaSaida, versao);
const manifesto = JSON.parse(readFileSync(join(pasta, 'manifesto.json'), 'utf8'));

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
const { data: login, error: erroLogin } = await supabase.auth.signInWithPassword({
  email,
  password: senha
});
if (erroLogin) throw erroLogin;
const usuario = login.user.id;

async function subir(
  caminho: string,
  corpo: Uint8Array | string,
  tipo: string,
  cache = '31536000'
) {
  console.time(caminho);
  const { error } = await supabase.storage
    .from('dicts')
    .upload(caminho, corpo, { contentType: tipo, upsert: true, cacheControl: cache });
  console.timeEnd(caminho);
  if (error) throw error;
}

const base = `${usuario}/dicionario/${versao}`;
await subir(
  `${base}/${manifesto.arquivo}`,
  readFileSync(join(pasta, manifesto.arquivo)),
  'application/gzip'
);
await subir(`${base}/manifesto.json`, JSON.stringify(manifesto), 'application/json');
// atual.json muda a cada versão: sem cache.
await subir(
  `${usuario}/dicionario/atual.json`,
  JSON.stringify({ versao, caminho: `${base}/${manifesto.arquivo}`, ...manifesto }),
  'application/json',
  '0'
);

console.log(`Enviado: ${versao} (${(manifesto.bytes / 1e6).toFixed(1)} MB)`);
await supabase.auth.signOut();
