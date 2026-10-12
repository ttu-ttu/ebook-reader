/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadToCalibre, waitForImportJobs, type CalibreImportJob } from './calibre-import';

const job = (state: CalibreImportJob['state']): CalibreImportJob => ({
  id: 'j1',
  name: 'a.epub',
  state
});

describe('calibre import', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uploads the file with its name', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ job: job('queued') })));

    vi.stubGlobal('fetch', fetchMock);

    const result = await uploadToCalibre(new File(['x'], '本 1.epub'));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(url).toBe('/calibre/import/api/add?name=%E6%9C%AC%201.epub');
    expect(init.method).toBe('POST');
    expect(result.state).toBe('queued');
  });

  it('explains a missing sign-in and server errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>', { status: 401 }))
    );
    await expect(uploadToCalibre(new File(['x'], 'a.epub'))).rejects.toThrow(/Sign in/);

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Not a valid EPUB file' }), { status: 400 })
      )
    );
    await expect(uploadToCalibre(new File(['x'], 'a.epub'))).rejects.toThrow(
      'a.epub: Not a valid EPUB file'
    );
  });

  it('polls until every job has finished', async () => {
    const responses = [[job('queued')], [job('adding')], [{ ...job('added'), calibreId: 7 }]];

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ jobs: responses.shift() })))
    );

    const updates: string[] = [];
    const jobs = await waitForImportJobs(['j1'], (j) => updates.push(j[0].state), 0);

    expect(updates).toEqual(['queued', 'adding', 'added']);
    expect(jobs[0].calibreId).toBe(7);
  });
});
