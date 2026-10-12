"""Jiten's difficulty features, computed locally (Python port of Jiten.Core/ML/MLHelper.cs
and the deck statistics in Jiten.Parser/Parser.cs, Apache-2.0).

Jiten parses text into JMdict words with its own Sudachi-based parser and looks word
frequencies up in its database. Here, Sudachi tokens are grouped into words the same
way (a verb or adjective together with its auxiliaries is one conjugated word, suru
verbs are merged), words are identified by Sudachi's normalised form, and frequencies
come from Jiten's Yomitan frequency list (see frequency.py).

EXTRA_FEATURES are not Jiten's: known-word coverage, syntax, kanji and furigana
measures from the Japanese readability literature (distil/README.md).
"""
import gzip
import json
import os
import html
import math
import posixpath
import re
import statistics
import zipfile
from collections import Counter, deque
from dataclasses import dataclass, field
from functools import lru_cache
from xml.etree import ElementTree

from deconjugator import Deconjugator

# Feature order of Jiten's model (DifficultyPredictor.cs); the distilled model appends two more (service.py).
FEATURE_ORDER = [
    'Ttr', 'AverageSentenceLength', 'DialoguePercentage', 'KanjiRatio',
    'KangoPercentage', 'WagoPercentage', 'GairaigoPercentage', 'VerbPercentage', 'ParticlePercentage',
    'AvgWordPerSentence', 'ReadabilityScore',
    'LogicalConnectorRatio', 'ModalMarkerRatio', 'RelativeClauseMarkerRatio', 'MetaphorMarkerRatio',
    'AvgLogFreqRank', 'StdLogFreqRank', 'AvgLogObsFreq', 'StdLogObsFreq',
    'LowFreqRankPerc', 'AvgReadingFreqRank', 'MedianReadingFreqRank', 'AvgReadingObsFreq',
    'MedianReadingObsFreq', 'AvgReadingFreqPerc', 'AvgCustomScorePerWord',
    'StdCustomWordScore', 'PercCustomScoreAboveSoftcapStart',
    'ratio_negative_conj', 'ratio_polite_conj', 'ratio_conditional_conj', 'ratio_passive_causative_conj',
    'ratio_potential_conj', 'ratio_volitional_conj', 'ratio_imperative_conj', 'ratio_te_form_conj',
    'ratio_past_conj', 'ratio_stem_conj', 'ratio_garu_conj', 'ratio_seemingness_conj', 'ratio_shimau_conj',
    'ratio_contracted_conj', 'ratio_other_conj', 'RatioConjugations', 'ratio_noun_pos', 'ratio_verb_pos',
    'ratio_adj_pos', 'ratio_adv_pos', 'ratio_conjunc_pos', 'ratio_aux_pos', 'ratio_inter_pos',
    'ratio_fix_pos', 'ratio_pn_pos', 'ratio_exp_pos', 'ratio_other_pos',
]

# Not Jiten's; appended to FEATURE_ORDER as model inputs (compute_extra_features).
EXTRA_FEATURES = [
    'LogCharacters', 'LogUniqueKanji',
    'CoverageRank90', 'CoverageRank95', 'CoverageRank98', 'Mattr',
    'LineSentenceLength', 'PredicatesPerSentence', 'RelativeClausesPerSentence', 'HiraganaRatio',
    'NonJoyoKanjiShare', 'UpperJoyoKanjiShare', 'RubyKanjiShare', 'RubyKatakanaShare',
]
# Moving-average type/token ratio window (Covington & McFall 2010).
MATTR_WINDOW = 500

HERE = os.path.dirname(os.path.abspath(__file__))
# 常用 kanji -> school grade (1-6 教育漢字, 8 the rest), from KANJIDIC2 (distil/make_tables.py).
with open(os.path.join(HERE, 'kanji-grades.json'), encoding='utf-8') as _f:
    KANJI_GRADES = json.load(_f)
# 語種 of kanji-spelled words from UniDic (distil/make_tables.py): 和, 漢, 外 or 混.
with gzip.open(os.path.join(HERE, 'goshu.json.gz'), 'rt', encoding='utf-8') as _f:
    GOSHU = json.load(_f)
GOSHU_ORIGIN = {'和': 'wago', '漢': 'kango', '外': 'gairaigo', '混': 'unknown'}

# MLConfig.cs
LOW_FREQ_RANK_THRESHOLD = 30000
RANK_BASE = 5000
RANK_EXP_BASE = 10000
RANK_SOFTCAP_START = 90000
RANK_SOFTCAP_STEP = 10000
RANK_HARDCAP = 115000

