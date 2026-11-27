/** Petit magasin de valeur partagée : lu une fois, mis à jour d'un coup, écouté par useSyncExternalStore. */
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
