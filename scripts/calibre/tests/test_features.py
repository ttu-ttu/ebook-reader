"""Tests for the parts of jiten/features.py that don't need Sudachi. Run from the repo root:
python3 -m unittest discover -s scripts/calibre/tests
"""
import math
import os
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'jiten'))
from features import (EXTRA_FEATURES, Analysis, Word, _coverage_rank, _origin, book_text,  # noqa: E402
                      compute_extra_features, to_hiragana, vn_text)

OPF = '''<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
<manifest>
  <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  <item id="c1" href="text/p-001.xhtml" media-type="application/xhtml+xml"/>
  <item id="col" href="text/colophon.xhtml" media-type="application/xhtml+xml"/>
</manifest>
<spine><itemref idref="nav"/><itemref idref="c1"/><itemref idref="col"/></spine>
</package>'''


def epub(chapter: str):
    path = os.path.join(tempfile.mkdtemp(), 'book.epub')
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/>'
                                                   '</rootfiles></container>')
        archive.writestr('OEBPS/content.opf', OPF)
        archive.writestr('OEBPS/nav.xhtml', '<html><body><p>目次</p></body></html>')
        archive.writestr('OEBPS/text/p-001.xhtml', f'<html><body>{chapter}</body></html>')
        archive.writestr('OEBPS/text/colophon.xhtml', '<html><body><p>発行所　株式会社</p></body></html>')
    return path


class Frequency:
    def __init__(self, ranks):
        self.ranks = ranks

    def word(self, key, reading=None):
        rank = self.ranks.get(key.split('\t')[0])
        return (rank, 1 / rank) if rank else None


class BookTextTest(unittest.TestCase):
    def test_skips_contents_and_colophon_and_counts_ruby(self):
        ruby = {}
        text = book_text(epub('<p><ruby>本気<rt>マジ</rt></ruby>で<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp>'
                              '</ruby>を読む。</p>'), 'EPUB', ruby)
        self.assertEqual(text, '本気で漢字を読む。')
        self.assertEqual(ruby, {'ruby': 2, 'kanji': 4, 'katakana': 1})

    def test_aozora_ruby_in_txt(self):
        path = os.path.join(tempfile.mkdtemp(), 'book.txt')
        with open(path, 'w', encoding='utf-8') as f:
            f.write('吾輩《わがはい》は｜猫《ねこ》である。\n')
        ruby = {}
        self.assertEqual(book_text(path, 'TXT', ruby), '吾輩は猫である。')
        self.assertEqual(ruby, {'ruby': 2, 'kanji': 3})

    def test_vn_script_in_folder_and_zip(self):
        script = '*start\nbg "a.png",1\n[太郎|voice/v1.ogg]「(本気/マジ)だ!w500」@\n　吾輩は#ffffff猫である。\\\nend\n'
        folder = tempfile.mkdtemp()
        with open(os.path.join(folder, 'nscript.dat'), 'wb') as f:
            f.write(bytes(b ^ 0x84 for b in script.encode('cp932')))
        ruby = {}
        self.assertEqual(vn_text(folder, ruby), '「本気だ」\n吾輩は猫である。')
        self.assertEqual(ruby, {'ruby': 1, 'kanji': 2, 'katakana': 1})
        path = os.path.join(tempfile.mkdtemp(), 'game.zip')
        with zipfile.ZipFile(path, 'w') as archive:
            archive.writestr('Game/1.txt', '二行目\n'.encode())
            archive.writestr('Game/0.txt', script.encode())
            archive.writestr('Game/sub/0.txt', '無視\n'.encode())
        self.assertEqual(vn_text(path), '「本気だ」\n吾輩は猫である。\n二行目')


class FeatureTest(unittest.TestCase):
    def test_origin_uses_unidic(self):
        self.assertEqual(_origin('手紙', 'noun'), 'wago')  # two kanji, but wago
        self.assertEqual(_origin('勉強', 'noun'), 'kango')
        self.assertEqual(_origin('場所', 'noun'), 'unknown')  # mixed (ば + しょ)
        self.assertEqual(_origin('テレビ', 'noun'), 'gairaigo')
        self.assertEqual(_origin('東京', 'name'), 'unknown')

    def test_coverage_rank(self):
        ranked = [(1, 50), (10, 40), (5000, 8), (90000, 2)]
        self.assertEqual(_coverage_rank(ranked, 0.90), 10)
        self.assertEqual(_coverage_rank(ranked, 0.95), 5000)
        self.assertEqual(_coverage_rank(ranked, 0.99), 90000)
        self.assertTrue(math.isnan(_coverage_rank([], 0.95)))

    def test_to_hiragana(self):
        self.assertEqual(to_hiragana('コト'), 'こと')

    def test_extra_features(self):
        words = {('の\tparticle', 'の'): [Word('の\tparticle', 'の', 'particle', 'wago', (), 'の'), 95],
                 ('魔法\tnoun', '魔法'): [Word('魔法\tnoun', '魔法', 'noun', 'kango', (), '魔法'), 5]}
        analysis = Analysis(text='魔法の本を読んだ。\n鬱だ', words=words, word_count=100, line_sentence_count=2,
                            predicates=3, relative_clauses=1, mattr=0.5)
        extra = compute_extra_features(analysis, Frequency({'の': 1, '魔法': 2000}), {'ruby': 1, 'kanji': 1, 'katakana': 1})
        self.assertEqual(list(extra), EXTRA_FEATURES)
        self.assertAlmostEqual(extra['CoverageRank95'], math.log(1))
        self.assertAlmostEqual(extra['CoverageRank98'], math.log(2000))
        self.assertEqual(extra['PredicatesPerSentence'], 1.5)
        self.assertEqual(extra['RelativeClausesPerSentence'], 0.5)
        self.assertAlmostEqual(extra['NonJoyoKanjiShare'], 0)  # 鬱 became 常用 in 2010
        self.assertAlmostEqual(extra['RubyKanjiShare'], 1 / 5)  # 魔法本読鬱
        self.assertEqual(extra['RubyKatakanaShare'], 1)


if __name__ == '__main__':
    unittest.main()
