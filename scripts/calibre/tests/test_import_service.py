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
import urllib.error
import urllib.request
import zipfile
from http.server import ThreadingHTTPServer

STATE = tempfile.mkdtemp()
FAKE_CALIBREDB = os.path.join(STATE, 'calibredb')
FAKE_BUILDER = os.path.join(STATE, 'builder')
BUILDS = os.path.join(STATE, 'builds.log')
ADDS = os.path.join(STATE, 'adds.log')

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
elif 'list' in args:
    print('[{{"id": 42, "title": "テスト"}}]')
""")
with open(FAKE_BUILDER, 'w') as f:
    f.write(f"#!/bin/sh\necho build >> {BUILDS}\n")
os.chmod(FAKE_CALIBREDB, 0o755)
os.chmod(FAKE_BUILDER, 0o755)
os.environ.update(IMPORT_STATE_DIR=os.path.join(STATE, 'state'), CALIBREDB=FAKE_CALIBREDB,
                  CATALOG_BUILDER=FAKE_BUILDER, CALIBRE_LIBRARY=STATE)

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

    def request(self, path, body=None, account='acc1', origin=True, scheme='https'):
        headers = {'Host': 'reader.example', 'X-Forwarded-Proto': scheme}
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

    def test_duplicate(self):
        _, body = self.request('/add?name=a.epub', epub('dup'))
        self.assertEqual(self.wait_for(body['job']['id'])['state'], 'duplicate')

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

    def test_jobs_are_per_account(self):
        _, body = self.request('/add?name=b.epub', epub())
        job_id = body['job']['id']
        self.wait_for(job_id)
        self.assertEqual(self.request(f'/jobs?ids={job_id}', account='acc2')[1], {'jobs': []})

    def test_helpers(self):
        self.assertEqual(service.parse_added_ids('Added book ids: 12, 13'), [12, 13])
        self.assertEqual(service.parse_added_ids('nothing'), [])
        self.assertEqual(service.clean_name('../../x/\x01本.epub'), '本.epub')


if __name__ == '__main__':
    unittest.main()
