/**
 * Code d'accès d'ASP Rail : une simple « porte d'entrée ». Chaque personne reçoit un code (créé par
 * l'administrateur) ; il est vérifié en ligne à l'ouverture, puis chaque minute tant que l'appli est ouverte (et à
 * chaque retour sur l'appli). Un code coupé ou arrivé à sa fin ferme l'appli dans la minute. Sans réseau, l'appli
 * reste ouverte le temps choisi pour ce code (de « réseau obligatoire » à 30 jours) après la dernière vérification.
 */
import { loadPref, savePref } from '../lib/me';
import { SB_KEY, SB_URL } from '../lib/server';

const ACCESS_KEY = 'asp-acces';
/** Sans réseau, par défaut (anciens codes) : 30 jours après la dernière vérification. */
const HORS_LIGNE_DEFAUT_H = 720;
/** « Réseau obligatoire » tolère quand même une coupure de quelques minutes (tunnel, réseau qui saute). */
const TOLERANCE_MS = 5 * 60 * 1000;
const APPAREIL_KEY = 'asp-appareil';

export interface StoredAccess {
  code: string;
  /** Nom donné au code par l'administrateur (souvent le nom de la personne). */
  nom: string;
  /** Dernière vérification réussie (ms). */
  verifie: number;
  /** Heures d'utilisation sans réseau autorisées pour ce code (0 : réseau obligatoire). */
  horsLigneH?: number;
  /** Fin du code (ms), ou null s'il est sans limite. */
  fin?: number | null;
}

export type Fermeture = 'expire' | 'fin';

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

/** Temps sans réseau autorisé pour ce code, en ms. */
export const horsLigneMs = (s: StoredAccess) => Math.max(TOLERANCE_MS, (s.horsLigneH ?? HORS_LIGNE_DEFAUT_H) * 3600_000);

/**
 * Faut-il demander le code ? Ouvert si la dernière vérification réussie est assez récente (temps hors ligne du code)
 * et si le code n'est pas arrivé à sa fin.
 */
export function decide(stored: StoredAccess | null, now: number): { open: boolean; expired: boolean; raison: Fermeture | null } {
  if (!stored) return { open: false, expired: false, raison: null };
  if (stored.fin && now >= stored.fin) return { open: false, expired: false, raison: 'fin' };
  const age = now - stored.verifie;
  if (age >= 0 && age < horsLigneMs(stored)) return { open: true, expired: false, raison: null };
  return { open: false, expired: true, raison: 'expire' };
}

/** « 24 heures », « 7 jours », « quelques minutes » : pour les messages. */
export function dureeTexte(h: number): string {
  if (h <= 0) return 'quelques minutes';
  if (h < 48) return `${h} heure${h > 1 ? 's' : ''}`;
  return `${Math.round(h / 24)} jours`;
}

/** Identifiant de ce téléphone pour l'administrateur (tiré au hasard, gardé ; rien d'autre n'est envoyé). */
export function appareilId(): string {
  let id = loadPref<string>(APPAREIL_KEY, '');
  if (!/^[A-Za-z0-9-]{8,40}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join('');
    savePref(APPAREIL_KEY, id);
  }
  return id;
}

/** « Android · Chrome · appli installée » : pour reconnaître ses téléphones dans l'espace administrateur. */
export function agentCourt(ua = navigator.userAgent, installe = matchMedia?.('(display-mode: standalone)').matches): string {
  const sys = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Autre';
  const nav = /SamsungBrowser/.test(ua)
    ? 'Samsung Internet'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /Firefox|FxiOS/.test(ua)
        ? 'Firefox'
        : /Chrome|CriOS/.test(ua)
          ? 'Chrome'
          : /Safari/.test(ua)
            ? 'Safari'
            : 'navigateur';
  return [sys, nav, installe ? 'appli installée' : ''].filter(Boolean).join(' · ');
}

export interface Verification {
  ok: boolean;
  nom?: string;
  /** Pourquoi le code ne marche pas : inconnu (ou supprimé), coupé, arrivé à sa fin. */
  raison?: 'inconnu' | 'coupe' | 'fin';
  horsLigneH?: number;
  fin?: number | null;
}

/** Vérifie un code auprès du serveur. Lève une erreur si le serveur ne répond pas (pas de réseau…). */
export async function checkCode(code: string, timeoutMs = 10_000): Promise<Verification> {
  let appareil: string | null = null;
  let agent: string | null = null;
  try {
    appareil = appareilId();
    agent = agentCourt();
  } catch {
    /* stockage ou navigateur limité : la vérification marche quand même */
  }
  const res = await fetch(`${SB_URL}/rest/v1/rpc/asp_verifier_code`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_code: cleanCode(code), p_appareil: appareil, p_agent: agent }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Serveur indisponible (${res.status})`);
  const data = (await res.json()) as { ok?: boolean; nom?: string; raison?: string; hors_ligne_h?: number; expire_le?: string | null };
  const raison = data.raison === 'coupe' || data.raison === 'fin' ? data.raison : 'inconnu';
  if (data.ok !== true) return { ok: false, raison };
  const fin = data.expire_le ? Date.parse(data.expire_le) : null;
  return { ok: true, nom: data.nom, horsLigneH: typeof data.hors_ligne_h === 'number' ? data.hors_ligne_h : undefined, fin: Number.isFinite(fin) ? fin : null };
}

/** Lien à partager pour un code : ouvre l'appli et remplit le code. */
export function lienCode(code: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}#code=${formatCode(code)}`;
}
