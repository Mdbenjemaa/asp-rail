/**
 * Chantier partagé : l'administrateur crée une session de chantier (un code de 6 signes) et l'envoie aux
 * intervenants (ASP, agent PN, AP LAM / S9). Ceux qui l'ont rejoint voient sur leur carte ce que chacun partage,
 * et chacun choisit, d'un interrupteur, de partager son chantier ou sa mission. Tout passe par des fonctions du
 * serveur qui vérifient le code d'accès : rien n'est lisible sans lui.
 */
import { useSyncExternalStore } from 'react';
import { appareilId, loadAccess } from '../access/gate';
import { loadPref, savePref } from '../lib/me';
import { SB_KEY, SB_URL } from '../lib/server';
import type { Donnees } from './donnees';

export type Activite = 'asp' | 'pn' | 'lam';

interface Session {
  /** Code de la session, 6 signes (« K7P3QX »). */
  code: string;
  nom: string;
  /** Fin de la session (ms). */
  fin: number;
}

/** Ce que ce téléphone partage : quoi (chantier ou mission), sous quel nom, avec quel téléphone. */
export interface MonPartage {
  actif: boolean;
  activite: Activite;
  /** Chantier ou mission partagé. */
  id: string;
  nom: string;
  tel: string;
}

/** Ce qu'un intervenant partage, tel que reçu du serveur. */
export interface Partage {
  appareil: string;
  activite: Activite;
  nom: string;
  tel: string;
  donnees: Donnees;
  /** Dernière mise à jour (ms). */
  maj: number;
}

const SESSION = 'asp-session';
const MON_PARTAGE = 'asp-partage-moi';

