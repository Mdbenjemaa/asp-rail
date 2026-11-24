import { describe, expect, it } from 'vitest';
import { AUCUNE_PARTICULARITE, calculer, distanceAnnonce, type Entree, type Particularites, type Voie } from './rules';

const voie = (id: string, nom: string, sens: Voie['sens'], vitesse: number, role: Voie['role'], interdite = false): Voie => ({
  id,
  nom,
  sens,
  vitesse,
  role,
  interdite,
});
const entree = (e: Partial<Entree> & { voies: Voie[] }, p: Partial<Particularites> = {}): Entree => ({
  outillage: 'cat1',
  dd: 5,
  pkDebut: null,
  pkFin: null,
  ...e,
  p: { ...AUCUNE_PARTICULARITE, ...p },
});
/** Résultat d'une voie dans un sens : distance et point d'annonce. */
const sur = (r: ReturnType<typeof calculer>, voieNom: string, sens: 'croissant' | 'decroissant') =>
  r.voies.find((v) => v.voie === voieNom && v.sens === sens);

describe('distance d’annonce (tableau du support)', () => {
  it('suit le tableau : V / 3,6 × délai, arrondi à la dizaine supérieure', () => {
    const cases: [number, number, number][] = [
      [30, 5, 50],
      [40, 5, 60],
      [60, 5, 90],
      [100, 10, 280],
      [140, 15, 590],
      [120, 60, 2000],
      [130, 60, 2170],
      [160, 20, 890],
      [160, 30, 1340],
      [160, 60, 2670],
      [150, 25, 1050],
      [170, 5, 240],
      [170, 15, 710],
      [200, 15, 840],
      [220, 20, 1230],
      [230, 5, 320],
      [270, 15, 1130],
      [300, 10, 840],
      [190, 35, 1850],
      [180, 5, 250],
    ];
    for (const [v, t, d] of cases) expect(distanceAnnonce(v, t), `${v} km/h, ${t} s`).toBe(d);
  });
  it('170 km/h et 10 s : 480 m (472 m exacts), comme le tableau DMVC, pas 470', () => {
    expect(distanceAnnonce(170, 10)).toBe(480);
  });
  it('donne 0 sans vitesse ni délai', () => {
    expect(distanceAnnonce(0, 10)).toBe(0);
    expect(distanceAnnonce(140, 0)).toBe(0);
  });
});