CONJUGATION_CATEGORIES = {
    'negative': ['negative', 'slurred negative', 'adverbial negative', 'without doing so', 'archaic negative',
                 'formal negative', 'formal negative past', 'negative polite', 'past negative polite'],
    'polite': ['polite', 'negative polite', 'past polite', 'te polite', 'past negative polite', 'polite volitional',
               'formal conditional', 'polite request', 'kind request', 'casual kind request'],
    'conditional': ['conditional', 'formal conditional', 'provisional conditional'],
    'passive_causative': ['passive', 'passive/potential', 'short causative', 'causative'],
    'potential': ['potential', 'passive/potential'],
    'volitional': ['volitional', 'polite volitional'],
    'imperative': ['imperative', 'kind request', 'casual kind request'],
    'te_form': ['(te form)', 'teiru', 'teru (teiru)', 'teoru', 'toru (teoru)', 'tearu', 'teiku', 'teku (teiku)',
                'tekuru'],
    'past': ['past', 'formal negative past', 'past polite', 'past negative polite', 'tari'],
    'stem': ["('a' stem)", '(adverbial stem)', '(ka stem)', '(ke stem)', '(stem)', '(izenkei)', '(mizenkei)',
             '(unstressed infinitive)', '(infinitive)'],
    'garu': ['garu'],
    'seemingness': ['seemingness'],
    'shimau': ['finish/completely/end up'],
    'contracted': ['contracted', 'slurred'],
    'other': ['excess', 'noun form', 'do for someone', 'for now', 'toku (for now)', 'topic/condition', 'while',
              'want', 'too much', '(unstressed infinitive)', '(infinitive)', ''],
}
# Later categories win for details listed twice, as in MLConfig's static constructor.
CONJUGATION_DETAIL_TO_CATEGORY = {d: c for c, details in CONJUGATION_CATEGORIES.items() for d in details}
POS_CATEGORIES = ['noun', 'verb', 'adj', 'adv', 'conjunc', 'aux', 'inter', 'fix', 'pn', 'exp', 'other']

# MLHelper.cs marker words (JMdict IDs there; matched here by their surface forms).
LOGICAL_CONNECTORS = ['結局', 'それに', 'そして', '結果', 'そこで', 'けど', 'けれども', 'にも関わらず',
                      'それにもかかわらず', 'に加えて', 'しかし', 'だが', '一方', 'だから', 'ので', '従って',
                      'なぜなら', 'さらに', 'しかも', 'なお', 'まず', '次に', 'つまり', 'ところで']
MODAL_MARKERS = ['だろう', 'でしょう', 'かもしれない', 'かも', 'はず', '違いない', 'らしい', 'ようだ', 'みたい',
                 'そうだ', 'っぽい', '気がする', '思う', 'かな']
RELATIVE_CLAUSE_MARKERS = ['という', 'といった', 'による', 'について', 'として', '関する', 'に対する', 'めぐる',
                           '通じた', 'すなわち']
METAPHOR_MARKERS = ['のように', 'みたい', 'まるで', 'あたかも', 'ような', 'かのように', 'ようだ']

TOKEN_CLEAN = re.compile(r'[^a-zA-Z0-9぀-ゟ゠-ヿ一-龯Ａ-Ｚａ-ｚ０-９々．]')
DIALOGUE = re.compile(r'[「『].{0,200}?[」』]', re.S)
SENTENCE_ENDERS = set('。！？」')
KATAKANA_WORD = re.compile(r'^[゠-ヿー・]+$')
KANJI_ONLY = re.compile(r'^[㐀-䶿一-鿿豈-﫿々]+$')
HAS_KANJI = re.compile(r'[㐀-䶿一-鿿豈-﫿]')
HIRAGANA = re.compile(r'[ぁ-ゖ]')
KATAKANA_READING = re.compile(r'^[ァ-ヺー・]+$')
HAS_CONTENT = re.compile(r'[0-9A-Za-z぀-ヿ㐀-䶿一-鿿豈-﫿０-ｚ々]')

# Auxiliaries that are part of a conjugated word in Jiten (anything the deconjugator handles).
CONJUGATING_AUX = {'ない', 'ぬ', 'ん', 'ず', 'た', 'ます', 'れる', 'られる', 'せる', 'させる', 'しめる', 'たい',
                   'たがる', 'う', 'よう', 'まい', 'てる', 'とく', 'ちゃう', 'じゃう', 'ちまう', 'じまう', 'す', 'さす'}
