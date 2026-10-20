/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { loadEnv } from 'vite';
import { describe, expect, it } from 'vitest';
import { createDokushoClient } from './create-client';

const env = loadEnv('test', process.cwd(), 'PUBLIC_');
const url = env.PUBLIC_SUPABASE_URL;
const anonKey = env.PUBLIC_SUPABASE_ANON_KEY;

// Fala com o projeto real; pulado sem apps/web/.env.
describe.skipIf(!url || !anonKey)('RLS sem sessão (anon key)', () => {
  const supabase = createDokushoClient(url, anonKey);

  it('não lê nenhuma linha de books', async () => {
    const { data, error } = await supabase.from('books').select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('não grava em books', async () => {
    const { error } = await supabase.from('books').insert({ id: 'rls-test', title: 'rls-test' });
    expect(error).not.toBeNull();
  });

  it('não lista arquivos do bucket epubs', async () => {
    const { data } = await supabase.storage.from('epubs').list();
    expect(data ?? []).toEqual([]);
  });

  it('cadastro está desligado', async () => {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
    const settings = await response.json();
    expect(settings.disable_signup).toBe(true);
  });
});
