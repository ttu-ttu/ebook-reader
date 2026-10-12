/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Adding books to the Calibre library through the server's import queue
 * (scripts/calibre/import/service.py, signed-in readers only). The server adds
 * one book at a time and rebuilds the catalog, so a finished job's book is
 * already in /calibre/catalog.json. Not part of upstream.
 */

export interface CalibreImportJob {
  id: string;
  /** Uploaded file name */
  name: string;
  state: 'queued' | 'adding' | 'added' | 'duplicate' | 'failed';
  calibreId?: number;
  /** Calibre's title (before the catalog makes duplicate titles unique) */
  title?: string;
  error?: string;
}

const apiUrl = '/calibre/import/api/';

async function errorMessage(response: Response) {
  if (response.status === 401) {
    return 'Sign in (Settings → Account, on the HTTPS address) to add books to Calibre';
  }

  try {
    const body = await response.json();

    if (typeof body?.error === 'string') {
      return body.error;
    }
  } catch (_) {
    // nginx error pages aren't JSON
  }

  return `HTTP ${response.status}`;
}

export async function uploadToCalibre(file: File, signal?: AbortSignal) {
  const response = await fetch(`${apiUrl}add?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
    signal
  });

  if (!response.ok) {
    throw new Error(`${file.name}: ${await errorMessage(response)}`);
  }

  return ((await response.json()) as { job: CalibreImportJob }).job;
}

export function isFinished(job: CalibreImportJob) {
  return job.state !== 'queued' && job.state !== 'adding';
}

/** Polls the jobs until every one has finished; `onUpdate` gets each poll's result. */
export async function waitForImportJobs(
  ids: string[],
  onUpdate: (jobs: CalibreImportJob[]) => void = () => {},
  intervalMs = 3000
) {
  for (;;) {
    const response = await fetch(`${apiUrl}jobs?ids=${ids.map(encodeURIComponent).join(',')}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Calibre import status unavailable: ${await errorMessage(response)}`);
    }

    const { jobs } = (await response.json()) as { jobs: CalibreImportJob[] };

    onUpdate(jobs);

    if (jobs.every(isFinished)) {
      return jobs;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
