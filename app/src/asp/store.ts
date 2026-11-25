/**
 * Chantiers gardés sur le téléphone (stockage local), sans serveur. Petite boutique partagée entre la carte
 * (zone, points d'annonce, agents) et les écrans de l'ASP.
 */
import { useSyncExternalStore } from 'react';
import { signalerRefus } from '../lib/collection';
import { loadPref, savePref } from '../lib/me';
import { normaliser, type Chantier } from './chantier';

const KEY = 'asp-chantiers-v1';
const ACTIVE_KEY = 'asp-chantier-carte';

let chantiers: Chantier[] = nettoyer(lire());
let actif: string | null = loadPref<string | null>(ACTIVE_KEY, null);
const abonnes = new Set<() => void>();

function lire(): Chantier[] {
  const brut = loadPref<unknown>(KEY, []);
  if (!Array.isArray(brut)) return [];
  return brut.filter((c): c is Chantier => !!c && typeof c === 'object' && typeof (c as Chantier).id === 'string').map(normaliser);
}

/** Au lancement : les chantiers créés puis laissés vides (appli fermée pendant la création) disparaissent. */
function nettoyer(list: Chantier[]): Chantier[] {
  const gardes = list.filter((c) => !c.brouillon);
  if (gardes.length !== list.length) savePref(KEY, gardes);
  return gardes;
}

function prevenir() {
  for (const f of abonnes) f();
}

function abonner(f: () => void) {
  abonnes.add(f);
  // Autre onglet ou fenêtre : on relit.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      chantiers = lire();
      f();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    abonnes.delete(f);
    window.removeEventListener('storage', onStorage);
  };
}

/** Enregistre (ajoute ou remplace) un chantier ; renvoie false si le téléphone refuse (stockage plein). */
export function enregistrer(c: Chantier): boolean {
  const next = { ...c, updated: Date.now() };
  const i = chantiers.findIndex((x) => x.id === c.id);
  chantiers = i === -1 ? [next, ...chantiers] : chantiers.map((x) => (x.id === c.id ? next : x));
  let ok = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(chantiers));
  } catch {
    ok = false;
    signalerRefus();
  }
  prevenir();
  return ok;
}

export function supprimer(id: string) {
  chantiers = chantiers.filter((c) => c.id !== id);
  savePref(KEY, chantiers);
  if (actif === id) definirActif(null);
  prevenir();
}

export function chantierParId(id: string | null): Chantier | null {
  return id ? (chantiers.find((c) => c.id === id) ?? null) : null;
}

/** Chantier affiché sur la carte (un seul à la fois), ou null. */
export function definirActif(id: string | null) {
  actif = id;
  savePref(ACTIVE_KEY, id);
  prevenir();
}

export function useChantiers(): Chantier[] {
  return useSyncExternalStore(abonner, () => chantiers);
}

export function useActif(): Chantier | null {
  return useSyncExternalStore(abonner, () => chantierParId(actif));
}

