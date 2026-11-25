/**
 * Bouton « retour » du téléphone (Android, geste retour) : il ferme d'abord ce qui est ouvert par-dessus
 * (feuille, écran, étape d'un parcours), comme dans les applis du téléphone, au lieu de quitter l'appli.
 *
 * Une seule entrée d'historique est ajoutée tant que quelque chose est ouvert ; à chaque « retour », le dernier
 * ouvert se ferme et l'entrée est remise s'il reste quelque chose d'ouvert.
 */
import { useEffect, useRef } from 'react';

const pile: Array<() => void> = [];
let pushed = false;
let ignore = 0;
let installed = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function sync() {
  if (pile.length && !pushed) {
    history.pushState({ ...(history.state ?? {}), aspRetour: true }, '');
    pushed = true;
  } else if (!pile.length && pushed) {
    pushed = false;
    ignore++;
    history.back();
  }
}

/** Resynchronise un peu plus tard : le temps que l'écran fermé se retire. */
function later() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    sync();
  }, 60);
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('popstate', () => {
    if (ignore > 0) {
      ignore--;
      return;
    }
    if (!pushed) return; // un retour qui ne nous concerne pas
    pushed = false;
    pile[pile.length - 1]?.();
    // Remis tout de suite (un second « retour » rapide reste dans l'appli) ; retiré ensuite si tout s'est fermé.
    sync();
    later();
  });
}

/** Ajoute une fermeture au-dessus de la pile ; renvoie de quoi la retirer (quand l'élément se ferme autrement). */
export function empiler(onRetour: () => void): () => void {
  install();
  const fn = () => onRetour();
  pile.push(fn);
  sync();
  return () => {
    const i = pile.lastIndexOf(fn);
    if (i >= 0) pile.splice(i, 1);
    later();
  };
}

/** Tant que `actif` est vrai, le bouton retour du téléphone appelle `onRetour` (le dernier ouvert d'abord). */
export function useRetour(actif: boolean, onRetour: () => void) {
  const ref = useRef(onRetour);
  useEffect(() => {
    ref.current = onRetour;
  });
  useEffect(() => (actif ? empiler(() => ref.current()) : undefined), [actif]);
}