JOINING_PARTICLES = {'て', 'で', 'ば', 'ちゃ', 'じゃ', 'たり', 'だり'}
# Verbs after て/で that Jiten folds into the conjugation (teiru, shimau, toku, ...).
TE_AUXILIARY_VERBS = {'いる', 'おる', 'ある', 'いく', 'ゆく', 'くる', 'しまう', 'おく', 'みる', 'やる', 'あげる',
                      'くれる', 'もらう', 'くださる', 'いただく', 'しまる'}
STEM_AUXILIARY_VERBS = {'すぎる', '過ぎる', 'がる', 'だす', '出す', 'はじめる', '始める', 'つづける', '続ける',
                        'おわる', '終わる'}
CONJUGATION_TAG_PREFIX = {'五段': 'v5', '上一段': 'v1', '下一段': 'v1', 'カ行変格': 'vk', 'サ行変格': 'vs',
                          '形容詞': 'adj-i', '助動詞': ''}


def is_kanji(char: str) -> bool:
    code = ord(char)
    return (0x4E00 <= code <= 0x9FFF or 0x3400 <= code <= 0x4DBF or 0xF900 <= code <= 0xFAFF
            or 0x20000 <= code <= 0x3134F)


# ---------------------------------------------------------------------------
# Book text

_BLOCK_END = re.compile(r'</(?:p|div|h[1-6]|li|blockquote|tr|dd|dt)\s*>|<br\s*/?>', re.I)
_RT = re.compile(r'<rt[\s>].*?</rt>|<rp[\s>].*?</rp>', re.S | re.I)
_SKIP = re.compile(r'<(head|script|style)[\s>].*?</\1>', re.S | re.I)
_TAG = re.compile(r'<[^>]+>')


_RUBY = re.compile(r'<ruby[\s>](.*?)</ruby>', re.S | re.I)
_RT_TEXT = re.compile(r'<rt[\s>](.*?)</rt>', re.S | re.I)
# Aozora-style ruby in TXT: ｜base《reading》, or a run of kanji followed by 《reading》.
_AOZORA_RUBY = re.compile(r'(?:｜([^《｜\n]+)|([㐀-䶿一-鿿豈-﫿々〆ヶ]+))《([^》]*)》')
# Spine documents that aren't the story: tables of contents, colophons (奥付), store notices, ads.
_FRONT_MATTER = re.compile(r'^(?:toc|nav|navdoc|contents|colophon|okuduke|okuzuke|caution|copyright'
                           r'|ad|ads|advert|advertisement)[-_]?\d*$', re.I)


def _count_ruby(ruby: dict, base: str, reading: str):
    """Furigana statistics: kanji under ruby, and readings in katakana (マジ over 本気)."""
    kanji = sum(1 for c in base if is_kanji(c))
    if not kanji:
        return
    ruby['ruby'] = ruby.get('ruby', 0) + 1
    ruby['kanji'] = ruby.get('kanji', 0) + kanji
    if KATAKANA_READING.match(reading.strip()):
        ruby['katakana'] = ruby.get('katakana', 0) + 1


def _markup_to_text(markup: str, ruby: dict | None = None) -> str:
    markup = _SKIP.sub('', markup)
    if ruby is not None:
        for match in _RUBY.finditer(markup):
            inner = match.group(1)
            reading = ''.join(_TAG.sub('', r) for r in _RT_TEXT.findall(inner))
            _count_ruby(ruby, html.unescape(_TAG.sub('', _RT.sub('', inner))), html.unescape(reading))
    markup = _RT.sub('', markup)
    markup = _BLOCK_END.sub('\n', markup)
    text = html.unescape(_TAG.sub('', markup))
    return '\n'.join(line.strip() for line in text.splitlines() if line.strip())


def _epub_documents(archive: zipfile.ZipFile):
    container = ElementTree.fromstring(archive.read('META-INF/container.xml'))
    rootfile = next(el for el in container.iter() if el.tag.endswith('rootfile')).get('full-path')
    opf = ElementTree.fromstring(archive.read(rootfile))
    base = posixpath.dirname(rootfile)
    manifest = {el.get('id'): el.get('href') for el in opf.iter()
                if el.tag.endswith('}item') and 'html' in (el.get('media-type') or '')}
    skip = {el.get('id') for el in opf.iter() if el.tag.endswith('}item') and 'nav' in (el.get('properties') or '')}
    skip_hrefs = {(el.get('href') or '').split('#')[0] for el in opf.iter()
                  if el.tag.endswith('}reference') and el.get('type') in ('toc', 'copyright-page', 'colophon')}
    spine = [el for el in opf.iter() if el.tag.endswith('}itemref') and el.get('idref') in manifest]
    story = [el for el in spine if el.get('linear') != 'no' and el.get('idref') not in skip
             and manifest[el.get('idref')] not in skip_hrefs
             and not _FRONT_MATTER.match(posixpath.splitext(posixpath.basename(manifest[el.get('idref')]))[0])]
    for el in story or spine:
        yield posixpath.normpath(posixpath.join(base, manifest[el.get('idref')]))


