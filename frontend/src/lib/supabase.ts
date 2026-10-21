import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Null when the build has no Supabase keys; the app then runs guest-only. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
