"""Tests for jiten/frequency.py (Yomitan ranks). Run from the repo root:
python3 -m unittest discover -s scripts/calibre/tests
"""
import json
import os
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'jiten'))
from frequency import TOP_SHARE, FrequencyTable, load_yomitan_ranks  # noqa: E402


def dictionary(mode='rank-based'):
    path = os.path.join(tempfile.mkdtemp(), 'freq.zip')
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('index.json', json.dumps({'title': 'T', 'format': 3, 'frequencyMode': mode}))
        archive.writestr('term_meta_bank_1.json', json.dumps([
            ['ある', 'freq', {'value': 18, 'displayValue': '18㋕'}],
            ['有る', 'freq', {'reading': 'ある', 'frequency': {'value': 12756, 'displayValue': '12756'}}],
            ['有る', 'freq', {'reading': 'ある', 'frequency': {'value': 18}}],
            ['在る', 'freq', {'reading': 'ある', 'frequency': 10382}],
            ['魔法', 'freq', {'reading': 'まほう', 'frequency': 1986}],
        ]))
    return path


class YomitanRanksTest(unittest.TestCase):
    def test_best_rank_per_term(self):
        self.assertEqual(load_yomitan_ranks(dictionary()), {'ある': 18, '有る': 18, '在る': 10382, '魔法': 1986})

    def test_rejects_occurrence_based(self):
        with self.assertRaises(ValueError):
            load_yomitan_ranks(dictionary('occurrence-based'))

    def test_word_and_spelling_lookups(self):
        table = FrequencyTable.load(dictionary())
        self.assertEqual(table.word('有る\tverb'), (18, TOP_SHARE / 18))
        self.assertIsNone(table.word('珍語\tnoun'))  # not in the dictionary: skipped, as in Jiten
        self.assertEqual(table.form('有る\tverb', 'ある'), (18, TOP_SHARE / 18, 100))
        rank, _, percentage = table.form('有る\tverb', '在る')
        self.assertEqual(rank, 10382)
        self.assertAlmostEqual(percentage, 100 * 18 / 10382)
        self.assertIsNone(table.form('有る\tverb', 'アル'))


if __name__ == '__main__':
    unittest.main()


class InstallDictionaryTest(unittest.TestCase):
    def setUp(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            'jiten_service', os.path.join(os.path.dirname(__file__), '..', 'jiten', 'service.py'))
        self.service = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.service)
        self.service.FREQUENCY_DICTIONARY = os.path.join(tempfile.mkdtemp(), 'frequency-dictionary.zip')

    def install(self, data: bytes):
        import io
        return self.service.install_dictionary(io.BytesIO(data), len(data))

    def test_installs_a_rank_based_list(self):
        with open(dictionary(), 'rb') as f:
            self.assertEqual(self.install(f.read()), 4)
        self.assertTrue(os.path.exists(self.service.FREQUENCY_DICTIONARY))

    def test_rejects_other_files_and_keeps_the_current_one(self):
        for data in (b'not a zip', open(dictionary('occurrence-based'), 'rb').read()):
            with self.assertRaises(ValueError):
                self.install(data)
        self.assertFalse(os.path.exists(self.service.FREQUENCY_DICTIONARY))
        self.assertEqual(os.listdir(os.path.dirname(self.service.FREQUENCY_DICTIONARY)), [])