def book_text(path: str, fmt: str, ruby: dict | None = None) -> str:
    """Plain text of a book, one paragraph per line, without furigana (counted into `ruby`
    if given), tables of contents, colophons or ads."""
    if fmt == 'TXT':
        raw = open(path, 'rb').read()
        for encoding in ('utf-8-sig', 'shift_jis', 'cp932', 'euc_jp', 'utf-16'):
            try:
                text = raw.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            text = raw.decode('utf-8', 'replace')
        # Aozora-style ruby: 漢字《かんじ》 and ｜ markers.
        if ruby is not None:
            for match in _AOZORA_RUBY.finditer(text):
                _count_ruby(ruby, match.group(1) or match.group(2), match.group(3))
        text = re.sub(r'《[^》]*》|｜', '', text)
        return '\n'.join(line.strip() for line in text.splitlines() if line.strip())

    with zipfile.ZipFile(path) as archive:
        if fmt == 'HTMLZ':
            names = sorted(n for n in archive.namelist() if n.lower().endswith(('.html', '.xhtml', '.htm')))
        else:
            names = list(_epub_documents(archive))
        parts = []
        for name in names:
            try:
                parts.append(_markup_to_text(archive.read(name).decode('utf-8', 'replace'), ruby))
            except KeyError:
                continue
    return '\n'.join(p for p in parts if p)


# ---------------------------------------------------------------------------
# Words

@dataclass
class Word:
    key: str  # word identity (Jiten: JMdict WordId)
    form: str  # written form (Jiten: ReadingIndex)
    pos: str  # coarse part of speech, see POS_CATEGORIES plus 'particle' / 'name'
    origin: str  # wago / kango / gairaigo / unknown
    conjugations: tuple[str, ...]
    surface: str
    reading: str | None = None  # hiragana reading of an unconjugated word, to tell homographs apart


@dataclass
class Analysis:
    text: str
    # (key, form) -> [Word (first occurrence), occurrences]; Jiten's DeckWords are unique per
    # (WordId, ReadingIndex), so each written form counts as its own word.
    words: dict = field(default_factory=dict)
    word_count: int = 0
    sentence_count: int = 0
    markers: dict = field(default_factory=dict)
    # Not Jiten's (EXTRA_FEATURES)
    line_sentence_count: int = 0
    predicates: int = 0
    relative_clauses: int = 0
    mattr: float = 0.0


def _origin(text: str, pos: str, normalized: str = '') -> str:
    if pos == 'name':
        return 'unknown'
    goshu = GOSHU.get(text) or GOSHU.get(normalized)
    if goshu:
        return GOSHU_ORIGIN[goshu]
    if KATAKANA_WORD.match(text):
        return 'gairaigo'
    if KANJI_ONLY.match(text):
        return 'kango' if len(text) >= 2 else 'unknown'
    if HAS_KANJI.search(text):
        return 'wago' if text[-1] not in 'するスル' else 'kango'
    return 'wago'


def _coarse_pos(pos: tuple) -> str:
    p0, p1 = pos[0], pos[1]
    if p0 == '名詞':
        if p1 == '固有名詞':
            return 'name'
        return 'noun'
    return {
        '代名詞': 'pn', '形状詞': 'adj', '連体詞': 'adj', '形容詞': 'adj', '動詞': 'verb', '副詞': 'adv',
        '接続詞': 'conjunc', '感動詞': 'inter', '助動詞': 'aux', '助詞': 'particle', '接頭辞': 'fix',
        '接尾辞': 'fix',
    }.get(p0, 'other')


class Token:
    """The parts of a Sudachi morpheme the analysis uses. Morphemes keep their whole
    tokenizer result alive, which on very long books ran workers out of memory."""
    __slots__ = ('_surface', '_dictionary_form', '_normalized_form', '_pos', '_reading')

    def __init__(self, surface: str, dictionary_form: str, normalized_form: str, pos: tuple, reading: str = ''):
        self._surface = surface
        self._dictionary_form = dictionary_form
        self._normalized_form = normalized_form
        self._pos = pos
        self._reading = reading

    def surface(self) -> str:
        return self._surface

    def dictionary_form(self) -> str:
        return self._dictionary_form

    def normalized_form(self) -> str:
        return self._normalized_form

    def part_of_speech(self) -> tuple:
        return self._pos

    def reading_form(self) -> str:
        return self._reading


