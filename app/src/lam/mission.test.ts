import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinePoint } from '../lib/data';
import { questionDuJour, questionsDe } from '../asp/quizStats';
import { MEMO_LAM, REGLES_LAM } from './memo';
import {
  avancementLam,
  cocherGesteTtx,
  depecheDe,
  cocherLam,
  controleDsh,
  demarrerTtx,
  depecheTtx,
  enregistrerMissionLam,
  journalTexteLam,
  missionLamParId,
  noterDepeche,
  nouvelleMissionLam,
  numerosUtilises,
  passageTtx,
  phasesLam,
  proposerNumero,
  signalProche,
  supprimerMissionLam,
  terminerTtx,
  titreMissionLam,
  toutesEtapesLam,
  ttxPossible,
  type MissionLam,
} from './mission';
import { EXERCICES_LAM } from './ordre';
import { QUESTIONS_LAM } from './quiz';
import { URGENCES } from './urgences';

const ids = (m: MissionLam) => toutesEtapesLam(m).map((e) => e.id);
const etape = (m: MissionLam, id: string) => toutesEtapesLam(m).find((e) => e.id === id)!;
/** Fait toutes les étapes jusqu'à `jusqua` exclu (les dépêches avec des numéros). */
const avancer = (m: MissionLam, jusqua: string) => {
  for (const e of toutesEtapesLam(m)) {
    if (e.id === jusqua) break;
    if (e.facultative) continue;
    m = e.depeche ? noterDepeche(m, { avec: 'CCh', objet: e.texte, recu: '41', donne: proposerNumero(numerosUtilises(m)) }, e) : cocherLam(m, e, true);
  }
  return m;
};

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

describe('mission AP LAM', () => {
  it('vérifications de l’engin, puis mise en voie, puis mise hors voie jusqu’à la consigne rendue', () => {
    const m = nouvelleMissionLam({ type: 'lam' });
    expect(phasesLam(m).map((p) => p.id)).toEqual(['avant', 'verif', 'mev', 'mhv']);
    const l = ids(m);
    expect(l.indexOf('agres')).toBeLessThan(l.indexOf('mev-arf'));
    expect(l.indexOf('mev-arf')).toBeLessThan(l.indexOf('mev'));
    expect(l.indexOf('renseigner')).toBeLessThan(l.indexOf('mev'));
    expect(l.at(-1)).toBe('restituer');
    expect(l).not.toContain('pn-route');
  });

  it('mise en voie au PN : mesures vis-à-vis de la route, puis réouverture', () => {
    const l = ids(nouvelleMissionLam({ type: 'lam', pn: true }));
    expect(l.indexOf('pn-route')).toBeLessThan(l.indexOf('mev'));
    expect(l.indexOf('mev')).toBeLessThan(l.indexOf('pn-ouvrir'));
  });

  it('rendre la consigne en premier ne termine pas la mission', () => {
    let m = nouvelleMissionLam({ type: 'lam' });
    m = cocherLam(m, etape(m, 'restituer'), true);
    expect(m.fin).toBeNull();
    m = nouvelleMissionLam({ type: 's9', outils: ['sam'] });
    m = noterDepeche(m, { avec: 'RPTx', objet: 'Retrait', recu: '11', donne: '55' }, etape(m, 'confirme-retrait'));
    expect(m.fin).toBeNull();
  });

  it('« pendant » après la mise en voie ; la consigne rendue termine la mission', () => {
    let m = avancer(nouvelleMissionLam({ type: 'lam' }), 'mhv-duree');
    expect(avancementLam(m).pendant).toBe(true);
    expect(avancementLam(m).prochaine?.id).toBe('mhv-duree');
    m = avancer(m, '__fin__');
    expect(m.fin).toBeGreaterThan(0);
    expect(avancementLam(m).pendant).toBe(false);
    expect(avancementLam(m).prochaine).toBeNull();
  });
});

