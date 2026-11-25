/** Activité du jour : annonce (ASP, TES M) ou passage à niveau (agent PN, TES F). Gardée sur le téléphone. */
import { useSyncExternalStore } from 'react';

export type Activite = 'asp' | 'pn';
const KEY = 'asp-activite';
const EVT = 'asp-activite';

function lire(): Activite {
  try {
    return localStorage.getItem(KEY) === 'pn' ? 'pn' : 'asp';
  } catch {
    return 'asp';
  }
}

export function choisirActivite(a: Activite) {
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