def to_hiragana(text: str) -> str:
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in text)


class Analyzer:
    def __init__(self):
        # Imported here so the rest of the module works without Sudachi (tests).
        from sudachipy import Dictionary, SplitMode
        self.tokenizer = Dictionary(dict='full').create(SplitMode.C)
        self._pos_by_id: dict[int, tuple] = {}
        self.deconjugator = Deconjugator()
        self.marker_sequences = {
            name: [self._marker_sequence(w) for w in words]
            for name, words in (('logical', LOGICAL_CONNECTORS), ('modal', MODAL_MARKERS),
                                ('relative', RELATIVE_CLAUSE_MARKERS), ('metaphor', METAPHOR_MARKERS))
        }

    def _marker_sequence(self, word: str):
        """Surfaces to match; a conjugating last word (思う, 違いない) also matches its other forms."""
        tokens = list(self.tokenizer.tokenize(word))
        last = tokens[-1]
        inflects = last.part_of_speech()[4] != '*' and last.surface() == last.dictionary_form()
        return tuple(t.surface() for t in tokens), last.dictionary_form() if inflects else None

    def _tokens(self, text: str):
        # Sudachi limits input size; paragraphs are short, long ones are cut at sentence ends.
        for paragraph in text.split('\n'):
            while paragraph:
                chunk = paragraph[:5000]
                if len(paragraph) > 5000:
                    cut = max(chunk.rfind(c) for c in '。！？')
                    chunk = paragraph[: cut + 1] if cut > 0 else chunk
                paragraph = paragraph[len(chunk):]
                for morpheme in self.tokenizer.tokenize(chunk):
                    pos_id = morpheme.part_of_speech_id()
                    pos = self._pos_by_id.get(pos_id) or self._pos_by_id.setdefault(pos_id, morpheme.part_of_speech())
                    surface = morpheme.surface()
                    if pos[0] not in ('補助記号', '空白') and HAS_CONTENT.search(surface):
                        yield Token(surface, morpheme.dictionary_form(), morpheme.normalized_form(), pos,
                                    morpheme.reading_form())

    @lru_cache(maxsize=100_000)
    def _conjugations(self, surface: str, target: str, conj_type: str) -> tuple[str, ...]:
        if surface == target:
            return ()
        prefix = next((tag for name, tag in CONJUGATION_TAG_PREFIX.items() if conj_type.startswith(name)), None)
        matches = [f for f in self.deconjugator.deconjugate(surface) if f.text == target]
        if not matches:
            return ()
        compatible = [f for f in matches if prefix and f.tags and f.tags[-1].startswith(prefix)] or matches
        return min(compatible, key=lambda f: len(f.process)).process

    def analyse(self, text: str) -> Analysis:
        result = Analysis(text=text)
        tokens = list(self._tokens(text))
        surfaces = [t.surface() for t in tokens]
        dictionary_forms = [t.dictionary_form() for t in tokens]

        # Relative clauses: Japanese marks them only by position, a verb or auxiliary in its
        # 連体形 right before a noun (昨日買った本). な after 形状詞 (静かな部屋) is a plain modifier.
        for i in range(len(tokens) - 1):
            pos = tokens[i].part_of_speech()
            if (pos[0] in ('動詞', '助動詞') and pos[5].startswith('連体形') and surfaces[i] != 'な'
                    and tokens[i + 1].part_of_speech()[0] in ('名詞', '代名詞')):
                result.relative_clauses += 1

        window, window_counts, distinct, ttr_sum, windows = deque(), Counter(), 0, 0.0, 0
        index = 0
        while index < len(tokens):
            head = tokens[index]
            pos = head.part_of_speech()
            surface = head.surface()
            end = index + 1
            target = head.dictionary_form()
            conj_type = pos[4]

            # Suru verb: 勉強 + する is one word.
            suru = False
            if (pos[0] == '名詞' and pos[2] == 'サ変可能' and end < len(tokens)
                    and tokens[end].dictionary_form() in ('する', '為る') and tokens[end].part_of_speech()[0] == '動詞'):
                target = surface + 'する'
                conj_type = 'サ行変格'
                surface += tokens[end].surface()
                end += 1
                suru = pos_inflects = True
            else:
                pos_inflects = pos[0] in ('動詞', '形容詞', '助動詞') or conj_type != '*'

            if pos_inflects:
                after_te = False
                while end < len(tokens):
                    token = tokens[end]
                    tpos = token.part_of_speech()
                    form = token.dictionary_form()
                    if tpos[0] == '助動詞' and form in CONJUGATING_AUX:
                        pass
                    elif tpos[0] == '形容詞' and tpos[1] == '非自立可能' and form in ('ない', '無い'):
                        pass
                    elif tpos[0] == '形状詞' and tpos[1] == '助動詞語幹' and form == 'そう':
                        pass
                    elif tpos[0] == '助詞' and tpos[1] == '接続助詞' and token.surface() in JOINING_PARTICLES:
                        surface += token.surface()
                        end += 1
                        after_te = token.surface() in ('て', 'で')
                        if not after_te:
                            break
                        continue
                    elif tpos[0] in ('動詞', '接尾辞') and (
                            (after_te and form in TE_AUXILIARY_VERBS)
                            or form in STEM_AUXILIARY_VERBS):
                        pass
                    else:
                        break
                    after_te = False
                    surface += token.surface()
                    end += 1

            coarse = _coarse_pos(pos)
            # Predicates per sentence (柴崎・原 2010): verbs, adjectives and the copula.
            if pos[0] in ('動詞', '形容詞') or (pos[0] == '助動詞' and head.dictionary_form() in ('だ', 'です')):
                result.predicates += 1
            word = Word(
                key=f'{head.normalized_form()}\t{coarse}',
                form=head.surface() if suru else head.dictionary_form(),
                pos=coarse,
                origin=_origin(head.surface() if pos[0] == '名詞' else head.dictionary_form(), coarse,
                               head.normalized_form()),
                conjugations=self._conjugations(surface, target, conj_type) if pos_inflects else (),
                surface=surface,
                reading=to_hiragana(head.reading_form()) if head.surface() == head.dictionary_form() else None,
            )
            word_key = (word.key, word.form)
            window.append(word_key)
            window_counts[word_key] += 1
            distinct += window_counts[word_key] == 1
            if len(window) > MATTR_WINDOW:
                old = window.popleft()
                window_counts[old] -= 1
                distinct -= window_counts[old] == 0
            if len(window) == MATTR_WINDOW:
                ttr_sum += distinct / MATTR_WINDOW
                windows += 1
            entry = result.words.get(word_key)
            if entry:
                entry[1] += 1
            else:
                result.words[word_key] = [word, 1]
            result.word_count += 1
            index = end

        # Marker expressions (single JMdict words in Jiten, often several Sudachi tokens).
        for name, sequences in self.marker_sequences.items():
            count = 0
            for sequence, last_form in sequences:
                n = len(sequence)
                for i in range(len(tokens) - n + 1):
                    if (tuple(surfaces[i:i + n - 1]) == sequence[:-1]
                            and (surfaces[i + n - 1] == sequence[-1] or dictionary_forms[i + n - 1] == last_form)):
                        count += 1
            result.markers[name] = count

        result.sentence_count = count_sentences(text)
        # Lines without 。 (common in light novels) end a sentence too.
        result.line_sentence_count = sum(count_sentences(line) for line in text.split('\n') if line)
        result.mattr = ttr_sum / windows if windows else (len(result.words) / result.word_count if result.word_count else 0)
        return result


