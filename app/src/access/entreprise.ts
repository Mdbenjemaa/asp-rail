/**
 * Entreprise du code d'accès : son nom, son logo (accueil et PDF) et le contenu qu'elle a dans l'appli. Le serveur la
 * renvoie à chaque vérification du code ; elle est gardée sur le téléphone pour marcher sans réseau. Le logo n'est
 * relu que quand sa version change.
 *
 * Contenu réglable par entreprise (par l'administrateur d'ASP Rail) : la lecture du planning ETF, les mémos (et les
 * incontournables), les quiz (et les cas pratiques). Sans entreprise connue (ancienne version, aperçu),
 * tout reste visible.
 */
import { useSyncExternalStore } from 'react';
import { magasin } from '../lib/magasin';
import { loadPref, savePref } from '../lib/me';
import { SB_KEY, SB_URL } from '../lib/server';

export interface Modules {
  /** Lecture du planning ETF (PDF). */
  planning: boolean;
  /** Mémos et incontournables. */
  memo: boolean;
  /** Quiz, question du jour et cas pratiques. */
  quiz: boolean;
}

export interface EntrepriseInfo {
  id: string;
  nom: string;
  modules: Modules;
  /** Version du logo (0 : pas de logo). */
  logoV: number;
}

interface LogoGarde {
  id: string;
  v: number;
  data: string | null;
}

export const TOUT: Modules = { planning: true, memo: true, quiz: true };
/** L'onglet « Réviser » a-t-il quelque chose à montrer ? */
export const reviserVisible = (m: Modules) => m.memo || m.quiz;
export const MODULES_TEXTE: Record<keyof Modules, [string, string]> = {
  planning: ['Lecture du planning ETF', 'Importer le PDF du planning et voir son service du jour.'],
  memo: ['Mémos', 'Mémos ASP, PN et LAM / S9, et les incontournables.'],
  quiz: ['Quiz et cas pratiques', 'Quiz, question du jour et exercices corrigés.'],
};

const CLE = 'asp-entreprise';
const CLE_LOGO = 'asp-entreprise-logo';

/** Lit l'entreprise renvoyée par le serveur (asp_verifier_code) ; null si absente ou mal formée. */
export function lireEntreprise(x: unknown): EntrepriseInfo | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as { id?: unknown; nom?: unknown; modules?: unknown; logo_v?: unknown };
  if (typeof o.id !== 'string' || typeof o.nom !== 'string') return null;
  const m = (o.modules && typeof o.modules === 'object' ? o.modules : {}) as Partial<Record<keyof Modules, unknown>>;
  return {
    id: o.id,
    nom: o.nom.trim().slice(0, 60),
    modules: { planning: m.planning === true, memo: m.memo === true, quiz: m.quiz === true },
    logoV: typeof o.logo_v === 'number' && Number.isFinite(o.logo_v) ? o.logo_v : 0,
  };
}

const valide = (e: EntrepriseInfo | null): EntrepriseInfo | null => (e && typeof e.id === 'string' && e.modules ? e : null);
const entrepriseStore = magasin(() => valide(loadPref<EntrepriseInfo | null>(CLE, null)));
const logoStore = magasin(() => loadPref<LogoGarde | null>(CLE_LOGO, null));

export const entreprise = () => entrepriseStore.get();
export const useEntreprise = () => useSyncExternalStore(entrepriseStore.abonner, entrepriseStore.get);
/** Ce que l'entreprise a dans l'appli (tout, si elle n'est pas connue). */
export function useModules(): Modules {
  return useEntreprise()?.modules ?? TOUT;
}

/** Logo de l'entreprise (data URL), s'il est à jour. */
export function logoEntreprise(): string | null {
  const e = entrepriseStore.get();
  const l = logoStore.get();
  return e && l && l.id === e.id && l.v === e.logoV && e.logoV > 0 ? l.data : null;
}
export function useLogo(): string | null {
  const e = useEntreprise();
  const l = useSyncExternalStore(logoStore.abonner, logoStore.get);
  return e && l && l.id === e.id && l.v === e.logoV && e.logoV > 0 ? l.data : null;
}

/** Pour les PDF : nom et logo de l'entreprise, s'il y en a une. */
export function entreprisePdf(): { nom: string; logo: string | null } | undefined {
  const e = entrepriseStore.get();
  return e ? { nom: e.nom, logo: logoEntreprise() } : undefined;
}

export function oublierEntreprise(): void {
  entrepriseStore.set(null);
  logoStore.set(null);
  try {
    localStorage.removeItem(CLE);
    localStorage.removeItem(CLE_LOGO);
  } catch {
    /* stockage indisponible */
  }
}

/**
 * Après une vérification réussie du code : garde l'entreprise et, si sa version a changé, va chercher le logo.
 * `undefined` (serveur qui ne la renvoie pas) : on garde ce qu'on avait.
 */
export function retenirEntreprise(code: string, e: EntrepriseInfo | null | undefined): void {
  if (e === undefined) return;
  const avant = entrepriseStore.get();
  if (JSON.stringify(avant) !== JSON.stringify(e)) {
    entrepriseStore.set(e);
    savePref(CLE, e);
  }
  if (!e) return;
  const l = logoStore.get();
  if (e.logoV === 0) {
    if (l) {
      logoStore.set(null);
      savePref(CLE_LOGO, null);
    }
    return;
  }
  if (l && l.id === e.id && l.v === e.logoV) return;
  void chargerLogo(code, e);
}

let enCours: string | null = null;
async function chargerLogo(code: string, e: EntrepriseInfo): Promise<void> {
  const cle = `${e.id}:${e.logoV}`;
  if (enCours === cle) return;
  enCours = cle;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/asp_logo`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return;
    const d = (await res.json()) as { ok?: boolean; logo?: string | null; v?: number };
    if (d.ok !== true) return;
    const data = typeof d.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(d.logo) ? d.logo : null;
    const garde: LogoGarde = { id: e.id, v: typeof d.v === 'number' ? d.v : e.logoV, data };
    logoStore.set(garde);
    savePref(CLE_LOGO, garde);
  } catch {
    /* pas de réseau : on réessaiera à la prochaine vérification */
  } finally {
    enCours = null;
  }
}
