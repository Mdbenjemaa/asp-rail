/**
 * Code d'accès d'ASP Rail : une simple « porte d'entrée ». Chaque personne reçoit un code (créé par
 * l'administrateur) ; il est vérifié en ligne à l'ouverture, puis gardé sur le téléphone. Sans réseau, l'appli
 * reste ouverte 30 jours après la dernière vérification réussie. Un code coupé ferme l'appli à la vérification suivante.
 */
import { loadPref, savePref } from '../lib/me';
import { SB_KEY, SB_URL } from '../lib/server';

export const ACCESS_KEY = 'asp-acces';
/** Sans réseau, l'appli s'ouvre encore pendant 30 jours après la dernière vérification. */
export const GRACE_MS = 30 * 24 * 3600 * 1000;

export interface StoredAccess {
  code: string;
  /** Nom donné au code par l'administrateur (souvent le nom de la personne). */
  nom: string;
  /** Dernière vérification réussie (ms). */
  verifie: number;
}

/** Huit signes sans ambiguïté (pas de 0/O, 1/I/L) : « abcd ef23 » → « ABCDEF23 ». */
export function cleanCode(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

/** Affichage par blocs de 4 : « ABCD-EF23 ». */
export function formatCode(s: string): string {
  const c = cleanCode(s);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Code reçu dans un lien de partage : « …/asp-rail/#code=ABCD-EF23 ». */
export function codeFromHash(hash: string): string | null {
  const m = /[#&]code=([A-Za-z0-9-]{8,9})(?:&|$)/.exec(hash);
  return m ? cleanCode(m[1]) : null;
}

/** Espace administrateur : « #admin », ou retour d'un lien reçu par e-mail (mot de passe oublié). */
export function isAdminRoute(hash: string, search: string): boolean {
  return /^#admin(?:$|[&?/])/.test(hash) || /(?:access_token|type=recovery|error_description)=?/.test(hash) || /[?&]admin(?:=|&|$)/.test(search);
}

export function loadAccess(): StoredAccess | null {
  const a = loadPref<StoredAccess | null>(ACCESS_KEY, null);
  return a && typeof a.code === 'string' && typeof a.verifie === 'number' ? a : null;
}

export function saveAccess(a: StoredAccess): void {
  savePref(ACCESS_KEY, a);
}

export function clearAccess(): void {
  try {
    localStorage.removeItem(ACCESS_KEY);
  } catch {
    /* stockage indisponible */
  }
}

/** Faut-il demander le code ? Ouvert si une vérification réussie date de moins de 30 jours. */
export function decide(stored: StoredAccess | null, now: number): { open: boolean; expired: boolean } {
  if (!stored) return { open: false, expired: false };
  const age = now - stored.verifie;
  if (age >= 0 && age < GRACE_MS) return { open: true, expired: false };
  return { open: false, expired: true };
}

/** Vérifie un code auprès du serveur. Lève une erreur si le serveur ne répond pas (pas de réseau…). */
export async function checkCode(code: string, timeoutMs = 10_000): Promise<{ ok: boolean; nom?: string }> {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/asp_verifier_code`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_code: cleanCode(code) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Serveur indisponible (${res.status})`);
  const data = (await res.json()) as { ok?: boolean; nom?: string };
  return { ok: data.ok === true, nom: data.nom };
}

/** Lien à partager pour un code : ouvre l'appli et remplit le code. */
export function lienCode(code: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}#code=${formatCode(code)}`;
}