def count_sentences(text: str) -> int:
    """MorphologicalAnalyser.SplitIntoSentences: newlines removed, split after runs of 。！？」."""
    text = text.replace('\r', '').replace('\n', '')
    count = 0
    seen_ender = False
    pending = False
    for char in text:
        pending = True
        if char in SENTENCE_ENDERS:
            seen_ender = True
            continue
        if seen_ender:
            count += 1
            seen_ender = False
    return count + (1 if pending else 0)


# ---------------------------------------------------------------------------
# Features

def _score_hardcap() -> float:
    score = RANK_BASE
    threshold = RANK_BASE
    multiplier = 1.0
    while threshold < RANK_SOFTCAP_START:
        multiplier *= 2
        next_threshold = threshold + RANK_EXP_BASE
        score += (RANK_EXP_BASE if next_threshold <= RANK_SOFTCAP_START else RANK_SOFTCAP_START - threshold) * multiplier
        threshold = next_threshold
    multiplier = 2 ** math.ceil((RANK_SOFTCAP_START - RANK_BASE) / RANK_EXP_BASE)
    threshold = RANK_SOFTCAP_START
    while threshold < RANK_HARDCAP:
        next_threshold = threshold + RANK_SOFTCAP_STEP
        score += (RANK_SOFTCAP_STEP if next_threshold <= RANK_HARDCAP else RANK_HARDCAP - threshold) * multiplier
        threshold = next_threshold
    return score