describe('exercices du support (corrigés)', () => {
  it('exercice 1 : V1 circulée 160, V2 170, portatif, 2 annonceurs → DA 10 s, PK 3+750 et 4+730', () => {
    const r = calculer(
      entree({
        voies: [voie('1', 'V1', 'croissant', 160, 'travail'), voie('2', 'V2', 'decroissant', 170, 'contigue')],
        pkDebut: 4.2,
        pkFin: 4.25,
      }),
    );
    expect(r.situation).toBe('circulee');
    expect(r.dfv).toEqual([]);
    expect(r.dd.erreurs).toEqual([]);
    expect(r.ms.valeur).toBe(5);
    expect(r.da).toBe(10);
    expect(sur(r, 'V1', 'croissant')).toMatchObject({ distance: 450, pointAnnonce: 3.75, limiteAmont: 4.2 });
    expect(sur(r, 'V2', 'decroissant')).toMatchObject({ distance: 480, pointAnnonce: 4.73, limiteAmont: 4.25 });
  });

  it('exercice 2 : 2e catégorie sur V2 à 170, banalisé, garage non contigu → interdiction obligatoire', () => {
    const voies = [voie('1', 'V1', 'deux', 160, 'contigue'), voie('2', 'V2', 'deux', 170, 'travail')];
    const r = calculer(entree({ voies, outillage: 'cat2', pkDebut: 4.2, pkFin: 4.25 }, { banaliseVutTct: true, garageDifficile: true }));
    expect(r.dfv.join(' ')).toMatch(/banalisée/);
    expect(r.dfv.join(' ')).toMatch(/garage difficile/);
    expect(r.dfv.join(' ')).toMatch(/160 km\/h/);
    expect(r.alertes[0].niveau).toBe('stop');
    // V2 interdite (DFV obtenue) : on annonce V1 dans les 2 sens, un annonceur par sens.
    voies[1].interdite = true;
    const r2 = calculer(entree({ voies, outillage: 'cat2', pkDebut: 4.2, pkFin: 4.25 }, { banaliseVutTct: true, garageDifficile: true }));
    expect(r2.situation).toBe('interdite');
    expect(r2.dfv).toEqual([]);
    expect(r2.ms.valeur).toBe(5);
    expect(r2.voies.map((v) => [v.voie, v.sens, v.distance, v.pointAnnonce])).toEqual([
      ['V1', 'croissant', 450, 3.75],
      ['V1', 'decroissant', 450, 4.7],
    ]);
  });

  it('exercice 3 : topo sur 4 voies, voies intérieures → MS 15 s, DA 20 s, 780 m et 670 m', () => {
    const r = calculer(
      entree(
        {
          voies: [
            voie('a', 'V1bis', 'croissant', 120, 'travail'),
            voie('b', 'V1', 'croissant', 140, 'travail'),
            voie('c', 'V2', 'decroissant', 140, 'travail'),
            voie('d', 'V2bis', 'decroissant', 120, 'travail'),
          ],
          pkDebut: 12,
          pkFin: 12.05,
          type: 'mobile',
        },
        { voiesInterieures: true },
      ),
    );
    expect(r.ms.valeur).toBe(15);
    expect(r.da).toBe(20);
    expect(sur(r, 'V1', 'croissant')).toMatchObject({ distance: 780, pointAnnonce: 11.22 });
    expect(sur(r, 'V1bis', 'croissant')).toMatchObject({ distance: 670, pointAnnonce: 11.33 });
    expect(sur(r, 'V2', 'decroissant')).toMatchObject({ distance: 780, pointAnnonce: 12.83 });
    expect(sur(r, 'V2bis', 'decroissant')).toMatchObject({ distance: 670, pointAnnonce: 12.72 });
    // Sans agents sur les voies intérieures (V1 et V2 interdites), la marge retombe à 5 s : 390 m et 340 m.
    const sans = calculer(
      entree({
        voies: [
          voie('a', 'V1bis', 'croissant', 120, 'travail'),
          voie('b', 'V1', 'croissant', 140, 'contigue'),
          voie('d', 'V2bis', 'decroissant', 120, 'contigue'),
        ],
        pkDebut: 12,
        pkFin: 12.05,
      }),
    );
    expect(sans.ms.valeur).toBe(5);
    expect(sur(sans, 'V1', 'croissant')?.distance).toBe(390);
    expect(sur(sans, 'V1bis', 'croissant')?.distance).toBe(340);
  });

  it('exercice 4 : V1 interdite (170), V2 140 annoncée, 2e catégorie → DA 10 s, PK 12+740', () => {
    const r = calculer(
      entree({
        voies: [voie('1', 'V1', 'croissant', 170, 'travail', true), voie('2', 'V2', 'decroissant', 140, 'contigue')],
        outillage: 'cat2',
        pkDebut: 12.3,
        pkFin: 12.35,
      }),
    );
    expect(r.situation).toBe('interdite');
    expect(r.dfv).toEqual([]);
    expect(r.ms.valeur).toBe(5);
    expect(r.voies).toHaveLength(1);
    expect(sur(r, 'V2', 'decroissant')).toMatchObject({ distance: 390, pointAnnonce: 12.74 });
  });

  it('exercice 5 : un seul annonceur pour les 2 sens → MS 15 s, 780 m, PK 11+520 et 13+130', () => {
    const r = calculer(
      entree(
        { voies: [voie('1', 'V1', 'croissant', 140, 'travail'), voie('2', 'V2', 'decroissant', 140, 'contigue')], pkDebut: 12.3, pkFin: 12.35 },
        { annonceur2Sens: true },
      ),
    );
    expect(r.ms.valeur).toBe(15);
    expect(r.da).toBe(20);
    expect(sur(r, 'V1', 'croissant')).toMatchObject({ distance: 780, pointAnnonce: 11.52 });
    expect(sur(r, 'V2', 'decroissant')).toMatchObject({ distance: 780, pointAnnonce: 13.13 });
  });

  it('exercice 6 : clôture limitative → DD nul, DA 5 s, 200 m, PK 12+550 (et le DD de 5 s est signalé)', () => {
    const voies = [voie('1', 'V1', 'croissant', 170, 'travail', true), voie('2', 'V2', 'decroissant', 140, 'contigue')];
    const avec5 = calculer(entree({ voies, outillage: 'cat2', dd: 5, pkDebut: 12.3, pkFin: 12.35 }, { clotureLimitative: true }));
    expect(avec5.dd.conseils.join(' ')).toMatch(/peut être nul/);
    expect(sur(avec5, 'V2', 'decroissant')).toMatchObject({ distance: 390, pointAnnonce: 12.74 });
    const nul = calculer(entree({ voies, outillage: 'cat2', dd: 0, pkDebut: 12.3, pkFin: 12.35 }, { clotureLimitative: true }));
    expect(nul.dd.erreurs).toEqual([]);
    expect(nul.ms.valeur).toBe(5);
    expect(nul.da).toBe(5);
    expect(sur(nul, 'V2', 'decroissant')).toMatchObject({ distance: 200, pointAnnonce: 12.55 });
  });

  it('exercice 7 : hors ZD, clôture limitative, l’ASP annonce lui-même → MS 5 s, DA 5 s, 200 m, PK 55+100', () => {
    const r = calculer(
      entree(
        { voies: [voie('1', 'V1', 'croissant', 140, 'contigue'), voie('2', 'V2', 'decroissant', 140, 'hors')], dd: 0, pkDebut: 55.3, pkFin: 55.33 },
        { clotureLimitative: true, aspAnnonceLuiMeme: true },
      ),
    );
    expect(r.situation).toBe('proximite');
    expect(r.ms.valeur).toBe(5);
    expect(r.da).toBe(5);
    expect(r.voies).toHaveLength(1);
    expect(sur(r, 'V1', 'croissant')).toMatchObject({ distance: 200, pointAnnonce: 55.1 });
    // Avec l'analyse de risques qui ne montre aucun risque : annonce non obligatoire.
    const ex = calculer(
      entree(
        { voies: [voie('1', 'V1', 'croissant', 140, 'contigue')], dd: 0, pkDebut: 55.3, pkFin: 55.33 },
        { clotureLimitative: true, analyseSansRisque: true },
      ),
    );
    expect(ex.exemption).toMatch(/aucun risque/);
  });
});

