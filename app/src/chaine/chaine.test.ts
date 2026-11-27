import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculChantier, nouveauChantier } from '../asp/chantier';
import { annonceurParSens, avecAgentA, codesAgents } from '../asp/dispositif';
import type { LineDoc } from '../lib/data';
import { donneesChantier, donneesPoste } from '../partage/donnees';
import type { Partage } from '../partage/session';
import { posteFeatures } from './carte';
import { GESTES_COMMUNS, GESTES_ROLE } from './gestes';
import { majPosteLie } from './lien';
import { ajouterEvenementPoste, ajouterTrainPoste, codeLibre, ecartPa, etatPoste, nouveauPoste, retirerDernierTrainPoste, titrePoste, trainsParPa } from './poste';

const doc = JSON.parse(readFileSync('public/data/lines/830000.json', 'utf8')) as LineDoc;
const t = (h: number, m: number) => new Date(2026, 10, 27, h, m).getTime();

function chantierAsp() {
  const c0 = nouveauChantier({ nom: 'Traverses', ligne: '830000', pkDebut: 28.718, pkFin: 28.768, date: '2026-11-27' });
  c0.voies = c0.voies.map((v) => ({ ...v, vitesse: 160 }));
  const c = annonceurParSens(c0, calculChantier(c0));
  return { c, r: calculChantier(c) };
}
const partageAsp = (donnees: ReturnType<typeof donneesChantier>): Partage => ({ appareil: 'asp-tel-1234', activite: 'asp', nom: 'Moo', tel: '06 12 34 56 78', donnees, maj: t(22, 0) });

describe('poste d’un agent de la chaîne', () => {
  it('codes, état, trains et incidents', () => {
    expect(codeLibre('annonceur', ['A1', 'A2'])).toBe('A3');
    expect(codeLibre('sentinelle', [])).toBe('S1');
    let p = nouveauPoste({ role: 'repetiteur', code: 'R1', chantier: 'Traverses', date: '2026-11-27', pk: 28.5, pas: [{ titre: 'PA V1 ▲', pk: 28.268 }] });
    expect(titrePoste(p)).toBe('Répétiteur R1 · Traverses');
    expect(etatPoste(p).texte).toBe('Pas encore en place');
    expect(ecartPa(p, p.pas[0])).toBe(232);
    p = { ...p, prise: t(22, 5) };
    expect(etatPoste(p, t(23, 15))).toEqual({ texte: 'En place depuis 22:05 (1 h 10)', niveau: 'en-place' });
    p = ajouterTrainPoste(ajouterTrainPoste(p, 'PA V1 ▲', t(22, 31)), 'PA V1 ▲', t(23, 2));
    expect(trainsParPa(p)).toEqual([{ nom: 'PA V1 ▲', heures: [t(22, 31), t(23, 2)] }]);
    expect(retirerDernierTrainPoste(p).trains).toHaveLength(1);
    p = ajouterEvenementPoste(p, 'incident', ' Perdu la vue de S1 ', t(23, 10));
    expect(p.evenements[0]).toMatchObject({ type: 'incident', texte: 'Perdu la vue de S1' });
    expect(etatPoste({ ...p, fin: t(5, 10) }).texte).toBe('Fin de poste à 05:10');
  });

  it('fiche réflexe : chaque rôle a ses gestes, et ce qui vaut pour tous', () => {
    for (const r of ['annonceur', 'repetiteur', 'sentinelle'] as const) expect(GESTES_ROLE[r].length).toBeGreaterThan(0);
    expect(GESTES_COMMUNS.find((b) => b.important)?.points.join(' ')).toMatch(/je préviens l’ASP tout de suite/);
  });
});

describe('chaîne reliée par le chantier partagé', () => {
  it('l’ASP partage sa chaîne : chaque poste avec son PK, ce qu’il surveille et ses points d’annonce', () => {
    const { c, r } = chantierAsp();
    const d = donneesChantier(c, r, doc);
    expect(d.chaine).toEqual([
      { code: 'A1', role: 'annonceur', pk: 28.268, surveille: 'V1 ▲', pas: [{ titre: 'PA V1 ▲', pk: 28.268 }] },
      { code: 'A2', role: 'annonceur', pk: 29.218, surveille: 'V2 ▼', pas: [{ titre: 'PA V2 ▼', pk: 29.218 }] },
    ]);
  });

  it('le poste relié suit ce que l’ASP change, avec un message', () => {
    const { c, r } = chantierAsp();
    const asp = partageAsp(donneesChantier(c, r, doc));
    const m = asp.donnees.chaine![0];
    const p = nouveauPoste({ role: m.role, code: m.code, pk: m.pk, pas: m.pas, surveille: m.surveille, chantier: 'Traverses', ligne: '830000', asp: 'Moo', aspTel: '06 12 34 56 78', lien: { asp: asp.appareil, session: 'K7P3QX' } });
    expect(majPosteLie(p, [asp])).toBeNull();
    // L'ASP rapproche A1 du chantier : le poste suit.
    const a1 = c.agents.find((a) => codesAgents(c.agents).get(a.id) === 'A1')!;
    const deplace = partageAsp(donneesChantier(avecAgentA(c, a1.id, 28.7), r, doc));
    const maj = majPosteLie(p, [deplace])!;
    expect(maj.message).toBe('L’ASP a déplacé ton poste A1 : PK 28+700.');
    expect(maj.poste.pk).toBe(28.7);
    // Un poste non relié, fini, ou dont l'ASP ne partage plus rien : rien ne change.
    expect(majPosteLie({ ...p, lien: null }, [deplace])).toBeNull();
    expect(majPosteLie({ ...p, fin: t(5, 0) }, [deplace])).toBeNull();
    expect(majPosteLie(p, [])).toBeNull();
  });

  it('l’agent partage son poste : relié, pas de point en double sur la carte (l’ASP le montre déjà)', () => {
    const p = nouveauPoste({ code: 'A1', chantier: 'Traverses', ligne: '830000', pk: 28.5, date: '2026-11-27', prise: t(22, 5), lien: { asp: 'asp-tel-1234', session: 'K7P3QX' } });
    const d = donneesPoste(p, doc);
    expect(d).toMatchObject({ titre: 'Annonceur A1 · Traverses', etat: 'En place depuis 22:05', niveau: 'en-place', lien: { asp: 'asp-tel-1234', code: 'A1' }, geo: [] });
    expect(donneesPoste({ ...p, lien: null }, doc).geo).toHaveLength(1);
  });

  it('mon poste sur la carte : moi, le point d’annonce et le trait jusqu’à lui', () => {
    const p = nouveauPoste({ code: 'A1', ligne: '830000', pk: 28.7, pas: [{ titre: 'PA V1 ▲', pk: 28.268 }] });
    const fc = posteFeatures(p, doc);
    const roles = fc.features.map((f) => f.properties?.role);
    expect(roles).toContain('agent');
    expect(roles).toContain('pa');
    expect(fc.features.find((f) => f.properties?.role === 'vue')?.properties?.label).toBe('A1 → PA V1 ▲ · 432 m');
  });
});
