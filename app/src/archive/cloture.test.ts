import { describe, expect, it } from 'vitest';
import { aCloturer, jourMoins, nomDossier, RAPPEL_JOURS } from './cloture';

describe('clôture de fin de mission', () => {
  const j = '2026-11-28';
  it('jour moins n jours, en changeant de mois', () => {
    expect(jourMoins(j, 1)).toBe('2026-11-27');
    expect(jourMoins('2026-03-01', 1)).toBe('2026-02-28');
    expect(jourMoins(j, RAPPEL_JOURS)).toBe('2026-11-14');
  });
  it('à clôturer : finie aujourd’hui, ou d’un jour passé récent', () => {
    expect(aCloturer({ date: j }, true, j)).toBe(true);
    expect(aCloturer({ date: j }, false, j)).toBe(false);
    expect(aCloturer({ date: '2026-11-27' }, false, j)).toBe(true);
    expect(aCloturer({ date: '2026-11-14' }, false, j)).toBe(true);
    // Trop ancienne pour un rappel, même finie.
    expect(aCloturer({ date: '2026-11-13' }, true, j)).toBe(false);
    // Demain : pas encore.
    expect(aCloturer({ date: '2026-11-29' }, false, j)).toBe(false);
  });
  it('déjà clôturée, ou brouillon : jamais rappelée', () => {
    expect(aCloturer({ date: '2026-11-27', cloture: { le: 1, par: 'A', archive: 'x' } }, true, j)).toBe(false);
    expect(aCloturer({ date: '2026-11-27', brouillon: true }, true, j)).toBe(false);
  });
  it('nom du fichier du dossier', () => {
    expect(nomDossier('Journal-PN-PN-26-2026-11-25-1025.pdf')).toBe('Dossier-Journal-PN-PN-26-2026-11-25-1025.pdf');
    expect(nomDossier('Dossier-Traverses.pdf')).toBe('Dossier-Traverses.pdf');
  });
});