describe('règles du délai de dégagement', () => {
  const voies = [voie('1', 'V1', 'croissant', 140, 'travail')];
  it('refuse un DD nul sans clôture limitative ni engagement par inadvertance', () => {
    const r = calculer(entree({ voies, dd: 0 }));
    expect(r.dd.erreurs[0]).toMatch(/nul n’est possible/);
    expect(r.dd.retenu).toBe(5);
  });
  it('un DD non nul est d’au moins 5 s', () => {
    expect(calculer(entree({ voies, dd: 3 })).dd.erreurs[0]).toMatch(/au moins 5 s/);
  });
  it('soudage ou meulage : 5 s minimum même avec une clôture limitative', () => {
    const r = calculer(entree({ voies, dd: 0 }, { clotureLimitative: true, soudageMeulage: true }));
    expect(r.dd.retenu).toBe(5);
    expect(r.dd.erreurs[0]).toMatch(/Soudage/);
  });
  it('2e catégorie : plus de 15 s impose l’interdiction', () => {
    const r = calculer(entree({ voies, outillage: 'cat2', dd: 20 }));
    expect(r.dfv.join(' ')).toMatch(/plus de 15 s/);
    expect(r.dd.erreurs.join(' ')).toMatch(/15 s/);
  });
  it('demande le DD s’il manque, sans calculer de distance', () => {
    const r = calculer(entree({ voies, dd: null }));
    expect(r.da).toBeNull();
    expect(r.voies[0].distance).toBe(0);
    expect(r.voies[0].pointAnnonce).toBeNull();
  });
});