SCORE_HARDCAP = _score_hardcap()


def custom_rank_score(rank: int) -> float:
    if rank <= RANK_BASE:
        return float(rank)
    if rank >= RANK_HARDCAP:
        return SCORE_HARDCAP
    score = float(RANK_BASE)
    threshold = RANK_BASE
    multiplier = 1.0
    while threshold < RANK_SOFTCAP_START and threshold < rank:
        multiplier *= 2
        next_threshold = threshold + RANK_EXP_BASE
        score += (min(rank, next_threshold) - threshold) * multiplier
        threshold = next_threshold
        if rank <= threshold:
            return score
    while threshold < RANK_HARDCAP and threshold < rank:
        next_threshold = threshold + RANK_SOFTCAP_STEP
        score += (min(rank, next_threshold) - threshold) * multiplier
        threshold = next_threshold
        if rank <= threshold:
            return score
    return score


def _mean(values):
    return statistics.fmean(values) if values else math.nan


def _median(values):
    return statistics.median(values) if values else math.nan


def _stdev(values):
    return statistics.stdev(values) if len(values) >= 2 else math.nan


def compute_features(analysis: Analysis, frequency) -> dict:
    """The 55 model features. `frequency` provides word(key) and form(key, form) lookups."""
    text = analysis.text
    words = list(analysis.words.values())
    word_count = float(analysis.word_count)
    f: dict[str, float] = {}

    character_count = len(TOKEN_CLEAN.sub('', text))
    sentence_count = analysis.sentence_count
    f['Ttr'] = len(words) / word_count if word_count else 0
    f['AverageSentenceLength'] = 0 if sentence_count in (0, 1) else character_count / sentence_count

    without_punctuation = len(TOKEN_CLEAN.sub('', text))
    without_dialogue = len(TOKEN_CLEAN.sub('', DIALOGUE.sub('', text)))
    f['DialoguePercentage'] = (without_punctuation - without_dialogue) / without_punctuation * 100 if without_punctuation else 0

    f['KanjiRatio'] = sum(1 for c in text if is_kanji(c)) / len(text) if text else 0

    # Readability (jreadability), MLHelper.ExtractReadabilityScore
    def occurrences(predicate):
        return sum(n for w, n in words if predicate(w))

    kango = 100 * occurrences(lambda w: w.origin == 'kango') / word_count
    wago = 100 * occurrences(lambda w: w.origin == 'wago') / word_count
    gairaigo = 100 * occurrences(lambda w: w.origin == 'gairaigo') / word_count
    verb = 100 * occurrences(lambda w: w.pos == 'verb') / word_count
    particle = occurrences(lambda w: w.pos == 'particle') / word_count
    per_sentence = word_count / sentence_count if sentence_count > 0 else 5
    f.update(KangoPercentage=kango, WagoPercentage=wago, GairaigoPercentage=gairaigo, VerbPercentage=verb,
             ParticlePercentage=particle, AvgWordPerSentence=per_sentence,
             # jReadability takes particles as a percentage, like the other shares.
             ReadabilityScore=per_sentence * -0.056 + kango * -0.126 + wago * -0.042 + verb * -0.145
             + particle * 100 * -0.044 + 11.724)

    f['LogicalConnectorRatio'] = analysis.markers['logical'] / word_count
    f['ModalMarkerRatio'] = analysis.markers['modal'] / word_count
    f['RelativeClauseMarkerRatio'] = analysis.markers['relative'] / word_count
    f['MetaphorMarkerRatio'] = analysis.markers['metaphor'] / word_count

    # Frequency statistics, MLHelper.ExtractFrequencyStats
    ranks, obs, reading_ranks, reading_obs, reading_perc, custom = [], [], [], [], [], []
    low_rank = 0
    above_softcap = 0
    custom_sum = 0.0
    softcap_score = custom_rank_score(RANK_SOFTCAP_START)
    for word, n in words:
        data = frequency.word(word.key, word.reading) if word.pos != 'name' else None
        if not data:
            continue
        rank, observed = data
        score = custom_rank_score(rank)
        custom.extend([score] * n)
        custom_sum += score * n
        if score >= softcap_score:
            above_softcap += n
        ranks.extend([math.log(rank + 1)] * n)
        obs.extend([math.log(observed + 1)] * n)
        if rank > LOW_FREQ_RANK_THRESHOLD:
            low_rank += n
        form = frequency.form(word.key, word.form)
        if form:
            form_rank, form_observed, form_percentage = form
            reading_ranks.extend([math.log(form_rank + 1)] * n)
            reading_obs.extend([math.log(form_observed + 1)] * n)
            reading_perc.extend([form_percentage] * n)

    f['AvgLogFreqRank'] = _mean(ranks)
    f['StdLogFreqRank'] = _stdev(ranks)
    f['AvgLogObsFreq'] = _mean(obs)
    f['StdLogObsFreq'] = _stdev(obs)
    f['LowFreqRankPerc'] = low_rank / word_count
    f['AvgReadingFreqRank'] = _mean(reading_ranks)
    f['MedianReadingFreqRank'] = _median(reading_ranks)
    f['AvgReadingObsFreq'] = _mean(reading_obs)
    f['MedianReadingObsFreq'] = _median(reading_obs)
    f['AvgReadingFreqPerc'] = _mean(reading_perc)
    f['AvgCustomScorePerWord'] = custom_sum / word_count
    f['StdCustomWordScore'] = _stdev(custom)
    f['PercCustomScoreAboveSoftcapStart'] = above_softcap / word_count

    # Conjugation and part-of-speech statistics, MLHelper.ExtractConjugationStats.
    # As in Jiten, only words with conjugations count, using their first occurrence.
    conj_counts = dict.fromkeys(CONJUGATION_CATEGORIES, 0)
    pos_counts = dict.fromkeys(POS_CATEGORIES, 0)
    total_conjugations = 0
    for word, n in words:
        if not word.conjugations:
            continue
        for detail in word.conjugations:
            total_conjugations += n
            conj_counts[CONJUGATION_DETAIL_TO_CATEGORY.get(detail, 'other')] += n
        pos_counts[word.pos if word.pos in pos_counts else 'other'] += n
    for category, count in conj_counts.items():
        f[f'ratio_{category}_conj'] = count / word_count
    for category, count in pos_counts.items():
        f[f'ratio_{category}_pos'] = count / word_count
    f['RatioConjugations'] = total_conjugations / word_count

    return f


