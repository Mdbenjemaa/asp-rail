import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REFUS_STOCKAGE } from '../lib/collection';

const KEY = 'asp-chantiers-v1';
let store: Map<string, string>;
let plein: boolean;
let win: EventTarget;
beforeEach(() => {
  vi.resetModules();
  store = new Map();
  plein = false;
  win = new EventTarget();
  vi.stubGlobal('window', win);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (plein) throw new DOMException('plein', 'QuotaExceededError');
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('chantiers gardés sur le téléphone', () => {
  it('au lancement, retire les fiches créées puis laissées vides', async () => {
    store.set(KEY, JSON.stringify([{ id: 'vide', brouillon: true }, { id: 'garde', brouillon: false }, { pas: 'un chantier' }]));
    const { chantierParId } = await import('./store');
    expect(chantierParId('vide')).toBeNull();
    expect(chantierParId('garde')?.id).toBe('garde');
    expect(JSON.parse(store.get(KEY)!).map((c: { id: string }) => c.id)).toEqual(['garde']);
  });

  it('enregistre en tête, remplace sans doublon et date la modification', async () => {
    const { enregistrer, chantierParId } = await import('./store');
    const { normaliser } = await import('./chantier');
    expect(enregistrer(normaliser({ id: 'a' }))).toBe(true);
    expect(enregistrer(normaliser({ id: 'b' }))).toBe(true);
    expect(enregistrer({ ...normaliser({ id: 'a' }), nom: 'Pose DSh' })).toBe(true);
    const lus = JSON.parse(store.get(KEY)!);
    expect(lus.map((c: { id: string }) => c.id)).toEqual(['b', 'a']);
    expect(chantierParId('a')?.nom).toBe('Pose DSh');
    expect(chantierParId('a')!.updated).toBeGreaterThan(0);
  });

  it('stockage plein : renvoie false et prévient l’appli (alerte à l’écran)', async () => {
    const { enregistrer } = await import('./store');
    const { normaliser } = await import('./chantier');
    const alerte = vi.fn();
    win.addEventListener(REFUS_STOCKAGE, alerte);
    plein = true;
    expect(enregistrer(normaliser({ id: 'x' }))).toBe(false);
    expect(alerte).toHaveBeenCalledTimes(1);
    expect(store.has(KEY)).toBe(false);
  });

  it('supprimer le chantier affiché sur la carte le retire aussi de la carte', async () => {
    const { enregistrer, supprimer, definirActif, chantierParId } = await import('./store');
    const { normaliser } = await import('./chantier');
    enregistrer(normaliser({ id: 'a' }));
    definirActif('a');
    expect(JSON.parse(store.get('asp-chantier-carte')!)).toBe('a');
    supprimer('a');
    expect(chantierParId('a')).toBeNull();
    expect(JSON.parse(store.get('asp-chantier-carte')!)).toBeNull();
  });
});