/** Six signes sans ambiguïté : « k7p 3qx » → « K7P3QX ». */
export const cleanSession = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
/** Affichage : « K7P-3QX ». */
export const formatSession = (s: string) => {
  const c = cleanSession(s);
  return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
};
/** Code reçu dans un lien : « …/asp-rail/#chantier=K7P-3QX ». */
export function sessionFromHash(hash: string): string | null {
  const m = /[#&]chantier=([A-Za-z0-9-]{6,7})(?:&|$)/.exec(hash);
  return m ? cleanSession(m[1]) : null;
}
export const lienSession = (code: string) => `${location.origin}${import.meta.env.BASE_URL}#chantier=${formatSession(code)}`;

/* ---------- Petits magasins partagés par l'accueil, la carte et l'interrupteur ---------- */

export function magasin<T>(lire: () => T) {
  let valeur = lire();
  const abonnes = new Set<() => void>();
  return {
    get: () => valeur,
    set(v: T) {
      valeur = v;
      abonnes.forEach((f) => f());
    },
    abonner(f: () => void) {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
  };
}

const lireSession = (): Session | null => {
  const s = loadPref<Session | null>(SESSION, null);
  return s && typeof s.code === 'string' && typeof s.fin === 'number' ? s : null;
};
const sessionStore = magasin(lireSession);
const monPartageStore = magasin(() => loadPref<MonPartage | null>(MON_PARTAGE, null));
interface Etat {
  partages: Partage[];
  /** Dernière lecture réussie (ms). */
  lu: number | null;
  erreur: string | null;
}
const etatStore = magasin<Etat>(() => ({ partages: [], lu: null, erreur: null }));

export const useSession = () => useSyncExternalStore(sessionStore.abonner, sessionStore.get);
export const useMonPartage = () => useSyncExternalStore(monPartageStore.abonner, monPartageStore.get);
export const usePartages = () => useSyncExternalStore(etatStore.abonner, etatStore.get);

export function definirMonPartage(p: MonPartage | null) {
  savePref(MON_PARTAGE, p);
  monPartageStore.set(p);
}

/* ---------- Serveur ---------- */

async function rpc<T>(nom: string, corps: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Serveur indisponible (${res.status})`);
  return (await res.json()) as T;
}

const codeAcces = () => loadAccess()?.code ?? '';

export type RaisonRefus = 'acces' | 'inconnu' | 'fin' | 'plein' | 'donnees' | 'appareil';
export const RAISON_TEXTE: Record<RaisonRefus, string> = {
  acces: 'Ton code d’accès n’est plus actif.',
  inconnu: 'Code chantier inconnu : vérifie les 6 signes.',
  fin: 'Ce chantier partagé est terminé.',
  plein: 'Trop d’intervenants partagent déjà sur ce chantier (40 au plus).',
  donnees: 'Partage refusé : trop de données.',
  appareil: 'Téléphone non reconnu : relance l’appli.',
};

/** Rejoint une session de chantier. Rend la raison du refus, ou null si c'est bon. */
export async function rejoindre(code: string): Promise<RaisonRefus | null> {
  const r = await rpc<{ ok: boolean; raison?: RaisonRefus; code?: string; nom?: string; expire_le?: string }>('asp_rejoindre_session', {
    p_code: codeAcces(),
    p_session: cleanSession(code),
  });
  if (!r.ok) return r.raison ?? 'inconnu';
  const s: Session = { code: r.code ?? cleanSession(code), nom: r.nom ?? 'Chantier partagé', fin: Date.parse(r.expire_le ?? '') || Date.now() + 86_400_000 };
  savePref(SESSION, s);
  sessionStore.set(s);
  etatStore.set({ partages: [], lu: null, erreur: null });
  void rafraichir();
  return null;
}

/** Quitte la session : ce que ce téléphone partageait est retiré. */
export async function quitter() {
  const s = sessionStore.get();
  const p = monPartageStore.get();
  if (s && p?.actif) await envoyer(null).catch(() => undefined);
  definirMonPartage(p ? { ...p, actif: false } : null);
  savePref(SESSION, null);
  sessionStore.set(null);
  etatStore.set({ partages: [], lu: null, erreur: null });
}

/** Lit ce que partagent les intervenants. */
export async function rafraichir(): Promise<void> {
  const s = sessionStore.get();
  if (!s) return;
  try {
    const r = await rpc<{ ok: boolean; raison?: RaisonRefus; nom?: string; expire_le?: string; partages?: (Omit<Partage, 'maj'> & { maj: string })[] }>('asp_voir_session', {
      p_code: codeAcces(),
      p_session: s.code,
    });
    if (!r.ok) {
      if (r.raison === 'fin') {
        // Session terminée par l'administrateur (ou arrivée à sa fin) : on la quitte.
        savePref(SESSION, null);
        sessionStore.set(null);
        definirMonPartage(monPartageStore.get() ? { ...monPartageStore.get()!, actif: false } : null);
        etatStore.set({ partages: [], lu: null, erreur: RAISON_TEXTE.fin });
        return;
      }
      etatStore.set({ ...etatStore.get(), erreur: RAISON_TEXTE[r.raison ?? 'acces'] });
      return;
    }
    const partages = (r.partages ?? []).map((p) => ({ ...p, maj: Date.parse(p.maj) || Date.now() })).filter((p) => p.donnees && typeof p.donnees === 'object');
    etatStore.set({ partages, lu: Date.now(), erreur: null });
  } catch {
    etatStore.set({ ...etatStore.get(), erreur: 'Pas de réseau : la carte montre la dernière mise à jour.' });
  }
}

/** Envoie ce que ce téléphone partage (null : arrête de partager). */
export async function envoyer(donnees: Donnees | null): Promise<RaisonRefus | null> {
  const s = sessionStore.get();
  const p = monPartageStore.get();
  if (!s) return 'fin';
  const r = await rpc<{ ok: boolean; raison?: RaisonRefus }>('asp_partager', {
    p_code: codeAcces(),
    p_appareil: appareilId(),
    p_session: s.code,
    p_activite: p?.activite ?? 'asp',
    p_nom: p?.nom ?? '',
    p_tel: p?.tel ?? '',
    p_donnees: donnees,
  });
  return r.ok ? null : (r.raison ?? 'donnees');
}

/** Ce téléphone (pour ne pas se montrer à soi-même). */
export const monAppareil = () => {
  try {
    return appareilId();
  } catch {
    return '';
  }
};
