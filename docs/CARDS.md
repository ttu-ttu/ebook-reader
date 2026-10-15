# Cards de Anki: formato e gerador

Origem: artefato "Cards de Anki: formato e gerador" (14/10/2026), copiado para `docs/CARDS.md` em 15/10/2026. Alteração em relação ao artefato: o deck das leituras passou a se chamar `日本語::1. Dokusho` (antes `日本語::1. Leituras`). `MODEL_ID`, os IDs dos decks e os prefixos de `guid` continuam os mesmos.

## Como usar

Este documento é a fonte única do formato dos cards de Anki: eles saem iguais aos do deck Kaishi 1.5k, com os mesmos 14 campos. Quando o formato mudar, muda aqui, uma vez só, e todo projeto que ler este documento passa a gerar o novo formato.

- Nos projetos que geram cards, a instrução é ler este documento antes de gerar e seguir o formato sem alterar.
- Para mudar frente, verso, estilo ou campos, edite este documento, não uma cópia.
- `MODEL_ID` e os IDs dos decks no script não mudam: é por eles que cada importação cai no mesmo tipo de nota e no deck certo.
- Cada projeto gera para o seu deck: o leitor de EPUB (Dokusho) vai para `日本語::1. Dokusho` e o Mugiwara RPG para `日本語::2. Mugiwara RPG`. Ao gerar o .apkg, a opção `--deck dokusho` ou `--deck rpg` escolhe o destino (sem a opção, vale `dokusho`).
- No app, a geração dos campos e do áudio é feita pela Edge Function `gemini` do Supabase (ver `docs/ESCOPO.md`); o formato dos campos, o tipo de nota, os IDs e o guid seguem este documento. O fluxo de áudio por tarefa agendada, descrito na seção "Áudio", vale para as conversas do Claude, não para o app.

## Formato do card

O card é o mais parecido possível com o do Kaishi. Os modelos de frente, verso e estilo do script são cópia dos do Kaishi 1.5k (publicados no README de github.com/donkuri/Kaishi), com os mesmos 14 campos na mesma ordem: Word, Word Reading, Word Meaning, Word Furigana, Word Audio, Sentence, Sentence Meaning, Sentence Furigana, Sentence Audio, Notes, Pitch Accent, Pitch Accent Notes, Frequency, Picture.

- **Frente:** a palavra grande e, embaixo, a frase da leitura com a palavra em negrito azul.
- **Verso:** a palavra com furigana em cima, o significado, a frase com furigana, a tradução da frase e os dois áudios (palavra e frase), como no Kaishi.
- **Deck:** `日本語::1. Dokusho` para as leituras e `日本語::2. Mugiwara RPG` para o RPG, ambos subdecks do deck 日本語. O Kaishi é `日本語::5. Kaishi 1.5k`; o "1." e o "2." põem esses decks acima dele na lista. O nome precisa ser exatamente esse, senão o Anki cria outro deck.
- **Tipo de nota:** "Leituras (estilo Kaishi)", o mesmo nos dois decks. Tem nome e ID próprios para a importação nunca mexer no tipo de nota do Kaishi.
- **Etiquetas:** a origem do card (L17, L18...) e a etiqueta do deck, `dokusho` ou `rpg`. A origem não aparece no card, como no Kaishi.

O que fica diferente do Kaishi: não há imagem (o campo existe, mas fica vazio), o áudio é sintético (Gemini TTS, voz Orus) e os significados são em português nos cards das conversas. Os cards gerados antes de 2026-10-13 ficam sem áudio.

> Nota para o app: o `ESCOPO.md` decidiu que, no leitor, Word Meaning usa a glosa em inglês do dicionário e só a tradução da frase é em português. A regra do artefato original (significado em português) vale para os cards gerados nas conversas.

## Como preencher cada card

Confira a leitura de cada kanji antes de gerar: furigana errado no card ensina errado, e um kanji lido errado pela voz também.

