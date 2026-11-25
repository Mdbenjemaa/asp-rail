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
