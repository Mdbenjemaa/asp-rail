import { describe, expect, it } from 'vitest';
import { activitesDuPoste, interpreter, prochainService, resume, serviceDuMoment, titreJour, travaille, type JourPlanning } from './jour';

describe('une case du planning', () => {
  it('nuit d’annonceur', () => {
    const j = interpreter(['"RGI EXEMPLE 4"', '[ANN]', 'Melun', '21h00-04h00'], '2026-11-23');
    expect(j).toMatchObject({ code: null, chantier: 'RGI EXEMPLE 4', poste: 'ANN', lieu: 'Melun', debut: '21:00', fin: '04:00', nuit: true });
    expect(travaille(j)).toBe(true);
    expect(resume(j)).toBe('RGI EXEMPLE 4 · ANN · 21h00-04h00 · Melun');
  });

  it('jour avec prise de service, OTP et informations', () => {
    const j = interpreter(['"RGI Exemple ²"', '[Doublon ANN ]', 'PS: Gare de Sens', '08h00-16h00', 'TOPO', 'OTP:101'], '2026-05-12');
    expect(j).toMatchObject({ chantier: 'RGI Exemple', poste: 'Doublon ANN', ps: 'Gare de Sens', otp: '101', lieu: '', debut: '08:00', fin: '16:00', nuit: false });
  });

  it('zone avant le poste, horaire en majuscules, NUIT écrit', () => {
    const j = interpreter(['"CDG Axe nord "', 'Zone F', '[APLAM/S9]', '22H00-05h00', 'Ps : Giratoire de Mitry', 'OTP: 947'], '2026-11-23');
    expect(j).toMatchObject({ chantier: 'CDG Axe nord', lieu: 'Zone F', poste: 'APLAM/S9', ps: 'Giratoire de Mitry', debut: '22:00', fin: '05:00', nuit: true });
  });

  it('formation : pas de guillemets ni de poste', () => {
    const j = interpreter(['Formation', 'TES F', '60 quai du port', '08h00-17h00', 'Avec 1h de pause', 'EPI Obligatoire'], '2026-07-21');
    expect(j).toMatchObject({ chantier: 'Formation', lieu: 'TES F', debut: '08:00', fin: '17:00', nuit: false });
  });

  it('codes sans chantier', () => {
    for (const c of ['RH', 'Z', 'AMO', 'CP', 'JF', 'FIN CONTRAT', 'Autres']) {
      const j = interpreter([c], '2026-11-28');
      expect(j.code).toBe(c === 'Autres' ? 'Autres' : c);
      expect(travaille(j)).toBe(false);
    }
    expect(titreJour(interpreter(['RH'], '2026-11-29'))).toBe('Repos hebdomadaire (RH)');
    expect(titreJour(interpreter(['AMO'], '2026-11-29'))).toBe('Attente de mission (AMO)');
    expect(titreJour(interpreter(['CSS'], '2026-11-29'))).toBe('CSS');
    expect(titreJour(interpreter([], '2026-11-29'))).toBe('Rien de prévu');
  });

  it('activité de l’appli selon le poste', () => {
    expect(activitesDuPoste('ANN')).toEqual(['asp']);
    expect(activitesDuPoste('Doublon APN')).toEqual(['pn']);
    expect(activitesDuPoste('APLAM/S9')).toEqual(['lam']);
    expect(activitesDuPoste('APN/APS9')).toEqual(['pn', 'lam']);
    expect(activitesDuPoste('CH1 /CB1 /PEC')).toEqual([]);
  });
});

describe('service du moment', () => {
  const semaine: Record<string, string[]> = {
    '2026-11-23': ['"RGI EXEMPLE"', '[ANN]', '21h00-04h00'],
    '2026-11-24': ['"RGI EXEMPLE"', '[ANN]', '21h00-04h00'],
    '2026-11-27': ['"RGI EXEMPLE"', '[ANN]', '21h00-04h00'],
    '2026-11-28': ['Z'],
    '2026-11-29': ['RH'],
    '2026-11-30': ['"RGI AUTRE"', '[APN]', '08h00-15h00'],
  };
  const jours = (d: string): JourPlanning | null => (semaine[d] ? interpreter(semaine[d], d) : null);
  const a = (j: number, h: number, mn = 0) => new Date(2026, 10, j, h, mn).getTime();

  it('la nuit d’hier tant qu’elle n’est pas finie, puis la case du jour', () => {
    expect(serviceDuMoment(jours, a(24, 2))?.date).toBe('2026-11-23');
    expect(serviceDuMoment(jours, a(24, 4, 20))?.date).toBe('2026-11-23');
    expect(serviceDuMoment(jours, a(24, 6))?.date).toBe('2026-11-24');
    expect(serviceDuMoment(jours, a(23, 15))?.date).toBe('2026-11-23');
  });

  it('jour de repos : le prochain service', () => {
    expect(serviceDuMoment(jours, a(29, 12))?.code).toBe('RH');
    expect(prochainService(jours, a(29, 12))?.date).toBe('2026-11-30');
    expect(serviceDuMoment(jours, a(25, 12))).toBeNull();
  });
});
