import { describe, expect, it } from 'vitest';
import { calculChantier, nouveauChantier } from './chantier';
import { annonceurParSens, avecAgentA, codesAgents, infoDeplacement, nouveauxProblemes, pointsAnnonceAgent, sansPaTexte } from './dispositif';

/** Chantier fixe double voie, PK 28+718 → 28+768, 160 km/h, 1re catégorie : un annonceur par sens au point d'annonce. */
function chantier() {
  const c0 = nouveauChantier({ ligne: '830000', pkDebut: 28.718, pkFin: 28.768 });
  c0.voies = c0.voies.map((v) => ({ ...v, vitesse: 160 }));
  const r = calculChantier(c0);
  const c = annonceurParSens(c0, r);
  return { c, r: calculChantier(c) };
}

describe('déplacer un agent sur la carte', () => {
  it('dit son PK et où il est par rapport au point d’annonce qu’il surveille', () => {
    const { c, r } = chantier();
    const a1 = c.agents.find((a) => codesAgents(c.agents).get(a.id) === 'A1')!;
    const pa = r.voies.find((v) => v.sens === 'croissant')!.pointAnnonce!;
    expect(a1.pk).toBeCloseTo(pa, 3);
    // Rapproché du chantier de 120 m : il doit voir 120 m en arrière, jusqu'au point d'annonce.
    expect(infoDeplacement(c, r, a1.id, pa + 0.12)).toMatch(/^A1 · PK \d+\+\d{3} · PA V1 ▲ à 120 m$/);
    // Éloigné du chantier : au-delà du point d'annonce.
    expect(infoDeplacement(c, r, a1.id, pa - 0.05)).toMatch(/au-delà du PA V1 ▲$/);
  });

  it('après le déplacement : ce qui est apparu à vérifier', () => {
    const { c, r } = chantier();
    const a1 = c.agents.find((a) => codesAgents(c.agents).get(a.id) === 'A1')!;
    const pa = r.voies.find((v) => v.sens === 'croissant')!.pointAnnonce!;
    const plusPres = avecAgentA(c, a1.id, pa + 0.12);
    expect(plusPres.agents.find((a) => a.id === a1.id)!.pk).toBe(pa + 0.12);
    expect(c.agents.find((a) => a.id === a1.id)!.pk).toBeCloseTo(pa, 3); // l'original ne change pas
    expect(nouveauxProblemes(c, plusPres, r).join(' ')).toMatch(/A1 doit voir jusqu’au PK .* 120 m de visibilité/);
    expect(nouveauxProblemes(c, avecAgentA(c, a1.id, pa - 0.05), r).join(' ')).toMatch(/A1 est placé au-delà du point d’annonce/);
    expect(nouveauxProblemes(c, c, r)).toEqual([]);
  });
});

describe('point d’annonce de chaque annonceur', () => {
  it('posé au point, à voir arriver les trains, ou au-delà, avec le calcul du point', () => {
    const { c, r } = chantier();
    const a1 = c.agents.find((a) => codesAgents(c.agents).get(a.id) === 'A1')!;
    // 160 km/h × 10 s (5 s de dégagement + 5 s de marge) = 444 m, arrondi à 450 m avant le PK 28+718 : PA au PK 28+268.
    const [au] = pointsAnnonceAgent(c, r, a1.id);
    expect(au).toMatchObject({ titre: 'PA V1 ▲', pk: 28.268, etat: 'au', ecart: 0 });
    expect(au.calcul).toBe('160 km/h × 10 s (dégagement 5 s + marge 5 s) = 450 m avant le chantier (PK 28+718).');

    const [voir] = pointsAnnonceAgent(avecAgentA(c, a1.id, 28.7), r, a1.id);
    expect(voir).toMatchObject({ etat: 'voir', ecart: 432 });
    expect(voir.texte).toBe('Doit voir arriver les trains sur 432 m, jusqu’au PK 28+268 : à vérifier sur place.');

    const [loin] = pointsAnnonceAgent(avecAgentA(c, a1.id, 28.2), r, a1.id);
    expect(loin).toMatchObject({ etat: 'audela', ecart: 68 });
    expect(loin.texte).toMatch(/^68 m au-delà du point d’annonce/);
    // À 5 m près, il est au point.
    expect(pointsAnnonceAgent(avecAgentA(c, a1.id, 28.272), r, a1.id)[0].etat).toBe('au');

    // Sens décroissant : le point est après la fin de la zone (PK 28+768 + 450 m).
    const a2 = c.agents.find((a) => codesAgents(c.agents).get(a.id) === 'A2')!;
    expect(pointsAnnonceAgent(c, r, a2.id)[0]).toMatchObject({ titre: 'PA V2 ▼', pk: 29.218, etat: 'au' });
  });

  it('un agent qui surveille les deux sens : le plus loin à voir d’abord ; sans point : pourquoi', () => {
    const { c, r } = chantier();
    const a1 = c.agents.find((a) => codesAgents(c.agents).get(a.id) === 'A1')!;
    const deuxSens = { ...c, agents: c.agents.map((a) => (a.id === a1.id ? { ...a, pk: 28.74, surveille: r.voies.map((v) => `${v.voieId}:${v.sens}`) } : a)) };
    expect(pointsAnnonceAgent(deuxSens, r, a1.id).map((p) => [p.titre, p.ecart])).toEqual([
      ['PA V2 ▼', 478],
      ['PA V1 ▲', 472],
    ]);
    expect(sansPaTexte({ ...a1, role: 'repetiteur' })).toMatch(/Répète l’annonce/);
    expect(sansPaTexte({ ...a1, surveille: [] })).toMatch(/Ne surveille encore aucune voie/);
    expect(pointsAnnonceAgent(c, r, 'inconnu')).toEqual([]);
  });
});
