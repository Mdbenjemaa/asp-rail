import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cadence, estLgv } from './cadence';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Laisse passer les promesses en cours. */
const vider = () => vi.advanceTimersByTimeAsync(0);

describe('position en direct : cadence du GPS', () => {
  it('traite tout de suite la première mesure, puis au plus une toutes les 1,5 s', async () => {
    const vus: number[] = [];
    const f = cadence<number>(async (v) => void vus.push(v));
    f.pousser(1);
    await vider();
    expect(vus).toEqual([1]);
    f.pousser(2);
    f.pousser(3); // remplace 2 : seule la plus récente compte
    await vi.advanceTimersByTimeAsync(1000);
    expect(vus).toEqual([1]);
    await vi.advanceTimersByTimeAsync(600);
    expect(vus).toEqual([1, 3]);
  });

  it('la dernière mesure n’est jamais perdue, même si le GPS se tait ensuite', async () => {
    const vus: number[] = [];
    let finir: () => void = () => undefined;
    const f = cadence<number>((v) => {
      vus.push(v);
      return new Promise<void>((r) => (finir = r)); // calcul long (chargement de la ligne)
    });
    f.pousser(1);
    await vider();
    f.pousser(2); // arrive pendant le calcul
    await vi.advanceTimersByTimeAsync(3000);
    expect(vus).toEqual([1]); // une seule à la fois
    finir();
    await vider();
    expect(vus).toEqual([1, 2]);
  });

  it('une erreur de calcul ne bloque pas la suite', async () => {
    const vus: number[] = [];
    const f = cadence<number>(async (v) => {
      vus.push(v);
      if (v === 1) throw new Error('hors ligne');
    });
    f.pousser(1);
    await vider();
    f.pousser(2);
    await vi.advanceTimersByTimeAsync(1600);
    expect(vus).toEqual([1, 2]);
  });

  it('arrêtée (accueil quitté) : plus rien n’est traité', async () => {
    const vus: number[] = [];
    const f = cadence<number>(async (v) => void vus.push(v));
    f.pousser(1);
    await vider();
    f.pousser(2);
    f.arreter();
    await vi.advanceTimersByTimeAsync(5000);
    expect(vus).toEqual([1]);
  });

  it('reconnaît une ligne à grande vitesse', () => {
    expect(estLgv('LGV Sud-Est', 300)).toBe(true);
    expect(estLgv('Ligne de Paris-Est à Strasbourg', 230)).toBe(true);
    expect(estLgv('Ligne de Paris-Lyon à Marseille', 160)).toBe(false);
    expect(estLgv(null, null)).toBe(false);
  });
});
