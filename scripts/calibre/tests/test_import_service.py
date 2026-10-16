"""Tests for import/service.py with fake calibredb and catalog builder. Run from the repo root:
python3 -m unittest discover -s scripts/calibre/tests
"""
import importlib.util
import io
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock
import urllib.error
import urllib.request
import zipfile
from http.server import ThreadingHTTPServer

STATE = tempfile.mkdtemp()
FAKE_CALIBREDB = os.path.join(STATE, 'calibredb')
FAKE_BUILDER = os.path.join(STATE, 'builder')
FAKE_CALIBRE_DEBUG = os.path.join(STATE, 'calibre-debug')
BUILDS = os.path.join(STATE, 'builds.log')
ADDS = os.path.join(STATE, 'adds.log')
TOKEN_FILE = os.path.join(STATE, 'internal-token')
with open(TOKEN_FILE, 'w') as f:
    f.write('c0ffee\n')

with open(FAKE_CALIBREDB, 'w') as f:
    f.write(f"""#!{sys.executable}
import sys
args = sys.argv[1:]
if 'add' in args:
    open({ADDS!r}, 'a').write(repr(args[3:]) + '\\n')
    if 'dup' in open(args[3], 'rb').read().decode('latin-1'):
        print('The following books were not added as they already exist in the database')
    else:
        print('Added book ids: 42')
elif 'remove' in args:
    open({ADDS!r}, 'a').write('remove ' + args[-1] + '\\n')
elif 'list' in args:
    print('[{{"id": 42, "title": "テスト"}}]')
""")
CATALOG = os.path.join(STATE, 'catalog.json')
VN_DIR = os.path.join(STATE, 'vn')
os.makedirs(VN_DIR)
with open(FAKE_BUILDER, 'w') as f:
    f.write(f"""#!/bin/sh
echo build "$@" >> {BUILDS}
echo '{{"books": [{{"vn": true}}, {{}}]}}' > "$2"
""")
with open(FAKE_CALIBRE_DEBUG, 'w') as f:
    f.write(f"""#!{sys.executable}
import json, sys
print('calibre noise')
print(json.dumps({{'assigned': 2, 'merged': 1, 'written': '--apply' in sys.argv}}))
""")
os.chmod(FAKE_CALIBRE_DEBUG, 0o755)
os.chmod(FAKE_CALIBREDB, 0o755)
os.chmod(FAKE_BUILDER, 0o755)
os.environ.update(IMPORT_STATE_DIR=os.path.join(STATE, 'state'), CALIBREDB=FAKE_CALIBREDB,
                  CATALOG_BUILDER=FAKE_BUILDER, CALIBRE_LIBRARY=STATE,
                  CALIBRE_DEBUG=FAKE_CALIBRE_DEBUG, CATALOG_OUTPUT=CATALOG, VN_DIR=VN_DIR,
                  MIN_FREE_MB='0', INTERNAL_TOKEN_FILE=TOKEN_FILE)

spec = importlib.util.spec_from_file_location(
    'import_service', os.path.join(os.path.dirname(__file__), '..', 'import', 'service.py'))
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)


def epub(marker: str = '') -> bytes:
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as archive:
        archive.writestr('mimetype', 'application/epub+zip')
        archive.writestr('META-INF/container.xml', '<container/>')
        archive.writestr('OEBPS/c.xhtml', f'<p>{marker}</p>')
    return data.getvalue()


class ImportServiceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.makedirs(service.queue_dir(), exist_ok=True)
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), service.Handler)
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        threading.Thread(target=service.worker, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def request(self, path, body=None, account='acc1', origin=True, scheme='https', token='c0ffee', admin=False):
        headers = {'Host': 'reader.example', 'X-Forwarded-Proto': scheme, 'X-Internal-Token': token,
                   'X-Account-Admin': '1' if admin else '0'}
        if account:
            headers['X-Account-Id'] = account
        if origin:
            headers['Origin'] = f'{scheme}://reader.example'
        req = urllib.request.Request(self.base + path, data=body, headers=headers,
                                     method='POST' if body is not None else 'GET')
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def wait_for(self, job_id, account='acc1'):
        for _ in range(100):
            _, body = self.request(f'/jobs?ids={job_id}', account=account)
            if body['jobs'] and body['jobs'][0]['state'] not in ('queued', 'adding'):
                return body['jobs'][0]
            time.sleep(0.05)
        self.fail('job did not finish')

    def test_adds_and_rebuilds_catalog(self):
        status, body = self.request('/add?name=%E6%9C%AC.epub', epub())
        self.assertEqual(status, 200)
        job = self.wait_for(body['job']['id'])
        self.assertEqual((job['state'], job['calibreId'], job['title'], job['name']),
                         ('added', 42, 'テスト', '本.epub'))
        self.assertTrue(os.path.exists(BUILDS))
        self.assertEqual(os.listdir(service.queue_dir()), [])

    def test_series_check_and_apply(self):
        status, body = self.request('/series', b'{}', admin=True)
        self.assertEqual((status, body['assigned'], body['written']), (200, 2, False))
        status, body = self.request('/series', b'{"apply": true}', admin=True)
        self.assertEqual((status, body['written']), (200, True))
        self.assertEqual(self.request('/series', b'{}', origin=False, admin=True)[0], 403)

    def test_admin_tools_need_admin(self):
        for path in ('/series', '/catalog', '/remove'):
            self.assertEqual(self.request(path, b'{}')[0], 403)
            # nginx's exact-match admin locations miss these; the service must not see '/series'.
            for variant in (';x', ';', '/'):
                self.assertEqual(self.request(path + variant, b'{}', admin=True)[0], 404)

    def test_duplicate(self):
        _, body = self.request('/add?name=a.epub', epub('dup'))
        self.assertEqual(self.wait_for(body['job']['id'])['state'], 'duplicate')

    def test_only_nginx_may_call(self):
        self.assertEqual(self.request('/jobs?ids=x', token='')[0], 403)
        self.assertEqual(self.request('/catalog', b'', token='wrong')[0], 403)
        self.assertEqual(self.request('/jobs?ids=x')[0], 200)

    def test_plain_http_only_when_allowed(self):
        self.assertEqual(self.request('/add?name=a.pdf', b'x', scheme='http')[0], 403)
        service.ALLOW_HTTP = True
        try:
            # Past the origin check: refused for the file type instead.
            self.assertEqual(self.request('/add?name=a.pdf', b'x', scheme='http')[0], 400)
        finally:
            service.ALLOW_HTTP = False

    def test_rejects_bad_requests(self):
        self.assertEqual(self.request('/add?name=a.pdf', b'x')[0], 400)
        self.assertEqual(self.request('/add?name=a.epub', b'not a zip')[0], 400)
        self.assertEqual(self.request('/add?name=a.epub', epub(), account='')[0], 401)
        self.assertEqual(self.request('/add?name=a.epub', epub(), origin=False)[0], 403)

    def test_manga_zip_is_added_as_cbz_with_its_name(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('001.jpg', b'x')
        _, body = self.request('/add?name=%E6%BC%AB%E7%94%BB%201.zip', data.getvalue())
        self.assertEqual(self.wait_for(body['job']['id'])['state'], 'added')
        with open(ADDS) as f:
            args = eval(f.read().splitlines()[-1])  # noqa: S307 - written by the fake above
        self.assertTrue(args[0].endswith('.cbz'))
        self.assertEqual(args[1:], ['--title', '漫画 1'])
        self.assertEqual(self.request('/add?name=a.cbz', epub())[0], 400)

    def test_game_zip_is_unpacked_into_the_vn_folder(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            for name in ('ゲーム/0.txt', 'ゲーム/arc.nsa', 'ゲーム/bgm/曲.ogg', 'ゲーム/../evil.txt',
                         '__MACOSX/ゲーム/._0.txt', 'readme.txt'):
                archive.writestr(name, b'x')
        adds = os.path.getsize(ADDS) if os.path.exists(ADDS) else 0
        _, body = self.request('/add?name=%E3%83%8E%E3%83%99%E3%83%AB.zip', data.getvalue())
        job = self.wait_for(body['job']['id'])
        self.assertEqual((job['state'], job['title']), ('added', 'ノベル'))
        files = sorted(os.path.relpath(os.path.join(root, name), VN_DIR)
                       for root, _, names in os.walk(VN_DIR) for name in names)
        self.assertEqual(files, ['ノベル/0.txt', 'ノベル/arc.nsa', 'ノベル/bgm/曲.ogg'])
        # Not added to Calibre.
        self.assertEqual(os.path.getsize(ADDS) if os.path.exists(ADDS) else 0, adds)
        _, body = self.request('/add?name=%E3%83%8E%E3%83%99%E3%83%AB.zip', data.getvalue())
        self.assertEqual(self.wait_for(body['job']['id'])['state'], 'duplicate')

    def test_corrupt_game_zip_fails_and_the_queue_goes_on(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('壊れ/0.txt', b'x' * 1000)
        data = bytearray(data.getvalue())
        data[30 + len('壊れ/0.txt'.encode())] = 0xFF  # reserved deflate block type: zlib.error
        _, body = self.request('/add?name=%E5%A3%8A%E3%82%8C.zip', bytes(data))
        self.assertEqual(self.wait_for(body['job']['id'])['state'], 'failed')
        self.assertFalse(os.path.exists(os.path.join(VN_DIR, '壊れ')))
        _, body = self.request('/add?name=next.epub', epub('next'))
        self.assertNotIn(self.wait_for(body['job']['id'])['state'], ('queued', 'adding'))

    def test_refuses_uploads_without_free_space(self):
        with mock.patch.object(service, 'MIN_FREE_BYTES', 1 << 62):
            status, body = self.request('/add?name=full.epub', epub())
        self.assertEqual((status, body['error']), (507, 'Not enough free space on the server'))
        self.assertEqual(os.listdir(service.queue_dir()), [])
        self.assertEqual(service.uploading, {})

    def test_catalog_rebuild(self):
        status, body = self.request('/catalog', b'', admin=True)
        self.assertEqual((status, body), (200, {'books': 2, 'visualNovels': 1}))
        with open(BUILDS) as f:
            self.assertIn('--force', f.read().splitlines()[-1])
        self.assertEqual(self.request('/catalog', b'', origin=False, admin=True)[0], 403)

    def test_remove_books_and_games(self):
        os.makedirs(os.path.join(VN_DIR, 'ゲーム'))
        game = service.vn_folder_id('ゲーム')
        status, body = self.request('/remove', json.dumps({'ids': [7, 9, game, -5]}).encode(), admin=True)
        self.assertEqual((status, body), (200, {'removed': [7, 9, game], 'failed': [-5]}))
        self.assertFalse(os.path.exists(os.path.join(VN_DIR, 'ゲーム')))
        with open(ADDS) as f:
            self.assertEqual(f.read().splitlines()[-1], 'remove 7,9')
        for bad in (b'{}', b'{"ids": ["1"]}', b'{"ids": [0]}', b'{"ids": [true]}', b'x'):
            self.assertEqual(self.request('/remove', bad, admin=True)[0], 400)
        self.assertEqual(self.request('/remove', b'{"ids": [1]}', origin=False, admin=True)[0], 403)

    def test_expire_trash_runs_calibre(self):
        with mock.patch.object(service.subprocess, 'run') as run, \
                mock.patch.object(service.time, 'sleep', side_effect=StopIteration):
            run.return_value.returncode = 0
            with self.assertRaises(StopIteration):
                service.expire_trash()
        command = run.call_args[0][0]
        self.assertEqual(command[:2], [FAKE_CALIBRE_DEBUG, '-c'])
        self.assertIn(f'db({STATE!r}).new_api.expire_old_trash()', command[2])

    def test_jobs_are_per_account(self):
        _, body = self.request('/add?name=b.epub', epub())
        job_id = body['job']['id']
        self.wait_for(job_id)
        self.assertEqual(self.request(f'/jobs?ids={job_id}', account='acc2')[1], {'jobs': []})

    def test_helpers(self):
        self.assertEqual(service.parse_added_ids('Added book ids: 12, 13'), [12, 13])
        self.assertEqual(service.parse_added_ids('nothing'), [])
        self.assertEqual(service.clean_name('../../x/\x01本.epub'), '本.epub')
        info = zipfile.ZipInfo('x')
        info.filename = 'ゲーム'.encode('cp932').decode('cp437') + '\\0.txt'
        info.flag_bits = 0
        self.assertEqual(service.zip_name(info), 'ゲーム/0.txt')
        self.assertEqual(service.vn_root(['a/b/0.txt', 'a/0.TXT', 'x.jpg']), 'a/')
        self.assertIsNone(service.vn_root(['x.jpg']))
        self.assertEqual(service.vn_title('.a/b:c.ZIP'), 'a_b_c')


if __name__ == '__main__':
    unittest.main()