describe('mission AP S9', () => {
  it('les étapes suivent les outils de la fiche de travail', () => {
    const dshSam = ids(nouvelleMissionLam({ type: 's9', outils: ['dsh', 'sam'] }));
    expect(dshSam).toEqual(expect.arrayContaining(['epi', 'dsh-lieu', 'dsh-verif', 'dsh-pose', 'sam-pose', 'dsh-retrait', 'sam-retrait']));
    expect(dshSam).not.toContain('cmb-ferme');
    expect(dshSam.indexOf('ordre-pose')).toBeLessThan(dshSam.indexOf('dsh-pose'));
    expect(dshSam.indexOf('dsh-pose')).toBeLessThan(dshSam.indexOf('confirme-pose'));
    const cmb = ids(nouvelleMissionLam({ type: 's9', outils: ['cmb'] }));
    expect(cmb).toEqual(expect.arrayContaining(['cmb-ferme', 'cmb-cadenas', 'cmb-ouvre']));
    expect(cmb).not.toContain('epi');
    expect(cmb.at(-1)).toBe('confirme-retrait');
  });

  it('passage d’un TTx : pinces, pétard, SAM, puis SAM, pétard, pinces', () => {
    const m = nouvelleMissionLam({ type: 's9', outils: ['dsh', 'sam'] });
    expect(passageTtx(m).map((e) => e.id)).toEqual(['accord', 'pinces', 'petard', 'sam', 'cr-retrait', 'passe', 'sam-remis', 'petard-remis', 'pinces-remises', 'cr-remise']);
    expect(passageTtx(nouvelleMissionLam({ type: 's9', outils: ['dsh'] })).map((e) => e.id)).not.toContain('sam');
    expect(ttxPossible(m)).toBe(true);
    expect(ttxPossible(nouvelleMissionLam({ type: 's9', outils: ['cmb', 'obs'] }))).toBe(false);
    expect(ttxPossible(nouvelleMissionLam({ type: 'lam' }))).toBe(false);
  });

  it('un passage de TTx : dépêches au carnet, compteur et journal', () => {
    let m = demarrerTtx(nouvelleMissionLam({ type: 's9', outils: ['dsh', 'sam'] }));
    m = depecheTtx(m, { avec: 'RPTx', objet: 'Accord TTx', recu: '26', donne: '39' }, 'accord');
    m = cocherGesteTtx(m, 'pinces', true);
    expect(m.depeches).toHaveLength(1);
    expect(m.enCours?.faits.accord).toBeGreaterThan(0);
    expect(m.enCours?.faits.pinces).toBeGreaterThan(0);
    const r = terminerTtx(m);
    expect(r.m.ttx).toBe(1);
    expect(r.m.enCours).toBeNull();
    expect(r.texte).toMatch(/^Passage du train travaux n° 1 \(de \d{2}:\d{2} à \d{2}:\d{2}\)$/);
  });

  it('titre court', () => {
    expect(titreMissionLam(nouvelleMissionLam({ type: 's9', bouclage: 'A3', lieu: { ligne: '830000', ligneNom: null, pk: 47.2, voie: '1', lieu: '' } }))).toBe('AP S9 · A3 · ligne 830 000');
    expect(titreMissionLam(nouvelleMissionLam({ type: 'lam' }))).toBe('AP LAM');
  });
});

describe('carnet de dépêches', () => {
  it('numéro proposé : deux chiffres, jamais à moins de 3 d’un numéro déjà échangé', () => {
    const pris = ['93', '24', '45', '36'];
    for (let k = 0; k < 300; k++) {
      const n = Number(proposerNumero(pris));
      expect(n).toBeGreaterThanOrEqual(10);
      expect(n).toBeLessThanOrEqual(99);
      for (const x of pris) expect(Math.abs(n - Number(x))).toBeGreaterThan(2);
    }
    // Hasard « collé » sur un numéro pris : on en cherche un autre.
    let i = 0;
    const seq = [93 - 10, 94 - 10, 60 - 10].map((v) => (v + 0.5) / 90);
    expect(proposerNumero(['93'], () => seq[i++ % seq.length])).toBe('60');
  });

  it('une dépêche qui valide une étape la coche, et part au journal avec ses numéros', () => {
    let m = nouvelleMissionLam({ type: 's9', outils: ['sam'] });
    m = noterDepeche(m, { avec: 'RPTx', objet: 'Ordre de mise en place du bouclage A3', recu: '93', donne: '24' }, etape(m, 'ordre-pose'));
    expect(m.faits['ordre-pose']).toBeGreaterThan(0);
    expect(m.depeches[0]).toMatchObject({ avec: 'RPTx', recu: '93', donne: '24', etape: 'ordre-pose' });
    expect(m.journal.at(-1)?.note).toBe('RPTx · reçu 93 · donné 24');
    expect(numerosUtilises(m)).toEqual(['93', '24']);
    // Décocher l'étape garde la dépêche et ses numéros, marqués annulés (les numéros restent pris).
    m = cocherLam(m, etape(m, 'ordre-pose'), false);
    expect(m.depeches).toHaveLength(1);
    expect(m.depeches[0].annulee).toBeGreaterThan(0);
    expect(m.faits['ordre-pose']).toBeUndefined();
    expect(depecheDe(m, 'ordre-pose')).toBeNull();
    expect(numerosUtilises(m)).toEqual(['93', '24']);
    expect(m.journal.at(-1)).toMatchObject({ type: 'annulation' });
    expect(journalTexteLam(m)).toMatch(/\[annulée à \d{2}:\d{2}\]/);
  });

  it('journal partagé : la mission, le carnet puis le journal', () => {
    let m = nouvelleMissionLam({ type: 's9', bouclage: 'A3', outils: ['dsh'], rptx: 'M. Jean' });
    m = noterDepeche(m, { avec: 'RPTx', objet: 'Ordre de mise en place', recu: '93', donne: '24' }, etape(m, 'ordre-pose'));
    const t = journalTexteLam(m);
    expect(t).toContain('AP S9 · A3');
    expect(t).toContain('Outils : Dispositif de shuntage (DSh)');
    expect(t).toContain('RPTx : M. Jean');
    expect(t).toMatch(/Dépêches\n\d{2}:\d{2} · Ordre de mise en place · RPTx · reçu 93 · donné 24/);
  });

  it('enregistre, relit et supprime sur le téléphone', () => {
    const m = nouvelleMissionLam({ type: 'lam', engins: 'Pelle 12' });
    enregistrerMissionLam(m);
    expect(missionLamParId(m.id)?.engins).toBe('Pelle 12');
    supprimerMissionLam(m.id);
    expect(missionLamParId(m.id)).toBeNull();
  });
});