- `palavra`: forma de dicionário, escrita como no texto.
- `leitura`: em hiragana.
- `significado`: em português, curto.
- `palavra_furigana`: a palavra no formato de furigana do Anki, kanji por kanji, como no Kaishi: `最[さい] 初[しょ]`, `気[き]のせい`.
- `frase`: a frase da leitura em que a palavra apareceu, com a palavra entre `<b>` e `</b>` na forma em que está na frase (se estiver conjugada, o negrito cobre a forma conjugada).
- `frase_significado`: tradução da frase em português.
- `frase_furigana`: a mesma frase com furigana em todos os kanji. Coloque um espaço antes de cada kanji que vem depois de kana, para o furigana ficar só sobre o kanji: `だと 思[おも]って`.
- `origem`: a leitura, por exemplo `L16`.
- `nota` (opcional): observação de uso. Aparece no verso como "Note: ...", igual ao Kaishi.
- `audio_palavra` e `audio_frase` (opcionais): o texto que a voz vai ler, quando a leitura de algum kanji for ambígua para a voz. Escreva o trecho duvidoso em kana. Exemplo: 大家さん pode ser lido たいか, então a frase vai como `おおやさんはすぐに濃いコーヒーを作ってくれた。`. Sem esses campos, a voz lê a `palavra` e a `frase` sem o negrito.

Exemplo de JSON:

```json
[
  {
    "palavra": "気のせい",
    "leitura": "きのせい",
    "significado": "impressão minha, coisa da cabeça",
    "palavra_furigana": "気[き]のせい",
    "frase": "最初は<b>気のせい</b>だと思って無視した。",
    "frase_significado": "No começo achei que era impressão minha e ignorei.",
    "frase_furigana": "最[さい] 初[しょ]は<b>気[き]のせい</b>だと 思[おも]って 無[む] 視[し]した。",
    "origem": "L16"
  }
]
```

## Áudio

Cada card leva o áudio da palavra (campo Word Audio) e o da frase (Sentence Audio), feitos pelo Gemini TTS: modelo `gemini-3.8-flash-tts` (com os outros modelos TTS de reserva), voz Orus, no plano pago do "Default Gemini Project". O custo é de centavos de dólar por mês.

As conversas de projeto não alcançam o Gemini (o ambiente delas bloqueia o endereço). Por isso o áudio sai de uma tarefa agendada à parte, **"Áudio das leituras (Gemini)"** (`trig_01F2QpCJ2VJaP7orapodNA9N`), sem horário, que roda no ambiente Default. A chave do Gemini fica numa credencial desse ambiente: nunca a peça nem a escreva em lugar nenhum. A conversa e a tarefa se falam pela página **"Áudio das Leituras"** (artifact `https://claude.ai/artifact/21ge7Q8aZFXYb25fwmjoWK`): a conversa publica o pedido ali, dispara a tarefa, e a tarefa publica no mesmo lugar os áudios em WAV. O script da tarefa está no prompt dela.

Passo a passo, depois da aprovação dos cards:

1. Salve `gerar_cards.py` (seção seguinte), rode `pip install --break-system-packages genanki` e monte o `cards.json`.
2. Rode `python3 gerar_cards.py pedido cards.json pendente.html`. Ele imprime o ID do pedido e gera a página pendente.
3. Leia o artifact com a ferramenta Artifact (`action: "read"`, só a `url`, sem `path`); a publicação exige essa leitura antes. Depois publique `pendente.html` nele (`action: "publish"`, a mesma `url`, sem `icon`).
4. Carregue `mcp__claude-code-remote__fire_trigger` com ToolSearch e dispare `trig_01F2QpCJ2VJaP7orapodNA9N` **sem texto**: o texto do disparo não chega à tarefa a tempo; o pedido vai só pela página. Dispare uma vez por pedido.
5. Espere. Rode `sleep 90` no Bash, leia a página com `action: "read"`, a `url` e `path: "index.html"` (o arquivo é salvo localmente) e rode `python3 gerar_cards.py estado ARQUIVO_SALVO ID`. Repita a cada 60 segundos até a resposta ser `pronto`, `parcial` ou `falhou`, por no máximo 12 minutos. Costuma levar de 2 a 4 minutos.
6. Com `pronto` ou `parcial`, gere `python3 gerar_cards.py cards.json leituras-LNN.apkg --audio ARQUIVO_SALVO`. O script avisa quais textos ficaram sem áudio. Para os cards do Mugiwara RPG, acrescente `--deck rpg` a esse comando e ao de gerar sem áudio (sem a opção, o destino é o deck das leituras, `dokusho`). Com `falhou`, ou depois de 12 minutos sem resposta, gere sem `--audio`.
7. Envie o `.apkg` com SendUserFile. Se faltou áudio em algum card, diga em uma linha quais e por quê (o motivo vem na linha de `estado`). Não precisa limpar a página depois.

## Script

