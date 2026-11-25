/** Petits outils de la position en direct, sans dépendance (testables seuls). */

/** Ligne à grande vitesse : « LGV » dans le nom, ou vitesse de ligne au-delà de 220 km/h. */
export const estLgv = (nom: string | null, vmax: number | null) => /\bLGV\b/i.test(nom ?? '') || (vmax ?? 0) > 220;

/**
 * Traite les mesures une à la fois, au plus toutes les `intervalle` ms. Les mesures reçues pendant l'attente se
 * remplacent : seule la plus récente est traitée, et elle n'est jamais perdue (le GPS peut se taire ensuite).
 */
export function cadence<T>(traiter: (v: T) => Promise<unknown>, intervalle = 1500) {
  let attente: { v: T } | null = null;
  let minuterie: ReturnType<typeof setTimeout> | null = null;
  let occupe = false;
  let fini = false;
  let dernier = -Infinity;
  const pomper = () => {
    minuterie = null;
    if (fini || occupe || !attente) return;
    const reste = intervalle - (Date.now() - dernier);
    if (reste > 0) {
      minuterie = setTimeout(pomper, reste);
      return;
    }
    const { v } = attente;
    attente = null;
    occupe = true;
    dernier = Date.now();
    traiter(v)
      .catch(() => undefined)
      .finally(() => {
        occupe = false;
        if (attente && !minuterie) pomper();
      });
  };
  return {
    pousser(v: T) {
      attente = { v };
      if (!minuterie) pomper();
    },
    arreter() {
      fini = true;
      if (minuterie) clearTimeout(minuterie);
      minuterie = null;
    },
  };
}
