/** Client Supabase de l'espace administrateur (session à part, clé propre). */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SB_KEY, SB_URL } from '../lib/server';

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  // Session à part (clé propre) : ASP Rail et les autres applis du même site ne se mélangent pas.
  client ??= createClient(SB_URL, SB_KEY, { auth: { storageKey: 'asp-admin-auth', persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } });
  return client;
}

/**
 * Jeton d'un lien « mot de passe oublié » collé à la main (…/auth/v1/verify?token=…&type=recovery), même enveloppé
 * par la messagerie (google.com/url?q=…). Permet de choisir son mot de passe sans ouvrir le lien.
 */
export function jetonDuLien(texte: string): string | null {
  let t = texte.trim();
  for (let i = 0; i < 3; i++) {
    try {
      const d = decodeURIComponent(t);
      if (d === t) break;
      t = d;
    } catch {
      break;
    }
  }
  const m = /[?&#]token=([A-Za-z0-9_-]{20,})/.exec(t);
  return m ? m[1] : null;
}