Salve como `gerar_cards.py`, sem alterar. Não mude `MODEL_ID` nem os IDs dentro de `DECKS`: são eles que fazem cada importação cair no mesmo tipo de nota e no deck certo. Uma palavra importada de novo atualiza o card existente em vez de duplicar, e cada deck tem o seu prefixo de `guid`, então a mesma palavra nos dois decks não se sobrescreve. Os nomes dos arquivos de áudio começam com `leituras-` e vêm de um hash do texto e da voz, então não colidem com a mídia do Kaishi.

```python
#!/usr/bin/env python3
"""Gera um .apkg com cards das leituras, no mesmo formato do deck Kaishi 1.5k, com áudio.

Uso (precisa de: pip install genanki; e do ffmpeg para o áudio):
  python3 gerar_cards.py pedido cards.json pendente.html
      Monta o pedido de áudio (palavra + frase de cada card) e a página pendente que vai
      para o artifact "Áudio das Leituras". Imprime o ID do pedido.
  python3 gerar_cards.py estado pagina.html ID_DO_PEDIDO
      Diz se a página já traz o pedido: esperando, pronto, parcial ou falhou.
  python3 gerar_cards.py cards.json saida.apkg --audio pagina.html
      Gera o .apkg com o áudio que a tarefa devolveu na página "Áudio das Leituras".
  python3 gerar_cards.py cards.json saida.apkg
      Gera o .apkg sem áudio (cards ficam com os campos de áudio vazios).
  Nos dois comandos de geração, --deck dokusho (padrão) ou --deck rpg escolhe o deck de destino.

Os modelos de frente, verso e estilo são cópia dos do Kaishi 1.5k (README de
github.com/donkuri/Kaishi), com os mesmos campos na mesma ordem. O tipo de nota tem
nome e ID próprios, para nunca alterar o tipo de nota do Kaishi que o Igor já usa.
NÃO mude MODEL_ID nem os ids de DECKS: são eles que fazem cada importação nova cair no
mesmo deck e no mesmo tipo de nota.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import base64
from datetime import datetime

import genanki

MODEL_ID = 1760101001
# Um deck por destino. O "1." e o "2." põem os dois acima do "5. Kaishi 1.5k" na lista.
DECKS = {
    "dokusho": {"id": 1760101002, "nome": "日本語::1. Dokusho", "guid": "leituras-igor", "tag": "dokusho"},
    "rpg": {"id": 1760101003, "nome": "日本語::2. Mugiwara RPG", "guid": "rpg-igor", "tag": "rpg"},
}
MODEL_NAME = "Leituras (estilo Kaishi)"
VOZES = ["Orus"]  # voz do Gemini TTS escolhida pelo Igor (para alternar, ponha mais nomes; cada card fica com uma)

CAMPOS = ["Word", "Word Reading", "Word Meaning", "Word Furigana", "Word Audio",
          "Sentence", "Sentence Meaning", "Sentence Furigana", "Sentence Audio",
          "Notes", "Pitch Accent", "Pitch Accent Notes", "Frequency", "Picture"]

FRENTE = """<div lang="ja">
{{Word}}
<div style='font-size: 20px;'>{{Sentence}}</div>
</div>"""

VERSO = """<div lang="ja">
{{furigana:Word Furigana}}

<!-- This part enables pitch accent.

{{#Pitch Accent}}
	<br><div style='font-size: 24px'>{{Pitch Accent}}</div>
{{/Pitch Accent}}

-->

<div style='font-size: 25px; padding-bottom:20px'>{{Word Meaning}}</div>
<div style='font-size: 25px;'>{{furigana:Sentence Furigana}}</div>
<div style='font-size: 25px; padding-bottom:10px'>{{Sentence Meaning}}</div>

{{Word Audio}}
{{Sentence Audio}}
<br>
{{Picture}}

{{#Notes}}
	<br>
	<div style="font-size: 20px; padding-top:12px">Note: {{Notes}}</div>
{{/Notes}}

<!-- This part enables pitch accent notes.

{{#Pitch Accent Notes}}
<div style="font-size: 20px; width: fit-content; max-width:40vw; margin: auto">
	<details><summary>Pitch Accent Notes</summary>
		<br>{{Pitch Accent Notes}}
	</details>
</div>
{{/Pitch Accent Notes}}

-->

</div>"""

ESTILO = """.card {
 font-family: "ヒラギノ角ゴ Pro W3", "Hiragino Kaku Gothic Pro", "Noto Sans JP", Osaka, "メイリオ", Meiryo, "ＭＳ Ｐゴシック", "MS PGothic", "MS UI Gothic", sans-serif;
 font-size: 44px;
 text-align: center;
}

img {
max-width: 300px;
max-height: 250px;
}

.mobile img {
max-width: 50vw;
}

/* This part defines the bold color. */
b{color: #5586cd}
"""

MODELO = genanki.Model(
    MODEL_ID, MODEL_NAME,
    fields=[{"name": c} for c in CAMPOS],
    templates=[{"name": "Card 1", "qfmt": FRENTE, "afmt": VERSO}],
    css=ESTILO,
)

OBRIGATORIOS = ["palavra", "leitura", "significado", "palavra_furigana",
                "frase", "frase_significado", "frase_furigana", "origem"]


def carregar(caminho):
    cards = json.load(open(caminho, encoding="utf-8"))
    for c in cards:
        for k in OBRIGATORIOS:
            if not c.get(k):
                sys.exit(f"ERRO: card '{c.get('palavra', '?')}' sem o campo '{k}'.")
        for k in ("frase", "frase_furigana"):
            if "<b>" not in c[k]:
                sys.exit(f"ERRO: em '{c['palavra']}', o campo '{k}' precisa da palavra entre <b> e </b>.")
    return cards


def textos_audio(c):
    """O que o Gemini lê: a palavra e a frase sem HTML. 'audio_palavra' e 'audio_frase'
    substituem, quando a leitura de um kanji for ambígua (escreva em kana)."""
    palavra = c.get("audio_palavra") or c["palavra"]
    frase = c.get("audio_frase") or re.sub(r"<[^>]+>", "", c["frase"])
    return palavra.strip(), frase.strip()


def voz_do_card(c):
    """Escolhe a voz do card pela palavra: sempre a mesma para a mesma palavra,
    e mais ou menos metade dos cards com cada voz. Palavra e frase usam a mesma voz."""
    h = int(hashlib.sha1(f"voz|{c['palavra']}".encode("utf-8")).hexdigest(), 16)
    return VOZES[h % len(VOZES)]


def nome_audio(texto, voz):
    return "leituras-" + hashlib.sha1(f"{voz}|{texto}".encode("utf-8")).hexdigest()[:12]


def pedido(cards):
    itens, vistos = [], set()
    for c in cards:
        voz = voz_do_card(c)
        for texto in textos_audio(c):
            nome = nome_audio(texto, voz) + ".wav"
            if nome not in vistos:
                vistos.add(nome)
                itens.append({"nome": nome, "texto": texto, "voz": voz})
    return {"pedido": datetime.now().strftime("%Y%m%d-%H%M%S"), "itens": itens}


PENDENTE = """<title>Áudio das Leituras</title>
<style>
:root { --bg: #f6f7f9; --fg: #1d2330; --muted: #5d6676; --line: #dde1e8; --accent: #5586cd; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #14171d; --fg: #e6e9ef; --muted: #9aa3b2; --line: #2b313c; --accent: #7fa6e0; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #14171d; --fg: #e6e9ef; --muted: #9aa3b2; --line: #2b313c; --accent: #7fa6e0; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; font-size: 15px; line-height: 1.5; }
main { max-width: 44rem; margin: 0 auto; padding-inline: 16px; padding-block: 28px 48px; display: grid; gap: 16px; }
h1 { font-size: 1.5rem; margin: 0; }
.meta { color: var(--muted); font-family: ui-monospace, monospace; font-size: 0.85rem; }
ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
li { padding-block: 10px; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
li span { color: var(--accent); font-family: ui-monospace, monospace; font-size: 0.8rem; margin-left: 8px; }
</style>
<main>
  <h1>Áudio das Leituras</h1>
  <div class="meta">PENDENTE · pedido {pedido} · {n} áudios na fila</div>
  <ul>{linhas}</ul>
</main>
<script type="application/json" id="audio-pedido">{dados}</script>
"""


def pagina_pendente(p):
    import html as _h
    linhas = "".join(f"<li>{_h.escape(it['texto'])}<span>{it['voz']}</span></li>" for it in p["itens"])
    valores = {"pedido": p["pedido"], "n": str(len(p["itens"])), "linhas": linhas,
               "dados": json.dumps(p, ensure_ascii=False).replace("</", "<\\/")}
    return re.sub(r"\{(pedido|n|linhas|dados)\}", lambda m: valores[m.group(1)], PENDENTE)


def ler_pagina(caminho):
    texto = open(caminho, encoding="utf-8").read()
    m = re.search(r'<script type="application/json" id="audio-data">(.*?)</script>', texto, re.S)
    if not m:
        sys.exit("ERRO: a página não tem o bloco audio-data.")
    return json.loads(m.group(1).replace("<\\/", "</"))


def para_mp3(wav_b64, destino):
    """WAV -> MP3 mono 64 kbps, cortando o silêncio do começo e do fim."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(base64.b64decode(wav_b64))
        origem = f.name
    corte = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08"
    filtro = f"{corte},areverse,{corte},areverse"
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", origem, "-af", filtro,
                        "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "64k", destino],
                       capture_output=True, text=True)
    os.unlink(origem)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip())


def main():
    args = sys.argv[1:]
    if len(args) == 3 and args[0] in ("pedido", "pendente"):
        # pedido cards.json saida.html | pendente pedido.json saida.html (pedido pronto, ex.: amostras)
        if args[0] == "pedido":
            p = pedido(carregar(args[1]))
        else:
            p = json.load(open(args[1], encoding="utf-8"))
        open(args[2], "w", encoding="utf-8").write(pagina_pendente(p))
        print(p["pedido"])
        return
    if len(args) == 3 and args[0] == "estado":
        if 'id="audio-data"' not in open(args[1], encoding="utf-8").read():
            print("esperando")
            return
        dados = ler_pagina(args[1])
        if dados.get("pedido") != args[2]:
            print("esperando")
        else:
            erros = [it.get("erro") for it in dados.get("itens", []) if not it.get("ok")]
            print(dados.get("estado", "?") + ("" if not erros else " | " + " | ".join(map(str, erros))[:600]))
        return
    audio_pagina = None
    if "--audio" in args:
        i = args.index("--audio")
        audio_pagina = args[i + 1]
        del args[i:i + 2]
    destino = "dokusho"
    if "--deck" in args:
        i = args.index("--deck")
        destino = args[i + 1]
        del args[i:i + 2]
    if destino not in DECKS:
        sys.exit(f"ERRO: deck '{destino}' desconhecido. Use: " + ", ".join(DECKS))
    deck_info = DECKS[destino]
    if not args:
        sys.exit(__doc__)
    cards = carregar(args[0])
    saida = args[1] if len(args) > 1 else "leituras-cards.apkg"

    disponiveis = {}
    if audio_pagina:
        dados = ler_pagina(audio_pagina)
        disponiveis = {it["nome"]: it["wav"] for it in dados.get("itens", []) if it.get("ok")}
    pasta = tempfile.mkdtemp(prefix="audio-leituras-")
    midia, faltando = [], []

    def campo_audio(texto, voz):
        if not audio_pagina:
            return ""
        base = nome_audio(texto, voz)
        wav = disponiveis.get(base + ".wav")
        if not wav:
            faltando.append(texto)
            return ""
        mp3 = os.path.join(pasta, base + ".mp3")
        if mp3 not in midia:
            try:
                para_mp3(wav, mp3)
            except RuntimeError as e:
                faltando.append(f"{texto} (ffmpeg: {e})")
                return ""
            midia.append(mp3)
        return f"[sound:{base}.mp3]"

    deck = genanki.Deck(deck_info["id"], deck_info["nome"])
    for c in cards:
        t_palavra, t_frase = textos_audio(c)
        voz = voz_do_card(c)
        valores = {
            "Word": c["palavra"], "Word Reading": c["leitura"], "Word Meaning": c["significado"],
            "Word Furigana": c["palavra_furigana"], "Word Audio": campo_audio(t_palavra, voz),
            "Sentence": c["frase"], "Sentence Meaning": c["frase_significado"],
            "Sentence Furigana": c["frase_furigana"], "Sentence Audio": campo_audio(t_frase, voz),
            "Notes": c.get("nota", ""),
        }
        deck.add_note(genanki.Note(
            model=MODELO,
            fields=[valores.get(f, "") for f in CAMPOS],
            guid=genanki.guid_for(deck_info["guid"], c["palavra"]),
            tags=[c["origem"], deck_info["tag"]],
        ))
    pacote = genanki.Package(deck)
    pacote.media_files = midia
    pacote.write_to_file(saida)
    print(f"OK -> {saida} ({len(cards)} cards, {len(midia)} áudios)")
    if faltando:
        print("AVISO: sem áudio para: " + "; ".join(faltando))


if __name__ == "__main__":
    main()
```
