/** Activité du jour : annonce (ASP, TES M), passage à niveau (agent PN, TES F) ou AP LAM / AP S9. Gardée sur le téléphone. */
import { useSyncExternalStore } from 'react';

export type Activite = 'asp' | 'pn' | 'lam';
const KEY = 'asp-activite';
const EVT = 'asp-activite';

function lire(): Activite {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'pn' || v === 'lam' ? v : 'asp';
  } catch {
    return 'asp';
  }
}

function choisirActivite(a: Activite) {
  try {
    localStorage.setItem(KEY, a);
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function useActivite(): Activite {
  return useSyncExternalStore(subscribe, lire);
}

/**
 * Mission ouverte depuis l'accueil général. Pas gardée : à chaque ouverture de l'appli, on repart de l'accueil
 * général et on choisit sa mission du jour.
 */
let ouverte = false;
const abonnesMission = new Set<() => void>();
const prevenir = () => abonnesMission.forEach((f) => f());

/** Ouvre une mission (annonce, agent PN, AP LAM / S9) : elle devient aussi l'activité du jour. */
export function ouvrirMission(a: Activite) {
  choisirActivite(a);
  if (ouverte) return;
  ouverte = true;
  prevenir();
}

/** Revient à l'accueil général. */
export function fermerMission() {
  if (!ouverte) return;
  ouverte = false;
  prevenir();
}

export function useMissionOuverte(): boolean {
  return useSyncExternalStore(
    (cb) => {
      abonnesMission.add(cb);
      return () => abonnesMission.delete(cb);
    },
    () => ouverte,
  );
}
