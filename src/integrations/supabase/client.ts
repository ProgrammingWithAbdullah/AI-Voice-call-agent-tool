import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Database } from './types.ts';

// Load values from environment variables in Deno
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_PUBLISHABLE_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

// Create client
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