describe('marge de sécurité', () => {
  const circ = [voie('1', 'V1', 'croissant', 140, 'travail')];
  const inter = [voie('1', 'V1', 'croissant', 140, 'travail', true), voie('2', 'V2', 'decroissant', 140, 'contigue')];
  it('voie circulée : 5 s, 15 s pour la 2e catégorie, le soudage, et les cas particuliers', () => {
    expect(calculer(entree({ voies: circ, outillage: 'aucun' })).ms.valeur).toBe(5);
    expect(calculer(entree({ voies: circ })).ms.valeur).toBe(5);
    expect(calculer(entree({ voies: circ, outillage: 'cat2' })).ms.valeur).toBe(15);
    expect(calculer(entree({ voies: circ }, { soudageMeulage: true })).ms.valeur).toBe(15);
    expect(calculer(entree({ voies: circ }, { obstacleMasquant: true })).ms.valeur).toBe(15);
    expect(calculer(entree({ voies: circ }, { aspAnnonceLuiMeme: true })).ms.valeur).toBe(15);
  });
  it('voie interdite ou proximité : 5 s, 10 s pour les cas particuliers sans clôture, 5 s avec clôture limitative', () => {
    expect(calculer(entree({ voies: inter })).ms.valeur).toBe(5);
    expect(calculer(entree({ voies: inter }, { annonceur2Sens: true })).ms.valeur).toBe(10);
    expect(calculer(entree({ voies: inter }, { annonceur2Sens: true, clotureLimitative: true })).ms.valeur).toBe(5);
    // Les voies intérieures ne sont un cas particulier que sur voie circulée.
    expect(calculer(entree({ voies: inter }, { voiesInterieures: true })).ms.valeur).toBe(5);
  });
  it('agent seul : 15 s sur voie circulée, 10 s sur voie interdite', () => {
    expect(calculer(entree({ voies: circ }, { agentSeul: true })).ms.valeur).toBe(15);
    expect(calculer(entree({ voies: inter }, { agentSeul: true })).ms.valeur).toBe(10);
  });
});

describe('autres règles', () => {
  it('au-delà de 160 km/h, le délai d’annonce est d’au moins 10 s', () => {
    const r = calculer(
      entree(
        { voies: [voie('1', 'V1', 'croissant', 170, 'travail', true), voie('2', 'V2', 'decroissant', 180, 'contigue')], dd: 0, pkDebut: 10, pkFin: 10.1 },
        { clotureLimitative: true },
      ),
    );
    expect(r.da).toBe(5);
    expect(sur(r, 'V2', 'decroissant')).toMatchObject({ da: 10, distance: 500, pointAnnonce: 10.6 });
    expect(sur(r, 'V2', 'decroissant')?.note).toMatch(/10 s/);
  });
  it('3e catégorie sur voie circulée : interdiction obligatoire', () => {
    expect(calculer(entree({ voies: [voie('1', 'V1', 'croissant', 100, 'travail')], outillage: 'cat3' })).dfv[0]).toMatch(/3e catégorie/);
  });
  it('2e catégorie de nuit : interdiction obligatoire', () => {
    expect(calculer(entree({ voies: [voie('1', 'V1', 'croissant', 100, 'travail')], outillage: 'cat2' }, { nuit: true })).dfv[0]).toMatch(/de nuit/);
  });
  it('agent seul de nuit ou en zone bruyante : annonceur obligatoire', () => {
    const r = calculer(entree({ voies: [voie('1', 'V1', 'croissant', 100, 'travail')] }, { agentSeul: true, nuit: true }));
    expect(r.alertes.some((a) => a.niveau === 'stop' && /annonceur\) est obligatoire/.test(a.texte))).toBe(true);
  });
  it('l’ASP ne peut pas annoncer lui-même dans un tunnel', () => {
    const r = calculer(entree({ voies: [voie('1', 'V1', 'croissant', 100, 'travail')] }, { aspAnnonceLuiMeme: true, tunnel: true }));
    expect(r.alertes.some((a) => a.niveau === 'stop' && /tunnel/.test(a.texte))).toBe(true);
  });
  it('confinement (clôture défensive) : annonce non obligatoire', () => {
    expect(calculer(entree({ voies: [voie('1', 'V1', 'croissant', 100, 'contigue')] }, { clotureDefensive: true })).exemption).toMatch(/défensif/);
  });
});
