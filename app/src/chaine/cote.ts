/** Dans l'annonce : je prépare le chantier (ASP) ou je suis dans la chaîne (annonceur, répétiteur, sentinelle). Gardé sur le téléphone. */
import { useSyncExternalStore } from 'react';
import { loadPref, savePref } from '../lib/me';

export type Cote = 'asp' | 'chaine';
const KEY = 'asp-annonce-cote';
const abonnes = new Set<() => void>();
let valeur: Cote = loadPref<Cote>(KEY, 'asp') === 'chaine' ? 'chaine' : 'asp';

export function choisirCote(c: Cote) {
  valeur = c;
  savePref(KEY, c);
  abonnes.forEach((f) => f());
}

export function useCote(): Cote {
  return useSyncExternalStore(
    (cb) => {
      abonnes.add(cb);
      return () => abonnes.delete(cb);
    },
    () => valeur,
  );
}
