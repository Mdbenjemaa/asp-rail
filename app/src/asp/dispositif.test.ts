import { describe, expect, it } from 'vitest';
import { calculChantier, nouveauChantier } from './chantier';
import { annonceurParSens, avecAgentA, codesAgents, infoDeplacement, nouveauxProblemes } from './dispositif';

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
