/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createDokushoClient } from './create-client';

export const supabase = createDokushoClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
