// Lista de modelos com reserva e tentativas; acesso só do usuário configurado. Sem imports: roda no
// Deno e no vitest. Os nomes dos modelos vêm dos secrets GEMINI_MODELOS_TEXTO e GEMINI_MODELOS_TTS.

export class ErroGemini extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    // Final: não adianta tentar outro modelo nem esperar (teto diário, chave inválida).
    readonly final = false
  ) {
    super(mensagem);
  }
}

export function lerLista(nome: string, valor: string | undefined) {
  const lista = (valor ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lista.length) throw new Error(`Configuração ${nome} vazia`);
  return lista;
}

export function usuarioPermitido(usuario: string, permitido: string | undefined) {
  // Espaços e aspas de um secret colado no terminal não contam.
  const limpo = (permitido ?? '').trim().replace(/^["']|["']$/g, '');
  return !!limpo && usuario === limpo;
}

// Modelo fora do ar, sem cota ou inexistente: tenta o próximo da lista.
function trocaModelo(erro: unknown) {
  if (!(erro instanceof ErroGemini)) return true;
  if (erro.final) return false;
  return erro.status === 404 || erro.status === 429 || erro.status >= 500;
}

const TENTATIVAS = 3;

// Até 3 tentativas; em cada uma, os modelos na ordem da lista. Espera 2 s e depois 6 s.
export async function comReserva<T>(
  modelos: string[],
  chamar: (modelo: string) => Promise<T>,
  opcoes: { esperar?: (ms: number) => Promise<void> } = {}
): Promise<{ valor: T; modelo: string }> {
  const esperar = opcoes.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let ultimo: unknown;
  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    if (tentativa > 0) await esperar(2000 * 3 ** (tentativa - 1));
    for (const modelo of modelos) {
      try {
        return { valor: await chamar(modelo), modelo };
      } catch (erro) {
        if (!trocaModelo(erro)) throw erro;
        ultimo = erro;
      }
    }
  }
  throw ultimo;
}
