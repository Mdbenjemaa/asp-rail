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

/** Jeton d'une invitation d'administrateur d'entreprise : « …/#admin&invitation=<48 signes hexadécimaux> ». */
export function invitationDuHash(hash: string): string | null {
  const m = /[#&?]invitation=([a-fA-F0-9]{48})(?:&|$)/.exec(hash);
  return m ? m[1].toLowerCase() : null;
}

/** Lien à envoyer à la personne invitée. */
export const lienInvitation = (jeton: string) => `${location.origin}${import.meta.env.BASE_URL}#admin&invitation=${jeton}`;

/** Rôle de la personne connectée : administrateur d'ASP Rail (toutes les entreprises) ou d'une ou plusieurs entreprises. */
export interface Role {
  email: string;
  super: boolean;
  entreprises: { id: string; nom: string }[];
}

export function lireRole(x: unknown): Role | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as { email?: unknown; super?: unknown; entreprises?: unknown };
  const entreprises = Array.isArray(o.entreprises)
    ? o.entreprises.filter((e): e is { id: string; nom: string } => !!e && typeof e.id === 'string' && typeof e.nom === 'string')
    : [];
  return { email: typeof o.email === 'string' ? o.email : '', super: o.super === true, entreprises };
}

/** Entreprise à afficher : celle choisie la dernière fois si elle existe encore, sinon la première. */
export function entrepriseChoisie(role: Role, gardee: string | null): string | null {
  return role.entreprises.find((e) => e.id === gardee)?.id ?? role.entreprises[0]?.id ?? null;
}
