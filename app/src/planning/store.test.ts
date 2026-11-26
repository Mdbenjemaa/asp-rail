import { beforeEach, describe, expect, it, vi } from 'vitest';

let store: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  store = new Map();
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

const semaine = (statut: 'definitif' | 'provisoire' | 'inconnu', premier: string) => ({
  semaine: 48,
  annee: 2026,
  lundi: '2026-11-23',
  statut,
  fichier: `Planning S48 ${statut}.pdf`,
  nom: 'MARTIN Paul',
  jours: [[premier], [], [], [], [], ['Z'], ['RH']],
});

describe('mes semaines de planning', () => {
  it('le provisoire puis le définitif : le définitif remplace', async () => {
    const { garderSemaine, jourDans, lireSemaines } = await import('./store');
    expect(garderSemaine(semaine('provisoire', 'AMO'))).toBe('nouvelle');
    expect(garderSemaine(semaine('definitif', 'RH'))).toBe('remplacee');
    expect(lireSemaines()).toHaveLength(1);
    expect(jourDans(lireSemaines(), '2026-11-23')?.code).toBe('RH');
  });

  it('un provisoire importé après le définitif ne l’écrase pas', async () => {
    const { garderSemaine, jourDans, lireSemaines } = await import('./store');
    garderSemaine(semaine('definitif', 'RH'));
    expect(garderSemaine(semaine('provisoire', 'AMO'))).toBe('gardee-definitive');
    expect(jourDans(lireSemaines(), '2026-11-23')?.code).toBe('RH');
  });

  it('seule ma ligne est gardée, et les jours hors des semaines importées sont vides', async () => {
    const { garderSemaine, jourDans, lireSemaines, joursDe } = await import('./store');
    garderSemaine(semaine('inconnu', 'RH'));
    const brut = store.get('asp-planning-v1')!;
    expect(brut).toContain('MARTIN Paul');
    expect(jourDans(lireSemaines(), '2026-11-30')).toBeNull();
    expect(joursDe(lireSemaines()[0]).map((j) => j.date)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
  });

  it('statut d’après le nom du fichier', async () => {
    const { statutDuFichier } = await import('./store');
    expect(statutDuFichier('Planning Securite chantier S48  définitif.pdf')).toBe('definitif');
    expect(statutDuFichier('planning S30 securite chantier provisoire.pdf')).toBe('provisoire');
    expect(statutDuFichier('Planning S42 Securite chantiers.pdf')).toBe('inconnu');
  });
});