describe('contrôle de pose d’un DSh', () => {
  const pts = [
    [47.035, 'sig_carre', 'Sémaphore 47', '', 2.6, 48.5],
    [47.403, 'pn', 'PN 26', '', 2.6, 48.5],
    [46.5, 'sig_vitesse', 'Pancarte', '', 2.6, 48.5],
  ] as LinePoint[];

  it('signal le plus proche (carrés, sémaphores, manœuvre ; pas les pancartes)', () => {
    expect(signalProche(pts, 47.05)).toMatchObject({ nom: 'Sémaphore 47', distance: 15, devant: false });
    expect(signalProche(pts, 46.5)?.nom).toBe('Sémaphore 47');
    expect(signalProche(undefined, 1)).toBeNull();
  });

  it('LGV interdit ; signal à 30 m ou PN à 3 km à vérifier ; sinon rien de proche', () => {
    const sig = { nom: 'Sémaphore 47', pk: 47.035, distance: 15, devant: false };
    expect(controleDsh({ lgv: true, signal: null, pn: null }).niveau).toBe('interdit');
    const v = controleDsh({ lgv: false, signal: sig, pn: { nom: 'PN 26', distance: 353 } });
    expect(v.niveau).toBe('verifier');
    expect(v.points.map((x) => x.titre)).toEqual(['Sémaphore 47 à 15 m', 'PN 26 à 353 m']);
    expect(controleDsh({ lgv: false, signal: { ...sig, distance: 31 }, pn: { nom: 'PN 26', distance: 3200 } })).toEqual({ niveau: 'ok', points: [] });
    expect(controleDsh({ lgv: false, signal: null, pn: { nom: 'PN 26', distance: 1250 } }).points[0].titre).toBe('PN 26 à 1,3 km');
  });
});

describe('contenu AP LAM / AP S9', () => {
  it('quiz : identifiants uniques et distincts des autres banques, bonne réponse valide', () => {
    const l = QUESTIONS_LAM.map((q) => q.id);
    expect(new Set(l).size).toBe(l.length);
    const autres = new Set([...questionsDe('asp'), ...questionsDe('pn')].map((q) => q.id));
    expect(l.some((id) => autres.has(id))).toBe(false);
    for (const q of QUESTIONS_LAM) {
      expect(new Set(q.choix).size).toBe(q.choix.length);
      expect(q.choix[q.bonne]).toBeTruthy();
    }
    expect(questionsDe('lam')).toBe(QUESTIONS_LAM);
    expect(QUESTIONS_LAM.map((q) => q.id)).toContain(questionDuJour('lam', '2026-11-25').q.id);
  });

  it('mémo, règles, cas pratiques et fiches réflexes bien formés', () => {
    const s = MEMO_LAM.map((x) => x.id);
    expect(new Set(s).size).toBe(s.length);
    expect(s).toEqual(expect.arrayContaining(['lam-urgences', 'lam-aleas', 's9-dsh', 's9-depeches']));
    expect(REGLES_LAM.length).toBeGreaterThanOrEqual(5);
    for (const e of EXERCICES_LAM) expect(new Set(e.etapes).size).toBe(e.etapes.length);
    expect(new Set(URGENCES.map((f) => f.id)).size).toBe(URGENCES.length);
    expect(URGENCES.some((f) => f.pour === 's9')).toBe(true);
  });
});
