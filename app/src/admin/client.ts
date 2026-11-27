/** Client Supabase de l'espace administrateur (session à part, clé propre). */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SB_KEY, SB_URL } from '../lib/server';

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  // Session à part (clé propre) : ASP Rail et les autres applis du même site ne se mélangent pas.
  client ??= createClient(SB_URL, SB_KEY, { auth: { storageKey: 'asp-admin-auth', persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } });
  return client;
}
