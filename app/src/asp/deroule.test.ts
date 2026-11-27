import { describe, expect, it } from 'vitest';
import { calculChantier, nouveauChantier, normaliser } from './chantier';
import {
  aHeure,
  ajouterEvenementCr,
  ajouterTrain,
  durees,
  effacerJalon,
  etatIntervention,
  lireDeroule,
  noterJalon,
  prochainJalon,
  referenceHeure,
  retirerDernierTrain,
  retirerEvenementCr,
  trainsParSens,
} from './deroule';
import { compteRenduTexte } from './partage';

const t = (h: number, m: number, j = 25) => new Date(2026, 10, j, h, m).getTime();

function chantier() {
  const c = nouveauChantier({ nom: 'Traverses', ligne: '830000', pkDebut: 47.1, pkFin: 47.3, date: '2026-11-25', horaire: 'nuit', asp: 'Moo', responsable: 'M. Durand' });
  c.voies = c.voies.map((v) => ({ ...v, vitesse: 160 }));
  return { c, r: calculChantier(c) };
}

describe('déroulé de l’intervention', () => {
  it('les moments dans l’ordre ; dispositif levé : fini', () => {
    const { c } = chantier();
    let d = c.deroule;
    expect(prochainJalon(d)?.id).toBe('arrivee');
    expect(etatIntervention(c, t(21, 0))).toBe('Pas commencée');
    d = noterJalon(d, 'arrivee', t(21, 40));
    expect(prochainJalon(d)?.id).toBe('enPlace');
    // Un moment noté plus loin : on continue après lui.
    d = noterJalon(d, 'debut', t(22, 10));
    expect(prochainJalon(d)?.id).toBe('fin');
    expect(etatIntervention({ ...c, deroule: d }, t(23, 45))).toBe('En cours depuis 2 h 05');
    d = noterJalon(d, 'leve', t(5, 5, 26));
    expect(prochainJalon(d)).toBeNull();
    expect(etatIntervention({ ...c, deroule: d }, t(6, 0, 26))).toBe('Finie à 05:05 (26/11)');
    expect(prochainJalon(effacerJalon(d, 'leve'))?.id).toBe('fin');
  });

  it('heure tapée à la main : le bon jour, même la nuit après minuit', () => {
    const { c } = chantier();
    const d = noterJalon(noterJalon(c.deroule, 'arrivee', t(21, 40)), 'enPlace', t(22, 5));
    // Fin des travaux tapée « 04:50 » : le lendemain matin, au plus près du dernier moment noté.
    expect(aHeure('04:50', referenceHeure(d, 'fin', t(5, 0, 26)))).toBe(t(4, 50, 26));
    // Correction de l'arrivée : même jour.
    expect(aHeure('21:35', referenceHeure(d, 'arrivee', t(5, 0, 26)))).toBe(t(21, 35));
    expect(aHeure('25:00', t(21, 0))).toBeNull();
    expect(aHeure('', t(21, 0))).toBeNull();
  });

  it('durées, trains par voie, incidents ; relu d’un chantier plus ancien', () => {
    const { c, r } = chantier();
    const v1 = `${r.voies[0].voieId}:${r.voies[0].sens}`;
    const v2 = `${r.voies[1].voieId}:${r.voies[1].sens}`;
    let d = c.deroule;
    d = noterJalon(d, 'arrivee', t(21, 40));
    d = noterJalon(d, 'enPlace', t(22, 5));
    d = noterJalon(d, 'debut', t(22, 10));
    d = noterJalon(d, 'fin', t(4, 50, 26));
    d = noterJalon(d, 'leve', t(5, 5, 26));
    expect(durees(d).map((x) => [x.titre, x.ms / 60000])).toEqual([
      ['Intervention', 445],
      ['Sous annonce', 420],
      ['Travaux', 400],
    ]);
    d = ajouterTrain(ajouterTrain(ajouterTrain(d, v1, t(22, 31)), v2, t(23, 2)), v1, t(23, 40));
    expect(trainsParSens(c, r, d).map((x) => [x.nom, x.heures.length])).toEqual([
      ['V1 ▲', 2],
      ['V2 ▼', 1],
    ]);
    expect(retirerDernierTrain(d).trains).toHaveLength(2);
    d = ajouterEvenementCr(d, 'observation', ' Pluie ', t(1, 0, 26));
    d = ajouterEvenementCr(d, 'incident', 'Annonce mal perçue', t(23, 15));
    expect(d.evenements.map((e) => e.texte)).toEqual(['Annonce mal perçue', 'Pluie']);
    expect(retirerEvenementCr(d, d.evenements[0].id).evenements).toHaveLength(1);

    const texte = compteRenduTexte({ ...c, deroule: d }, r);
    expect(texte).toContain('Compte rendu d’intervention · Traverses');
    expect(texte).toContain('- Dispositif levé : 05:05 (26/11)');
    expect(texte).toContain('Durée : intervention 7 h 25 · sous annonce 7 h 00 · travaux 6 h 40');
    expect(texte).toContain('Trains annoncés : 3 (V1 ▲ : 2 · V2 ▼ : 1)');
    expect(texte).toContain('- 23:15 Incident : Annonce mal perçue');

    // Chantier gardé avant le compte rendu : déroulé vide ; valeurs abîmées ignorées.
    const { deroule: _, ...ancien } = c;
    expect(normaliser(ancien).deroule).toEqual({ jalons: {}, trains: [], evenements: [] });
    expect(lireDeroule({ jalons: { arrivee: 'x', fin: 5 }, trains: [{ t: 1 }, null], evenements: [{ t: 2, texte: 'ok', type: 'autre' }] })).toMatchObject({
      jalons: { fin: 5 },
      trains: [{ t: 1, cle: null }],
      evenements: [{ t: 2, texte: 'ok', type: 'observation' }],
    });
  });
});