def _coverage_rank(ranked: list, share: float) -> float:
    """Frequency rank a reader must know up to for `share` of the tokens; `ranked` is sorted
    (rank, occurrences). Learners need about 95-98% known words to read unaided."""
    total = sum(n for _, n in ranked)
    covered = 0
    for rank, n in ranked:
        covered += n
        if covered >= share * total:
            return rank
    return ranked[-1][0] if ranked else math.nan


def compute_extra_features(analysis: Analysis, frequency, ruby: dict | None = None) -> dict:
    """EXTRA_FEATURES. `ruby` is the furigana count from book_text."""
    text = analysis.text
    ruby = ruby or {}
    kanji = [c for c in text if is_kanji(c)]
    unique_kanji = len(set(kanji))
    sentences = max(analysis.line_sentence_count, 1)

    # Words without a rank are mostly names and numbers, skipped as in the frequency features.
    by_rank = Counter()
    for word, n in analysis.words.values():
        data = frequency.word(word.key, word.reading) if word.pos != 'name' else None
        if data:
            by_rank[data[0]] += n
    ranked = sorted(by_rank.items())
    content = len(TOKEN_CLEAN.sub('', text)) or 1

    return {
        'LogCharacters': math.log(max(len(TOKEN_CLEAN.sub('', text)), 1)),
        'LogUniqueKanji': math.log(max(unique_kanji, 10)),
        'CoverageRank90': math.log(_coverage_rank(ranked, 0.90)),
        'CoverageRank95': math.log(_coverage_rank(ranked, 0.95)),
        'CoverageRank98': math.log(_coverage_rank(ranked, 0.98)),
        'Mattr': analysis.mattr,
        'LineSentenceLength': content / sentences,
        'PredicatesPerSentence': analysis.predicates / sentences,
        'RelativeClausesPerSentence': analysis.relative_clauses / sentences,
        'HiraganaRatio': len(HIRAGANA.findall(text)) / content,
        'NonJoyoKanjiShare': sum(1 for c in kanji if c not in KANJI_GRADES) / len(kanji) if kanji else 0,
        'UpperJoyoKanjiShare': sum(1 for c in kanji if KANJI_GRADES.get(c) == 8) / len(kanji) if kanji else 0,
        'RubyKanjiShare': min(ruby.get('kanji', 0) / len(kanji), 1) if kanji else 0,
        'RubyKatakanaShare': ruby.get('katakana', 0) / ruby['ruby'] if ruby.get('ruby') else 0,
    }


def words_for_coverage(extra: dict) -> int:
    """Top-N words a reader needs to know for 95% of the book's words."""
    return int(round(math.exp(extra['CoverageRank95'])))
