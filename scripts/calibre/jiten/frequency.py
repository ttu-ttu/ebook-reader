"""Word frequencies for the difficulty features, from a rank-based Yomitan frequency
dictionary (Jiten's own list, jiten.moe/frequency-dictionaries), standing in for Jiten's
JmDictWordFrequencies / WordFormFrequencies. Not upstream.
"""
import json
import zipfile

# Share of all word occurrences at rank 1 (の is about 6.5%); shares fall off as 1/rank (Zipf).
TOP_SHARE = 0.065


def load_yomitan_ranks(path: str) -> dict:
    """term -> best (lowest) rank from a rank-based Yomitan frequency dictionary."""
    with zipfile.ZipFile(path) as archive:
        index = json.loads(archive.read('index.json'))
        if index.get('frequencyMode') != 'rank-based':
            raise ValueError(f"{path}: not a rank-based frequency dictionary")
        ranks = {}
        for name in archive.namelist():
            if not name.startswith('term_meta_bank'):
                continue
            for term, kind, data in json.loads(archive.read(name)):
                # data: a number, {value, displayValue}, or {reading, frequency: number | {value}}
                frequency = data.get('frequency', data) if isinstance(data, dict) else data
                value = frequency.get('value') if isinstance(frequency, dict) else frequency
                if kind == 'freq' and isinstance(value, (int, float)) and value > 0:
                    ranks[term] = min(value, ranks.get(term, value))
    return ranks


class FrequencyTable:
    """word(key) -> (rank, share of occurrences); form(key, spelling) -> (rank, share, percentage).
    Keys are Sudachi's normalised form plus a part of speech ('有る\\tverb'), looked up by
    the normalised form; a spelling's percentage is how close its rank is to the word's."""

    def __init__(self, ranks: dict):
        self.ranks = ranks

    @classmethod
    def load(cls, path: str) -> 'FrequencyTable':
        return cls(load_yomitan_ranks(path))

    def word(self, key):
        rank = self.ranks.get(key.split('\t')[0])
        return (rank, TOP_SHARE / rank) if rank else None

    def form(self, key, form):
        word = self.word(key)
        rank = self.ranks.get(form)
        if not word or not rank:
            return None
        return rank, TOP_SHARE / rank, 100 * min(1.0, word[0] / rank)
