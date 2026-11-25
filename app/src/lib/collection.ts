/**
 * Liste d'éléments gardée sur le téléphone (stockage local) et partagée entre les écrans : missions PN, missions
 * LAM / S9. Si le téléphone refuse d'enregistrer (stockage plein, navigation privée), l'événement REFUS_STOCKAGE
 * part, et l'appli le dit à l'écran au lieu de laisser croire que c'est gardé.
 */
import { useSyncExternalStore } from 'react';

/** Identifiant court et unique sur le téléphone. */
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const REFUS_STOCKAGE = 'asp-stockage-refuse';

/** Prévient l'appli qu'un enregistrement a été refusé par le téléphone. */
export function signalerRefus() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REFUS_STOCKAGE));
}

let durable = false;
/**
 * Demande au navigateur de ne pas effacer les données de l'appli quand il manque de place (et, sur iPhone, après
 * quelques jours sans visite). Appelé au moment où l'on crée quelque chose à garder.
 */
export function garderDurablement() {
  if (durable || typeof navigator === 'undefined') return;
  durable = true;
  void navigator.storage?.persist?.().catch(() => false);
}

export interface Element {
  id: string;
  updated: number;
  /** Créé par « Nouvelle… » et jamais rempli : retiré au prochain lancement s'il traîne encore. */
  brouillon?: boolean;
}

export interface Collection<T extends Element> {
  lire: () => T[];
  /** Ajoute ou remplace ; false si le téléphone a refusé (l'alerte est déjà partie). */
  enregistrer: (x: T) => boolean;
  supprimer: (id: string) => void;
  parId: (id: string) => T | null;
  useListe: () => T[];
}

export function creerCollection<T extends Element>(cle: string, normaliser: (brut: T) => T): Collection<T> {
  let cache: T[] | null = null;
  let nettoye = false;
  const abonnes = new Set<() => void>();

  function lire(): T[] {
    if (cache) return cache;
    let list: T[] = [];
    try {
      const raw = localStorage.getItem(cle);
      const brut = raw ? (JSON.parse(raw) as unknown) : [];
      list = Array.isArray(brut) ? (brut as T[]).filter((x) => !!x && typeof x === 'object' && typeof x.id === 'string').map(normaliser) : [];
    } catch {
      list = [];
    }
    // Au premier chargement : les brouillons laissés par une appli fermée pendant la création disparaissent.
    if (!nettoye) {
      nettoye = true;
      const gardes = list.filter((x) => !x.brouillon);
      if (gardes.length !== list.length) {
        list = gardes;
        try {
          localStorage.setItem(cle, JSON.stringify(list));
        } catch {
          /* rien : ce sera refait au prochain enregistrement */
        }
      }
    }
    cache = list;
    return list;
  }

  function ecrire(list: T[]): boolean {
    cache = list;
    abonnes.forEach((f) => f());
    try {
      localStorage.setItem(cle, JSON.stringify(list));
      return true;
    } catch {
      signalerRefus();
      return false;
    }
  }

  function subscribe(cb: () => void) {
    abonnes.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === cle) {
        cache = null;
        cb();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      abonnes.delete(cb);
      window.removeEventListener('storage', onStorage);
    };
  }

  return {
    lire,
    enregistrer(x) {
      const list = lire();
      const next = { ...x, updated: Date.now() };
      const i = list.findIndex((y) => y.id === x.id);
      return ecrire(i >= 0 ? list.map((y) => (y.id === x.id ? next : y)) : [next, ...list]);
    },
    supprimer(id) {
      ecrire(lire().filter((x) => x.id !== id));
    },
    parId(id) {
      return lire().find((x) => x.id === id) ?? null;
    },
    useListe() {
      return useSyncExternalStore(subscribe, lire);
    },
  };
}
