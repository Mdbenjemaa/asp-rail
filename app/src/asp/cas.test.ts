import { describe, expect, it } from 'vitest';
import { CAS } from './cas';
import { calculChantier, cleSens, nouveauChantier, nouvelleVoie, zoneAnnonce, type Chantier } from './chantier';
import { codesAgents, controlesDispositif, visibilites } from './dispositif';
import { resumeTexte } from './partage';
import { pdfText } from '../lib/pdfKit';

/** Ce que disent les corrections : délai d'annonce, puis [voie, sens, distance, point d'annonce]. */
const ATTENDU: Record<string, { da: number; ms: number; voies: [string, string, number, number][] }> = {
  ex1: { da: 10, ms: 5, voies: [['V1', 'croissant', 450, 3.75], ['V2', 'decroissant', 480, 4.73]] },
  ex2: { da: 10, ms: 5, voies: [['V1', 'croissant', 450, 3.75], ['V1', 'decroissant', 450, 4.7]] },
  ex3: {
    da: 20,
    ms: 15,
    voies: [
      ['V1bis', 'croissant', 670, 11.33],
      ['V1', 'croissant', 780, 11.22],
      ['V2', 'decroissant', 780, 12.83],
      ['V2bis', 'decroissant', 670, 12.72],
    ],
  },
  ex4: { da: 10, ms: 5, voies: [['V2', 'decroissant', 390, 12.74]] },
  ex5: { da: 20, ms: 15, voies: [['V1', 'croissant', 780, 11.52], ['V2', 'decroissant', 780, 13.13]] },
  ex6: { da: 5, ms: 5, voies: [['V2', 'decroissant', 200, 12.55]] },
  ex7: { da: 5, ms: 5, voies: [['V1', 'croissant', 200, 55.1]] },
};

describe('cas pratiques : le moteur donne les valeurs des corrections', () => {
  for (const cas of CAS) {
    it(cas.titre, () => {
      const r = calculChantier(cas.chantier());
      const a = ATTENDU[cas.id];
      expect(r.da).toBe(a.da);
      expect(r.ms.valeur).toBe(a.ms);
      expect(r.voies.map((v) => [v.voie, v.sens, v.distance, v.pointAnnonce])).toEqual(a.voies);
      expect(r.dfv).toEqual([]);
      // Chaque distance et chaque PK cité dans la correction est bien écrit dans son texte.
      const texte = cas.correction.join(' ');
      for (const [, , d, pk] of a.voies) {
        expect(texte).toContain(`${d} m`);
        expect(texte).toContain(`PK ${Math.floor(pk)}+${String(Math.round((pk % 1) * 1000)).padStart(3, '0')}`);
      }
    });
  }
});

describe('chantier mobile', () => {
  it('calcule les points d’annonce depuis la portion sous annonce, qui avance avec l’équipe', () => {
    const c = CAS.find((x) => x.id === 'ex3')!.chantier();
    expect(zoneAnnonce(c)).toEqual({ debut: 12, fin: 12.05 });
    const plusLoin: Chantier = { ...c, pkEquipe: 13 };
    const r = calculChantier(plusLoin);
    expect(r.voies.find((v) => v.voie === 'V1')?.pointAnnonce).toBe(12.22);
    expect(r.voies.find((v) => v.voie === 'V2')?.pointAnnonce).toBe(13.83);
  });
});

describe('dispositif', () => {
  const base = () => {
    const v1 = nouvelleVoie('V1', 'croissant', 'travail', 140);
    const v2 = nouvelleVoie('V2', 'decroissant', 'contigue', 140);
    return { v1, v2, c: nouveauChantier({ pkDebut: 12.3, pkFin: 12.35, voies: [v1, v2], dd: 5, entreprise: 'ETF' }) };
  };

  it('signale une voie que personne ne surveille', () => {
    const { c } = base();
    const alertes = controlesDispositif(c, calculChantier(c));
    expect(alertes.filter((a) => a.niveau === 'stop').map((a) => a.texte)).toEqual([
      'Personne ne surveille V1 (vers les PK croissants).',
      'Personne ne surveille V2 (vers les PK décroissants).',
    ]);
  });

  it('un annonceur sur les 2 sens demande la case « 2 sens », et donne la visibilité à avoir', () => {
    const { c, v1, v2 } = base();
    const avec: Chantier = {
      ...c,
      agents: [...c.agents, { id: 'a1', role: 'annonceur', nom: 'Karim', entreprise: 'ETF', pk: 12.32, surveille: [cleSens(v1.id, 'croissant'), cleSens(v2.id, 'decroissant')] }],
    };
    const r = calculChantier(avec);
    expect(controlesDispositif(avec, r).some((a) => a.niveau === 'stop' && /2 sens/.test(a.texte))).toBe(true);
    const ok: Chantier = { ...avec, p: { ...avec.p, annonceur2Sens: true } };
    const r2 = calculChantier(ok);
    expect(r2.ms.valeur).toBe(15);
    expect(controlesDispositif(ok, r2).filter((a) => a.niveau === 'stop')).toEqual([]);
    // DA 20 s → 780 m : V1 au PK 11+520, V2 au PK 13+130 ; l'annonceur au PK 12+320 doit voir 800 m et 810 m.
    expect(visibilites(ok, r2).map((v) => v.aVoir)).toEqual([800, 810]);
    expect(codesAgents(ok.agents).get('a1')).toBe('A1');
  });

  it('refuse la mixité d’entreprises dans la chaîne', () => {
    const { c, v1, v2 } = base();
    const mix: Chantier = {
      ...c,
      agents: [
        ...c.agents,
        { id: 'a1', role: 'annonceur', nom: '', entreprise: 'ETF', pk: null, surveille: [cleSens(v1.id, 'croissant')] },
        { id: 'a2', role: 'annonceur', nom: '', entreprise: 'Autre', pk: null, surveille: [cleSens(v2.id, 'decroissant')] },
      ],
    };
    expect(controlesDispositif(mix, calculChantier(mix)).some((a) => /Mixité/.test(a.texte))).toBe(true);
  });

  it('l’ASP ne peut pas être annonceur sur un chantier mobile', () => {
    const { c, v1 } = base();
    const m: Chantier = { ...c, type: 'mobile', agents: c.agents.map((a) => (a.role === 'asp' ? { ...a, surveille: [cleSens(v1.id, 'croissant')] } : a)) };
    expect(controlesDispositif(m, calculChantier(m)).some((a) => /mobile/.test(a.texte))).toBe(true);
  });
});

describe('partage', () => {
  it('le résumé reprend la zone, les délais et les points d’annonce', () => {
    const c = CAS[0].chantier();
    const t = resumeTexte(c, calculChantier(c));
    expect(t).toContain('Ligne 830 000');
    expect(t).toContain('PK 4+200 → 4+250');
    expect(t).toContain('DD 5 s · MS 5 s · DA 10 s');
    expect(t).toContain('V1 ▲ (vers les PK croissants) 160 km/h, 10 s : 450 m → point d’annonce PK 3+750');
    expect(t).toContain('V2 ▼ (vers les PK décroissants) 170 km/h, 10 s : 480 m → point d’annonce PK 4+730');
  });
  it('le PDF n’utilise que des caractères connus des polices standard', () => {
    expect(pdfText('V1 ▲ → PK 3+750 ≥ 10 s')).toBe('V1 (+) -> PK 3+750 >= 10 s');
    expect(pdfText('d’annonce « à vérifier » — œuvre')).toBe('d’annonce « à vérifier » — œuvre');
  });
});
