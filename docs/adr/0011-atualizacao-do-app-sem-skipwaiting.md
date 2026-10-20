# Atualização do app sem skipWaiting

O service worker do ttu chama `skipWaiting()` e apaga o cache da versão anterior ao ativar. No Dokusho, a versão nova espera: o app mostra "Nova versão: atualizar" fora do leitor (Biblioteca, Início), e a versão nova também entra na próxima abertura do zero.

Com a troca imediata, a página aberta continua com o código velho, e o primeiro pedaço de código ainda não carregado (o painel da palavra, por exemplo) não existe mais nem no cache nem na Vercel, que só serve a versão nova. O resultado é um botão morto ou uma tela em branco no meio da leitura. Não volte ao `skipWaiting()` automático sem resolver isso.
