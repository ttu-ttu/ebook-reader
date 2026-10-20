"""Saída de referência do genanki para os testes do port em TypeScript (R1).

Uso (Python <= 3.14; o pyyaml não compila no 3.15):
  py -3.14 -m venv tools/.venv
  tools/.venv/Scripts/python -m pip install -r tools/requirements.txt
  tools/.venv/Scripts/python tools/genanki_referencia.py

Grava apps/web/src/lib/functions/anki/genanki-referencia.json, lido pelos testes do vitest.
Valores do modelo copiados de docs/CARDS.md (fonte única).
"""

import json
import os
import sqlite3
import tempfile
import zipfile
from pathlib import Path

import genanki

MODEL_ID = 1760101001
MODEL_NAME = "Leituras (estilo Kaishi)"
DECK = {"id": 1760101002, "nome": "日本語::1. Dokusho", "guid": "leituras-igor", "tag": "dokusho"}

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

TIMESTAMP = 1760900000.5

CASOS_GUID = [
    ["leituras-igor", "開く", "あく"],
    ["leituras-igor", "開く", "ひらく"],
    ["leituras-igor", "止める", "とめる"],
    ["leituras-igor", "止める", "やめる"],
    ["leituras-igor", "方", "かた"],
    ["leituras-igor", "方", "ほう"],
    ["leituras-igor", "気のせい", "きのせい"],
    ["leituras-igor", "ありがとう", "ありがとう"],
    ["leituras-igor", "気のせい"],
    ["leituras-igor", "café", "ação"],
    ["a"],
    [""],
]

NOTAS = [
    {
        "campos": ["気のせい", "きのせい", "impressão minha, coisa da cabeça", "気[き]のせい",
                   "[sound:leituras-aaaaaaaaaaaa.wav]",
                   "最初は<b>気のせい</b>だと思って無視した。",
                   "No começo achei que era impressão minha e ignorei.",
                   "最[さい] 初[しょ]は<b>気[き]のせい</b>だと 思[おも]って 無[む] 視[し]した。",
                   "[sound:leituras-bbbbbbbbbbbb.wav]", "", "", "", "319", ""],
        "etiquetas": ["dokusho", "dokusho::Livro_de_Teste"],
    },
    {
        "campos": ["開く", "あく", "abrir", "開[あ]く", "", "ドアが<b>開いた</b>。", "A porta abriu.",
                   "ドアが<b>開[あ]いた</b>。", "", "Nota", "", "", "", ""],
        "etiquetas": ["dokusho", "dokusho::Livro_de_Teste"],
    },
    {
        "campos": ["開く", "ひらく", "abrir (livro)", "開[ひら]く", "", "本を<b>開く</b>。", "Abro o livro.",
                   "本[ほん]を<b>開[ひら]く</b>。", "", "", "", "", "1200", ""],
        "etiquetas": ["dokusho"],
    },
]

MIDIAS = [
    {"nome": "leituras-aaaaaaaaaaaa.wav", "bytes": [82, 73, 70, 70, 1, 2, 3]},
    {"nome": "leituras-bbbbbbbbbbbb.wav", "bytes": [82, 73, 70, 70, 4, 5, 6, 7]},
]


def modelo():
    return genanki.Model(
        MODEL_ID, MODEL_NAME,
        fields=[{"name": c} for c in CAMPOS],
        templates=[{"name": "Card 1", "qfmt": FRENTE, "afmt": VERSO}],
        css=ESTILO,
    )


def linhas(conn, tabela):
    cur = conn.execute(f"SELECT * FROM {tabela} ORDER BY rowid")
    nomes = [d[0] for d in cur.description]
    return [dict(zip(nomes, linha)) for linha in cur.fetchall()]


def main():
    raiz = Path(__file__).resolve().parent.parent
    saida = raiz / "apps/web/src/lib/functions/anki/genanki-referencia.json"

    m = modelo()
    deck = genanki.Deck(DECK["id"], DECK["nome"])
    for n in NOTAS:
        deck.add_note(genanki.Note(
            model=m, fields=n["campos"], tags=n["etiquetas"],
            guid=genanki.guid_for(DECK["guid"], n["campos"][0], n["campos"][1]),
        ))

    with tempfile.TemporaryDirectory() as tmp:
        caminhos = []
        for midia in MIDIAS:
            p = os.path.join(tmp, midia["nome"])
            with open(p, "wb") as f:
                f.write(bytes(midia["bytes"]))
            caminhos.append(p)

        apkg = os.path.join(tmp, "ref.apkg")
        genanki.Package(deck, media_files=caminhos).write_to_file(apkg, timestamp=TIMESTAMP)

        with zipfile.ZipFile(apkg) as z:
            entradas = z.namelist()
            midia_json = json.loads(z.read("media"))
            arquivos = {nome: list(z.read(nome)) for nome in entradas
                        if nome not in ("collection.anki2", "media")}
            db = os.path.join(tmp, "collection.anki2")
            with open(db, "wb") as f:
                f.write(z.read("collection.anki2"))

        conn = sqlite3.connect(db)
        col = linhas(conn, "col")
        for linha in col:
            for chave in ("conf", "models", "decks", "dconf", "tags"):
                linha[chave] = json.loads(linha[chave])
        schema = [r[0] for r in conn.execute(
            "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name")]
        ref = {
            "genanki": genanki.__version__,
            "guids": [{"valores": c, "guid": genanki.guid_for(*c)} for c in CASOS_GUID],
            "entrada": {"timestamp": TIMESTAMP, "notas": NOTAS, "midias": MIDIAS},
            "apkg": {
                "entradas": entradas,
                "media": midia_json,
                "arquivos": arquivos,
                "schema": schema,
                "col": col,
                "notes": linhas(conn, "notes"),
                "cards": linhas(conn, "cards"),
            },
        }
        conn.close()

    saida.write_text(json.dumps(ref, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"gravado {saida.relative_to(raiz)}")


if __name__ == "__main__":
    main()
