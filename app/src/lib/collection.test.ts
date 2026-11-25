import { beforeEach, describe, expect, it, vi } from 'vitest';
import { creerCollection, REFUS_STOCKAGE } from './collection';
import { dateFr, dateHeure, duree, heure, heureDans, jourDe } from './temps';

interface X {
  id: string;
  updated: number;
  brouillon?: boolean;
  v?: number;
}

let store: Map<string, string>;
let plein = false;
beforeEach(() => {
  store = new Map();
  plein = false;
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (plein) throw new DOMException('plein', 'QuotaExceededError');
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('collection gardée sur le téléphone', () => {
  it('enregistre, remplace, relit et supprime', () => {
    const c = creerCollection<X>('t-1', (x) => ({ v: 0, ...x }));
    expect(c.enregistrer({ id: 'a', updated: 0 })).toBe(true);
    expect(c.enregistrer({ id: 'a', updated: 0, v: 2 })).toBe(true);
    expect(c.lire()).toHaveLength(1);
    expect(c.parId('a')?.v).toBe(2);
    expect(JSON.parse(store.get('t-1')!)[0].v).toBe(2);
    c.supprimer('a');
    expect(c.parId('a')).toBeNull();
  });

  it('stockage plein : renvoie false et prévient l’appli', () => {
    const c = creerCollection<X>('t-2', (x) => x);
    const f = vi.fn();
    window.addEventListener(REFUS_STOCKAGE, f);
    plein = true;
    expect(c.enregistrer({ id: 'a', updated: 0 })).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('au premier chargement, les brouillons laissés vides disparaissent', () => {
    store.set(
      't-3',
      JSON.stringify([
        { id: 'a', updated: 1, brouillon: true },
        { id: 'b', updated: 2 },
        { id: 'c', updated: 3, brouillon: false },
        null,
        { pas: 'un élément' },
      ]),
    );
    const c = creerCollection<X>('t-3', (x) => x);
    expect(c.lire().map((x) => x.id)).toEqual(['b', 'c']);
    expect(JSON.parse(store.get('t-3')!).map((x: X) => x.id)).toEqual(['b', 'c']);
    // Un brouillon créé pendant la session reste (il est en cours de création).
    c.enregistrer({ id: 'd', updated: 0, brouillon: true });
    expect(c.parId('d')).not.toBeNull();
  });

  it('données illisibles : liste vide, pas de plantage', () => {
    store.set('t-4', '{pas du json');
    expect(creerCollection<X>('t-4', (x) => x).lire()).toEqual([]);
  });
});

describe('heures et dates', () => {
  it('formats français', () => {
    const t = new Date(2026, 10, 25, 9, 5).getTime();
    expect(heure(t)).toBe('09:05');
    expect(dateHeure(t)).toBe('25/11/2026 à 09:05');
    expect(dateFr('2026-11-25')).toBe('25/11/2026');
    expect(jourDe(t)).toBe('2026-11-25');
    expect(duree(45 * 60000)).toBe('45 min');
    expect(duree(125 * 60000)).toBe('2 h 05');
    expect(heureDans(new Date(2026, 10, 26, 0, 10).getTime(), '2026-11-25')).toBe('00:10 (26/11)');
  });
});
