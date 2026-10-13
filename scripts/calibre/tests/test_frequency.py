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
            ['事', 'freq', {'reading': 'こと', 'frequency': 30}],
            ['事', 'freq', {'reading': 'じ', 'frequency': 9000}],
        ]))
    return path


class YomitanRanksTest(unittest.TestCase):
    def test_best_rank_per_term(self):
        self.assertEqual(load_yomitan_ranks(dictionary()), {'ある': 18, '有る': 18, '在る': 10382, '魔法': 1986, '事': 30})

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

    def test_reading_tells_homographs_apart(self):
        table = FrequencyTable.load(dictionary())
        self.assertEqual(table.word('事\tnoun', 'じ')[0], 9000)
        self.assertEqual(table.word('事\tnoun', 'こと')[0], 30)
        self.assertEqual(table.word('事\tnoun')[0], 30)  # unknown reading: the most common one
        self.assertEqual(table.word('魔法\tnoun', 'まじっく')[0], 1986)  # reading not listed: the spelling's rank



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
        # Bytes past Content-Length stand in for a socket that stays open: they must not be read.
        return self.service.install_dictionary(io.BytesIO(data + b'next request'), len(data))

    def test_installs_a_rank_based_list(self):
        with open(dictionary(), 'rb') as f:
            self.assertEqual(self.install(f.read()), 5)
        self.assertTrue(os.path.exists(self.service.FREQUENCY_DICTIONARY))

    def test_rejects_other_files_and_keeps_the_current_one(self):
        for data in (b'not a zip', open(dictionary('occurrence-based'), 'rb').read()):
            with self.assertRaises(ValueError):
                self.install(data)
        self.assertFalse(os.path.exists(self.service.FREQUENCY_DICTIONARY))
        self.assertEqual(os.listdir(os.path.dirname(self.service.FREQUENCY_DICTIONARY)), [])


class KanjiEndpointTest(unittest.TestCase):
    def test_saved_counts_are_served(self):
        import importlib.util
        import threading
        import urllib.error
        import urllib.request
        from http.server import ThreadingHTTPServer
        spec = importlib.util.spec_from_file_location(
            'jiten_service_kanji', os.path.join(os.path.dirname(__file__), '..', 'jiten', 'service.py'))
        service = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(service)
        service.KANJI_DIR = tempfile.mkdtemp()
        service.INTERNAL_TOKEN_FILE = os.path.join(service.KANJI_DIR, 'token')
        with open(service.INTERNAL_TOKEN_FILE, 'w') as f:
            f.write('c0ffee')
        service.save_kanji(7, '魔法の魔女')
        def get(url, token='c0ffee'):
            return urllib.request.urlopen(urllib.request.Request(url, headers={'X-Internal-Token': token}))
        server = ThreadingHTTPServer(('127.0.0.1', 0), service.Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            base = f'http://127.0.0.1:{server.server_port}'
            with get(f'{base}/kanji/7') as response:
                import gzip
                self.assertEqual(json.loads(gzip.decompress(response.read())), {'魔': 2, '法': 1, '女': 1})
            for path in ('/kanji/8', '/kanji/..%2Fx'):
                with self.assertRaises(urllib.error.HTTPError) as error:
                    get(base + path)
                self.assertEqual(error.exception.code, 404)
            with self.assertRaises(urllib.error.HTTPError) as error:
                get(f'{base}/kanji/7', token='')
            self.assertEqual(error.exception.code, 403)

            def post(origin):
                headers = {'X-Internal-Token': 'c0ffee', 'Host': 'reader.example'}
                if origin:
                    headers['Origin'] = origin
                request = urllib.request.Request(f'{base}/nothing', data=b'{}', headers=headers)
                try:
                    return urllib.request.urlopen(request).status
                except urllib.error.HTTPError as error:
                    return error.code
            # Other sites can't post with the reader's cookie; past the check, an unknown action is 404.
            self.assertEqual(post(None), 403)
            self.assertEqual(post('https://evil.example'), 403)
            self.assertEqual(post('http://reader.example'), 403)
            self.assertEqual(post('https://reader.example'), 404)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
