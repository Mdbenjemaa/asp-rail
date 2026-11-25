import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Historique du navigateur simulé. `back()` arrive un peu plus tard (popstate), vers l'entrée qui précédait au
 * moment de l'appel, comme Chrome ; `entrees` est la position (1 : la page de l'appli, 0 : on a quitté l'appli).
 */
let entrees: number;
let sorties: number;
let win: EventTarget;
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  entrees = 1;
  sorties = 0;
  win = new EventTarget();
  vi.stubGlobal('window', win);
  vi.stubGlobal('history', {
    state: null,
    pushState: () => void entrees++,
    back: () => {
      const cible = entrees - 1;
      setTimeout(() => {
        entrees = cible;
        if (entrees < 1) sorties++;
        else win.dispatchEvent(new Event('popstate'));
      }, 5);
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** L'utilisateur appuie sur « retour » du téléphone. */
const retourTelephone = () => {
  entrees--;
  win.dispatchEvent(new Event('popstate'));
};

describe('bouton retour du téléphone', () => {
  it('ferme le dernier ouvert d’abord, puis le suivant', async () => {
    const { empiler } = await import('./back');
    const fermes: string[] = [];
    const retirerEcran = empiler(() => fermes.push('écran'));
    const retirerFeuille = empiler(() => fermes.push('feuille'));
    expect(entrees).toBe(2); // une seule entrée ajoutée pour les deux

    retourTelephone();
    expect(fermes).toEqual(['feuille']);
    retirerFeuille(); // la feuille se retire en se fermant
    vi.advanceTimersByTime(100);
    expect(entrees).toBe(2); // il reste l'écran : l'entrée est remise

    retourTelephone();
    expect(fermes).toEqual(['feuille', 'écran']);
    retirerEcran();
    vi.advanceTimersByTime(100);
    expect(entrees).toBe(1); // tout est fermé : l'appli ne garde rien dans l'historique
  });

  it('fermé autrement (bouton ✕) : l’entrée est retirée sans rien fermer d’autre', async () => {
    const { empiler } = await import('./back');
    const onRetour = vi.fn();
    const retirer = empiler(onRetour);
    expect(entrees).toBe(2);
    retirer();
    vi.advanceTimersByTime(100);
    expect(entrees).toBe(1);
    expect(onRetour).not.toHaveBeenCalled();
  });

  it('un retour qui ne concerne pas l’appli est ignoré', async () => {
    const { empiler } = await import('./back');
    const onRetour = vi.fn();
    empiler(onRetour)();
    vi.advanceTimersByTime(100); // le popstate de notre propre history.back() est ignoré
    retourTelephone();
    expect(onRetour).not.toHaveBeenCalled();
  });

  it('une feuille ouverte juste après une fermeture ne fait jamais quitter l’appli', async () => {
    const { empiler } = await import('./back');
    const retirerFiche = empiler(() => undefined);
    retirerFiche(); // la fiche se ferme…
    vi.advanceTimersByTime(60); // … l'appli demande le retour de son entrée
    const retirerOnglet = empiler(() => undefined); // un onglet s'ouvre avant que le retour soit arrivé
    vi.advanceTimersByTime(100);
    expect(entrees).toBe(2); // une entrée au-dessus de l'appli, pour l'onglet
    retirerOnglet(); // retour à l'accueil
    vi.advanceTimersByTime(200);
    expect(entrees).toBe(1);
    expect(sorties).toBe(0);
  });
});
