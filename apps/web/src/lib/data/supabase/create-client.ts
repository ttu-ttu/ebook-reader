/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type DokushoSupabaseClient = ReturnType<typeof createDokushoClient>;

// Sessão no localStorage do aparelho; a leitura funciona com sessão vencida e a
// sincronização espera a rede (ESCOPO "Segurança").
export function createDokushoClient(url: string, anonKey: string) {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
}
